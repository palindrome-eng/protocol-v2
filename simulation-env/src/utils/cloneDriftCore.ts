import {getDriftStateAccountPublicKey} from "@drift-labs/sdk";
import {DRIFT} from "../setupEnvironment";
import cloneMainnetAccount from "./cloneMainnetAccount";

export default async function cloneDriftCore(): Promise<void> {
    const stateAddress = await getDriftStateAccountPublicKey(DRIFT);
    await cloneMainnetAccount(stateAddress);
}