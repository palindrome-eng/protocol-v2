import {Connection, LAMPORTS_PER_SOL, PublicKey, TransactionMessage, VersionedTransaction} from "@solana/web3.js";
import {DRIFT_ADMIN_SECRET_KEY} from "../constants";
import getKeypairFromEnv from "../utils/getKeypairFromEnv";
import {createMintToInstruction, getAssociatedTokenAddressSync} from "@solana/spl-token";

const localConnection = new Connection("http://localhost:8899");
const driftAdminKeypair = getKeypairFromEnv(DRIFT_ADMIN_SECRET_KEY);
const LST = process.env.LST;
const BOT_ADDRESS = process.env.BOT_ADDRESS;

export default async function mintLst() {
    const ata = getAssociatedTokenAddressSync(
        new PublicKey(LST),
        new PublicKey(BOT_ADDRESS),
        true
    );

    console.log(LST, BOT_ADDRESS);

    const ix = createMintToInstruction(
        new PublicKey(LST),
        ata,
        driftAdminKeypair.publicKey,
        2000 * LAMPORTS_PER_SOL
    );

    const { blockhash, lastValidBlockHeight } = await localConnection.getLatestBlockhash();
    const message = new TransactionMessage({
        recentBlockhash: blockhash,
        instructions: [ix],
        payerKey: driftAdminKeypair.publicKey
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([driftAdminKeypair]);

    const signature = await localConnection.sendRawTransaction(tx.serialize());
    await localConnection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature
    });

    return signature;
}

(async () => {
    const tx = await mintLst();
    console.log(`Minted LST: ${tx}`);
})();