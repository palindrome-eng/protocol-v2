import axios from "axios";
import { BN } from "@drift-labs/sdk";

type Response = {
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
    }
}[]

export default async function getOraclePrice(feed = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d") {
    const {
        data
    } = await axios.get<Response>(`https://hermes.pyth.network/api/latest_price_feeds?ids[]=${feed}`);

    const {
        price: {
            price,
            expo
        }
    } = data[0];

    return {
        price: new BN(price),
        precision: new BN(expo).abs()
    };
}