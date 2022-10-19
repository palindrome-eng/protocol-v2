import inquirer from 'inquirer';

import {
	Token,
	TOKEN_PROGRAM_ID,
	ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
    Keypair,
    PublicKey,
    Connection,
    Commitment,
    Transaction,
    TransactionInstruction,
 } from '@solana/web3.js';
import {
    TEN,
    MarketType,
    OrderTriggerCondition,
    OrderType,
    BN,
    BulkAccountLoader,
    convertToNumber,
    isVariant,
    isOneOfVariant,
    initialize,
    BASE_PRECISION,
    QUOTE_PRECISION,
    ClearingHouse,
    getMarketOrderParams,
    getLimitOrderParams,
    getTriggerLimitOrderParams,
    getTriggerMarketOrderParams,
    PositionDirection,
    SpotMarkets,
    PerpMarkets,
    SpotMarketConfig,
    PerpMarketConfig,
    UserMap,
    DLOB,
    SlotSubscriber,
    OraclePriceData,
    calculateAskPrice,
    calculateBidPrice,
    PerpMarketAccount,
    PRICE_PRECISION,
    OptionalOrderParams,
    getTokenAmount,
} from '@drift-labs/sdk';

import dotenv = require('dotenv');
dotenv.config();

import {
    getWallet,
    sleep,
    printUserSPLBalances,
    printUserAccount,
    printDLOB,
    wrapInTx,
} from './utils';

const stateCommitment: Commitment = 'confirmed';
const env = 'devnet';
const initMsg = false;

const SpotOrderKind = "Spot";
const PerpOrderKind = "Perp";

const MarketOrderType = "Market";
const LimitOrderType = "Limit";
const TriggerMarketOrderType = "Trigger Market";
const TriggerLimitOrderType = "Trigger Limit";

const LongOrderDirection = "Long";

const ShortOrderDirection = "Short";

const AboveTriggerCondition = "Above";
const BelowTriggerCondition = "Below";

const commandPrefix = "Drift>";


