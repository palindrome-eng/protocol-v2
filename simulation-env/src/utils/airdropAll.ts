import {JIT_BOT_ADDRESS, KEEPER_BOT_ADDRESS, REFLECT_BOT_ADDRESS} from "../constants";
import {svm} from "../setupEnvironment";
import {LAMPORTS_PER_SOL, PublicKey} from "@solana/web3.js";

export default function airdropAll(): void {
    [JIT_BOT_ADDRESS, KEEPER_BOT_ADDRESS, REFLECT_BOT_ADDRESS]
        .map(address => svm.airdrop(new PublicKey(address), BigInt(50 * LAMPORTS_PER_SOL)));
}