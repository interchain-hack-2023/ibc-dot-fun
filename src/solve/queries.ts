import { useQuery } from "@tanstack/react-query";
import { LeapClient } from "./client";
import { PostQuoteRequestDto } from "./types";
import { atom, useAtomValue } from "jotai";
import { useDebounce } from "./hooks";
import { cosmoToERCMap, ercToCosmoMap, cosmoToErcChainIdMap } from "./utils";
import { WalletClient } from "@cosmos-kit/core";
import { get } from "http";
import { getAccount } from "@/utils/utils";
import { use } from "react";
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
  walletClient: WalletClient,
  amountIn: string,
  sourceAsset?: string,
  sourceAssetChainID?: string,
  destinationAsset?: string,
  destinationAssetChainID?: string,
  useSourceAmount?: boolean,
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
      if (!useSourceAmount) {
        useSourceAmount = true;
      }

      const targetChainId: string = useSourceAmount
        ? sourceAssetChainID
        : destinationAssetChainID;

      if (!cosmoToErcChainIdMap[targetChainId]) {
        return;
      }

      const account = await getAccount(walletClient, targetChainId);
      const pk = Buffer.from(account.pubkey).toString("base64");

      const postQuoteRequest: PostQuoteRequestDto = {
        chainId: cosmoToErcChainIdMap[targetChainId],
        tokenInAddr: cosmoToERCMap[targetChainId][sourceAsset],
        tokenOutAddr: cosmoToERCMap[targetChainId][destinationAsset],
        from: pk,
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

      // if (!route.operations) {
      //   throw new Error("No route found");
      // }

      // return route;
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
