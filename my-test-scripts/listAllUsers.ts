import { PublicKey, Keypair, Connection, Commitment } from '@solana/web3.js';
import {
    BN,
    BulkAccountLoader,
    convertToNumber,
    EventSubscriber,
    UserAccount,
    isVariant,
    Wallet,
    PerpMarkets,
    SpotMarkets,
    PRICE_PRECISION,
    BASE_PRECISION,
    ClearingHouse,
    initialize,
    ClearingHouseUser,
//  } from '../sdk/src';
 } from '@drift-labs/sdk';

import {
    getWallet,
} from './utils';

import dotenv = require('dotenv');
dotenv.config();

const driftEnv = 'devnet';

const stateCommitment: Commitment = 'confirmed';

async function main() {
    const endpoint = process.env.ENDPOINT;
	const connection = new Connection(endpoint!, stateCommitment);
    const config = initialize({ env: driftEnv });
    const clearingHousePublicKey = new PublicKey(
        config.CLEARING_HOUSE_PROGRAM_ID
    );
	const [wallet, _] = getWallet(process.env.ANCHOR_WALLET!);

    const bulkAccountLoader = new BulkAccountLoader(connection, 'confirmed', 1000);
    const clearingHouse = new ClearingHouse({
        connection,
        wallet: wallet,
        programID: clearingHousePublicKey,
        env: driftEnv,
        // accountSubscription: {
		// 	type: 'websocket',
        // }
        accountSubscription: {
            type: 'polling',
            accountLoader: bulkAccountLoader,
        }
    });
    await clearingHouse.subscribe();

    console.log(`ClearingHouse ProgramId: ${clearingHousePublicKey.toString()}`);
    console.log(`RPC endpoint           : ${connection.rpcEndpoint}`);

    
    const run = async () => {

        const programAccounts = await clearingHouse.program.account.user.all();
        for await (const programAccount of programAccounts) {
            // @ts-ignore
            const u: UserAccount = programAccount.account;
            const userAccountPublicKey = programAccount.publicKey;

            const chUser = new ClearingHouseUser({
                accountSubscription: {
                    type: 'polling',
                    accountLoader: bulkAccountLoader,
                },
                clearingHouse,
                userAccountPublicKey,
            });
            await chUser.subscribe();
            await bulkAccountLoader.load();

            for (const market of SpotMarkets["devnet"]) {
                const assetValue = chUser.getSpotMarketAssetValue(market.marketIndex);
                console.log(`${market.symbol}: ${convertToNumber(assetValue, market.precision).toString()}`);
            }

            const logMsg = `UserAccount ${userAccountPublicKey.toBase58()}, authority: ${u.authority.toBase58()}, nextOrderId: ${u.nextOrderId.toString()}:`;
            console.log(`oracle slot: ${clearingHouse.getOracleDataForMarket(0).slot.toString()}`);
            console.log(logMsg);

        }
    };

    await run();
    return;
}


try {
	if (!process.env.ANCHOR_WALLET) {
		throw new Error(
			'Must set environment variable ANCHOR_WALLET with the path to a id.json or a list of commma separated numbers'
		);
	}
    if (!process.env.ENDPOINT) {
        throw new Error('ENDPOINT must be set.');
    }
    main();
} catch (e) {
   console.error(e);
}
