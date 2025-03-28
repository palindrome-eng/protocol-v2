import {OracleSource, TestClient} from "@drift-labs/sdk";
import {PublicKey} from "@solana/web3.js";

export default async function updateSpotMarketOracle(
    marketIndex: number,
    newOracle: PublicKey,
    client: TestClient
) {
    return client.updateSpotMarketOracle(marketIndex, newOracle, OracleSource.PYTH);
}