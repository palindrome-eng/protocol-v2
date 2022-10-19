import * as anchor from '@project-serum/anchor';
import { AnchorProvider } from '@project-serum/anchor';
import { PublicKey, clusterApiUrl } from '@solana/web3.js';
import {
    BN,
    BulkAccountLoader,
    convertToNumber,
    EventSubscriber,
    UserAccount,
    fetchUserAccounts,
 } from '../sdk/src';

import dotenv = require('dotenv');
import { initialize } from '../sdk/src';
import {
    DevnetMarkets,
    BASE_PRECISION,
    QUOTE_PRECISION,
    ClearingHouse,
} from '../sdk/src';
dotenv.config();


async function liquidatorer(provider: AnchorProvider) {
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
		console.error(`ClearingHouseUser for ${provider.wallet.publicKey} does not exist`);
        console.info(`Creating ClearingHouseUser for ${provider.wallet.publicKey}`);
        const [txSig] = await clearingHouse.initializeUserAccount();
        console.log(`Initialized user account in transaction: ${txSig}`);
	}

    clearingHouse.getOracleDataForMarket(new BN(0));

    const keyToSymbol = new Map<string, string>();
    const marketIndexToSymbol = new Map<number, string>();
    for (const market of DevnetMarkets) {
        keyToSymbol.set(market.oracle.toBase58(), market.baseAssetSymbol);
        marketIndexToSymbol.set(market.marketIndex.toNumber(), market.symbol);
    }

    // const userKeyWant: PublicKey | undefined = undefined;
    // const userKeyWant: PublicKey | undefined = new PublicKey("DJwD8T2TKev7asmcvPyU9BUhTsjH5yZYEwoKDoHHcicu"); // my whale painter
    // const userKeyWant: PublicKey | undefined = new PublicKey("2m55odw9r3Ab5sG8gJihM5nQWfk6bKAcF4yeUSSWabJt")
    // const userKeyWant: PublicKey | undefined = new PublicKey("C21j521vsRSAYyncMpgcBUcvyevVXK4v8BT8PRhxk4ix")

    // liq 1
    // const userKeyWant: PublicKey | undefined = new PublicKey("9JkHYWfdeX6dMGhdUndjt5K9gy1BfuxSdy3MNZwPgUE2")
    // liq 2
    const userKeyWant: PublicKey | undefined = new PublicKey("H4JY8ahYZG2GEGYLmnFjf321SzGu3yaX5EtUEAgkrb4p");
    
    
    const run = async () => {
        await clearingHouse.fetchAccounts();
        await clearingHouse.getUser().fetchAccounts();

        const programAccounts = await clearingHouse.program.account.user.all();
        for await (const programAccount of programAccounts) {
            // @ts-ignore
            const u: UserAccount = programAccount.account;
            const userAccountPublicKey = programAccount.publicKey;

            if (userKeyWant && !userAccountPublicKey.equals(userKeyWant)) {
                continue;
            }

            console.log("");
            console.log(`${new Date(Date.now())}`);
            // @ts-ignore
            console.log(`UserAccount ${userAccountPublicKey.toBase58()}, authority: ${u.authority.toBase58()}, nextOrderId: ${u.nextOrderId.toString()}:`);

            const allSubaccounts = await fetchUserAccounts(connection, clearingHouse.program, u.authority);
            for (let i = 0; i < allSubaccounts.length; i++) {
                const s = allSubaccounts[i];
                if (!s) {
                    continue;
                }
                const chUser = clearingHouse.createUser(
                    s.userId,
                    // { type: 'websocket' })
                    {
                        type: 'polling',
                        accountLoader: bulkAccountLoader,
                    });
                clearingHouse.addUser(s.userId);
                await chUser.subscribe();
                await chUser.fetchAccounts();

                console.log(` [Subaccount ${i}, userId: ${s.userId}], (chUser.isSubscribed? ${chUser.isSubscribed}):`);

                // resolve this promise flag event is received
                // chUser.eventEmitter.on("update", async () => {
                    // console.log("got something")

                    // console.log(`   collat: ${convertToNumber(s.collateral, QUOTE_PRECISION)}`)
                    // console.log(`   collatV: ${convertToNumber(chUser.getCollateralValue(), QUOTE_PRECISION)}`)
                    // console.log(`   unsettled pnl: ${convertToNumber(chUser.getUnsettledPNL(), QUOTE_PRECISION)}`)
                    // console.log(`   unrealized pnl: ${convertToNumber(chUser.getUnrealizedPNL(), QUOTE_PRECISION)}`)

                    console.log(` . Open positions:`);
                    let openPos = 0;
                    for await (const p of s.positions) {
                        if (p.baseAssetAmount.isZero()) {
                            continue;
                        }
                        console.log(` .   [${openPos}]: mkt: ${p.marketIndex.toString()}, base: ${convertToNumber(p.baseAssetAmount, BASE_PRECISION)}, unsetteldpnl: ${convertToNumber(p.unsettledPnl, QUOTE_PRECISION)}`);
                        openPos++;
                    }
                    console.log(` . open position count: ${openPos}`);


                    // chUser.eventEmitter.removeAllListeners("update");
                // })

                // console.log("waiitng")
                // while (!done) {
                //     // sleep 5s, wait for event
                //     await sleep(1000);
                // }
                // console.log("done")

            }
            console.log(`subaccts: [${allSubaccounts.length}]`);


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
                console.log(` . quoteEntryAmount: ${p.quoteEntryAmount.toString()}`);
                console.log(` . lastCumulativeFundingRate: ${p.lastCumulativeFundingRate.toString()}`);
                console.log(` . unsettledPnL:              ${p.unsettledPnl.toString()}`);
                // console.log(` . openOrders: ${p.openOrders}`);
                console.log(` . openBids: ${p.openBids.toString()}`);
                console.log(` . openAsks: ${p.openAsks.toString()}`);
                openPositions++;


                // liquidate position?
                const remainingAccounts = clearingHouse.getRemainingAccountsForLiquidation({
                    writableMarketIndex: p.marketIndex,
                    userAccount: u,
                });
                const ix = await clearingHouse.getLiquidatePerpIx(userAccountPublicKey, u, p.marketIndex, p.baseAssetAmount)

                try {
                    const simRes = await provider.simulate(
                        wrapInTx(ix),
                        [],
                        'confirmed',
                        remainingAccounts.map((a: AccountMeta): PublicKey => {return a.pubkey}),
                        )
                    console.log("liquidation sim success, send actual liq tx now")
                    console.log(simRes);
                } catch (e) {
                    console.error("liquidation sim fail!")

                    try {
                        const tx = await provider.sendAndConfirm(
                            wrapInTx(ix),
                            [],
                            {
                                commitment:'confirmed',
                            }
                        )
                        console.log(`uhh wtf? ${tx}`);
                    } catch (ee) {
                        console.log(`tx send error:`);
                        console.error(ee);
                    }

                    console.error(e)
                }
            }
            console.log(`Open positions: ${openPositions}`);
            */
        }
    };

    await run();
    // setInterval(run, 1000);
}


try {
    if (!process.env.ANCHOR_WALLET) {
        throw new Error('ANCHOR_WALLET must be set.');
    }
    liquidatorer(
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