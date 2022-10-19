import { Connection, PublicKey } from '@solana/web3.js';
import {
    Market,
    decodeEventQueue,
} from '@project-serum/serum';

import {
    printOpenOrders,
    printOrderBook,
    mainnetMarkets,
    devnetMarkets,
    getMultipleAccounts,
} from './utils';

import dotenv = require('dotenv');
dotenv.config();

let env: string;
// env = 'mainnet-beta'
env = 'devnet';

// mainnet 
let programId: PublicKey;
if (env === 'mainnet-beta') {
    programId = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
} else if (env === 'devnet') {
    programId = new PublicKey("DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY");
}

// const endpoint = process.env.ENDPOINT;
let endpoint: string;
if (env === 'mainnet-beta') {
    endpoint = "https://api.mainnet-beta.solana.com";
} else if (env === 'devnet') {
    endpoint = process.env.ENDPOINT!; //"https://api.devnet.solana.com";
}

const markets = env === 'mainnet-beta' ? mainnetMarkets : devnetMarkets;
//     "mainnet-beta": mainnetMarkets,
//     "devnet": devnetMarkets,
// }

async function main() {
	const connection = new Connection(endpoint!, 'confirmed');

    console.log(`ENV: ${env}`);

    // iterate over all mainnet markets
    // for (const [name, address] of Object.entries(mainnetMarkets)) {
    // for (const [name, address] of Object.entries(markets[env as string] as any)) {
    for (const m of markets) {
        const name = m.name;
        const address = m.address;
        console.log(`Market: ${name} ${(address).toString()}`);
        const market = await Market.load(
            connection,
            address,
            {},
            programId
        );
        console.log(` . eventQueue: ${market.decoded.eventQueue}`);
        console.log(` . minOrderSize: ${market.minOrderSize}`);
        console.log(` . tickSize: ${market.tickSize}`);
        console.log(` . baseMint: ${market.decoded.baseMint}`);
        console.log(` . quoteMint: ${market.decoded.quoteMint}`);
        console.log(` . vaultSignerNonce: ${market.decoded.vaultSignerNonce}`);
        console.log(` . baseLotSize:  ${market.decoded.baseLotSize}`);
        console.log(` . quoteLotSize: ${market.decoded.quoteLotSize}`);
        console.log(` . feeRateBps:   ${market.decoded.feeRateBps}`);

        console.log(`eventqwueure : ${market.decoded.eventQueue as PublicKey}`);
        const eventQueueAccts = await getMultipleAccounts(connection, [market.decoded.eventQueue as PublicKey]);
        for (let i = 0; i < eventQueueAccts.length; i++) {
            const accountInfo = eventQueueAccts[i].accountInfo;
            const events = decodeEventQueue(accountInfo.data);
            if (events.length === 0) {
                continue;
            }
    
            const accounts: Set<string> = new Set();
            for (const event of events) {
                accounts.add(event.openOrders.toBase58());

                // Limit unique accounts to first 10
                if (accounts.size >= 10) {
                    break;
                }
            }
            const openOrdersAccounts = [...accounts]
            .map((s) => new PublicKey(s))
            .sort((a, b) => a.toBuffer().swap64().compare(b.toBuffer().swap64()));
            console.log(`openordersaccounts:`);
            for (const o of openOrdersAccounts) {
                console.log(`  ${o.toString()}`);
            }
        }
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
