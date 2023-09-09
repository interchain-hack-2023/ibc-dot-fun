import { toBech32 } from "@cosmjs/encoding";
import { getChainByID } from "@/utils/utils";
import { MsgsRequest, RouteResponse, LeapClient } from "./client";
import {
  Asset,
  AssetWithMetadata,
  MetamaskTransaction,
  TokenV2,
} from "./types";
import { ethers, BigNumberish } from "ethers";

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

// export class SwapTransactionHelper {
//   private provider?: ethers.providers.Web3Provider;
//   private signer?: ethers.Signer;

//   public refreshProvider() {
//     this.provider = new ethers.providers.Web3Provider(
//       window.ethereum as unknown as ethers.providers.ExternalProvider
//     );
//     this.signer = this.provider.getSigner();
//   }

//   constructor() {
//     if (typeof window === "undefined" || typeof jest !== "undefined")
//       throw new Error(
//         "swap-helper should not executed in server-side or testing environment!"
//       );

//     if (window.ethereum) {
//       this.refreshProvider();
//     }
//   }

//   async getBalanceFromAddress(tokenAddress: string) {
//     if (!this.signer || !this.provider) throw new MetaMaskNotInstalledError();
//     try {
//       const address = await this.signer.getAddress();

//       const erc20 = IERC20__factory.connect(tokenAddress, this.signer);
//       return await erc20.balanceOf(address);
//     } catch (e: unknown) {
//       throw new ProviderError(
//         `Can't fetch erc20 balance: ${getErrorMessage(e)}`
//       );
//     }
//   }

//   async getNativeBalance() {
//     if (!this.signer || !this.provider) throw new MetaMaskNotInstalledError();
//     try {
//       const address = await this.signer.getAddress();

//       return this.provider.getBalance(address);
//     } catch (e: unknown) {
//       throw new ProviderError(
//         `Can't fetch native balance: ${getErrorMessage(e)}`
//       );
//     }
//   }

//   async getApprove(
//     contractAddress: string,
//     address: string,
//     amount: ethers.BigNumber
//   ) {
//     if (!this.signer || !this.provider) throw new MetaMaskNotInstalledError();
//     try {
//       const erc20 = IERC20__factory.connect(contractAddress, this.signer);
//       return await erc20.approve(address, amount);
//     } catch (e) {
//       throw new ProviderError(`Can't erc20 approve: ${getErrorMessage(e)}`);
//     }
//   }

//   async getPermit2Allowance(
//     permit2Address: string,
//     address: string,
//     contractAddress: string,
//     spender: string
//   ) {
//     if (!this.signer || !this.provider) throw new MetaMaskNotInstalledError();
//     try {
//       const permit2 = Permit2abi__factory.connect(
//         permit2Address.toLowerCase(),
//         this.signer
//       );
//       return await permit2.allowance(
//         address.toLowerCase(),
//         contractAddress.toLowerCase(),
//         spender.toLowerCase()
//       );
//     } catch (e) {
//       throw new ProviderError(
//         `Can't get allowance of permit2 contract: ${getErrorMessage(e)}`
//       );
//     }
//   }

//   validateTransactionInput(args: {
//     tokenInAddress?: string;
//     tokenIn?: TokenV2;
//     tokenOut?: TokenV2;
//   }) {
//     const { tokenInAddress, tokenIn, tokenOut } = args;
//     if (!tokenInAddress || !tokenIn || !tokenOut) {
//       throw new Error("Invalid input");
//     }
//   }
// }

// const swapTransactionHelper = (
//   typeof window === "undefined" || typeof jest !== "undefined"
//     ? null
//     : new SwapTransactionHelper()
// ) as SwapTransactionHelper;
// export default swapTransactionHelper;
