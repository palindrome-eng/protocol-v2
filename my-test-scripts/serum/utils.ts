import {
    Connection,
    PublicKey,
    AccountInfo,
    Commitment,
 } from '@solana/web3.js';
import { 
    Market,
} from '@project-serum/serum';


export const mainnetMarkets = [
    // USDC: prec: 1e6
    // Devnet: 8zGuJQqwhZafTah7Uc7Z4tXRnguqkn5KLFAP8oV6PHe2

    /**
     * base precExp: 1e9
     * quote (USDC): prec: 1e6
     * baseLotsize: 100000000  (1e8) -> 0.1 SOL
     * quoteLotSize: 100       (1e2) -> 0.0001 USDC
     * devnet: So11111111111111111111111111111111111111112
     * 
     */
    {"name": "SOL/USDC", "address": new PublicKey("9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT")},

    /**
     * base precExp: 1e6
     * quote (USDC): prec: 1e6
     * baseLotsize: 100 (1e2) -> 0.0001 BTC
     * quoteLotSize: 10 (1e1) -> 0.00001 USDC
     * devnet: 3BZPwbcqB5kKScF3TEXxwNfx5ipV13kbRVDvfVp5c6fv
     */
    {"name": "BTC/USDC", "address": new PublicKey("A8YFbxQYFVqKZaoYJLLUVcQiWP7G2MeEgW5wsAQgMvFw")},


    // "ETH/USDC": new PublicKey("8Gmi2HhZmwQPVdCwzS7CM66MGstMXPcTVHA7jF19cLZz"), // 
];

export const devnetMarkets = [
    // USDC: prec: 1e6
    // Devnet: 8zGuJQqwhZafTah7Uc7Z4tXRnguqkn5KLFAP8oV6PHe2

    /**
     * base precExp: 1e9
     * quote (USDC): prec: 1e6
     * baseLotsize: 100000000  (1e8) -> 0.1 SOL
     * quoteLotSize: 100       (1e2) -> 0.0001 USDC
     * devnet: So11111111111111111111111111111111111111112
     * 
     * https://explorer.solana.com/tx/4obXgqqvk7QK2fBTPyAEqdydhCbkgv4XuuzfqHxhvSy2JBjsEL4rVrjNG7JqPaf3ZeUNszosYFbzWkT3fZjoJFhr?cluster=devnet
     * https://explorer.solana.com/tx/33hUY1QPEDDpyvanyLhUkhLha34LpiqtZtVygEoF7taSntiAzUyo3NeehMN5SwiovuH97Za7FYyx1amGkqRUkzU5?cluster=devnet
     * devnet: 8N37SsnTu8RYxtjrV9SStjkkwVhmU8aCWhLvwduAPEKW
     */
    {"name": "SOL/USDC", "address": new PublicKey("8N37SsnTu8RYxtjrV9SStjkkwVhmU8aCWhLvwduAPEKW")},

    /**
     * base precExp: 1e6
     * quote (USDC): prec: 1e6
     * baseLotsize: 100 (1e2) -> 0.0001 BTC
     * quoteLotSize: 10 (1e1) -> 0.00001 USDC
     * 
     * 
     * https://explorer.solana.com/tx/5cioKuJDgRgByxoXfPWAfUDpQYiCEXajv7PiTQfeRLsnnHqEThdy1PZRuFH5T2q3WX3xsMgzuRziL94U97Dzhd68?cluster=devnet
     * https://explorer.solana.com/tx/3r2oV59gGncK8U3wwNGAd5LfHb4pXMBWLLur9m6qQSnsA6eapky7gEvL9TSAAH6XsS6fKPG38BJmrmsjWWadMA9x?cluster=devnet
     * devnet: A37tPzZDviVMHDLsDMCwfg2DqUF9EBoSpBRCJRNF9dFx
     */
    {"name": "BTC/USDC", "address": new PublicKey("AGsmbVu3MS9u68GEYABWosQQCZwmLcBHu4pWEuBYH7Za")},

];

export async function printOrderBook(connection: Connection, market: Market) {

    /**
     * L2:
     * [
     *  this.market.priceLotsToNumber(priceLots),
     *  this.market.baseSizeLotsToNumber(sizeLots),
     *  priceLots,
     *  sizeLots,
     *  ]
     */
    const asks = (await market.loadAsks(connection)).getL2(100);
    console.log(`OrderBook Asks:`);
    for (let i = 0; i < asks.length; i++) {
        const price = asks[i][0];
        const size = asks[i][1];
        // const priceLot = bids[i][2];
        // const sizeLot = bids[i][3];
        console.log(`  [${i}]: ${size} @ ${price}`);
    }

    const bids = (await market.loadBids(connection)).getL2(100);
    console.log(`OrderBook Bids:`);
    for (let i = 0; i < bids.length; i++) {
        const price = bids[i][0];
        const size = bids[i][1];
        // const priceLot = bids[i][2];
        // const sizeLot = bids[i][3];
        console.log(`  [${i}]: ${size} @ ${price}`);
    }
}

export async function printOpenOrders(connection: Connection, market: Market, owner: PublicKey) {

    console.log(`Open orders for ${owner.toBase58()}:`);

    const myOrders = await market.loadOrdersForOwner(connection, owner);
    for (const order of myOrders) {
        console.log(`[${order.orderId.toString()}-${order.clientId?.toString()}]: ${order.side} ${order.size} @ ${order.price} - ${order.openOrdersAddress.toBase58()}`);
    }
}

export async function printMarketFills(connection: Connection, market: Market) {
    console.log(`Market fills: ${(await market.loadFills(connection)).length}`);
    //for (let fill of await market.loadFills(connection)) {
    //   console.log(fill)
    //}
}


export async function getMultipleAccounts(
        connection: Connection,
        publicKeys: PublicKey[],
        commitment?: Commitment,
    ): Promise<
    {
        publicKey: PublicKey;
        context: { slot: number };
        accountInfo: AccountInfo<Buffer>;
    }[]
    > {
    const len = publicKeys.length;
    if (len === 0) {
        return [];
    }
    if (len > 100) {
    const mid = Math.floor(publicKeys.length / 2);
    return Promise.all([
        getMultipleAccounts(connection, publicKeys.slice(0, mid), commitment),
        getMultipleAccounts(connection, publicKeys.slice(mid, len), commitment),
    ]).then((a) => a[0].concat(a[1]));
    }
    const publicKeyStrs = publicKeys.map((pk) => pk.toBase58());
    // load connection commitment as a default
    commitment = commitment || connection.commitment;
  
    const args = commitment ? [publicKeyStrs, { commitment }] : [publicKeyStrs];
    // @ts-ignore
    const resp = await connection._rpcRequest('getMultipleAccounts', args);
    if (resp.error) {
        throw new Error(resp.error.message);
    }
    if (resp.result) {
        const nullResults = resp.result.value.filter((r: any) => r?.account === null);
        if (nullResults.length > 0)
        throw new Error(
            `gma returned ${
            nullResults.length
            } null results. ex: ${nullResults[0]?.pubkey.toString()}`,
        );
    }
    return resp.result.value.map(
        /* @ts-ignore */
        ({ data, executable, lamports, owner }, i: number) => ({
        publicKey: publicKeys[i],
        context: resp.result.context,
        accountInfo: {
            data: Buffer.from(data[0], 'base64'),
            executable,
            owner: new PublicKey(owner),
            lamports,
        },
        }),
    );
}