async function handlePlaceOrderCommand(clearingHouse: ClearingHouse) {
    let marketType: MarketType | undefined;
    const marketTypeName = 'What market type?';
    const marketTypeCmd= await inquirer.prompt(
        {
            type: 'list',
            prefix: commandPrefix,
            name: marketTypeName,
            choices: [
                PerpOrderKind,
                SpotOrderKind,
            ]
        }
    );
    switch (marketTypeCmd[marketTypeName]) {
        case PerpOrderKind as string:
            marketType = MarketType.PERP;
            break;
        case SpotOrderKind as string:
            marketType = MarketType.SPOT;
            break;
        default:
            throw new Error(`Invalid Order Kind: ${marketTypeCmd[marketTypeName]}`);
    }

    const orderTypeName = 'What Type of Order?';
    let orderType: OrderType;
    const orderTypeCmd = await inquirer.prompt(
        {
            type: 'list',
            prefix: 'Drift>',
            name: orderTypeName,
            choices: [
                MarketOrderType,
                LimitOrderType,
                TriggerMarketOrderType,
                TriggerLimitOrderType,
            ]
        }
    );
    switch (orderTypeCmd[orderTypeName]) {
        case MarketOrderType as string:
            orderType = OrderType.MARKET;
            break;
        case LimitOrderType as string:
            orderType = OrderType.LIMIT;
            break;
        case TriggerMarketOrderType as string:
            orderType = OrderType.TRIGGER_MARKET;
            break;
        case TriggerLimitOrderType as string:
            orderType = OrderType.TRIGGER_LIMIT;
            break;
        default:
            throw new Error(`Invalid Order Type: ${orderTypeCmd[orderTypeName]}`);
    }

    /**
     * get marketIndex for market type
     */
    const marketToIndex = new Map<string, number>();
    let orderMarketIndex: number;
    let selectedMarketName = '';
    if (isVariant(marketType, 'perp')) {
        for (const market of PerpMarkets[env]) {
            marketToIndex.set(market.symbol, market.marketIndex);
        }
        selectedMarketName = "Which Perp Market";
    } else if (isVariant(marketType, 'spot')) {
        for (const market of SpotMarkets[env]) {
            marketToIndex.set(market.symbol, market.marketIndex);
        }
        selectedMarketName = "Which Spot Market";
    } else {
        throw new Error(`Invalid Market Type: ${marketType}`);
    }
    const selectedMarketCmd = await inquirer.prompt(
        {
            type: 'list',
            prefix: 'Drift>',
            name: selectedMarketName,
            choices: Array.from(marketToIndex.keys()),
        }
    );
    orderMarketIndex = marketToIndex.get(selectedMarketCmd[selectedMarketName])!;
    if (!orderMarketIndex) {
        throw new Error(`Invalid Market: ${selectedMarketCmd[selectedMarketName]}`);
    }


    let orderDirection: PositionDirection;
    const directionName = "Direction";
    const directionCmd = await inquirer.prompt(
        {
            type: 'list',
            prefix: 'Drift>',
            name: directionName,
            choices: [
                LongOrderDirection,
                ShortOrderDirection
            ]
        }
    );
    switch (directionCmd[directionName]) {
        case LongOrderDirection as string:
            orderDirection = PositionDirection.LONG;
            break;
        case ShortOrderDirection as string:
            orderDirection = PositionDirection.SHORT;
            break;
        default:
            throw new Error(`Invalid Order Direciton: ${directionCmd[directionName]}`);
    }


    const baaName = "Base Asset Amount";
    const baseAssetAmountInput = await inquirer.prompt(
        {
            type: 'input',
            prefix: 'Drift>',
            name: baaName,
        }
    );

    let triggerPrice: BN | undefined;
    let triggerCondition: OrderTriggerCondition | undefined;
    if (isOneOfVariant(orderType, ['triggerMarket', 'triggerLimit'])) {
        const priceName = "Trigger Price";
        const priceInput = await inquirer.prompt(
            {
                type: 'input',
                prefix: 'Drift>',
                name: priceName,
            }
        );
        triggerPrice = new BN(priceInput[priceName] as number * convertToNumber(QUOTE_PRECISION, new BN(1)));

        const triggerConditionName = "Trigger Condition";
        const triggerInput = await inquirer.prompt(
            {
                type: 'list',
                prefix: 'Drift>',
                name: triggerConditionName,
                choices: [
                    AboveTriggerCondition,
                    BelowTriggerCondition,
                ],
            }
        );
        switch (triggerInput[triggerConditionName]) {
            case AboveTriggerCondition as string:
                triggerCondition = OrderTriggerCondition.ABOVE;
                break;
            case BelowTriggerCondition as string:
                triggerCondition = OrderTriggerCondition.BELOW;
                break;
            default:
                throw new Error(`Invalid Trigger Condition: ${triggerInput[triggerConditionName]}`);
        }
    }
    
    let limitPrice: BN | undefined;
    let oraclePriceOffset: BN | undefined;
    const priceName = "Limit Price";
    const priceInput = await inquirer.prompt(
        {
            type: 'input',
            prefix: 'Drift>',
            default: undefined,
            name: priceName,
        }
    );
    limitPrice = new BN(priceInput[priceName] as number).mul(PRICE_PRECISION);

    const oraclePriceOffsetName = "Oracle Price Offset";
    const oraclePriceOffsetInput = await inquirer.prompt(
        {
            type: 'input',
            prefix: 'Drift>',
            name: oraclePriceOffsetName,
        }
    );
    oraclePriceOffset = new BN(oraclePriceOffsetInput[oraclePriceOffsetName] as number * convertToNumber(QUOTE_PRECISION, new BN(1)));


    let baseAssetAmount: BN;
    if (isVariant(marketType, 'perp')) {
        try {
        baseAssetAmount = new BN(baseAssetAmountInput[baaName] as number * convertToNumber(BASE_PRECISION, new BN(1)));
        } catch (e) {
            console.error(e);
            throw new Error(`Invalid Base Asset Amount: ${baseAssetAmountInput[baaName]}`);
        }
    } else if (isVariant(marketType, 'spot')) {
        try {
        baseAssetAmount = new BN(baseAssetAmountInput[baaName] as number * convertToNumber(SpotMarkets[env][orderMarketIndex].precision, new BN(1)));
        } catch (e) {
            console.error(e);
            throw new Error(`Invalid Base Asset Amount: ${baseAssetAmountInput[baaName]}`);
        }
    } else {
        throw new Error(`Invalid Market Type: ${marketType}`);
    }

    const reduceOnlyName = "Reduce Only?";
    const reduceOnlyCmd = await inquirer.prompt(
        {
            type: 'confirm',
            prefix: 'Drift>',
            default: false,
            name: reduceOnlyName,
        }
    );
    const reduceOnly = reduceOnlyCmd[reduceOnlyName] as boolean;

    let postOnly: boolean | undefined;
    if (!isVariant(orderType, 'market')) {
        const postOnlyName = "Post Only?";
        const postOnlyCmd = await inquirer.prompt(
            {
                type: 'confirm',
                prefix: 'Drift>',
                default: false,
                name: postOnlyName,
            }
        );
        postOnly = postOnlyCmd[postOnlyName] as boolean;
    }

    let immediateOrCancel: boolean | undefined;
    const immediateOrCancelName = "Immediate or Cancel?";
    const immediateOrCancelCmd = await inquirer.prompt(
        {
            type: 'confirm',
            prefix: 'Drift>',
            default: false,
            name: immediateOrCancelName,
        }
    );
    immediateOrCancel = immediateOrCancelCmd[immediateOrCancelName] as boolean;

    console.log(`selected orderType: ${JSON.stringify(orderType)}`);
    console.log(`selected market: ${selectedMarketCmd[selectedMarketName]} - ${orderMarketIndex.toString()}`);
    console.log(`selected direction: ${JSON.stringify(orderDirection)}`);
    console.log(`order amount: ${baseAssetAmount.toString()}`);
    console.log(`reduce only?: ${reduceOnly}`);
    console.log(`post only?: ${postOnly}`);
    console.log(`ioc?: ${immediateOrCancel}`);

    let orderParams: OptionalOrderParams;
    if (isVariant(orderType, 'market')) {
        orderParams = getMarketOrderParams({
            marketIndex: orderMarketIndex,
            direction: orderDirection,
            baseAssetAmount,
        });
        if (limitPrice) {
            orderParams.price = limitPrice;
        }
    } else if (isVariant(orderType, 'limit')) {
        orderParams = getLimitOrderParams({
            marketIndex: orderMarketIndex,
            direction: orderDirection,
            baseAssetAmount,
            price: limitPrice!,
            oraclePriceOffset,
            reduceOnly,
            postOnly,
            immediateOrCancel,
        });
    } else if (isVariant(orderType, 'triggerMarket')) {
        orderParams =getTriggerMarketOrderParams({
            marketIndex: orderMarketIndex,
            direction: orderDirection,
            baseAssetAmount,
            triggerPrice: triggerPrice!,
            triggerCondition: triggerCondition!,
            reduceOnly,
            postOnly,
            immediateOrCancel,
        });
    } else if (isVariant(orderType, 'triggerLimit')) {
        orderParams = getTriggerLimitOrderParams({
            marketIndex: orderMarketIndex,
            direction: orderDirection,
            baseAssetAmount,
            price: limitPrice!,
            oraclePriceOffset,
            triggerPrice: triggerPrice!,
            triggerCondition: triggerCondition!,
            reduceOnly,
            postOnly,
            immediateOrCancel,
        });
    } else {
        throw new Error(`Invalid Order Type: ${orderType}`);
    }

    if (isVariant(marketType, 'perp')) {
        const tx = await clearingHouse.placeOrder(orderParams);
        console.log(`Placed perp order tx: ${tx}`);
    } else if (isVariant(marketType, 'spot')) {
        orderParams.auctionDuration = 0;
        for (let i = 0; i < 10; i++) {
            const tx = await clearingHouse.placeSpotOrder(orderParams);
            console.log(`Placed perp order tx: ${tx}`);
        }
    } else {
        throw new Error(`Invalid Market Type: ${JSON.stringify(marketType)}`);
    }
}

