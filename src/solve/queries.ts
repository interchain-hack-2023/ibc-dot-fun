import { useQuery } from "@tanstack/react-query";
import { LeapClient } from "./client";

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

// export function getChainMetadata(client: LeapClient, chainId: number) {
//   const { data } = client.https.get<GetMetadataResponseDto>(
//     `${process.env.NEXT_PUBLIC_API_ENDPOINT}/v1/chains/${chainId}/metadata`
//   );
//   return data.result;
// }
