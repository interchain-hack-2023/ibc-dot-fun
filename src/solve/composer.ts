import { walletContext } from "@cosmos-kit/react-lite";
import { useChain } from "@cosmos-kit/react";
import { LeapClient, RouteResponse } from "./client";
import { useRoute, useEVMRoute } from "./queries";
import { useQuery } from "@tanstack/react-query";
import { WalletClient } from "@cosmos-kit/core";
import chainIdToVenueNameMap from "../utils/utils";
import { getEVMChainId, cosmoToERCMap, evmosToEth } from "./utils";
import { getChainByID } from "@/utils/utils";
import { WalletAccount } from "@cosmos-kit/core";
import { use } from "react";
import { OperationWithERC20Convert, Operation } from "./types";
import { ercToCosmoMap, tokenChainMap, cosmoToErcChainIdMap } from "./utils";
import { SWAP_VENUES } from "@/config";
import { PostQuoteRequestDto, OperationWithSwap } from "./types";

function makeConvertERC20RouteResponse(
  contractAddress: string,
  amount: string,
  asset: string,
  assetChainId: string,
  account: WalletAccount
) {
  const venueName = chainIdToVenueNameMap.get(assetChainId);

  if (!venueName) {
    throw new Error(`No venue name for chain id ${assetChainId}`);
  }

  const operation: OperationWithERC20Convert = {
    erc20Convert: {
      convert_message: {
        contractAddress: contractAddress,
        amount: amount,
        receiver: account.address,
        sender: evmosToEth(account.address),
      },
      convert_operation: {
        // TODO: get denom of erc20 and coin pair
        denom: asset,
        venue: {
          name: venueName,
          chain_id: assetChainId,
        },
      },
    },
    transfer: undefined,
    swap: undefined,
  };

  return {
    source_asset_denom: asset,
    source_asset_chain_id: assetChainId,
    dest_asset_denom: ercToCosmoMap[assetChainId][contractAddress].address,
    dest_asset_chain_id: assetChainId,
    amount_in: amount,
    operations: [operation],
    chain_ids: [],
    estimated_amount_out: amount,
    does_swap: false,
  };
}

async function makeEVMRouteResponse(
  client: LeapClient,
  amountIn: string,
  sourceAsset?: string,
  sourceAssetChainID?: string,
  destinationAsset?: string,
  destinationAssetChainID?: string
) {
  if (
    !sourceAsset ||
    !sourceAssetChainID ||
    !destinationAsset ||
    !destinationAssetChainID
  ) {
    return;
  }

  const targetChainId: string = sourceAssetChainID;

  const cosmoTargetChainTokenIn: string =
    tokenChainMap[targetChainId][
      cosmoToERCMap[sourceAssetChainID][sourceAsset].name
    ];
  const cosmoTargetChainTokenOut: string =
    tokenChainMap[targetChainId][
      cosmoToERCMap[destinationAssetChainID][destinationAsset].name
    ];

  const ercTokenInAddr: string =
    cosmoToERCMap[targetChainId][cosmoTargetChainTokenIn].address;
  const ercTokenOutAddr: string =
    cosmoToERCMap[targetChainId][cosmoTargetChainTokenOut].address;

  if (
    !cosmoToErcChainIdMap[targetChainId] ||
    !ercTokenInAddr ||
    !ercTokenOutAddr
  ) {
    return;
  }

  const postQuoteRequest: PostQuoteRequestDto = {
    chainId: cosmoToErcChainIdMap[targetChainId].chainId,
    tokenInAddr: ercTokenInAddr,
    tokenOutAddr: ercTokenOutAddr,
    from: "",
    /**
     * TODO: decimals
     */
    amount: amountIn,
    /**
     * slippage tolerance 10000 => 100%, 30 => 0.3%
     */
    slippageBps: 100,
    /**
     * amount max split
     */
    maxSplit: 15,
    /**
     * max edge of graph
     */
    maxEdge: 3,
    /**
     * set true if Flash Loan(false if normal swap)
     */
    withCycle: false,
  };

  const route = await client.evm.postQuoteV2(postQuoteRequest);

  if (!route.isSwapPathExists) {
    throw new Error("No route found");
  }

  const operation: OperationWithSwap = {
    swap: {
      swap_in: {
        swap_venue: {
          name: "evmos-dex",
          chain_id: sourceAssetChainID,
        },
        swap_operations: [
          {
            pool: "EVMswap",
            denom_in: cosmoTargetChainTokenIn,
            denom_out: cosmoTargetChainTokenOut,
          },
        ],
        swap_amount_in: amountIn,
      },
      estimated_affiliate_fee: "0" + cosmoTargetChainTokenOut,
    },
    transfer: undefined,
    erc20Convert: undefined,
  };

  const result: RouteResponse = {
    source_asset_denom: sourceAsset,
    source_asset_chain_id: sourceAssetChainID,
    dest_asset_denom: cosmoTargetChainTokenOut,
    dest_asset_chain_id: sourceAssetChainID,
    amount_in: amountIn,
    operations: [operation],
    chain_ids: [sourceAssetChainID],
    does_swap: true,
    estimated_amount_out: route.dexAgg.expectedAmountOut,
    swap_venue: {
      name: "evmos-dex",
      chain_id: sourceAssetChainID,
    },
    dex_aggregate: route.dexAgg,
  };

  return result;
}

