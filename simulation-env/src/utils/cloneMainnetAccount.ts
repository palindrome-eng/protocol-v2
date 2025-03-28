import { connection, svm } from "../setupEnvironment";
import {PublicKey} from "@solana/web3.js";

export default async function cloneMainnetAccount(
    publicKey: PublicKey,
): Promise<void> {
    const state = await connection.getAccountInfo(publicKey);
    try {
        svm.setAccount(
            publicKey,
            state
        );
    } catch (err) {
        // console.log("RentEpoch overflow.");
        // console.log(state.rentEpoch);
        // console.log(BigInt(state.rentEpoch));

        svm.setAccount(
            publicKey,
            {
                ...state,
                rentEpoch: 0
            }
        );
    }
}