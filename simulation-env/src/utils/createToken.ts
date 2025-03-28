import {
    ComputeBudgetProgram,
    Connection, Keypair,
    SystemProgram,
    TransactionMessage,
    VersionedTransaction
} from "@solana/web3.js";
import {createInitializeMint2Instruction, MINT_SIZE, TOKEN_PROGRAM_ID} from "@solana/spl-token";

export async function createToken(
    connection: Connection,
    adminKeypair: Keypair,
    tokenKeypair: Keypair,
    decimals = 6
) {
    const ix3 = SystemProgram.createAccount({
        lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
        space: MINT_SIZE,
        fromPubkey: adminKeypair.publicKey,
        newAccountPubkey: tokenKeypair.publicKey,
        programId: TOKEN_PROGRAM_ID
    });

    const ix = createInitializeMint2Instruction(
        tokenKeypair.publicKey,
        decimals,
        adminKeypair.publicKey,
        adminKeypair.publicKey
    );
    console.log("here");

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const message = new TransactionMessage({
        payerKey: adminKeypair.publicKey,
        instructions: [ix3, ix, ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 })],
        recentBlockhash: blockhash
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);
    transaction.sign([adminKeypair, tokenKeypair]);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    console.log({ signature });

    await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature
    });

    return signature;
}