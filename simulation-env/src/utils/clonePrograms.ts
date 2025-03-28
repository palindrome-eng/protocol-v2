import {DRIFT, svm} from "../setupEnvironment";
import {PublicKey} from "@solana/web3.js";
import { join } from "path";

const PYTH_PROGRAM_ID = new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH");
const SWITCHBOARD_PROGRAM_ID = new PublicKey("SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f");
const SWITCHBOARD_ON_DEMAND_PROGRAM_ID = new PublicKey("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");
const TOKEN_FAUCET_PROGRAM_ID = new PublicKey("AmNeSW4UMPFBodCjEJD22G3kA8EraUGkhxr3GmdyEF4f");

export default function clonePrograms(): void {
    svm.addProgramFromFile(DRIFT, join(__dirname, "../programs/drift.so"));
    svm.addProgramFromFile(PYTH_PROGRAM_ID, join(__dirname, "../programs/pyth.so"));
    svm.addProgramFromFile(SWITCHBOARD_PROGRAM_ID, join(__dirname, "../programs/switchboard.so"));
    svm.addProgramFromFile(SWITCHBOARD_ON_DEMAND_PROGRAM_ID, join(__dirname, "../programs/switchboard_on_demand.so"));
    svm.addProgramFromFile(TOKEN_FAUCET_PROGRAM_ID, join(__dirname, "../programs/token_faucet.so"));
}