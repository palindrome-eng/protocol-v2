import fs from 'fs';

import {
	ComputeBudgetProgram,
    Keypair,
    PublicKey,
    Connection,
    Transaction,
    TransactionInstruction,
    LAMPORTS_PER_SOL,
 } from '@solana/web3.js';
import {
	Token,
	TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import {
    DriftEnv,
    ClearingHouse,
    TEN_THOUSAND,
    SpotMarkets,
    PerpMarkets,
    ClearingHouseUser,
    BN,
    convertToNumber,
    UserAccount,
    isVariant,
    Wallet,
    PRICE_PRECISION,
    BASE_PRECISION,
    TokenFaucet,
    QUOTE_PRECISION,
    SpotMarketConfig,
    PerpMarketConfig,
    DLOBNode,
    OraclePriceData,
    getVariant,
    getTokenAmount,
    SpotBalanceType,
 } from '@drift-labs/sdk';

const COMPUTE_UNITS_DEFAULT = 200_000;

export const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function getWallet(privateKey: string): [Wallet, Keypair] {
	// try to load privateKey as a filepath
	let loadedKey: Uint8Array;
	if (fs.existsSync(privateKey)) {
		console.log(`loading private key from ${privateKey}`);
		loadedKey = new Uint8Array(
			JSON.parse(fs.readFileSync(privateKey).toString())
		);
	} else {
		console.log(`loading private key as comma separated numbers`);
		loadedKey = Uint8Array.from(
			privateKey.split(',').map((val) => Number(val))
		);
	}

	const keypair = Keypair.fromSecretKey(Uint8Array.from(loadedKey));
	return [new Wallet(keypair), keypair];
}

export async function airdropTokens(
	connection: Connection,
	wallet: Wallet,
    keypair: Keypair,
	airdropReceiver: PublicKey,
    env: DriftEnv = 'devnet',
    solAirdrops = 1,
) {

    const solAirdropConn = new Connection('https://api.devnet.solana.com');
    try {
        for (let i = 0; i < solAirdrops ; i++) {
            await sleep(1000);
            const tx = await solAirdropConn.requestAirdrop(
                airdropReceiver,
                1 * LAMPORTS_PER_SOL // 2 is max
            );
            console.log(`Airdropping SOL: ${tx}`);
            await sleep(10000);
        }
    } catch (e) {
        console.log("SOL airdrop failed");
        console.error(e);
    }

	for (const spotMarket of SpotMarkets[env]) {
        if (spotMarket.symbol === 'SOL') {
            continue;
        }

		try {
			let airdropAmount = 500_000;

			switch (spotMarket.symbol) {
				case 'BTC':
					airdropAmount = 100;
					break;
				default:
					break;
			}

			console.log(
				`Airdropping ${airdropAmount} ${
					spotMarket.symbol
				} to ${airdropReceiver.toBase58()}`
			);

            const token = new Token(
                connection,
                spotMarket.mint,
                TOKEN_PROGRAM_ID,
                keypair,
            );
            const mintAccount = await token.getMintInfo();

            const faucet = new TokenFaucet(
                connection,
                wallet,
                new PublicKey('V4v1mQiAdLz4qwckEb45WqHYceYizoib39cDBHSWfaB'),
                spotMarket.mint
            );

            const airdropAmountBn = new BN(
                airdropAmount * 10**mintAccount.decimals
            );

            const [ata, tx] = await faucet.createAssociatedTokenAccountAndMintTo(
                airdropReceiver,
                airdropAmountBn
            );
            console.log(`airdrop ata: ${ata.toString()}, tx: ${tx}`);
		} catch (e) {
			console.error(e);
		}
	}
}


export function printPositions(user: UserAccount, clearingHouse: ClearingHouse, env: DriftEnv = 'devnet') {
    console.log("User market Perp Positions:");
    let perpCount = 0;
    for (const position of user.perpPositions) {
        if (position.baseAssetAmount.isZero()) {
            continue;
        }
        const m = PerpMarkets[env][position.marketIndex];
        console.log(` [${position.marketIndex}]: ${m.symbol}`);
        console.log(`   baseAssetAmount: ${convertToNumber(position.baseAssetAmount, BASE_PRECISION).toFixed(4)}`);
        console.log(`   quoteAssetAmount: ${convertToNumber(position.quoteAssetAmount, QUOTE_PRECISION).toFixed(4)}`);
        console.log(`   lastCumulativeFundingRate: ${convertToNumber(position.lastCumulativeFundingRate, QUOTE_PRECISION).toFixed(4)}`);
        console.log(`   openOrders: ${position.openOrders.toString()}, openBids: ${position.openBids.toString()}, openAsks: ${position.openAsks.toString()}`);
        perpCount++;
    }
    console.log(`Total open perp positions: ${perpCount}`);

    console.log("\nUser market Spot Positions:");
    const spotCount = 0;
    for (const position of user.spotPositions) {
        if (position.balance.isZero()) {
            continue;
        }
        const m = SpotMarkets[env][position.marketIndex];
        console.log(` [${position.marketIndex}]: ${m.symbol}`);
        const marketAccount = clearingHouse.getSpotMarketAccount(m.marketIndex);
        console.log(`   balance: ${convertToNumber(position.balance, BASE_PRECISION).toFixed(4)}`);
        console.log(`   balanceType: ${getVariant(position.balanceType)}`);
        console.log(`   openOrders: ${position.openOrders.toString()}, openBids: ${position.openBids.toString()}, openAsks: ${position.openAsks.toString()}`);
        perpCount++;
    }
    console.log(`Total open spot positions: ${spotCount}`);

    console.log("");
}

export function printOpenOrders(user: UserAccount, env: DriftEnv = 'devnet') {
    console.log("Open orders:");
    let count = 0;
    for (const order of user.orders) {
        if (isVariant(order.status, "init")) {
            continue;
        }
        console.log(` ${getVariant(order.marketType)} Market: ${order.marketIndex}, ${getVariant(order.direction)}, ${getVariant(order.orderType)}`);
        console.log(`  ${user.authority.toBase58()} - ${order.orderId}`);
        console.log(`  orderStartSlot: ${order.slot}, duration: ${order.auctionDuration}`);
        let basePrecision = BASE_PRECISION;
        if (isVariant(order.marketType, "spot")) {
            basePrecision = SpotMarkets[env][order.marketIndex].precision;
        }
        const baseAmtFilled = convertToNumber(order.baseAssetAmountFilled, basePrecision);
        const baseAmt = convertToNumber(order.baseAssetAmount, basePrecision);
        const quoteAmtFilled = convertToNumber(order.quoteAssetAmountFilled, QUOTE_PRECISION);
        const quoteAmt = convertToNumber(order.quoteAssetAmount, QUOTE_PRECISION);
        console.log(`  baseAmount:  ${baseAmtFilled}/${baseAmt}`);
        console.log(`  quoteAmount: ${quoteAmtFilled}/${quoteAmt}`);
        const aucStartPrice = convertToNumber(order.auctionStartPrice, PRICE_PRECISION);
        const aucEndPrice = convertToNumber(order.auctionEndPrice, PRICE_PRECISION);
        console.log(`  aucStartPrice:  ${aucStartPrice}`);
        console.log(`  aucEndPrice:    ${aucEndPrice}`);
        console.log(`  aucDuration:    ${order.auctionDuration}`);
        count++;
    }
    console.log(`Total open orders: ${count}`);
    console.log("");
}

export async function printUserSOLBalance(connection: Connection, user: PublicKey) {
    console.log("User SOL balances:");
	const lamportsBalance = await connection.getBalance(user);
    console.log(` . SOL: ${lamportsBalance / 10 ** 9}`);
}

export async function printUserSPLBalances(env: DriftEnv, connection: Connection, keypair: Keypair, clearingHouse: ClearingHouse): Promise<Map<string, BN>> {

    console.log("User SOL+SPL balances:");
    const balancesMap = new Map<string, BN>();
    for (const bank of SpotMarkets[env]) {
        if (bank.symbol === "SOL") {
            const lamportsBalance = await connection.getBalance(keypair.publicKey);
            console.log(` . SOL: ${lamportsBalance / 10 ** 9}`);
            balancesMap.set("SOL", new BN(lamportsBalance));
            continue;
        }
        try {
            const token = new Token(
                connection,
                bank.mint,
                TOKEN_PROGRAM_ID,
                keypair,
            );
            const tokenAccountInfo = await token.getOrCreateAssociatedAccountInfo(clearingHouse.wallet.publicKey);

            await sleep(1000);

            const balance = (await connection.getTokenAccountBalance(tokenAccountInfo.address)).value;
            console.log(` . ${bank.symbol}: ${balance.uiAmountString}`);
            balancesMap.set(bank.symbol, new BN(balance.amount));
        } catch (e) {
            console.error(`failed to get balances for ${bank.symbol}, no ATA?`);
            console.error(e);
        }
    }

    return balancesMap;
}


export function printUserAccount(clearingHouse: ClearingHouse, env: DriftEnv = 'devnet') {
    const chUser = clearingHouse.getUser();
    const user = chUser!.getUserAccount();
    console.log("User Account");
    console.log(`  UserAccountKey: ${chUser.getUserAccountPublicKey().toBase58()}`);
    console.log(`  Authority: ${user.authority.toBase58()}`);
    const name = Buffer.from(user.name).toString("utf-8");
    console.log(`  Name: ${name}`);
    console.log(`  UserId: ${user.userId.toString()}`);
    console.log(`  BankAssetValue: ${convertToNumber(chUser.getSpotMarketAssetValue(), QUOTE_PRECISION).toFixed(4)}`);
    console.log(`  BankLiabilityValue: ${convertToNumber(chUser.getSpotMarketLiabilityValue(), QUOTE_PRECISION).toFixed(4)}`);
    console.log(`  BankNetValue: ${convertToNumber(chUser.getNetSpotMarketValue(), QUOTE_PRECISION).toFixed(4)}`);

    for (const [_idx, market] of PerpMarkets[env].entries()) {
        console.log(`  Mkt ${market.symbol}, BuyingPower: ${convertToNumber(chUser.getBuyingPower(market.marketIndex), QUOTE_PRECISION).toFixed(4)}`);
    }
    console.log(`  Account leverage: ${convertToNumber(chUser.getLeverage(), TEN_THOUSAND)}`);
    console.log(`  UnrealizedPnL:        $${convertToNumber(chUser.getUnrealizedPNL(), QUOTE_PRECISION)}`);
    console.log(`  UnrealizedFundingPnL: $${convertToNumber(chUser.getUnrealizedFundingPNL(), QUOTE_PRECISION)}`);
    console.log("");

    printPositions(user, clearingHouse);
    printOpenOrders(user);
}

function printNode(node: DLOBNode, slot: number, oracle: OraclePriceData) {
    if (node.order) {
        console.log(`  ${getVariant(node.order.orderType)}\t\t : ${convertToNumber(node.order.baseAssetAmountFilled, BASE_PRECISION)}/${convertToNumber(node.order.baseAssetAmount, BASE_PRECISION)} @ \t\t $${convertToNumber(node.getPrice(oracle, slot), PRICE_PRECISION)}, postOnly: ${node.order.postOnly}, reduceOnly: ${node.order.reduceOnly}, ioc: ${node.order.immediateOrCancel}, [${node.userAccount?.toBase58()} - ${node.order.orderId}]`);
    } else {
        console.log(`  ${node.isVammNode() ? "vAMM" : "notVAMM"}\t\t : \t @ \t\t $${convertToNumber(node.getPrice(oracle, slot), PRICE_PRECISION)}`);
    }
}

export function printDLOB(marketConfig: SpotMarketConfig | PerpMarketConfig, asks: Generator<DLOBNode>, bids: Generator<DLOBNode>, slot: number, oracle: OraclePriceData) {
    console.log(`DLOB for ${marketConfig.symbol} market`);
    console.log(`Bids:`);
    for (const bid of bids) {
        printNode(bid, slot, oracle);
    }
    console.log(`Asks:`);
    for (const ask of asks) {
        printNode(ask, slot, oracle);
    }
}


export function wrapInTx(
	instruction: TransactionInstruction,
	computeUnits = 600_000 // TODO, requires less code change
): Transaction {
	const tx = new Transaction();
	if (computeUnits != COMPUTE_UNITS_DEFAULT) {
		tx.add(
			ComputeBudgetProgram.requestUnits({
				units: computeUnits,
				additionalFee: 0,
			})
		);
	}

	return tx.add(instruction);
}