import {LiteSVM} from "litesvm";
import {
    DRIFT_PROGRAM_ID,
} from "@drift-labs/sdk";
import {Connection, LAMPORTS_PER_SOL, PublicKey} from "@solana/web3.js";
import {RPC_URL} from "./constants";
import cloneMarkets from "./utils/cloneMarkets";
import clonePrograms from "./utils/clonePrograms";
import cloneDriftCore from "./utils/cloneDriftCore";
import airdropAll from "./utils/airdropAll";

const DRIFT = new PublicKey(DRIFT_PROGRAM_ID);
const svm = new LiteSVM()
	.withSysvars()
	.withSplPrograms()
	.withBlockhashCheck(false)
	.withSigverify(false)
	.withLamports(BigInt(10_000 * LAMPORTS_PER_SOL)); // 10k sol
const connection = new Connection(RPC_URL);
const localConnection = new Connection("http://localhost:8899/");

export default async function setupEnvironment() {
    console.log("Preparing enviroment. Cloning programs from local.");
    clonePrograms();
    console.log("Airdropping to bots.");
    airdropAll();
    console.log("Cloning core Drift accounts.");
    await cloneDriftCore();
    console.log("Cloning Drift markets.");
    await cloneMarkets();
}

export {
    svm,
    connection,
    localConnection,
    DRIFT
};