async function handleCancelOrder(clearingHouse: ClearingHouse) {
    console.log("currently only cancels all open orders b/c lazy");

    let tx: Transaction | undefined;
    const ixs = new Array<TransactionInstruction>();
    for (const order of clearingHouse.getUserAccount()!.orders) {
        if (isVariant(order.status, 'init')) {
            continue;
        }
        console.log(`cancelling order ${order.orderId.toString()}`);
        ixs.push(await clearingHouse.getCancelOrderIx(order.orderId));
    }

    if (ixs.length === 0) {
        console.log("No open orders to cancel");
        return;
    }

    for (const ix of ixs) {
        if (!tx) {
            tx = wrapInTx(ix);
        } else {
            tx.add(ix);
        }
    }
    
    if (!tx) {
        throw new Error("No open orders to cancel...?");
    }

    const resp = await clearingHouse.txSender.send(
        tx!,
        [],
        clearingHouse.opts
    );
    console.log(`sent tx: ${resp.txSig}`);
}

async function handleDeposit(keypair: Keypair, clearingHouse: ClearingHouse) {
    // printUserAccount(clearingHouse.getUser());
    const balancesMap = await printUserSPLBalances(env, clearingHouse.connection, keypair, clearingHouse);

    // get deposit-able assets
    const symbolToSpotMarket = new Map<string, SpotMarketConfig>();
    for (const market of SpotMarkets[env]) {
        symbolToSpotMarket.set(market.symbol, market);
    }

    let depositMarket: SpotMarketConfig | undefined;
    const depositAssetName = 'What asset to deposit?';
    const spotMarketCommand = await inquirer.prompt(
        {
            type: 'list',
            prefix: commandPrefix,
            name: depositAssetName,
            choices: SpotMarkets[env].map(market => market.symbol),
        }
    );
    depositMarket = symbolToSpotMarket.get(spotMarketCommand[depositAssetName] as string);
    if (!depositMarket) {
        throw new Error(`Invalid market: ${spotMarketCommand[depositAssetName]}`);
    }


    let depositAmount: number | undefined;
    const depositAmountName = 'How much to deposit?';
    const depositAmountCommand = await inquirer.prompt(
        {
            type: 'number',
            prefix: commandPrefix,
            name: depositAmountName,
        }
    );
    try {
        depositAmount = depositAmountCommand[depositAmountName] as number;
    } catch(e) {
        console.error(e);
        throw new Error(`Invalid deposit amount: ${depositAmountCommand[depositAmountName]}`);
    }

    const spotTokenDecimals = clearingHouse.getSpotMarketAccount(depositMarket.marketIndex)!.decimals;
    const depositAmountBN = new BN(depositAmount).mul(TEN.pow(new BN(spotTokenDecimals)));

    if (depositAmountBN.gt(balancesMap.get(depositMarket.symbol) as BN)) {
        throw new Error(`Insufficient balance to deposit ${depositAmountBN.toString()} ${depositMarket.symbol}`);
    }

    console.log(`Depositing ${depositAmount} ${depositMarket.symbol}`);

    const ata = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        depositMarket.mint,
        keypair.publicKey
    );

    const tx = await clearingHouse.deposit(
        depositAmountBN,
        depositMarket.marketIndex,
        ata
    );
    console.log(`Deposit transaction: ${tx}`);

    await clearingHouse.fetchAccounts();
    printUserAccount(clearingHouse);
    await printUserSPLBalances(env, clearingHouse.connection, keypair, clearingHouse);
}

