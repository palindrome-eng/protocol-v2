import { PublicKey, Keypair, Connection, Commitment } from '@solana/web3.js';
import {
    Markets,
    BN,
    Banks,
    BulkAccountLoader,
    convertToNumber,
    EventSubscriber,
    UserAccount,
    isVariant,
    Wallet,
    DevnetMarkets,
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


const stateCommitment: Commitment = 'confirmed';

async function main() {
    const endpoint = process.env.ENDPOINT;
	const connection = new Connection(endpoint, {
        commitment: stateCommitment,
        // wsEndpoint: "ws://3.220.170.22:8900",
    });
    const config = initialize({ env: 'devnet' });
    const clearingHousePublicKey = new PublicKey(
        config.CLEARING_HOUSE_PROGRAM_ID
    );
	const [wallet, _] = getWallet(process.env.ANCHOR_WALLET);

    // const bulkAccountLoader = new BulkAccountLoader(connection, 'confirmed', 1000);
    const clearingHouse = new ClearingHouse({
        connection,
        wallet: wallet,
        programID: clearingHousePublicKey,
        env: 'devnet',
        accountSubscription: {
			type: 'websocket',
        },
        marketIndexes: Markets['devnet'].map(market => market.marketIndex),
        bankIndexes: Banks['devnet'].map(bank => bank.bankIndex),
        // oracleInfos ?? []
        // accountSubscription: {
        //     type: 'polling',
        //     accountLoader: bulkAccountLoader,
        // }
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
                    type: 'websocket',
                },
                clearingHouse,
                userAccountPublicKey,
            });
            if (!await chUser.subscribe()) {
                throw new Error('Failed to subscribe to user account');
            }
            await clearingHouse.fetchAccounts();
            await chUser.fetchAccounts();

            for (const bank of Banks["devnet"]) {
                const assetValue = chUser.getBankAssetValue(bank.bankIndex);
                console.log(`${bank.symbol}: ${assetValue.toString()}`);
            }

            const logMsg = `UserAccount ${userAccountPublicKey.toBase58()}, authority: ${u.authority.toBase58()}, nextOrderId: ${u.nextOrderId.toString()}:`;
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
