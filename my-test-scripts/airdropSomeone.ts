import { PublicKey, Connection, Commitment, TokenAmount } from '@solana/web3.js';
import {
	Token,
	TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
    SpotMarkets,
    PerpMarkets,
 } from '@drift-labs/sdk';

import {
    airdropTokens,
    getWallet,
    sleep,
} from './utils';

import dotenv = require('dotenv');
dotenv.config();
 const driftEnv = 'devnet';

const stateCommitment: Commitment = 'confirmed';
const env = 'devnet';

// normally passed in process.env.ANCHOR_WALLET
const airdropReceivers = [
    // "8uKYzkkp3eGSHAmDriDDkC4GfwjDB1CZteQUNU8M8oXY",
    // "bbuUv99ePgHogpjjNemdmoRH7YRquFzyxegKaLsL3ez"

    // "wi118WNNuZGLqgrznHDwzDnHKKmMCQmCyDGQCMRbZdj",
    // "ww18NdhuLSQPCrHSx7V68eZJpe2y311heWeXJfSmP3Q",
    // "ww2z7N9TG1PLLUQGQF2VKzCFaPtQ5FBhRfeEAuy6c5C",
    // "mm3MzYmkZbQRuG2B3ed21r2SWewPpcMShkqCaEyqDRY",

    // gui guy
    "7AifWhe6f2UfcK5vRWVH48VcTWo9wSPMgLQftjZ9AHJz",

    // bots
    // master
    // "bot1ABJRcrt72TbXeb5wMxoqzy54CrhTnyAXstZEM82",
    // "bot2RzYy9oY5s3z71Yubo4MmRxyDBQP3qNNCqyqLcPp",
    // "1iq1fy8Py4LJWg4GzWRDgDZMusNdJKnpzjk9nSLhCMN",
    // "j1tCTP7viuKJvbVPpY7zpVDYTXj18gMghqZULt8RZJJ",
    // "mm124NrWs8xJbKRm11w4PLRmJn95NT6YHooc846zwWS",

    // devnet
    // "bot3BWXQCbRNFAgq9Fn9xsyk97eFTnkHoWADWe22Mp7",
    // "bot4vSFEjAjBmjt7cwv5TnTYtG8Pd2d7UdN6zgc4dnP",
    // "1iq2v1CHngTM1Rw79QKWUjn2py6LGkeNSpxVsx8WXSX",
    // "jit2aJCvwwbppM6Z3LRoRLxoBLgHvoVD1WcBsZfAh7K",
    // "mm2MD9ek5ywoBpxAxWfUrMRSBN9SoDnQ1iwHN1AYDPD",
];

async function doAirDrop(recieverPubkeyStr: string, connection: Connection) {

    if (!process.env.FEE_PAYER) {
        throw new Error('FEE_PAYER is not set');
    }

    const [wallet, keypair] = getWallet(process.env.FEE_PAYER);
    const receiverPubKey = new PublicKey(recieverPubkeyStr);
    console.log(`Airdropping to: ${receiverPubKey.toBase58()}`);

    await airdropTokens(connection, wallet, keypair, receiverPubKey, env, 1);

    // print user chain balances
	let lamportsBalance = 0.00;
    try {
        lamportsBalance = await connection.getBalance(receiverPubKey);
    } catch(e) {
        console.log("failed to get SOL balance");
    }
    await sleep(1000);
    const splBalances: Map<string, TokenAmount> = new Map();
    for (const bank of SpotMarkets[driftEnv]) {
        const token = new Token(
            connection,
            bank.mint,
            TOKEN_PROGRAM_ID,
            keypair,
        );
        const tokenAccountInfo = await token.getOrCreateAssociatedAccountInfo(receiverPubKey);
        await sleep(1000);
        splBalances.set(bank.symbol, (await connection.getTokenAccountBalance(tokenAccountInfo.address)).value);
        console.log(`${bank.symbol}, prec: ${bank.precision.toString()}, precExp: ${bank.precisionExp.toString()}`);
    }

    console.log(` . SOL: ${lamportsBalance / 10 ** 9}`);
    splBalances.forEach((balance, symbol) => {
        console.log(` . Bank balance: ${symbol}: ${balance.uiAmountString}`);
    });

    await sleep(1000);
}

async function main() {
    const endpoint = process.env.ENDPOINT!; 
	const connection = new Connection(endpoint, stateCommitment);
    const repeats = 1;
    for (let i = 0; i < repeats; i++) {
        for (const airdropUserKey of airdropReceivers) {
            try {
                await doAirDrop(
                    airdropUserKey,
                    connection,
                );
            } catch (e) {
                console.error(e);
            }
            await sleep(5000);
        }
        await sleep(5000);
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
