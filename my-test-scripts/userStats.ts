import { PublicKey, Commitment, Connection } from '@solana/web3.js';
import {
    BulkAccountLoader,
    initialize,
    ClearingHouse,
 } from '@drift-labs/sdk';

import dotenv = require('dotenv');
dotenv.config();

import {
    airdropTokens,
    getWallet,
    sleep,
    printUserAccount,
} from './utils';

const stateCommitment: Commitment = 'confirmed';

async function main() {
    const endpoint = process.env.ENDPOINT!;
	const connection = new Connection(endpoint, stateCommitment);
    const config = initialize({ env: 'devnet' });
    const clearingHousePublicKey = new PublicKey(
        config.CLEARING_HOUSE_PROGRAM_ID
    );

    const [wallet, keypair] = getWallet(process.env.ANCHOR_WALLET!);
    const bulkAccountLoader = new BulkAccountLoader(connection, 'confirmed', 500);
    const clearingHouse = new ClearingHouse({
        connection,
        wallet: wallet,
        programID: clearingHousePublicKey,
        env: 'devnet',
        accountSubscription: {
            type: 'polling',
            accountLoader: bulkAccountLoader,
        }
    });

    if (!await clearingHouse.subscribe()) {
        throw new Error("fail to clearing house");
    }

    const clearingHouseUser = clearingHouse.getUser();
    if (!await clearingHouseUser.subscribe()) {
        throw new Error("failed to subscribe to clearing house user");
    }

    console.log(`clearingHouse program:      ${clearingHouse.program.programId.toBase58()}`);
    console.log(`clearingHouse state pubkey: ${(await clearingHouse.getStatePublicKey()).toBase58()}`);
    console.log(`clearingHouseUser pubkey:   ${clearingHouseUser.userAccountPublicKey.toBase58()}`);

    console.log("");
    // TODO: spot markets
    // console.log("User bank balances:");
    // for (let i = 0; i < DevnetBanks.length; i += 1) {
    //     const bank = DevnetBanks[i];
    //     const balance = clearingHouse.getUserBankBalance(i);
    //     const balanceStr = convertToNumber(balance?.balance, QUOTE_PRECISION).toFixed(4);
    //     console.log(`[${bank.bankIndex.toNumber()}]: ${bank.symbol}, mint: ${bank.mint.toString()}, balance: ${balanceStr}`);
    // }

    printUserAccount(clearingHouse);

   await clearingHouse.unsubscribe();
}

try {
   if (!process.env.ANCHOR_WALLET) {
      throw new Error('ANCHOR_WALLET must be set.');
   }
   main();
} catch (e) {
   console.error(e);
}
