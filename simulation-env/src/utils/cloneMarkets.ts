import {getPerpMarketPublicKey, getSpotMarketPublicKey, PerpMarkets, SpotMarkets} from "@drift-labs/sdk";
import cloneMainnetAccount from "./cloneMainnetAccount";
import {DRIFT} from "../setupEnvironment";

export default async function cloneMarkets() {
    const spotMarkets = SpotMarkets["mainnet-beta"];
    const perpMarkets = PerpMarkets["mainnet-beta"];

    const spotMarketPromises = spotMarkets.map(async ({ marketIndex, oracle, mint }) => {
        const marketAddress = await getSpotMarketPublicKey(DRIFT, marketIndex);
        await cloneMainnetAccount(marketAddress);
        await cloneMainnetAccount(oracle);
        await cloneMainnetAccount(mint);
    });

    const perpMarketPromises = perpMarkets.map(async ({ marketIndex, oracle }) => {
        const marketAddress = await getPerpMarketPublicKey(DRIFT, marketIndex);
        await cloneMainnetAccount(marketAddress);
        await cloneMainnetAccount(oracle);
    });

    await Promise.all([...spotMarketPromises, ...perpMarketPromises]);
}