import { LeapClient, RouteResponse } from "./client";
import { useRoute } from './queries'
import { useQuery } from "@tanstack/react-query";


const chainIdToVenueNameMap = new Map<string, string>();
chainIdToVenueNameMap.set("evmos_9001-1", "evmos-dex");
chainIdToVenueNameMap.set("cronosmainnet_25-1", "cronos-dex");

function useConvertERC20(
  contractAddress: string,
  amount: string,
  receiver: string,
  sender: string,
  asset: string,
  assetChainId: string,
  enabled?: boolean) {

  const venueName = chainIdToVenueNameMap.get(assetChainId);

  if (!venueName) {
    throw new Error(`No venue name for chain id ${assetChainId}`);
  }

  return useQuery({
    queryKey: [
      "solve-convert-erc20",
      contractAddress,
      amount,
      receiver,
      sender,
    ],
    queryFn: function (): RouteResponse {
      return {
        source_asset_denom: asset,
        source_asset_chain_id: assetChainId,
        dest_asset_denom: asset,
        dest_asset_chain_id: assetChainId,
        amount_in: amount,
        operations: [
          {
            erc20Convert: {
              convert_message: {
                contractAddress: contractAddress,
                amount: amount,
                receiver: receiver,
                sender: sender,
              },
              convert_operation: {
                // TODO: get denom of erc20 and coin pair
                denom: asset,
                venue: {
                  name: venueName,
                  chain_id: assetChainId,
                }
              }
            }
          }
        ],
        chain_ids: [],
        does_swap: false,
      }
    },
    enabled: enabled,
  })
}

export function useComposedRoute(
  client: LeapClient,
  amountIn: string,
  sourceAsset?: string,
  sourceAssetChainID?: string,
  destinationAsset?: string,
  destinationAssetChainID?: string,
  enabled?: boolean
) {

  // const isERC20Source = false;
  // // 1. check if sourceAsset is a ERC20
  // if (!isERC20Source) {
  //   return useRoute(
  //     client,
  //     amountIn,
  //     sourceAsset,
  //     sourceAssetChainID,
  //     destinationAsset,
  //     destinationAssetChainID,
  //     enabled
  //   );
  // }

  // const convert = useConvertERC20("", "", "", "", "", enabled);
  //
  // // 2. Split path to ERC20 swap and cosmos route path.
  //
  // const evmRoutes = useRoute(
  //   client,
  //   amountIn,
  //   sourceAsset,
  //   sourceAssetChainID,
  //   destinationAsset,
  //   destinationAssetChainID,
  //   enabled
  // );
  //
  // return evmRoutes;
  return useRoute(
    client,
    amountIn,
    sourceAsset,
    sourceAssetChainID,
    destinationAsset,
    destinationAssetChainID,
    enabled
  );
}
