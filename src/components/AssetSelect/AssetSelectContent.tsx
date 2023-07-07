/* eslint-disable @next/next/no-img-element */
import { Asset } from "@/cosmos";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { ethers, toBigInt } from "ethers";
import { FC, useEffect, useRef, useState } from "react";

interface Props {
  assets?: Asset[];
  balances: Record<string, string>;
  onChange?: (asset: Asset) => void;
  onClose: () => void;
  showChainInfo?: boolean;
}

const AssetSelectContent: FC<Props> = ({
  assets,
  balances,
  onChange,
  onClose,
  showChainInfo,
}) => {
  const inputEl = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputEl.current?.focus();
  }, []);

  const [searchValue, setSearchValue] = useState("");

  const sortedAssets = assets
    ?.sort((a, b) => {
      if (a.symbol > b.symbol) {
        return 1;
      }

      if (a.symbol < b.symbol) {
        return -1;
      }

      return 0;
    })
    .sort((a, b) => {
      const balanceA = balances[a.denom] ? toBigInt(balances[a.denom]) : 0n;
      const balanceB = balances[b.denom] ? toBigInt(balances[b.denom]) : 0n;

      if (balanceA > balanceB) return -1;
      if (balanceA < balanceB) return 1;

      return 0;
    });

  const filteredAssets = sortedAssets?.filter((asset) => {
    if (!searchValue) return true;

    if (asset.symbol.toLowerCase().includes(searchValue.toLowerCase())) {
      return true;
    }

    return asset.denom.toLowerCase().includes(searchValue.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full px-4 py-6 space-y-6">
      <div>
        <div className="flex items-center gap-4">
          <button
            className="hover:bg-neutral-100 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            onClick={onClose}
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          <p className="font-bold text-xl">Select Token</p>
        </div>
      </div>
      <div>
        <input
          className="w-full border p-4 rounded-md"
          type="text"
          placeholder="Search name or paste address"
          onChange={(e) => setSearchValue(e.target.value)}
          value={searchValue}
          ref={inputEl}
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto scrollbar-hide">
          {filteredAssets?.map((asset) => (
            <button
              className="flex text-left w-full items-center gap-4 hover:bg-[#ECD9D9] p-4 rounded-lg transition-colors"
              key={`${asset.chainID}-${asset.denom}`}
              onClick={() => {
                onClose();

                if (!onChange) {
                  return;
                }

                onChange(asset);
              }}
            >
              <img
                alt={asset.symbol}
                className="w-12 h-12 rounded-full"
                src={asset.image}
                onError={(e) =>
                  (e.currentTarget.src =
                    "https://api.dicebear.com/6.x/shapes/svg")
                }
              />
              <div className="flex-1">
                <p className="font-semibold text-lg">{asset.symbol}</p>
                {showChainInfo && (
                  <p className="text-sm text-neutral-400">{asset.chainID}</p>
                )}
              </div>
              <div>
                {balances[asset.denom] && (
                  <p className="font-medium text-sm text-neutral-400">
                    {ethers.formatUnits(balances[asset.denom], asset.decimals)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AssetSelectContent;