async function handleViewDLOB(clearingHouse: ClearingHouse) {
    const userMap = new UserMap(
        clearingHouse,
        clearingHouse.userAccountSubscriptionConfig
    );
    const userMapInitPromise = userMap.fetchAllUsers();
    
    const marketTypeName = "DLOB Market Type";
    const marketTypeCmd = await inquirer.prompt(
        {
            type: 'list',
            prefix: commandPrefix,
            name: marketTypeName,
            choices: [
                'Perp',
                'Spot',
            ]
        }
    );

    let marketConfig: SpotMarketConfig | PerpMarketConfig | undefined;
    let oracle: OraclePriceData | undefined;
    let marketType: MarketType | undefined;
    let marketIndex: number | undefined;
    let vBid: BN | undefined;
    let vAsk: BN | undefined;
    if (marketTypeCmd[marketTypeName] === 'Perp') {
        marketType = MarketType.PERP;

        // get available markets
        const symbolToPerpMarket = new Map<string, PerpMarketConfig>();
        for (const market of PerpMarkets[env]) {
            symbolToPerpMarket.set(market.symbol, market);
        }

        const marketTypeCmd = await inquirer.prompt(
            {
                type: 'list',
                prefix: commandPrefix,
                name: marketTypeName,
                choices: PerpMarkets[env].map(market => market.symbol),
            }
        );

        marketConfig = symbolToPerpMarket.get(marketTypeCmd[marketTypeName] as string);
        marketIndex = marketConfig?.marketIndex;
        oracle = clearingHouse.getOracleDataForMarket(marketIndex!);

		vAsk = calculateAskPrice(clearingHouse.getPerpMarketAccount(marketIndex!) as PerpMarketAccount, oracle);
		vBid = calculateBidPrice(clearingHouse.getPerpMarketAccount(marketIndex!) as PerpMarketAccount, oracle);
    } else if (marketTypeCmd[marketTypeName] === 'Spot') {
        marketType = MarketType.SPOT;

        // get available markets
        const symbolToSpotMarket = new Map<string, SpotMarketConfig>();
        for (const market of SpotMarkets[env]) {
            symbolToSpotMarket.set(market.symbol, market);
        }

        const marketTypeCmd = await inquirer.prompt(
            {
                type: 'list',
                prefix: commandPrefix,
                name: marketTypeName,
                choices: SpotMarkets[env].map(market => market.symbol),
            }
        );

        marketConfig = symbolToSpotMarket.get(marketTypeCmd[marketTypeName] as string);
        marketIndex = marketConfig?.marketIndex;
        oracle = clearingHouse.getOracleDataForSpotMarket(marketIndex!);
    } else {
        throw new Error(`Invalid market type: ${marketTypeCmd[marketTypeName]}`);
    }

    if (!marketType || (marketIndex === undefined) || !marketConfig || !oracle) {
        throw new Error(`Invalid marketType (${marketTypeCmd[marketTypeName]}) or marketIndex (${marketIndex}) or marketConfig (${marketConfig}) or oracle (${oracle})`);
    }

    await userMapInitPromise;
    const dlob = new DLOB(
        clearingHouse.getPerpMarketAccounts(),
        clearingHouse.getSpotMarketAccounts(),
        true
    );
    await dlob.init(clearingHouse, userMap);

    const slotSubscriber = new SlotSubscriber(clearingHouse.connection);
    await slotSubscriber.subscribe();
    const dlobAsks = dlob.getAsks(marketIndex, vAsk, slotSubscriber.getSlot(), marketType, oracle);
    const dlobBids = dlob.getBids(marketIndex, vBid, slotSubscriber.getSlot(), marketType, oracle);

    printDLOB(marketConfig, dlobAsks, dlobBids, slotSubscriber.getSlot(), oracle);
}

