import {PublicKey} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {BN, Program} from "@coral-xyz/anchor";
import buffer from "buffer";
import pythIDL from "../../../sdk/src/idl/pyth.json";

function readBigInt64LE(buffer, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buffer[offset];
    const last = buffer[offset + 7];
    if (first === undefined || last === undefined)
        boundsError(offset, buffer.length - 8);
    const val =
        buffer[offset + 4] +
        buffer[offset + 5] * 2 ** 8 +
        buffer[offset + 6] * 2 ** 16 +
        (last << 24); // Overflow
    return (
        (BigInt(val) << BigInt(32)) +
        BigInt(
            first +
            buffer[++offset] * 2 ** 8 +
            buffer[++offset] * 2 ** 16 +
            buffer[++offset] * 2 ** 24
        )
    );
}

// https://github.com/nodejs/node/blob/v14.17.0/lib/internal/errors.js#L758
const ERR_BUFFER_OUT_OF_BOUNDS = () =>
    new Error('Attempt to access memory outside buffer bounds');
// https://github.com/nodejs/node/blob/v14.17.0/lib/internal/errors.js#L968
const ERR_INVALID_ARG_TYPE = (name, expected, actual) =>
    new Error(
        `The "${name}" argument must be of type ${expected}. Received ${actual}`
    );
// https://github.com/nodejs/node/blob/v14.17.0/lib/internal/errors.js#L1262
const ERR_OUT_OF_RANGE = (str, range, received) =>
    new Error(
        `The value of "${str} is out of range. It must be ${range}. Received ${received}`
    );
function validateNumber(value, name) {
    if (typeof value !== 'number')
        throw ERR_INVALID_ARG_TYPE(name, 'number', value);
}
// https://github.com/nodejs/node/blob/v14.17.0/lib/internal/buffer.js#L68-L80
function boundsError(value, length) {
    if (Math.floor(value) !== value) {
        validateNumber(value, 'offset');
        throw ERR_OUT_OF_RANGE('offset', 'an integer', value);
    }
    if (length < 0) throw ERR_BUFFER_OUT_OF_BOUNDS();
    throw ERR_OUT_OF_RANGE('offset', `>= 0 and <= ${length}`, value);
}

function readBigUInt64LE(buffer, offset = 0) {
    validateNumber(offset, 'offset');
    const first = buffer[offset];
    const last = buffer[offset + 7];
    if (first === undefined || last === undefined)
        boundsError(offset, buffer.length - 8);
    const lo =
        first +
        buffer[++offset] * 2 ** 8 +
        buffer[++offset] * 2 ** 16 +
        buffer[++offset] * 2 ** 24;
    const hi =
        buffer[++offset] +
        buffer[++offset] * 2 ** 8 +
        buffer[++offset] * 2 ** 16 +
        last * 2 ** 24;
    return BigInt(lo) + (BigInt(hi) << BigInt(32)); // tslint:disable-line:no-bitwise
}

const empty32Buffer = buffer.Buffer.alloc(32);
const PKorNull = (data) =>
    data.equals(empty32Buffer) ? null : new anchor.web3.PublicKey(data);

const parsePriceInfo = (data, exponent) => {
    // Aggregate price.
    const priceComponent = data.readBigUInt64LE(0);
    const price = Number(priceComponent) * 10 ** exponent;
    // Aggregate confidence.
    const confidenceComponent = data.readBigUInt64LE(8);
    const confidence = Number(confidenceComponent) * 10 ** exponent;
    // Aggregate status.
    const status = data.readUInt32LE(16);
    // Aggregate corporate action.
    const corporateAction = data.readUInt32LE(20);
    // Aggregate publish slot.
    const publishSlot = data.readBigUInt64LE(24);
    return {
        priceComponent,
        price,
        confidenceComponent,
        confidence,
        status,
        corporateAction,
        publishSlot,
    };
};

