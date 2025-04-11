import { BN } from "@drift-labs/sdk";
import {setFeedPrice} from "./setFeedPrice";
import {PublicKey} from "@solana/web3.js";
import getMainnetFeedPrice from "./getMainnetFeedPrice";

export default async function graduallyChangeOraclePrice(
    endingPrice: BN,
    trendDurationSeconds: BN,
    oracleAccount: PublicKey,
    feed: string
) {
    const {
        expo,
        price
    } = await getMainnetFeedPrice(feed);

    const initialPrice = new BN(price);

    const priceDifference = endingPrice
        .sub(initialPrice)
        .abs();

    const priceDifferencePerSecond = priceDifference
        .div(trendDurationSeconds);

    let step = 1;

    const interval = setInterval(async () => {
        const price = initialPrice
            .sub(priceDifferencePerSecond.muln(step));

        await setFeedPrice(
            price.toNumber(),
            expo,
            oracleAccount
        );

        step += 1;

        if (
            endingPrice.lt(initialPrice) && price.gte(endingPrice) ||
            endingPrice.gt(initialPrice) && price.lte(initialPrice)
        ) clearInterval(interval);

    }, 1000);
}