async function handleViewCHAccount(clearingHouse: ClearingHouse) {
    await clearingHouse.fetchAccounts();
    await clearingHouse.getUser().fetchAccounts();
    printUserAccount(clearingHouse);
}

async function getAndExecCommand(keypair: Keypair, clearingHouse: ClearingHouse) {

    const PlaceOrderAction = "Place Order";
    const CancelOrderAction = "Cancel Order";
    const DepositAction = "Deposit Collateral";
    const ViewDLOB = "View DLOB";
    const ViewCHAccount = "View ClearingHouse Account";
    const CheckAddressBalances = "AddressBalances";

    const name = 'Action';
    const action = await inquirer.prompt(
        {
            type: 'list',
            prefix: 'Drift>',
            name: 'Action',
            choices: [
                PlaceOrderAction,
                CancelOrderAction,
                DepositAction,
                ViewDLOB,
                ViewCHAccount,
                CheckAddressBalances,
            ]
        }
    );

    switch (action[name]) {
        case PlaceOrderAction as string:
            await handlePlaceOrderCommand(clearingHouse);
            break;
        case CancelOrderAction as string:
            await handleCancelOrder(clearingHouse);
            break;
        case DepositAction as string:
            await handleDeposit(keypair, clearingHouse);
            break;
        case ViewDLOB as string:
            await handleViewDLOB(clearingHouse);
            break;
        case ViewCHAccount as string:
            await handleViewCHAccount(clearingHouse);
            break;
        // case CheckAddressBalances as string:
        //     await handleCheckAddressBalances(clearingHouse);
        //     break;
        default:
            throw new Error(`Invalid action: ${action.Action}`);
    }
}

