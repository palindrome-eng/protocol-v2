import { PublicKey, Connection, Commitment } from '@solana/web3.js';
import {
    BulkAccountLoader,
    ClearingHouse,
    initialize,
 } from '@drift-labs/sdk';

import {
    getWallet,
    sleep,
    printUserSOLBalance,
    printUserSPLBalances,
} from './utils';

import dotenv = require('dotenv');
dotenv.config();

const stateCommitment: Commitment = 'confirmed';
const env = 'devnet';
let initMsg = false;

// normally passed in process.env.ANCHOR_WALLET
const privateKeysToInit = [
    // "/Users/ww/.config/solana/arbJEWqPDYfgTFf3CdACQpZrk56tB6z7hPFc6K9KLUi.json",

    "/Users/ww/.config/solana/bbuUv99ePgHogpjjNemdmoRH7YRquFzyxegKaLsL3ez.json",
    "/Users/ww/.config/solana/botdd4FXGoNzvAzGnN8zVVDCELdLUX6K5wsXdrS3Dd3.json",

    "/Users/ww/.config/solana/ww18NdhuLSQPCrHSx7V68eZJpe2y311heWeXJfSmP3Q.json",
    "/Users/ww/.config/solana/ww2z7N9TG1PLLUQGQF2VKzCFaPtQ5FBhRfeEAuy6c5C.json",
    "/Users/ww/.config/solana/ww3StJtTubhwssqAhvSSAc5ifCgKjzmF8hz7Gt2DmSa.json",
    "/Users/ww/.config/solana/wi118WNNuZGLqgrznHDwzDnHKKmMCQmCyDGQCMRbZdj.json",

    "/Users/ww/.config/solana/bot1ABJRcrt72TbXeb5wMxoqzy54CrhTnyAXstZEM82.json",
    "/Users/ww/.config/solana/bot2RzYy9oY5s3z71Yubo4MmRxyDBQP3qNNCqyqLcPp.json",
    "/Users/ww/.config/solana/1iq1fy8Py4LJWg4GzWRDgDZMusNdJKnpzjk9nSLhCMN.json",
    "/Users/ww/.config/solana/j1tCTP7viuKJvbVPpY7zpVDYTXj18gMghqZULt8RZJJ.json",
    "/Users/ww/.config/solana/mm124NrWs8xJbKRm11w4PLRmJn95NT6YHooc846zwWS.json",

    "/Users/ww/.config/solana/bot3BWXQCbRNFAgq9Fn9xsyk97eFTnkHoWADWe22Mp7.json",
    "/Users/ww/.config/solana/bot4vSFEjAjBmjt7cwv5TnTYtG8Pd2d7UdN6zgc4dnP.json",
    "/Users/ww/.config/solana/1iq2v1CHngTM1Rw79QKWUjn2py6LGkeNSpxVsx8WXSX.json",
    "/Users/ww/.config/solana/jit2aJCvwwbppM6Z3LRoRLxoBLgHvoVD1WcBsZfAh7K.json",
    "/Users/ww/.config/solana/mm2MD9ek5ywoBpxAxWfUrMRSBN9SoDnQ1iwHN1AYDPD.json",
    "/Users/ww/.config/solana/mm3MzYmkZbQRuG2B3ed21r2SWewPpcMShkqCaEyqDRY.json",
];

async function initUser(privateKeyPath: string, connection: Connection, clearingHousePubKey: PublicKey, bulkAccountLoader: BulkAccountLoader) {

    const [wallet, keypair] = getWallet(privateKeyPath);
    const clearingHouse = new ClearingHouse({
        connection,
        wallet,
        programID: clearingHousePubKey,
        env: env,
        accountSubscription: {
            type: 'polling',
            accountLoader: bulkAccountLoader,
        }
    });

    if (!initMsg) {
        console.log(`ClearingHouse ProgramId: ${clearingHouse.program.programId.toString()}`);
        console.log(`RPC endpoint           : ${connection.rpcEndpoint}`);
        initMsg = true;
    }
    console.log(`Authority: ${clearingHouse.wallet.publicKey.toBase58()}`);

    // print user chain balances
    await printUserSOLBalance(connection, clearingHouse.wallet.publicKey);
    await sleep(1000);
    await printUserSPLBalances(env, connection, keypair, clearingHouse);

	// const lamportsBalance = await connection.getBalance(clearingHouse.wallet.publicKey);
    /*
    const splBalances: Map<string, TokenAmount> = new Map();
    for (const bank of Banks[env]) {
        const token = new Token(
            connection,
            bank.mint,
            TOKEN_PROGRAM_ID,
            keypair,
        );
        const tokenAccountInfo = await token.getOrCreateAssociatedAccountInfo(clearingHouse.wallet.publicKey);
    await sleep(1000);
        splBalances.set(bank.symbol, (await connection.getTokenAccountBalance(tokenAccountInfo.address)).value);
    }
    */

    // console.log(` . SOL: ${lamportsBalance / 10 ** 9}`);
    /*
    splBalances.forEach((balance, symbol) => {
        console.log(` . Bank balance: ${symbol}: ${balance.uiAmountString}`);
    });
    */

    if (!await clearingHouse.subscribe()) {
        console.error("fail to subscribe to clearingHouse");
    }

    if (!(await clearingHouse.getUser().exists())) {
        const tx = await clearingHouse.initializeUserAccount();
        console.log(`Initialized user account for: ${tx}`);
    }
    await sleep(1000);
}

async function main() {
    const endpoint = process.env.ENDPOINT;
	const connection = new Connection(endpoint!, stateCommitment);
    const config = initialize({ env: 'devnet' });
    const clearingHousePublicKey = new PublicKey(
        config.CLEARING_HOUSE_PROGRAM_ID
    );

    const bulkAccountLoader = new BulkAccountLoader(connection, 'confirmed', 1000);
    for (const privateKeyPath of privateKeysToInit) {
        await initUser(
            privateKeyPath,
            connection,
            clearingHousePublicKey,
            bulkAccountLoader
        );
    }

    return;
}


try {
    if (!process.env.ENDPOINT) {
        throw new Error('ENDPOINT must be set.');
    }
    main();
} catch (e) {
   console.error(e);
}
