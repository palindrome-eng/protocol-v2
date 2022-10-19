import * as anchor from '@project-serum/anchor';
import { PublicKey, clusterApiUrl, Commitment, Connection } from '@solana/web3.js';
import {
    getVariant,
    BN,
    BulkAccountLoader,
    convertToNumber,
    EventSubscriber,
    UserAccount,
    isVariant,
    initialize,
    MARK_PRICE_PRECISION,
    BASE_PRECISION,
    ClearingHouse,
    PerpMarkets,
} from '@drift-labs/sdk';

import dotenv = require('dotenv');
dotenv.config();

import {
    getWallet,
} from './utils';

const stateCommitment: Commitment = 'confirmed';
const env = 'devnet';

async function main() {
    const endpoint = process.env.ENDPOINT!;
	const connection = new Connection(endpoint, stateCommitment);
    const config = initialize({ env });
    const clearingHousePublicKey = new PublicKey(
        config.CLEARING_HOUSE_PROGRAM_ID
    );
	const [wallet, _] = getWallet(process.env.ANCHOR_WALLET!);

    const bulkAccountLoader = new BulkAccountLoader(connection, 'confirmed', 1000);
    const clearingHouse = new ClearingHouse({
        connection,
        wallet: wallet,
        programID: clearingHousePublicKey,
        env,
        // accountSubscription: {
		// 	type: 'websocket',
        // }
        accountSubscription: {
            type: 'polling',
            accountLoader: bulkAccountLoader,
        }
    });
    console.log(`clearinghouse user: ${clearingHousePublicKey}`);

    const eventSubscriber = new EventSubscriber(connection, clearingHouse.program, {
        maxTx: 8192,
        maxEventsPerType: 4096,
        orderBy: 'blockchain',
        orderDir: 'desc',
        commitment: 'confirmed',
        logProviderConfig: {
            type: 'websocket',
        },
    });

    if (!await clearingHouse.subscribe()) {
        throw new Error("fail clearingHouse.subscribe");
    }
    if (!await clearingHouse.accountSubscriber.subscribe()) {
        throw new Error("fail clearingHouse.accountSubscriber.subscribe");
    }
	if (!eventSubscriber.subscribe()) {
        throw new Error("fail eventSubscriber.subscribe");
    }

	if (!(await clearingHouse.getUser().exists())) {
		console.error(`ClearingHouseUser for ${wallet.publicKey} does not exist`);
        console.info(`Creating ClearingHouseUser for ${wallet.publicKey}`);
        const [txSig] = await clearingHouse.initializeUserAccount();
        console.log(`Initialized user account in transaction: ${txSig}`);
	}

    clearingHouse.getOracleDataForMarket(new BN(0));

    const keyToSymbol = new Map<string, string>();
    const marketIndexToSymbol = new Map<number, string>();
    // TODO: SPOTS
    for (const market of PerpMarkets[env]) {
        keyToSymbol.set(market.oracle.toBase58(), market.baseAssetSymbol);
        marketIndexToSymbol.set(market.marketIndex.toNumber(), market.symbol);
    }

    const userKeyWant: PublicKey | undefined = undefined;
    // const userKeyWant: PublicKey | undefined = new PublicKey("DJwD8T2TKev7asmcvPyU9BUhTsjH5yZYEwoKDoHHcicu"); // my whale painter
    // const userKeyWant: PublicKey | undefined = new PublicKey("2m55odw9r3Ab5sG8gJihM5nQWfk6bKAcF4yeUSSWabJt")
    // const userKeyWant: PublicKey | undefined = new PublicKey("C21j521vsRSAYyncMpgcBUcvyevVXK4v8BT8PRhxk4ix")
    // const userKeyWant: PublicKey | undefined = new PublicKey("9JkHYWfdeX6dMGhdUndjt5K9gy1BfuxSdy3MNZwPgUE2")
    
    
    const run = async () => {
        await clearingHouse.fetchAccounts();
        await clearingHouse.getUser().fetchAccounts();

        let totalOpenOrders = 0;
        const programAccounts = await clearingHouse.program.account.user.all();
        for await (const programAccount of programAccounts) {
            // @ts-ignore
            const u: UserAccount = programAccount.account;
            const userAccountPublicKey = programAccount.publicKey;

            if (userKeyWant && !userAccountPublicKey.equals(userKeyWant)) {
                continue;
            }

            // console.log("")
            // console.log(`${new Date(Date.now())}`)
            // @ts-ignore
            let logMsg = `UserAccount ${userAccountPublicKey.toBase58()}, authority: ${u.authority.toBase58()}, nextOrderId: ${u.nextOrderId.toString()}:\n`;

            let openOrders = 0;
            logMsg += "Open orders:\n";
            for (const o of u.orders) {
                if (isVariant(o.status, "init")) {
                    continue;
                }

                const orderAgeS = (new Date()).getTime() / 1000.0 - o.ts.toNumber();
                const baseAssetAmount = convertToNumber(o.baseAssetAmount, BASE_PRECISION);
                const baseAssetAmountFilled = convertToNumber(o.baseAssetAmountFilled, BASE_PRECISION);
                const price = convertToNumber(o.price, MARK_PRICE_PRECISION);
                const priceOffset = convertToNumber(o.oraclePriceOffset, MARK_PRICE_PRECISION);
                const triggerPrice = convertToNumber(o.triggerPrice, MARK_PRICE_PRECISION);
                const oraclePriceData = clearingHouse.getOracleDataForMarket(o.marketIndex);
                const oraclePrice = convertToNumber(oraclePriceData.price, MARK_PRICE_PRECISION);
                const triggerCond = getVariant(o.triggerCondition);
                let warnFlags = '';
                if (isVariant(o.orderType, "limit")) {
                    if (isVariant(o.direction, 'long')) {
                        if (price > oraclePrice) {
                            warnFlags += `  <== should fill lim. long`;
                        }
                    } else {
                        if (price < oraclePrice) {
                            warnFlags += `  <== should fill lim. short`;
                        }
                    }
                } else if (isVariant(o.orderType, "market")) {
                    warnFlags += `  <== MARKET!`;
                }
                u.nextOrderId;
                logMsg += ` . [${getVariant(o.marketType)} - ${o.orderId.toString()},\t${getVariant(o.orderType)}, ${getVariant(o.direction)}, mktIdx: ${o.marketIndex.toString()}]: \torder age: ${orderAgeS.toFixed(4)}s\tBAA: ${baseAssetAmountFilled.toString()}/${baseAssetAmount.toString()},\t\tp: ${price.toString()}, offsetP: ${priceOffset}, trigP: ${triggerPrice.toString()}, trigCon: ${triggerCond}, oracle: ${oraclePrice.toString()} ${warnFlags}\n`;
                openOrders++;
            }
            totalOpenOrders += openOrders;
            logMsg += `count: ${openOrders}\n`;
            if (openOrders > 0) {
                console.log(logMsg);
            }

            /*
            let openPositions = 0;
            console.log("Open positions:");
            for (const p of u.positions) {
                if (p.baseAssetAmount.isZero()) {
                    continue;
                }
                console.log(` [${marketIndexToSymbol.get(p.marketIndex.toNumber())}]`);
                console.log(` . baseAssetAmount:  ${p.baseAssetAmount.toString()}`);
                console.log(` . quoteAssetAmount: ${p.quoteAssetAmount.toString()}`);
                console.log(` . quoteEntryAmount: ${p.quot.toString()}`);
                console.log(` . lastCumulativeFundingRate: ${p.lastCumulativeFundingRate.toString()}`);
                console.log(` . openOrders: ${p.openOrders}`);
                console.log(` . openBids: ${p.openBids.toString()}`);
                console.log(` . openAsks: ${p.openAsks.toString()}`);
                openPositions++;
            }
            console.log(`count: ${openPositions}`);
            */
        }
        console.log(`total open orders count: ${totalOpenOrders}`);
        console.log("===========================================");
    };

    await run();
    setInterval(run, 3000);
    return;
}


try {
    if (!process.env.ANCHOR_WALLET) {
        throw new Error('ANCHOR_WALLET must be set.');
    }
    main(
        // anchor.AnchorProvider.local(clusterApiUrl("devnet"), {
        //     anchor.AnchorProvider.local('http://3.220.170.22:8899', {
        //     preflightCommitment: 'confirmed',
        //     skipPreflight: false,
        //     commitment: 'confirmed',
        // })
    );
    // anchor.AnchorProvider.local('https://psytrbhymqlkfrhudd.dev.genesysgo.net:8899/');
} catch (e) {
   console.error(e);
}
