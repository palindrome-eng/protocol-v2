import axios from "axios";
import {setFeedPrice} from "../setFeedPrice";
import {PublicKey} from "@solana/web3.js";
import getMainnetFeedPrice from "../getMainnetFeedPrice";

export default async function cloneMainnetOracleState(
    feed: string,
    oracleAccount: PublicKey
) {
    const {
        expo,
        price
    } = await getMainnetFeedPrice(feed);

    return setFeedPrice(
        parseInt(price),
        expo,
        oracleAccount
    );
}