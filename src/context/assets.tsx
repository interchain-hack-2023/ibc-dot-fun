import {
  FC,
  PropsWithChildren,
  createContext,
  useContext,
  useMemo,
} from "react";
import { Chain, useChains } from "./chains";
import {
  Asset,
  AssetWithMetadata,
  filterAssetsWithMetadata,
  useLeapClient,
  useAssets as useSolveAssets,
} from "../solve";

interface AssetsContext {
  assets: Record<string, AssetWithMetadata[]>;
  assetsByChainID: (chainID: string) => AssetWithMetadata[];
  getAsset(denom: string, chainID: string): AssetWithMetadata | undefined;
  getFeeDenom(chainID: string): AssetWithMetadata | undefined;
  getNativeAssets(): AssetWithMetadata[];
}

export const AssetsContext = createContext<AssetsContext>({
  assets: {},
  assetsByChainID: () => [],
  getAsset: () => undefined,
  getFeeDenom: () => undefined,
  getNativeAssets: () => [],
});

function getAssetSymbol(
  asset: AssetWithMetadata,
  assets: Asset[],
  chains: Chain[]
) {
  const hasDuplicates =
    (assets?.filter((a) => a.symbol === asset.symbol).length ?? 0) > 1;

  if (hasDuplicates) {
    const originChain = chains.find(
      (c) => c.chain_id === asset.origin_chain_id
    );
    const originChainName = originChain?.prettyName ?? asset.origin_chain_id;

    return `${originChainName} ${asset.symbol}`;
  }

  return asset.symbol;
}

export const AssetsProvider: FC<PropsWithChildren> = ({ children }) => {
  const leapClient = useLeapClient();

  const { chains } = useChains();

  const { data: solveAssets } = useSolveAssets(leapClient);

  const assets = useMemo(() => {
    if (!solveAssets) {
      return {};
    }

    return Object.entries(solveAssets).reduce((acc, [chainID, assets]) => {
      return {
        ...acc,
        [chainID]: filterAssetsWithMetadata(assets).map((asset) => ({
          ...asset,
          symbol: getAssetSymbol(asset, assets, chains),
        })),
      };
    }, {} as Record<string, AssetWithMetadata[]>);
  }, [chains, solveAssets]);

  function assetsByChainID(chainID: string) {
    return assets[chainID] || [];
  }

  function getAsset(denom: string, chainID: string) {
    const asset = assets[chainID]?.find((asset) => asset.denom === denom);

    return asset;
  }

  function getFeeDenom(chainID: string) {
    const chain = chains.find((c) => c.chain_id === chainID);

    if (!chain || !chain.record?.chain.fees) {
      return undefined;
    }

    const feeDenom = chain.record.chain.fees.fee_tokens[0].denom;

    return getAsset(feeDenom, chainID);
  }

  function getNativeAssets() {
    const nativeAssets: AssetWithMetadata[] = [];

    for (const chainAssetList of Object.values(assets)) {
      for (const asset of chainAssetList) {
        if (asset.chain_id === asset.origin_chain_id) {
          nativeAssets.push(asset);
        }
      }
    }

    return nativeAssets;
  }

  return (
    <AssetsContext.Provider
      value={{
        assets,
        assetsByChainID,
        getAsset,
        getFeeDenom,
        getNativeAssets,
      }}
    >
      {children}
    </AssetsContext.Provider>
  );
};

export function useAssets() {
  return useContext(AssetsContext);
}