export function useComposedRoute(
  client: LeapClient,
  amountIn: string,
  sourceAsset?: string,
  sourceAssetChainID?: string,
  destinationAsset?: string,
  destinationAssetChainID?: string,
  walletClient?: WalletClient,
  enabled?: boolean
) {
  return useQuery({
    queryKey: [
      "solve-composed-route",
      amountIn,
      sourceAsset,
      sourceAssetChainID,
      destinationAsset,
      destinationAssetChainID,
      walletClient,
      enabled,
    ],
    queryFn: async () => {
      if (
        !sourceAsset ||
        !sourceAssetChainID ||
        !destinationAsset ||
        !destinationAssetChainID ||
        !walletClient?.getAccount
      ) {
        return;
      }

      const account = await walletClient.getAccount(sourceAssetChainID);
      const hasEVMPath = getEVMChainId(sourceAssetChainID) !== 0;

      if (hasEVMPath) {
        const evmRouteResponse = await makeEVMRouteResponse(
          client,
          amountIn,
          sourceAsset,
          sourceAssetChainID,
          destinationAsset,
          destinationAssetChainID
        );

        if (!evmRouteResponse || !evmRouteResponse.estimated_amount_out) {
          return;
        }

        console.log(evmRouteResponse);
        console.log(destinationAssetChainID);

        if (evmRouteResponse.dest_asset_chain_id == destinationAssetChainID) {
          console.log("same chain");
          return evmRouteResponse;
        }

        const convertRouteResponse = makeConvertERC20RouteResponse(
          cosmoToERCMap[sourceAssetChainID][sourceAsset].address,
          evmRouteResponse.estimated_amount_out,
          evmRouteResponse.dest_asset_denom,
          sourceAssetChainID,
          account
        );

        if (!convertRouteResponse) {
          return;
        }

        const routeResponse = await client.skipClient.fungible.getRoute({
          amount_in: convertRouteResponse.estimated_amount_out,
          source_asset_denom: convertRouteResponse.dest_asset_denom,
          source_asset_chain_id: convertRouteResponse.dest_asset_chain_id,
          dest_asset_denom: destinationAsset,
          dest_asset_chain_id: destinationAssetChainID,
        });

        if (!routeResponse.operations) {
          throw new Error("No route found");
        }

        if (!routeResponse) {
          return;
        }

        const fullRouteResponse = {
          source_asset_denom: sourceAsset,
          source_asset_chain_id: sourceAssetChainID,
          dest_asset_denom: destinationAsset,
          dest_asset_chain_id: destinationAssetChainID,
          amount_in: amountIn,
          operations: [
            ...evmRouteResponse.operations,
            ...convertRouteResponse.operations,
            ...routeResponse.operations,
          ],
          estimated_amount_out: routeResponse.estimated_amount_out,
          chain_ids: [],
          does_swap: true,
        };

        return fullRouteResponse;
      }

      const route = await client.skipClient.fungible.getRoute({
        amount_in: amountIn,
        source_asset_denom: sourceAsset,
        source_asset_chain_id: sourceAssetChainID,
        dest_asset_denom: destinationAsset,
        dest_asset_chain_id: destinationAssetChainID,
      });

      if (!route.operations) {
        throw new Error("No route found");
      }

      return route;
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled:
      enabled &&
      !!sourceAsset &&
      !!destinationAsset &&
      !!sourceAssetChainID &&
      !!destinationAssetChainID &&
      amountIn !== "0",
  });
}
