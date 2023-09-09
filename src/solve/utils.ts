import { toBech32 } from "@cosmjs/encoding";
import { getChainByID } from "@/utils/utils";
import { MsgsRequest, RouteResponse, LeapClient } from "./client";
import {
  Asset,
  AssetWithMetadata,
  MetamaskTransaction,
  ChainMetadata,
  Chain,
  PostQuoteRequestDto,
  TokenV2,
} from "./types";
import { ethers, BigNumberish } from "ethers";
import { atom } from "jotai";

import { CHAINS_RESPONSE } from "../../fixtures/chains";
import { ASSETS_RESPONSE } from "../../fixtures/assets";

export function assetHasMetadata(asset: Asset) {
  if (!asset.decimals) {
    return false;
  }

  if (!asset.symbol) {
    return false;
  }

  if (!asset.name) {
    return false;
  }

  if (!asset.logo_uri) {
    return false;
  }

  return true;
}

export function isAssetWithMetadata(asset: Asset): asset is AssetWithMetadata {
  return assetHasMetadata(asset);
}

export function filterAssetsWithMetadata(assets: Asset[]) {
  return assets.filter(isAssetWithMetadata);
}

const ASSETS_MAP: Record<
  string,
  Record<string, Asset[]>
> = ASSETS_RESPONSE.chain_to_assets_map;

const CHAIN_MAP = CHAINS_RESPONSE.chains;
// convert token config from cosmos to erc
export const cosmoToERCMap: Record<
  string,
  Record<string, string>
> = getCosmoToErcMap();

function getCosmoToErcMap() {
  const dictionary: Record<string, Record<string, string>> = {};
  for (const chainID in ASSETS_MAP) {
    if (getEVMChainId(chainID) != 0) {
      ASSETS_MAP[chainID].assets.forEach((assetItem) => {
        if (assetItem.evm_address) {
          if (!dictionary[chainID]) {
            dictionary[chainID] = {};
          } else {
            dictionary[chainID][assetItem.denom] = assetItem.evm_address;
          }
        }
      });
    }
  }
  return dictionary;
}

function getErcToCosmoMap() {
  const dictionary: Record<string, Record<string, string>> = {};
  for (const chainID in ASSETS_MAP) {
    if (getEVMChainId(chainID) != 0) {
      ASSETS_MAP[chainID].assets.forEach((assetItem) => {
        if (assetItem.evm_address) {
          if (!dictionary[chainID]) {
            dictionary[chainID] = {};
          } else {
            dictionary[chainID][assetItem.evm_address] = assetItem.denom;
          }
        }
      });
    }
  }
  return dictionary;
}

export const ercToCosmoMap: Record<
  string,
  Record<string, string>
> = getErcToCosmoMap();

function getCosmoToErcChainIdMap() {
  const dictionary: Record<string, number> = {};
  for (const chains of CHAIN_MAP) {
    if (chains.evm_chain_id) {
      dictionary[chains.chain_id] = chains.evm_chain_id;
    }
  }
  return dictionary;
}

export const cosmoToErcChainIdMap: Record<string, number> =
  getCosmoToErcChainIdMap();

export function getEVMChainId(chainId: string): number {
  // evmos and cronos
  if (chainId == "evmos_9001-2") {
    return 9001;
  } else if (chainId == "cronosmainnet_25-1") {
    return 25;
  } else {
    return 0;
  }
}

export async function getNumberOfTransactionsFromRoute(route: RouteResponse) {
  const userAddresses: Record<string, string> = {};
  for (const chainID of route.chain_ids) {
    const chain = getChainByID(chainID);

    // fake address
    userAddresses[chainID] = toBech32(
      chain.bech32_prefix,
      Uint8Array.from(Array.from({ length: 20 }))
    );
  }

  const msgRequest: MsgsRequest = {
    source_asset_denom: route.source_asset_denom,
    source_asset_chain_id: route.source_asset_chain_id,
    dest_asset_denom: route.dest_asset_denom,
    dest_asset_chain_id: route.dest_asset_chain_id,
    amount_in: route.amount_in,
    operations: route.operations,

    estimated_amount_out: route.estimated_amount_out,
    chain_ids_to_addresses: userAddresses,
    slippage_tolerance_percent: "0.05",
  };

  const leapClient = new LeapClient();

  const msgsResponse = await leapClient.skipClient.fungible.getMessages(
    msgRequest
  );

  return msgsResponse.msgs.length;
}

export const chainMetaDataListAtom = atom<ChainMetadata[]>([]);

export const pageModeAtom = atom<"swap" | "flash">("swap");
export const tokenInAddressAtom = atom<string | undefined>(undefined);
export const signParamsTypeAtom = atom<"max" | "fit">("max");

export const balanceUpdateTimestampAtom = atom(0);
export const tokenOutAddressAtom = atom<string | undefined>(undefined);

export const txInProgressAtom = atom<{
  txHash: string;
  status: "waiting" | "done";
} | null>(null);

export function compareTokenAddress(a: string, b: string) {
  return a.toLocaleLowerCase() == b.toLocaleLowerCase();
}

export const queryKeys = {
  balance: {
    v2: (chainId: number, walletAddress: string) =>
      ["balance-v2", { chainId, walletAddress }] as const,
  },

  quote: {
    calculate: (
      endpoint: string,
      params: PostQuoteRequestDto
    ): [string, PostQuoteRequestDto & { endpoint: string }] => [
      "quote",
      { ...params, endpoint },
    ],
  },
};
