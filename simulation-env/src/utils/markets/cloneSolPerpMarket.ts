import {TestClient} from "@drift-labs/sdk";
import mockOracle from "../initializeMockOracle";
import { BN } from '@drift-labs/sdk';
import getMainnetFeedPrice from "../getMainnetFeedPrice";
import {SOL_PRICE_FEED} from "../../constants";
import {PublicKey} from "@solana/web3.js";

export default async function cloneSolPerpMarket(
    localClient: TestClient,
    solOracle: PublicKey
) {
    const periodicity = new BN(60 * 60); // 1 HOUR

    await localClient.initializePerpMarket(
        0,
        solOracle,
        new BN(1000),
        new BN(1000),
        periodicity
    );

    return {
        oracle: solOracle,
        marketIndex: 0
    };
}