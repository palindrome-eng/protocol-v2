import {
    BN,
    BulkAccountLoader,
    DRIFT_PROGRAM_ID,
    DriftClient,
    getDriftStateAccountPublicKey,
    TestClient, WRAPPED_SOL_MINT
} from "@drift-labs/sdk";
import {Connection, Keypair, LAMPORTS_PER_SOL, PublicKey} from "@solana/web3.js";
import {
    AIRDROPS,
    DRIFT_ADMIN_SECRET_KEY,
    JITO_PRICE_FEED,
    RPC_URL,
    SOL_PRICE_FEED,
    USDC_PRICE_FEED
} from "../constants";
import getKeypairFromEnv from "../utils/getKeypairFromEnv";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import cloneSolPerpMarket from "../utils/markets/cloneSolPerpMarket";
import {createToken} from "../utils/createToken";
import cloneMarketAndOracle from '../utils/markets/cloneMarketAndOracle';
import getMainnetFeedPrice from "../utils/getMainnetFeedPrice";
import subscribeToOracleUpdates from "../utils/subscribeToOracleUpdates";
import mockOracle from "../utils/initializeMockOracle";
import updateSpotMarketOracle from "../utils/updateOracle";
import mintTokens from "../utils/mintTokens";
import createLookupTables from "../utils/createLookupTables";
import {getAssociatedTokenAddressSync} from "@solana/spl-token";

const localConnection = new Connection("http://localhost:8899");
const mainnetConnection = new Connection(RPC_URL);

const driftAdminKeypair = getKeypairFromEnv(DRIFT_ADMIN_SECRET_KEY);

const localClient = new TestClient({
    connection: localConnection,
    wallet: new NodeWallet(driftAdminKeypair),
    authority: driftAdminKeypair.publicKey,
    accountSubscription: {
        type: "polling",
        accountLoader: new BulkAccountLoader(localConnection, "confirmed", 1)
    },
    opts: {
        skipPreflight: true
    }
});

const mainnetClient = new DriftClient({
    connection: mainnetConnection,
    env: "mainnet-beta",
    wallet: new NodeWallet(driftAdminKeypair),
    authority: driftAdminKeypair.publicKey,
});

function sleep(seconds: number): Promise<null> {
    return new Promise(resolve => {
        setTimeout(() => { resolve(null); }, seconds * 1000);
    });
}

