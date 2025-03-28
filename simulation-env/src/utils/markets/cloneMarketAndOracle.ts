import mockOracle from "../initializeMockOracle";
import {DriftClient, OracleSource, TestClient} from "@drift-labs/sdk";
import {PublicKey} from "@solana/web3.js";

export default async function cloneMarketAndOracle(
    mainnetClient: DriftClient,
    localClient: TestClient,
    tokenMint: PublicKey,
    initialUsdPrice: number,
    expo: number,
    mainnetMarketIndex: number,
    isUsdc?: boolean
) {
    const {
        optimalUtilization,
        optimalBorrowRate,
        maxBorrowRate,
        initialAssetWeight,
        maintenanceLiabilityWeight,
        maintenanceAssetWeight,
        initialLiabilityWeight
    } = mainnetClient.getSpotMarketAccount(mainnetMarketIndex);

    const oracle = !isUsdc
        ? await mockOracle(initialUsdPrice, expo)
        : PublicKey.default;

    await localClient.initializeSpotMarket(
        tokenMint,
        optimalUtilization,
        optimalBorrowRate,
        maxBorrowRate,
        oracle,
        isUsdc ? OracleSource.QUOTE_ASSET : OracleSource.PYTH,
        initialAssetWeight,
        maintenanceAssetWeight,
        initialLiabilityWeight,
        maintenanceLiabilityWeight,
    );

    return {
        oracle
    };
}