async function main() {
    const endpoint = process.env.ENDPOINT!;
    console.log(`Endpoint: ${endpoint}`);
	const connection = new Connection(endpoint, stateCommitment);
    const config = initialize({ env });
    const clearingHousePublicKey = new PublicKey(
        config.CLEARING_HOUSE_PROGRAM_ID
    );

    const [wallet, keypair] = getWallet(process.env.ANCHOR_WALLET!);
    const bulkAccountLoader = new BulkAccountLoader(connection, 'confirmed', 1000);
    const clearingHouse = new ClearingHouse({
        connection,
        wallet: wallet,
        programID: clearingHousePublicKey,
        env,
        accountSubscription: {
            type: 'polling',
            accountLoader: bulkAccountLoader,
        }
    });

    // ensure CHUser exists
    if (!(await clearingHouse.getUser().exists())) {
        const doInit = await inquirer.prompt(
            {
                type: 'list',
                prefix: 'Drift>',
                name: 'initializeUser',
                message: `${wallet.publicKey.toBase58()} is not a ClearingHouse user. Would you like to initialize it?`,
                choices: [
                    "yes",
                    "no",
                    // "run test"
                ]
            }
        );
        if (doInit.initializeUser === "yes") {
            console.log(`Initializing ${wallet.publicKey.toBase58()}...`);
            const tx = await clearingHouse.initializeUserAccount();
            console.log(`Initialized user account for: ${tx}`);
        } else if (doInit.initializeUser === "no") {
            console.log(`chose ${doInit.initializeUser}`);
            console.log("Can't continue without a ClearingHouse user, exiting...");
            process.exit(0);
        } else if (doInit.initializeUser === "run test") {
            /// do test things here
            await clearingHouse.subscribe();
        }
    }

    if (!await clearingHouse.subscribe()) {
        throw new Error("fail to clearing house");
    }
    const clearingHouseUser = clearingHouse.getUser();
    if (!await clearingHouseUser.subscribe()) {
        throw new Error("failed to subscribe to clearing house user");
    }
    await clearingHouse.fetchAccounts();
    await clearingHouseUser.fetchAccounts();

    console.log(`clearingHouse program:      ${clearingHouse.program.programId.toBase58()}`);
    console.log(`clearingHouse state pubkey: ${(await clearingHouse.getStatePublicKey()).toBase58()}`);
    console.log(`clearingHouseUser pubkey:   ${clearingHouseUser.userAccountPublicKey.toBase58()}`);

    for (const m of clearingHouse.getPerpMarketAccounts()) {
        const c = PerpMarkets['devnet'][m.marketIndex];
        console.log(`${m.marketIndex}: ${c.baseAssetSymbol} - ${c.fullName}`)
        console.log(` marketpubkey: ${m.pubkey.toBase58()}`);
    }

    for (;;) {
        await getAndExecCommand(keypair, clearingHouse);
        console.log("");
    }
}

try {
    if (!process.env.ENDPOINT) {
        throw new Error('ENDPOINT must be set.');
    }
   if (!process.env.ANCHOR_WALLET) {
      throw new Error('ANCHOR_WALLET must be set.');
   }
   main();
} catch (e) {
   console.error(e);
}