export default async function main() {
    console.log("Creating development environment.");
    await mainnetClient.subscribe();
    await localClient.subscribe();

    console.log(`Subscribing to mainnet: ${mainnetClient.accountSubscriber.isSubscribed}`);

    try {
        await localConnection.requestAirdrop(driftAdminKeypair.publicKey, 100000 *  LAMPORTS_PER_SOL);
        console.log("Airdropped to the admin wallet.");

        await Promise.all(AIRDROPS.map(async (address) => await localConnection.requestAirdrop(new PublicKey(address), 50000 * LAMPORTS_PER_SOL)));
        console.log("Airdropped to bots.");
        await sleep(15);

        const usdcKeypair = Keypair.generate();
        await createToken(localConnection, driftAdminKeypair, usdcKeypair);
        console.log(`Initialised mock USDC: ${usdcKeypair.publicKey.toString()}`);
        await sleep(10);

        await Promise.all([...AIRDROPS, driftAdminKeypair.publicKey].map(async (address) => await mintTokens(localConnection, usdcKeypair.publicKey, new PublicKey(address), driftAdminKeypair, 500_000_000 * Math.pow(10, 6))));
        console.log("Airdropped USDC to recipients");

        await localClient.initialize(usdcKeypair.publicKey, true);
        console.log(`Initialised Drift`);

        await sleep(10);

        const usdcMarketIndex = 0;
        const {
            oracle: fakeUsdcOracle
        } = await cloneMarketAndOracle(mainnetClient, localClient, usdcKeypair.publicKey, 1, -7, 0, true);

        console.log(`Initialised USDC spot market. Market index: ${usdcMarketIndex}. Oracle: ${fakeUsdcOracle.toString()}`);

        const {
            price: usdcPrice,
            expo: usdcExpo
        } = await getMainnetFeedPrice(USDC_PRICE_FEED);

        const usdcOracle = await mockOracle(
            parseInt(usdcPrice) * 10 ** usdcExpo,
            usdcExpo
        );

        console.log("Created mock USDC oracle.");
        await sleep(10);

        const updateUsdcOracleTx = await updateSpotMarketOracle(
            usdcMarketIndex,
            usdcOracle,
            localClient
        );

        console.log(`Updated USDC oracle. New oracle: ${usdcOracle.toString()}. Tx: ${updateUsdcOracleTx}`);

        const jitoKeypair = Keypair.generate();
        await createToken(localConnection, driftAdminKeypair, jitoKeypair, 9);

        console.log(`Created mock jitoSOL: ${jitoKeypair.publicKey.toString()}`);

        const {
            price: jitoPrice,
            expo: jitoExpo
        } = await getMainnetFeedPrice(JITO_PRICE_FEED);

        const {
            price: solPrice,
            expo: solExpo
        } = await getMainnetFeedPrice(SOL_PRICE_FEED);

        await sleep(10);

        const solMarketIndex = 1;
        const {
            oracle: solOracle
        } = await cloneMarketAndOracle(mainnetClient, localClient, WRAPPED_SOL_MINT, parseInt(solPrice) * 10 ** solExpo, solExpo, solMarketIndex, false);
        console.log(`Initialized SOL spot market. Market index: ${solMarketIndex}. Oracle: ${solOracle.toString()}`);

        const jitoMarketIndex = 2;
        const {
            oracle: jitoOracle
        } = await cloneMarketAndOracle(mainnetClient, localClient, jitoKeypair.publicKey, parseInt(jitoPrice) * 10 ** jitoExpo, jitoExpo, 6, false);
        console.log(`Initialised jitoSOL spot market. Market index: ${jitoMarketIndex}. Oracle: ${jitoOracle.toString()}`);

        await sleep(10);

        const {
            marketIndex: solPerpMarketIndex
        } = await cloneSolPerpMarket(localClient, solOracle);
        console.log(`Initialised SOL perp market & oracle. Market index: ${solPerpMarketIndex}. Oracle: ${solOracle.toString()}`);

        const lookupTable = await createLookupTables(
            localConnection,
            driftAdminKeypair,
            [
                solOracle,
                jitoOracle,
                jitoKeypair.publicKey,
                usdcOracle,
                usdcKeypair.publicKey,
                new PublicKey(DRIFT_PROGRAM_ID),
                await getDriftStateAccountPublicKey(new PublicKey(DRIFT_PROGRAM_ID))
            ]
        );

        console.log(`Created lookup tables: ${lookupTable.toString()}`);

        const [initializeUserAccountTx, userAccount] = await localClient
            .initializeUserAccount(
                0,
                "main"
            );

        console.log(`Initialized user account. Tx: ${initializeUserAccountTx}. User account: ${userAccount.toString()}`);
        await sleep(10);

        const usdcAta = getAssociatedTokenAddressSync(usdcKeypair.publicKey, driftAdminKeypair.publicKey, true);
        const addUsdcForBorrowTx = await localClient
            .deposit(
                new BN(5_000_000 * Math.pow(10, 6)),
                0,
                usdcAta,
                0
            );

        console.log(`Supplied USDC liquidity to enable borrows: ${addUsdcForBorrowTx}`);

        await sleep(10);

        const addLiquidityTx = await localClient
            .addPerpLpShares(
                new BN(1_000_000),
                0,
                {
                    getCUPriceFromComputeUnits: () => 300_000
                },
                0
            );

        console.log(`Added liquidity for the SOL-PERP market AMM: ${addLiquidityTx}`);

        subscribeToOracleUpdates([
            {
                localAccount: solOracle,
                feed: SOL_PRICE_FEED
            },
            {
                localAccount: jitoOracle,
                feed: JITO_PRICE_FEED
            },
            {
                localAccount: usdcOracle,
                feed: USDC_PRICE_FEED
            }
        ]);

    } catch (err) {
        console.error(err);
        throw err;
    }
}

(async () => {
    await main();
})();