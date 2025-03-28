import {
    AddressLookupTableProgram,
    PublicKey,
    TransactionMessage,
    VersionedTransaction,
    Connection,
    Keypair
} from "@solana/web3.js";

export default async function createLookupTables(
    connection: Connection,
    signer: Keypair,
    addresses: PublicKey[]
) {
    try {
        const {
            lastValidBlockHeight,
            blockhash
        } = await connection.getLatestBlockhash();

        const slot = await connection.getSlot();

        const [createIx, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
            payer: signer.publicKey,
            authority: signer.publicKey,
            recentSlot: slot,
        });

        const extendIx = AddressLookupTableProgram.extendLookupTable({
            payer: signer.publicKey,
            lookupTable: lookupTableAddress,
            authority: signer.publicKey,
            addresses
        });

        const message = new TransactionMessage({
            payerKey: signer.publicKey,
            instructions: [createIx, extendIx],
            recentBlockhash: blockhash
        }).compileToV0Message();

        const transaction = new VersionedTransaction(message);
        transaction.sign([signer]);
        const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });

        await connection.confirmTransaction({
            blockhash,
            lastValidBlockHeight,
            signature
        });

        return lookupTableAddress;
    } catch (err) {
        console.error(err);
        console.log("Failed to create lookup table. Retrying");
        throw err;
    }
}