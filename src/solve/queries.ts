import { useQuery } from "@tanstack/react-query";
import { LeapClient } from "./client";
import {
  PostQuoteRequestDto,
  PostBuildRequestDto,
  MultiChainMsg,
  OperationWithSwap,
} from "./types";
import { RouteResponse } from "./client";
import { atom, useAtomValue } from "jotai";
import { useDebounce } from "./hooks";
import {
  cosmoToERCMap,
  ercToCosmoMap,
  cosmoToErcChainIdMap,
  tokenChainMap,
} from "./utils";
import { WalletClient } from "@cosmos-kit/core";
import { get } from "http";
import { use } from "react";
import { Route } from "next";
import chainIdToVenueNameMap from "../utils/utils";

import { SWAP_VENUES } from "@/config";
export function useAssets(client: LeapClient) {
  return useQuery({
    queryKey: ["solve-assets"],
    queryFn: async () => {
      const assets = await client.skipClient.fungible.getAssets();

      return assets;
    },
  });
}

export function useSolveChains(client: LeapClient) {
  return useQuery({
    queryKey: ["solve-chains"],
    queryFn: () => {
      return client.skipClient.chains();
    },
    placeholderData: [],
  });
}

export function useRoute(
  client: LeapClient,
  amountIn: string,
  sourceAsset?: string,
  sourceAssetChainID?: string,
  destinationAsset?: string,
  destinationAssetChainID?: string,
  enabled?: boolean
) {
  return useQuery({
    queryKey: [
      "solve-route",
      amountIn,
      sourceAsset,
      destinationAsset,
      sourceAssetChainID,
      destinationAssetChainID,
    ],
    queryFn: async () => {
      if (
        !sourceAsset ||
        !sourceAssetChainID ||
        !destinationAsset ||
        !destinationAssetChainID
      ) {
        return;
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

export const QUOTE_REFETCH_INTERVAL = 5000;
export function useEVMRoute(
  client: LeapClient,
  amountIn: string,
  sourceAsset?: string,
  sourceAssetChainID?: string,
  destinationAsset?: string,
  destinationAssetChainID?: string,
  enabled?: boolean
) {
  return useQuery({
    queryKey: [
      "quote",
      amountIn,
      sourceAsset,
      sourceAssetChainID,
      destinationAsset,
      destinationAssetChainID,
    ],
    queryFn: async () => {
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
        tokenInAddr: ercTokenInAddr.toLowerCase(),
        tokenOutAddr: ercTokenOutAddr.toLowerCase(),
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
