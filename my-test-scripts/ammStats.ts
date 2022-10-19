import * as anchor from '@project-serum/anchor';
import { AnchorProvider } from '@project-serum/anchor';
import { PublicKey, clusterApiUrl } from '@solana/web3.js';
import {
    BN,
    BulkAccountLoader,
    convertToNumber,
    calculateBidAskPrice,
    UserAccount,
 } from '../sdk/src';

import dotenv = require('dotenv');
import { initialize } from '../sdk/src';
import {
    DevnetMarkets,
    MARK_PRICE_PRECISION,
    ClearingHouse,
} from '../sdk/src';
dotenv.config();

async function oracleViewer(provider: AnchorProvider) {
    const connection = provider.connection;
    const config = initialize({ env: 'devnet' });
    const clearingHousePublicKey = new PublicKey(
        config.CLEARING_HOUSE_PROGRAM_ID
    );

    const bulkAccountLoader = new BulkAccountLoader(connection, 'confirmed', 1000);
    const clearingHouse = new ClearingHouse({
        connection,
        wallet: provider.wallet,
        programID: clearingHousePublicKey,
        env: 'devnet',
        // accountSubscription: {
		// 	type: 'websocket',
        // }
        accountSubscription: {
            type: 'polling',
            accountLoader: bulkAccountLoader,
        }
    });

    if (!await clearingHouse.subscribe()) {
        throw new Error("fail to clearing house");
    }
    await clearingHouse.accountSubscriber.subscribe();
    clearingHouse.getOracleDataForMarket(new BN(0));

    const keyToSymbol = new Map<string, string>();
    const marketIndexToSymbol = new Map<number, string>();
    for (const market of DevnetMarkets) {
        keyToSymbol.set(market.oracle.toBase58(), market.baseAssetSymbol);
        marketIndexToSymbol.set(market.marketIndex.toNumber(), market.symbol);
    }

    // clearingHouse.eventEmitter.on("oraclePriceUpdate", (publicKey: PublicKey, data: OraclePriceData) => {
    //     const s = keyToSymbol.get(publicKey.toBase58());
    //     console.log(`[${data.slot}: ${new Date().toISOString()}]: ${s}: $${convertToNumber(data.price, MARK_PRICE_PRECISION).toFixed(4)} (twap: $${convertToNumber(data?.twap, MARK_PRICE_PRECISION).toFixed(4)})`);
    //     // console.log(`oracle update: ${publicKey.toBase58()}`)
    //     // console.log(`  price: ${convertToNumber(data.price, MARK_PRICE_PRECISION).toFixed(4)}`)
    //     // console.log(`  slot: ${data.slot}: ${new Date().toISOString()}`)
    //     // console.log(`  confidence: ${data.confidence.toString()}`);
    //     // console.log(`  twap: ${convertToNumber(data?.twap, MARK_PRICE_PRECISION).toFixed(4)}`);
    //     // console.log(`  twap confidence: ${data.twapConfidence?.toString()}`);
    //     // console.log(`  has sufficient datapoints: ${data.hasSufficientNumberOfDataPoints}`);
    // })

    // const userKeyWant = new PublicKey("DJwD8T2TKev7asmcvPyU9BUhTsjH5yZYEwoKDoHHcicu"); // my whale painter
    const userKeyWant = new PublicKey("2m55odw9r3Ab5sG8gJihM5nQWfk6bKAcF4yeUSSWabJt");
    
    const run = async () => {
        await clearingHouse.fetchAccounts();
        console.log("");
        for await (const market of clearingHouse.getMarketAccounts()) {
            console.log(`[${marketIndexToSymbol.get(market.marketIndex.toNumber())}]:}`);
            console.log(` . baseAssetAmount:      ${market?.baseAssetAmount?.toString()}`);
            console.log(` . baseAssetAmountLong:  ${market.baseAssetAmountLong.toString()}`);
            console.log(` . baseAssetAmountShort: ${market.baseAssetAmountShort.toString()}`);
            console.log(` . marginRatioInitial:     ${market.marginRatioInitial.toString()}`);
            console.log(` . marginRatioMaintenance: ${market.marginRatioMaintenance.toString()}`);
            console.log(` . marginRatioPartial:     ${market.marginRatioPartial.toString()}`);

            const oracle = clearingHouse.getOracleDataForMarket(market.marketIndex);
            const [bidPrice, askPrice] = calculateBidAskPrice(market.amm, oracle);
            console.log(` vBid price: $${convertToNumber(bidPrice, MARK_PRICE_PRECISION).toFixed(4)}`);
            console.log(` vask price: $${convertToNumber(askPrice, MARK_PRICE_PRECISION).toFixed(4)}`);
        }
        console.log(`${clearingHouse.getStateAccount()}`);


        const programAccounts = await clearingHouse.program.account.user.all();
        for (const programAccount of programAccounts) {
            // @ts-ignore
            const u: UserAccount = programAccount.account;
            const userAccountPublicKey = programAccount.publicKey;

            if (!userAccountPublicKey.equals(userKeyWant)) {
                continue;
            }

            console.log(`UserAccount ${userAccountPublicKey.toBase58()}:`);
            clearingHouse.program.account;

            for (const p of u.positions) {
                // if (p.baseAssetAmount.isZero()) {
                //     continue;
                // }
                console.log(`[${marketIndexToSymbol.get(p.marketIndex.toNumber())}] Position:`);
                console.log(` . baseAssetAmount:  ${p.baseAssetAmount.toString()}`);
                console.log(` . quoteAssetAmount: ${p.quoteAssetAmount.toString()}`);
                console.log(` . quoteEntryAmount: ${p.quoteEntryAmount.toString()}`);
                console.log(` . lastCumulativeFundingRate: ${p.lastCumulativeFundingRate.toString()}`);
                console.log(` . unsettledPnL:              ${p.unsettledPnl.toString()}`);
                console.log(` . openOrders: ${p.openOrders}`);
                console.log(` . openBids: ${p.openBids.toString()}`);
                console.log(` . openAsks: ${p.openAsks.toString()}`);
            }
        }
    };

    run();
    setInterval(run, 10000);
}


try {
    if (!process.env.ANCHOR_WALLET) {
        throw new Error('ANCHOR_WALLET must be set.');
    }
    oracleViewer(
        anchor.AnchorProvider.local(clusterApiUrl("devnet"), {
            // anchor.AnchorProvider.local('https://devnet.genesysgo.net', {
            preflightCommitment: 'confirmed',
            skipPreflight: false,
            commitment: 'confirmed',
        })
    );
    // anchor.AnchorProvider.local('https://psytrbhymqlkfrhudd.dev.genesysgo.net:8899/');
} catch (e) {
   console.error(e);
}