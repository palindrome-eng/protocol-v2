import { Connection, PublicKey } from '@solana/web3.js';
import { 
    Market,
} from '@project-serum/serum';

import {
    getWallet, sleep,
} from '../utils';

import {
    printOpenOrders,
    printOrderBook,
    mainnetMarkets,
    devnetMarkets,
} from './utils';

import dotenv = require('dotenv');
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { DriftEnv } from '@drift-labs/sdk';

dotenv.config();

let env: DriftEnv;
// env = 'mainnet-beta'
env = 'devnet';
console.log(`ENV: ${env}`);

// note: i used ww18NdhuLSQPCrHSx7V68eZJpe2y311heWeXJfSmP3Q as the wallet

const marketToDeal = "SOL/USDC";
// let marketToDeal = "BTC/USDC";
const side = 'sell';
const price = 35;
const size = 1.11;

// mainnet 
let programId: PublicKey;
if (env as string === 'mainnet-beta') {
    programId = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
} else if (env === 'devnet') {
    programId = new PublicKey("DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY");
}

// const endpoint = process.env.ENDPOINT;
let endpoint: string;
if (env as string === 'mainnet-beta') {
    endpoint = "https://api.mainnet-beta.solana.com";
} else if (env === 'devnet') {
    endpoint = process.env.ENDPOINT!;
}

const wrappedSOLMint = new PublicKey("So11111111111111111111111111111111111111112");

const markets = env as string === 'mainnet-beta' ? mainnetMarkets : devnetMarkets;


async function main() {
	const connection = new Connection(endpoint!, 'confirmed');
    const [wallet, keypair] = getWallet("/Users/ww/.config/solana/ww18NdhuLSQPCrHSx7V68eZJpe2y311heWeXJfSmP3Q.json");


    for (const m of markets) {
        const name = m.name;
        const address = m.address;
        if (name !== marketToDeal) {
            continue;
        }
        console.log(`[Market: ${name} ${(address).toString()}]`);
        const market = await Market.load(
            connection,
            address,
            {},
            programId
        );
        const baseToken = new Token(connection, market.baseMintAddress, TOKEN_PROGRAM_ID, keypair);
        const baseAta = await baseToken.getOrCreateAssociatedAccountInfo(wallet.publicKey);
        const quoteToken = new Token(connection, market.quoteMintAddress, TOKEN_PROGRAM_ID, keypair);
        const quoteAta = await quoteToken.getOrCreateAssociatedAccountInfo(wallet.publicKey);
        console.log(`base token balance: ${(await connection.getTokenAccountBalance(baseAta.address)).value.uiAmountString}`);
        console.log(`quote token balance: ${(await connection.getTokenAccountBalance(quoteAta.address)).value.uiAmountString}`);

        let payer: PublicKey; 
        if (side === 'buy') {
            if (market.quoteMintAddress.equals(wrappedSOLMint)) {
                payer = wallet.publicKey;
            } else {
                payer = quoteAta.address;
            }
        } else if (side === 'sell') {
            if (market.baseMintAddress.equals(wrappedSOLMint)) {
                payer = wallet.publicKey;
            } else {
                payer = baseAta.address;
            }
        } else {
            throw new Error('invalid side');
        }

        // cancel all open orders
        // const orders = await market.loadOrdersForOwner(connection, wallet.publicKey);
        // for (const order of orders) {
        //     /* @ts-expect-error */
        //     const tx = await market.cancelOrder(connection, keypair, order);
        //     console.log(`canceled order: ${tx}`)
        //     await sleep(1000);
        // }

        const tx = await market.placeOrder(connection, {
            /* @ts-expect-error */
            owner: keypair,
            payer,
            side,
            price,
            size,
            orderType: 'limit', // 'limit', 'ioc', 'postOnly'
            feeDiscountPubkey: null, // only for devnet: to prevent looking up non-existant SRM and fee discount accounts
        });
        console.log(`order tx: ${tx}`);

        await printOpenOrders(connection, market, wallet.publicKey);
    }

}

try {
	// if (!process.env.ANCHOR_WALLET) {
	// 	throw new Error(
	// 		'Must set environment variable ANCHOR_WALLET with the path to a id.json or a list of commma separated numbers'
	// 	);
	// }
    if (!process.env.ENDPOINT) {
        throw new Error('ENDPOINT must be set.');
    }
    main();
} catch (e) {
   console.error(e);
}
