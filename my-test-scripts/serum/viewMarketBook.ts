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
    printMarketFills,
    mainnetMarkets,
    devnetMarkets,
} from './utils';

import dotenv = require('dotenv');
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { DriftEnv } from '@drift-labs/sdk';

dotenv.config();

let env: DriftEnv = 'devnet';
// env = 'mainnet-beta'
env = 'devnet';

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
    endpoint = process.env.ENDPOINT!; // "https://api.devnet.solana.com";
}

const markets = env as string === 'mainnet-beta' ? mainnetMarkets : devnetMarkets;

async function doIt() {
    console.log(`Current time: ${new Date().toISOString()}`);
	const connection = new Connection(endpoint!, 'confirmed');
    for (const m of markets) {
        const name = m.name;
        const address = m.address;

        console.log(`[Market: ${name} ${(address).toString()}]`);
        const market = await Market.load(
            connection,
            address,
            {},
            programId
        );

        // current time
        await printOrderBook(connection, market);
        await printMarketFills(connection, market);
    }
    console.log("");
}

async function main() {

    while (true) {
        await doIt();
        await sleep(10000);
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
