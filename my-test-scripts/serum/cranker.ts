import {
    Connection,
    PublicKey,
    TransactionInstruction,
    Transaction,
} from '@solana/web3.js';
import { 
    Market,
    DexInstructions,
    decodeEventQueue,
    EVENT_QUEUE_LAYOUT,
} from '@project-serum/serum';

import {
    getWallet,
    sleep,
} from '../utils';

import {
    printOpenOrders,
    printOrderBook,
    mainnetMarkets,
    devnetMarkets,
    getMultipleAccounts,
} from './utils';

import dotenv = require('dotenv');
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
    BN,
    DriftEnv,
} from '@drift-labs/sdk';
import { Instruction } from '@project-serum/anchor';
import { decodeEventsSince } from '@project-serum/serum/lib/queue';

dotenv.config();

let env: DriftEnv;
// env = 'mainnet-beta'
env = 'devnet';

const maxUniqueAccounts = parseInt(process.env.MAX_UNIQUE_ACCOUNTS || '10');
const consumeEventsLimit = new BN(process.env.CONSUME_EVENTS_LIMIT || '10');

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

console.log(`ENV: ${env}`);

const markets = env as string === 'mainnet-beta' ? mainnetMarkets : devnetMarkets;
const connection = new Connection(endpoint!, 'confirmed');
const [wallet, keypair] = getWallet(process.env.ANCHOR_WALLET!);
const lastSeqNumByMarket = new Map<string, number>();

async function main() {

    const ixs = Array<TransactionInstruction>();
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

        const baseToken = new Token(connection, market.baseMintAddress, TOKEN_PROGRAM_ID, keypair);
        const quoteToken = new Token(connection, market.quoteMintAddress, TOKEN_PROGRAM_ID, keypair);

        // build the cranking ix

        /* @ts-expect-error */
        const eventQueue = market._decoded.eventQueue;
        const eventQueueAccts = await getMultipleAccounts(connection, [eventQueue]);
        for (let i = 0; i < eventQueueAccts.length; i++) {

            const accountInfo = eventQueueAccts[i].accountInfo;
            const events = decodeEventQueue(accountInfo.data);
            const lastSeqNum = lastSeqNumByMarket.get(market.publicKey.toString());
            const eventsSince = decodeEventsSince(accountInfo.data, lastSeqNum || 0);
            if (events.length === 0) {
                continue;
            }
            console.log(`eventsSince: ${eventsSince.length}`);
            if (eventsSince.length === 0) {
                console.log(`no new events, last seqnum: ${lastSeqNum}`);
                continue;
            }

            const header = EVENT_QUEUE_LAYOUT.HEADER.decode(accountInfo.data);
            console.log(` . updated lastSeqNum: ${header.seqNum}`);
            lastSeqNumByMarket.set(market.publicKey.toString(), header.seqNum);


            const accounts: Set<string> = new Set();
            for (const event of events) {
                accounts.add(event.openOrders.toBase58());

                if (accounts.size >= maxUniqueAccounts) {
                    console.log("too many unique accounts");
                    break;
                }
            }

            const openOrdersAccounts = [...accounts]
            .map((s) => new PublicKey(s))
            .sort((a, b) => a.toBuffer().swap64().compare(b.toBuffer().swap64()));

            ////
            console.log(`openorders accounts to crank:`);
            for (const o of openOrdersAccounts) {
                console.log(` --> ${o.toBase58()}`);
            }

            ixs.push(DexInstructions.consumeEvents({
                market: market.publicKey,
                eventQueue: eventQueue,
                coinFee: baseToken.publicKey,
                pcFee: quoteToken.publicKey,
                openOrdersAccounts,
                limit: consumeEventsLimit,
                programId,
            }));
        }
    }
    if (ixs.length > 0) {
        const latestBlock = await connection.getLatestBlockhash();
        const tx = new Transaction({
            blockhash: latestBlock.blockhash,
            lastValidBlockHeight: latestBlock.lastValidBlockHeight,
            feePayer: wallet.publicKey,
        });
        for (const ix of ixs) {
        tx.add(ix);
        }
        const signedTx = await wallet.signTransaction(tx);
        const txSig = await connection.sendRawTransaction(signedTx.serialize());
        console.log(`Cranked ${ixs.length} ix in tx: ${txSig}`);
    } else {
        console.log(`no ix to crank`);
    }

    console.log("");
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

    // run main every 5s
    setInterval(async () => {
        await main();
    }, 10000);
} catch (e) {
   console.error(e);
}
