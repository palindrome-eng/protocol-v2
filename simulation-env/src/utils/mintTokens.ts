import {
    createAssociatedTokenAccountIdempotentInstruction,
    createMintToInstruction,
    getAssociatedTokenAddressSync
} from "@solana/spl-token";
import {Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction} from "@solana/web3.js";

export default async function mintTokens(
    connection: Connection,
    mint: PublicKey,
    recipient: PublicKey,
    authority: Keypair,
    amount: number
) {
    const ata = getAssociatedTokenAddressSync(
        mint,
        recipient,
        true
    );

    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        authority.publicKey,
        ata,
        recipient,
        mint
    );

    const mintTokensIx = createMintToInstruction(
        mint,
        ata,
        authority.publicKey,
        amount
    );

    const { blockhash } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
        recentBlockhash: blockhash,
        instructions: [createAtaIx, mintTokensIx],
        payerKey: authority.publicKey
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([authority]);

    await connection.sendRawTransaction(tx.serialize());
}