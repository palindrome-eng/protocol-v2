import getKeypairFromEnv from "../utils/getKeypairFromEnv";

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) throw new Error("Missing RPC_URL");

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) throw new Error("Missing SECRET_KEY");
const keypair = getKeypairFromEnv(SECRET_KEY);


export {
    RPC_URL,
    keypair
};