import {PublicKey} from "@solana/web3.js";
import cloneMainnetOracleState from "./oracle/cloneMainnetOracleState";

type ClonableOracle = {
    feed: string,
    localAccount: PublicKey
}

export default function subscribeToOracleUpdates(oracles: ClonableOracle[]) {
    console.log(`Subscribed to ${oracles.length} oracles.`);

    setInterval(async () => {
        const promises = oracles.map(async ({ feed, localAccount }) => {
            await cloneMainnetOracleState(feed, localAccount);
        });

        const result = await Promise.allSettled(promises);

        const successful = result.filter(r => r.status === "fulfilled").length;
        console.log(`Successfully cloned ${successful} oracle states from mainnet`);
    }, 1000);
}