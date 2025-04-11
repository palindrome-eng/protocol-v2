import { Connection, PublicKey } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/esm/nodewallet";
import {keypair, RPC_URL} from "../constants";
import { DriftClient, BN, OrderType, PostOnlyParams, getUserAccountPublicKey, PositionDirection, OrderTriggerCondition, Order, DriftClientAccountEvents, UserAccount } from "@drift-labs/sdk";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

class Bot {
    private driftClient: DriftClient;

    constructor() {
        const connection = new Connection(RPC_URL);

        const driftClient = new DriftClient({
            connection,
            authority: keypair.publicKey,
            wallet: new NodeWallet(keypair)
        });

        this.driftClient = driftClient;
    }

    async addUserListener(
        user: PublicKey,
        subAccountId: number
    ) {
        await this.driftClient.addUser(
            subAccountId,
            user
        );

        await this.driftClient.subscribe();
    }

    async listenToUserOrders(
        reflectAccount: PublicKey,
        onNewOrder: ({ userAccountPubkey, userAccount, order } : {userAccountPubkey: PublicKey, userAccount: UserAccount, order: Order}) => void
    ) {
        let reflectOrders: Order[] = [];

        this.driftClient
            .eventEmitter
            .on("userAccountUpdate", async (userAccount) => {
                const {
                    authority,
                    orders,
                } = userAccount;

                if (!authority.equals(reflectAccount)) return;

                const oldOrderIds = reflectOrders.map(order => order.orderId);
                const newOrders: Order[] = orders.filter(order => !oldOrderIds.includes(order.orderId));

                const userAccountPubkey = await getUserAccountPublicKey(
                    this.driftClient.program.programId,
                    reflectAccount,
                    0
                );

                newOrders.map(order => onNewOrder({userAccountPubkey, userAccount, order}));
                reflectOrders = orders;
            });
    }

    async depositCollateral(
        marketIndex: number,
        mint: PublicKey,
        amount: BN,
    ) {
        const ata = getAssociatedTokenAddressSync(
            mint,
            this.driftClient.authority,
            true
        );

        return await this.driftClient.deposit(
            amount,
            marketIndex,
            ata,
            0
        );
    }

    async placeMarketOrder(
        marketIndex = 0,
        size: BN,
        direction: PositionDirection = PositionDirection.LONG // Defaults to long to take our short
    ) {
        return await this.driftClient.placePerpOrder(
            {
                orderType: OrderType.MARKET,
                postOnly: PostOnlyParams.MUST_POST_ONLY,
                marketIndex,
                baseAssetAmount: size,
                direction
            }
        );
    }

    async placeLimitOrder(
        marketIndex = 0,
        size: BN,
        price: BN | number,
        direction: PositionDirection = PositionDirection.LONG // Defaults to long to take our short
    ) {
        return await this.driftClient.placePerpOrder(
            {
                orderType: OrderType.LIMIT,
                price: new BN(price),
                triggerCondition: OrderTriggerCondition.ABOVE,
                triggerPrice: new BN(price),
                postOnly: PostOnlyParams.MUST_POST_ONLY,
                marketIndex,
                baseAssetAmount: size,
                direction
            }
        );
    }

    async counterOrder(order: Order) {
        const {
            orderType,
            price,
            triggerPrice,
            direction,
            marketIndex,
            baseAssetAmount,
            baseAssetAmountFilled,
        } = order;

        const leftToFill = baseAssetAmount
            .sub(baseAssetAmountFilled);

        return await this.placeLimitOrder(
            marketIndex,
            leftToFill,
            triggerPrice,
            direction == PositionDirection.LONG
                ? PositionDirection.SHORT
                : PositionDirection.LONG
        );
    }

    async fillOrder({ order, userAccountPubkey, userAccount } : {
        userAccountPubkey: PublicKey,
        userAccount: UserAccount,
        order: Order
    }) {
        await this
            .driftClient
            .fillPerpOrder(
                userAccountPubkey,
                userAccount,
                order
            );
    }

    async moveMarketByTrend(
        initialPrice: BN,
        endingPrice: BN,
        trendDurationSeconds: BN,
        amountPerTransaction: BN,
        marketIndex = 0
    ) {
        const priceDifference = endingPrice
            .sub(initialPrice)
            .abs();

        const priceDifferencePerSecond = priceDifference
            .div(trendDurationSeconds);

        let step = 1;

        const interval = setInterval(async () => {
            const price = initialPrice
                .sub(priceDifferencePerSecond.muln(step));

            await this.placeLimitOrder(
                marketIndex,
                amountPerTransaction,
                price,
                PositionDirection.LONG
            );

            await this.placeLimitOrder(
                marketIndex,
                amountPerTransaction,
                price,
                PositionDirection.SHORT
            );

            step += 1;

            if (
                endingPrice.lt(initialPrice) && price.gte(endingPrice) ||
                endingPrice.gt(initialPrice) && price.lte(initialPrice)
            ) clearInterval(interval);

        }, 1000);
    }
}

export {
    Bot
};