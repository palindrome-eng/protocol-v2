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

// let marketToDeal = "SOL/USDC";
const marketToDeal = "BTC/USDC";
const side = 'sell';
const price = 17500;
const size = 0.02;

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

// SOL/USDC

const markets = env as string === 'mainnet-beta' ? mainnetMarkets : devnetMarkets;


async function main() {
	const connection = new Connection(endpoint!, 'confirmed');
    const [wallet, keypair] = getWallet(process.env.ANCHOR_WALLET!);

    console.log(`ENV: ${env}`);

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

        // let payer: PublicKey; 
        // if (side === 'buy') {
        //     payer = quoteAta.address;
        // } else if (side === 'sell') {
        //     payer = baseAta.address;
        // } else {
        //     throw new Error('invalid side');
        // }
        // console.log(`payer: ${payer.toBase58()}`)

        // cancel all open orders
        const orders = await market.loadOrdersForOwner(connection, wallet.publicKey);
        for (const order of orders) {
            /* @ts-expect-error */
            const tx = await market.cancelOrder(connection, keypair, order);
            console.log(`canceled order: ${tx}`);
            await sleep(1000);
        }

        // place orders around the midprice again (1% apart)
        const midPrice = 19_000;
        const halfSpread = 0.001; // 10 bps
        // place asks above
        for (let i = 0; i < 5; i++) {
            const tx = await market.placeOrder(connection, {
                /* @ts-expect-error */
                owner: keypair,
                payer: baseAta.address,
                side: 'sell',
                price: midPrice * (1 + (i + 1) * halfSpread),
                size: 10,
                orderType: 'limit', // 'limit', 'ioc', 'postOnly'
                feeDiscountPubkey: null, // only for devnet: to prevent looking up non-existant SRM and fee discount accounts
            });
            console.log(`offerorder tx: ${tx}`);
            await sleep(1000);
        }

        // place bids below
        for (let i = 0; i < 5; i++) {
            const tx = await market.placeOrder(connection, {
                /* @ts-expect-error */
                owner: keypair,
                payer: quoteAta.address,
                side: 'buy',
                price: midPrice * (1 - (i + 1) * halfSpread),
                size: 10, // baller
                orderType: 'limit', // 'limit', 'ioc', 'postOnly'
                feeDiscountPubkey: null, // only for devnet: to prevent looking up non-existant SRM and fee discount accounts
            });
            console.log(`bid order tx: ${tx}`);
            await sleep(1000);
        }

        // place orders
        // const tx = await market.placeOrder(connection, {
        //     /* @ts-expect-error */
        //     owner: keypair,
        //     payer,
        //     side, // 'buy' or 'sell'
        //     price,
        //     size,
        //     orderType: 'limit', // 'limit', 'ioc', 'postOnly'
        //     feeDiscountPubkey: null, //PublicKey.default, // only for devnet: to prevent looking up non-existant SRM account
        // });
        // console.log(`placeOrder tx: ${tx}`);

        // // replace an order
        // await market.replaceOrders(
        //     connection,
        //     {
        //         /* @ts-expect-error */
        //         owner: keypair,
        //         payer: payer,
        //         feeDiscountPubkey: null,
        //         programId: programId,
        //     },
        //     [

        //     ]
        // )

        await printOpenOrders(connection, market, wallet.publicKey);

    }

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
