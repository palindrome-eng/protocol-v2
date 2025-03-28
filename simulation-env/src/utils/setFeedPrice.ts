import {
	PublicKey,
} from '@solana/web3.js';
import {Program} from "@coral-xyz/anchor";
import pythIDL from "../../../sdk/src/idl/pyth.json";
import * as anchor from "@coral-xyz/anchor";
import {BN} from "@drift-labs/sdk";

export const setFeedPrice = async (
    newPrice: number,
    exponent: number,
    priceFeed: PublicKey,
) => {
    anchor.setProvider(
        anchor.AnchorProvider.local(undefined, {
            commitment: 'confirmed',
            preflightCommitment: 'confirmed',
        })
    );

    const provider = anchor.getProvider();

    const program = new Program(
        pythIDL as anchor.Idl,
        new PublicKey('FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH'),
        provider
    );

    const tx = await program.rpc.setPrice(
        new BN(newPrice * 10 ** exponent),
        {
            accounts: { price: priceFeed },
        }
    );

    return tx;
};