const parsePriceData = (data) => {
    // Pyth magic number.
    const magic = data.readUInt32LE(0);
    // Program version.
    const version = data.readUInt32LE(4);
    // Account type.
    const type = data.readUInt32LE(8);
    // Price account size.
    const size = data.readUInt32LE(12);
    // Price or calculation type.
    const priceType = data.readUInt32LE(16);
    // Price exponent.
    const exponent = data.readInt32LE(20);
    // Number of component prices.
    const numComponentPrices = data.readUInt32LE(24);
    // unused
    // const unused = accountInfo.data.readUInt32LE(28)
    // Currently accumulating price slot.
    const currentSlot = readBigUInt64LE(data, 32);
    // Valid on-chain slot of aggregate price.
    const validSlot = readBigUInt64LE(data, 40);
    // Time-weighted average price.
    const twapComponent = readBigInt64LE(data, 48);
    const twap = Number(twapComponent) * 10 ** exponent;
    // Annualized price volatility.
    const avolComponent = readBigUInt64LE(data, 56);
    const avol = Number(avolComponent) * 10 ** exponent;
    // Space for future derived values.
    const drv0Component = readBigInt64LE(data, 64);
    const drv0 = Number(drv0Component) * 10 ** exponent;
    const drv1Component = readBigInt64LE(data, 72);
    const drv1 = Number(drv1Component) * 10 ** exponent;
    const drv2Component = readBigInt64LE(data, 80);
    const drv2 = Number(drv2Component) * 10 ** exponent;
    const drv3Component = readBigInt64LE(data, 88);
    const drv3 = Number(drv3Component) * 10 ** exponent;
    const drv4Component = readBigInt64LE(data, 96);
    const drv4 = Number(drv4Component) * 10 ** exponent;
    const drv5Component = readBigInt64LE(data, 104);
    const drv5 = Number(drv5Component) * 10 ** exponent;
    // Product id / reference account.
    const productAccountKey = new anchor.web3.PublicKey(data.slice(112, 144));
    // Next price account in list.
    const nextPriceAccountKey = PKorNull(data.slice(144, 176));
    // Aggregate price updater.
    const aggregatePriceUpdaterAccountKey = new anchor.web3.PublicKey(
        data.slice(176, 208)
    );
    const aggregatePriceInfo = parsePriceInfo(data.slice(208, 240), exponent);
    // Price components - up to 32.
    const priceComponents = [];
    let offset = 240;
    let shouldContinue = true;
    while (offset < data.length && shouldContinue) {
        const publisher = PKorNull(data.slice(offset, offset + 32));
        offset += 32;
        if (publisher) {
            const aggregate = parsePriceInfo(
                data.slice(offset, offset + 32),
                exponent
            );
            offset += 32;
            const latest = parsePriceInfo(data.slice(offset, offset + 32), exponent);
            offset += 32;
            priceComponents.push({ publisher, aggregate, latest });
        } else {
            shouldContinue = false;
        }
    }
    return Object.assign(
        Object.assign(
            {
                magic,
                version,
                type,
                size,
                priceType,
                exponent,
                numComponentPrices,
                currentSlot,
                validSlot,
                twapComponent,
                twap,
                avolComponent,
                avol,
                drv0Component,
                drv0,
                drv1Component,
                drv1,
                drv2Component,
                drv2,
                drv3Component,
                drv3,
                drv4Component,
                drv4,
                drv5Component,
                drv5,
                productAccountKey,
                nextPriceAccountKey,
                aggregatePriceUpdaterAccountKey,
            },
            aggregatePriceInfo
        ),
        { priceComponents }
    );
};

export const createPriceFeed = async ({
                                          oracleProgram,
                                          initPrice,
                                          confidence = undefined,
                                          expo = -4,
                                      }: {
    oracleProgram: Program;
    initPrice: number;
    confidence?: number;
    expo?: number;
}): Promise<PublicKey> => {
    const conf = new BN(confidence) || new BN((initPrice / 10) * 10 ** -expo);
    const collateralTokenFeed = new anchor.web3.Account();
    console.log({ a: initPrice * 10 ** -expo });
    const txid = await oracleProgram.rpc.initialize(
        new BN(initPrice * 10 ** -expo),
        expo,
        conf,
        {
            accounts: { price: collateralTokenFeed.publicKey },
            signers: [collateralTokenFeed],
            instructions: [
                anchor.web3.SystemProgram.createAccount({
                    // @ts-ignore
                    fromPubkey: oracleProgram.provider.wallet.publicKey,
                    newAccountPubkey: collateralTokenFeed.publicKey,
                    space: 3312,
                    lamports:
                        await oracleProgram.provider.connection.getMinimumBalanceForRentExemption(
                            3312
                        ),
                    programId: oracleProgram.programId,
                }),
            ],
        }
    );
    console.log(txid);
    return collateralTokenFeed.publicKey;
};

export const getFeedData = async (
    oracleProgram: Program,
    priceFeed: PublicKey
) => {
    const info = await oracleProgram.provider.connection.getAccountInfo(
        priceFeed
    );
    return parsePriceData(info.data);
};

export default async function mockOracle(
    price: number = 50 * 10e7,
    expo = -7,
    confidence?: number
): Promise<PublicKey> {
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

    console.log({ price });
    const priceFeedAddress = await createPriceFeed({
        oracleProgram: program,
        initPrice: price,
        expo: expo,
        confidence,
    });

    const feedData = await getFeedData(program, priceFeedAddress);
    if (feedData.price !== price) {
        console.log('mockOracle precision error:', feedData.price, '!=', price);
    }

    return priceFeedAddress;
}