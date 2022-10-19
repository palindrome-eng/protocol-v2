import * as anchor from '@project-serum/anchor';
import { AnchorProvider } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import {
    convertToNumber,
    BASE_PRECISION,
    BulkAccountLoader,
    ClearingHouse,
    OrderRecord,
    QUOTE_PRECISION,
 } from '../sdk/src';

import dotenv = require('dotenv');
import { initialize } from '../sdk/src';
dotenv.config();


async function decodeLogs(provider: AnchorProvider) {
    const connection = provider.connection;
    const config = initialize({ env: 'devnet' });
    const clearingHousePublicKey = new PublicKey(
        config.CLEARING_HOUSE_PROGRAM_ID
    );

    const bulkAccountLoader = new BulkAccountLoader(connection, 'confirmed', 500);
    const clearingHouse = new ClearingHouse({
        connection,
        wallet: provider.wallet,
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

    // plac eorder
    // const txSig = "2greTCS1g18hUmReELBnkKqNDa39xUDWmH2jYvf87xzoJHHrcGYUxZBZcfph99Dk8SRzzbct1idZvpyocMFPcSZi";
    // local fill order
    // const txSig = "5CD1Df263C6bd7sxwHhxAH5bJFzeVUZ2MJG6vELYmase7iL4oWGYQgXJv8B7oaA1yjGac7jopG1vJCHT1bVwKMcX";
    // const txSig = "2YdnmnWkvM3bnnwpCPQjv71t5NLcTGNJNX3a5UVDRcxMnSAKuVA6csSvhEvN112CAMiXoLMsBYn8MNbLXPYqhuGu";

    // this tx succeed but no fill??
    // const txSig = "5sN7HkEfhRNs5Lre8usB1JTCCjZRkMa3D3qGY2TuVkLjjtNq23gpEMisW62z7RZZwaU8DyAeh6cBRQSrVSZ1E4iH";
    const txSig = "2q1uR1Z9y2ksxgsUEyRmUYqQDxwimkRVWVBcTd9doNSfmYyALLypGSH4LFpyY1dc12k2fUSUPSW7LQZsz9uuNNoZ";
    const tx = await connection.getParsedTransaction(txSig);
    console.log(tx.meta.logMessages);

    // @ts-ignore
    clearingHouse.program._events._eventParser.parseLogs(tx.meta.logMessages, (event) => {
        // const expectRecordType = this.eventListMap.has(event.name);
        // console.log(`event: ${event.keys()}`)
        console.log(`event name: ${event.name}`);
        // console.log(event.data)
        if (event.name === "OrderRecord") {
            const e = event.data as OrderRecord;
            console.log(` action: ${JSON.stringify(e.action)}`);
            console.log(` actionExplanation: ${JSON.stringify(e.actionExplanation)}`);
            console.log(` taker: ${e.taker}`);
            console.log(` maker: ${e.maker}`);
            console.log(` filler: ${e.filler}`);
            console.log(` baseAssetAmountFilled: ${convertToNumber(e.baseAssetAmountFilled, BASE_PRECISION)}`);
            console.log(` quoteAssetAmountFilled: ${convertToNumber(e.quoteAssetAmountFilled, QUOTE_PRECISION)}`);
            console.log(` quoteAssetAmountSurplus: ${convertToNumber(e.quoteAssetAmountSurplus, QUOTE_PRECISION)}`);
            console.log(` order.taker.baseAssetAmount:       ${convertToNumber(e.takerOrder.baseAssetAmount, BASE_PRECISION).toString()}`);
            console.log(` order.taker.baseAssetAmountFilled: ${convertToNumber(e.takerOrder.baseAssetAmountFilled, BASE_PRECISION).toString()}`);
            console.log(` order.maker.baseAssetAmount:       ${convertToNumber(e.makerOrder.baseAssetAmount, BASE_PRECISION).toString()}`);
            console.log(` order.maker.baseAssetAmountFilled: ${convertToNumber(e.makerOrder.baseAssetAmountFilled, BASE_PRECISION).toString()}`);
        }
    });

    await clearingHouse.unsubscribe();
}

try {
   if (!process.env.ANCHOR_WALLET) {
      throw new Error('ANCHOR_WALLET must be set.');
   }
   decodeLogs(
      anchor.AnchorProvider.local('https://devnet.genesysgo.net', {
         preflightCommitment: 'confirmed',
         skipPreflight: false,
         commitment: 'confirmed',
      })
   );
   // anchor.AnchorProvider.local('https://psytrbhymqlkfrhudd.dev.genesysgo.net:8899/');
} catch (e) {
   console.error(e);
}