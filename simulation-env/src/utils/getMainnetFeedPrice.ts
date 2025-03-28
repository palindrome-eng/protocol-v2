import axios from "axios";

const HERMES_URL = "https://hermes.pyth.network/v2/updates/price/latest?ids[]=";
const constructUrl = (feed: string) => `${HERMES_URL}${feed}`;

type Feed = {
    id: string,
    price: {
        price: `${number}`,
        conf: `${number}`,
        expo: number,
        publish_time: number
    },
    ema_price: {
        price: `${number}`,
        conf: `${number}`,
        expo: number,
        publish_time: number
    },
    metadata: {
        slot: number,
        proof_available_time: number,
        prev_publish_time: number
    }
}

type HermesResponse = {
    binary: {
        encoding: "hex",
        data: string[]
    },
    parsed: Feed[]
}

export default async function getMainnetFeedPrice(
    feed: string
) {
    const {
        data: {
            parsed: [
                {
                    price
                }
            ]
        }
    } = await axios.get<HermesResponse>(
        constructUrl(feed)
    );

    return price;
}