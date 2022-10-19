import * as anchor from '@project-serum/anchor';
import { AnchorProvider } from '@project-serum/anchor';
import { PublicKey, clusterApiUrl } from '@solana/web3.js';
import {
    BN,
    convertToNumber,
    OraclePriceData,
 } from '../sdk/src';

import dotenv = require('dotenv');
import { initialize } from '../sdk/src';
import {
    DevnetMarkets,
    PRICE_PRECISION,
    ClearingHouse,
} from '../sdk/src';
dotenv.config();

async function oracleViewer(provider: AnchorProvider) {
    const connection = provider.connection;
    const config = initialize({ env: 'devnet' });
    const clearingHousePublicKey = new PublicKey(
        config.CLEARING_HOUSE_PROGRAM_ID
    );

    // const bulkAccountLoader = new BulkAccountLoader(connection, 'confirmed', 1000);
    const clearingHouse = new ClearingHouse({
        connection,
        wallet: provider.wallet,
        programID: clearingHousePublicKey,
        env: 'devnet',
        accountSubscription: {
			type: 'websocket',
        }
        // accountSubscription: {
        //     type: 'polling',
        //     accountLoader: bulkAccountLoader,
        // }
    });

    if (!await clearingHouse.subscribe()) {
        throw new Error("fail to clearing house");
    }
    console.log(await clearingHouse.accountSubscriber.subscribe());
    clearingHouse.getOracleDataForMarket(new BN(0));

    const keyToSymbol = new Map<string, string>();
    for (const market of DevnetMarkets) {
        keyToSymbol.set(market.oracle.toBase58(), market.baseAssetSymbol);
    }

    clearingHouse.eventEmitter.on("oraclePriceUpdate", (publicKey: PublicKey, data: OraclePriceData) => {
        const s = keyToSymbol.get(publicKey.toBase58());
        console.log(`[${data.slot}: ${new Date().toISOString()}]: ${s}: $${convertToNumber(data.price, PRICE_PRECISION).toFixed(4)} (twap: $${convertToNumber(data.twap!, PRICE_PRECISION).toFixed(4)})`);
        // console.log(`oracle update: ${publicKey.toBase58()}`)
        // console.log(`  price: ${convertToNumber(data.price, PRICE_PRECISION).toFixed(4)}`)
        // console.log(`  slot: ${data.slot}: ${new Date().toISOString()}`)
        // console.log(`  confidence: ${data.confidence.toString()}`);
        // console.log(`  twap: ${convertToNumber(data?.twap, PRICE_PRECISION).toFixed(4)}`);
        // console.log(`  twap confidence: ${data.twapConfidence?.toString()}`);
        // console.log(`  has sufficient datapoints: ${data.hasSufficientNumberOfDataPoints}`);
    });
}


try {
    if (!process.env.ANCHOR_WALLET) {
        throw new Error('ANCHOR_WALLET must be set.');
    }
    oracleViewer(
        anchor.AnchorProvider.local(clusterApiUrl("devnet"), {
            // anchor.AnchorProvider.local('https://devnet.genesysgo.net', {
            preflightCommitment: 'confirmed',
            skipPreflight: false,
            commitment: 'confirmed',
        })
    );
    // anchor.AnchorProvider.local('https://psytrbhymqlkfrhudd.dev.genesysgo.net:8899/');
} catch (e) {
   console.error(e);
}