import {Keypair} from "@solana/web3.js";
import bs58 from "bs58";

export default function getKeypairFromEnv(env: any) {
    if (!env) throw Error("variable is empty");
    if (env[0] == "[") return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(env)));
    return Keypair.fromSecretKey(bs58.decode(env));
}