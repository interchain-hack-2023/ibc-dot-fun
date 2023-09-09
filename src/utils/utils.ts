import { useRef, useEffect } from "react";
import { EthSignType } from '@keplr-wallet/types';
import {
  EncodeObject,
  OfflineSigner,
  TxBodyEncodeObject,
  encodePubkey,
  makeAuthInfoBytes,
} from "@cosmjs/proto-signing";
import {
  SigningCosmWasmClient,
  SigningCosmWasmClientOptions,
} from "@cosmjs/cosmwasm-stargate";
import {
  AminoTypes,
  SignerData,
  SigningStargateClient,
  SigningStargateClientOptions,
  StargateClient,
  StdFee,
  createDefaultAminoConverters,
  accountFromAny,
} from "@cosmjs/stargate";
import { WalletClient, getFastestEndpoint } from "@cosmos-kit/core";
import { useChain, useManager } from "@cosmos-kit/react";
import * as chainRegistry from "chain-registry";
import {
  generateEndpointAccount,
  generatePostBodyBroadcast,
  generateEndpointBroadcast,
} from "@evmos/provider";

import { createTransactionPayload } from "@evmos/transactions";
import axios from "axios";
import {
  Chain,
  Fee,
  IBCMsgTransferParams,
  Sender,
  TxContext,
  createTxIBCMsgTransfer,
} from "@evmos/transactions";
import { createTxRaw, decodeEthermintAccount } from "@evmos/proto";

import Long from "long";
import {
  BaseAccount,
  ChainRestAuthApi,
  ChainRestTendermintApi,
  Msgs,
  TxRestClient,
  createTransaction,
  getTxRawFromTxRawOrDirectSignResponse,
} from "@injectivelabs/sdk-ts";
import {
  DEFAULT_BLOCK_TIMEOUT_HEIGHT,
  BigNumberInBase,
} from "@injectivelabs/utils";
import { KeplrClient } from "@cosmos-kit/keplr-extension";
import { CosmostationClient } from "@cosmos-kit/cosmostation-extension/dist/extension/client";
import { LeapClient } from "@cosmos-kit/leap-extension/dist/extension/client";
import { OfflineAminoSigner } from "@keplr-wallet/types";
import { makeSignDoc, encodeSecp256k1Pubkey } from "@cosmjs/amino";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { Int53 } from "@cosmjs/math";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { fromBase64 } from "@cosmjs/encoding";
import { createCosmosPayload } from "./transactions";
import { Proto } from "@evmos/proto";
import ethers from "ethers";
import { CompressedBatchProof } from "cosmjs-types/proofs";
import assert from "assert";

export function getChainByID(chainID: string) {
  return chainRegistry.chains.find(
    (chain) => chain.chain_id === chainID
  ) as (typeof chainRegistry.chains)[0];
}

// cache clients to reuse later
const STARGATE_CLIENTS: Record<string, StargateClient> = {};

export async function getStargateClientForChainID(chainID: string) {
  if (STARGATE_CLIENTS[chainID]) {
    return STARGATE_CLIENTS[chainID];
  }

  const chain = chainRegistry.chains.find(
    (chain) => chain.chain_id === chainID
  );

  if (!chain) {
    throw new Error(`Chain with ID ${chainID} not found`);
  }

  const preferredEndpoint = `https://ibc.fun/nodes/${chainID}`;

  try {
    const client = await StargateClient.connect(preferredEndpoint, {});

    STARGATE_CLIENTS[chainID] = client;

    return client;
  } catch {}

  const rpcEndpoints = chain.apis?.rpc ?? [];

  const endpoint = await getFastestEndpoint(
    rpcEndpoints.reduce((acc, endpoint) => {
      return [...acc, endpoint.address];
    }, [] as string[]),
    "rpc"
  );

  const client = await StargateClient.connect(endpoint, {});

  return client;
}

export async function getSigningStargateClientForChainID(
  chainID: string,
  signer: OfflineSigner,
  options?: SigningStargateClientOptions
) {
  const chain = chainRegistry.chains.find(
    (chain) => chain.chain_id === chainID
  );

  if (!chain) {
    throw new Error(`Chain with ID ${chainID} not found`);
  }

  const preferredEndpoint = `https://ibc.fun/nodes/${chainID}`;

  try {
    const client = await SigningStargateClient.connectWithSigner(
      preferredEndpoint,
      signer,
      options
    );

    console.log(`Connected to ${preferredEndpoint}`);

    return client;
  } catch {}

  const rpcEndpoints = chain.apis?.rpc ?? [];

  const endpoint = await getFastestEndpoint(
    rpcEndpoints.reduce((acc, endpoint) => {
      return [...acc, endpoint.address];
    }, [] as string[]),
    "rpc"
  );

  const client = await SigningStargateClient.connectWithSigner(
    endpoint,
    signer,
    options
  );

  return client;
}

export async function getAddressForChain(
  walletClient: WalletClient,
  chainId: string
) {
  if (walletClient.getOfflineSigner) {
    const signer = await walletClient.getOfflineSigner(chainId);
    const accounts = await signer.getAccounts();

    return accounts[0].address;
  }

  throw new Error("unsupported wallet");
}

export async function getSigningCosmWasmClientForChainID(
  chainID: string,
  signer: OfflineSigner,
  options?: SigningCosmWasmClientOptions
) {
  const chain = chainRegistry.chains.find(
    (chain) => chain.chain_id === chainID
  );

  if (!chain) {
    throw new Error(`Chain with ID ${chainID} not found`);
  }

  const preferredEndpoint = `https://ibc.fun/nodes/${chainID}`;
  try {
    const client = await SigningCosmWasmClient.connectWithSigner(
      preferredEndpoint,
      signer,
      options
    );

    return client;
  } catch {}

  const rpcEndpoints = chain.apis?.rpc ?? [];

  const endpoint = await getFastestEndpoint(
    rpcEndpoints.reduce((acc, endpoint) => {
      return [...acc, endpoint.address];
    }, [] as string[]),
    "rpc"
  );

  const client = await SigningCosmWasmClient.connectWithSigner(
    endpoint,
    signer,
    options
  );

  return client;
}

export async function createCosmosMessageMsgEthereumTx(
  chainId: string,
  nonce: bigint,
  gasPrice: bigint,
  gasLimit: bigint,
  to: string,
  value: bigint,
  data: string,
  from: string
): Promise<Proto.Ethermint.EVM.Tx.MsgEthereumTx> {
  if (!window.keplr) {
    throw new Error("Keplr not found");
  }
  const account = await window.keplr.getKey(chainId);
  const signature = await window.keplr.signEthereum(
    chainId,
    account.bech32Address,
    JSON.stringify({
      nonce: Number(nonce),
      gasPrice: Number(gasPrice),
      gasLimit: Number(gasLimit),
      to: to,
      value: Number(value),
      data: data,
    }), EthSignType.TRANSACTION);

  assert(signature.length === 65, "signature length is invalid");

  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  const v = signature.slice(64, 65);
  const transaction: ethers.TransactionLike = {
    nonce: Number(nonce),
    gasPrice: gasPrice,
    gasLimit: gasLimit,
    to: to,
    value: value,
    data: data,
    signature: {
      r: ethers.hexlify(r), s: ethers.hexlify(s), v: ethers.hexlify(v),
    },
  };

  const hash = ethers.Transaction.from(transaction).hash;
  if (!hash) {
    throw new Error("Signature is empty");
  }

  const ethTx = new Proto.Ethermint.EVM.Tx.LegacyTx({
    nonce: nonce,
    gasPrice: gasPrice.toString(),
    gas: gasLimit,
    to: to,
    value: value.toString(),
    data: ethers.getBytes(data),
    r: r,
    s: s,
    v: v,
  });

  return new Proto.Ethermint.EVM.Tx.MsgEthereumTx({
    // @ts-ignore
    data: ethTx,
    size: ethTx.toBinary().length, // deprecated
    hash: hash,
    from: from,
  });
}

export const accountParser = (account: any) => {
  try {
    return decodeEthermintAccount(account);
  } catch {
    return accountFromAny(account);
  }
};

export async function signAndBroadcastEvmosRaw(
  walletClient: WalletClient,
  signerAddress: string,
  payload: Proto.Ethermint.EVM.Tx.MsgEthereumTx
) {
  const chainID = "evmos_9001-2";
  const result = await axios.get(
    `https://rest.bd.evmos.org:1317${generateEndpointAccount(signerAddress)}`
  );
  const account = await getAccount(walletClient, chainID);
  const pk = Buffer.from(account.pubkey).toString("base64");
  const chain: Chain = {
    chainId: 9001,
    cosmosChainId: "evmos_9001-2",
  };
  // Populate the transaction sender parameters using the
  // query API.
  const sender: Sender = {
    accountAddress: signerAddress,
    sequence: result.data.account.base_account.sequence,
    accountNumber: result.data.account.base_account.account_number,
    // Use the public key from the account query, or retrieve
    // the public key from the code snippet above.
    pubkey: pk,
  };
  const fee: Fee = {
    amount: "4000000000000000",
    denom: "aevmos",
    gas: "200000",
  };
  const memo = "";
  const context: TxContext = {
    chain,
    sender,
    fee,
    memo,
  };
  const tx = createCosmosPayload(context, payload);
  const { signDirect } = tx;
  const signer = await getOfflineSigner(walletClient, chainID);
  const signResponse = await signer.signDirect(sender.accountAddress, {
    bodyBytes: signDirect.body.toBinary(),
    authInfoBytes: signDirect.authInfo.toBinary(),
    chainId: chain.cosmosChainId,
    accountNumber: new Long(sender.accountNumber),
  });
  if (!signResponse) {
    // Handle signature failure here.
    throw new Error("Signature failed");
  }
  const signatures = [
    new Uint8Array(Buffer.from(signResponse.signature.signature, "base64")),
  ];
  const { signed } = signResponse;
  const signedTx = createTxRaw(
    signed.bodyBytes,
    signed.authInfoBytes,
    signatures
  );
  const response = await axios.post(
    `https://rest.bd.evmos.org:1317${generateEndpointBroadcast()}`,
    generatePostBodyBroadcast(signedTx, "BROADCAST_MODE_BLOCK")
  );
  return response.data.tx_response;
}

export async function signAndBroadcastEvmos(
  walletClient: WalletClient,
  signerAddress: string,
  params: IBCMsgTransferParams
) {
  const chainID = "evmos_9001-2";
  const result = await axios.get(
    `https://rest.bd.evmos.org:1317${generateEndpointAccount(signerAddress)}`
  );
  const account = await getAccount(walletClient, chainID);
  const pk = Buffer.from(account.pubkey).toString("base64");
  const chain: Chain = {
    chainId: 9001,
    cosmosChainId: "evmos_9001-2",
  };
  // Populate the transaction sender parameters using the
  // query API.
  const sender: Sender = {
    accountAddress: signerAddress,
    sequence: result.data.account.base_account.sequence,
    accountNumber: result.data.account.base_account.account_number,
    // Use the public key from the account query, or retrieve
    // the public key from the code snippet above.
    pubkey: pk,
  };
  const fee: Fee = {
    amount: "4000000000000000",
    denom: "aevmos",
    gas: "200000",
  };
  const memo = "";
  const context: TxContext = {
    chain,
    sender,
    fee,
    memo,
  };
  const tx = createTxIBCMsgTransfer(context, params);
  const { signDirect } = tx;
  const signer = await getOfflineSigner(walletClient, chainID);
  const signResponse = await signer.signDirect(sender.accountAddress, {
    bodyBytes: signDirect.body.toBinary(),
    authInfoBytes: signDirect.authInfo.toBinary(),
    chainId: chain.cosmosChainId,
    accountNumber: new Long(sender.accountNumber),
  });
  if (!signResponse) {
    // Handle signature failure here.
    throw new Error("Signature failed");
  }
  const signatures = [
    new Uint8Array(Buffer.from(signResponse.signature.signature, "base64")),
  ];
  const { signed } = signResponse;
  const signedTx = createTxRaw(
    signed.bodyBytes,
    signed.authInfoBytes,
    signatures
  );
  const response = await axios.post(
    `https://rest.bd.evmos.org:1317${generateEndpointBroadcast()}`,
    generatePostBodyBroadcast(signedTx, "BROADCAST_MODE_BLOCK")
  );
  return response.data.tx_response;
}

export async function signAndBroadcastInjective(
  walletClient: WalletClient,
  signerAddress: string,
  msgs: Msgs | Msgs[],
  fee: StdFee
) {
  const chainID = "injective-1";
  const restEndpoint = "https://lcd.injective.network";

  const chainRestAuthApi = new ChainRestAuthApi(restEndpoint);

  const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
    signerAddress
  );
  const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse);

  /** Block Details */
  const chainRestTendermintApi = new ChainRestTendermintApi(restEndpoint);
  const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
  const latestHeight = latestBlock.header.height;
  const timeoutHeight = new BigNumberInBase(latestHeight).plus(
    DEFAULT_BLOCK_TIMEOUT_HEIGHT
  );

  const account = await getAccount(walletClient, chainID);
  const pk = Buffer.from(account.pubkey).toString("base64");

  const { signDoc } = createTransaction({
    pubKey: pk,
    chainId: chainID,
    message: msgs,
    sequence: baseAccount.sequence,
    accountNumber: baseAccount.accountNumber,
    timeoutHeight: timeoutHeight.toNumber(),
    fee,
  });

  const signer = await getOfflineSigner(walletClient, chainID);

  const directSignResponse = await signer.signDirect(
    signerAddress,
    // @ts-ignore
    signDoc
  );

  const txRaw = getTxRawFromTxRawOrDirectSignResponse(directSignResponse);

  const txRestClient = new TxRestClient(restEndpoint);

  const tx = await txRestClient.broadcast(txRaw, {
    // @ts-ignore
    mode: "sync",
  });

  return tx;
}

// generic wrapper to support enabling chains on many different wallets
export async function enableChains(
  walletClient: WalletClient,
  chains: string[]
) {
  if (walletClient.enable) {
    return walletClient.enable(chains);
  }

  // @ts-ignore
  if (walletClient.ikeplr) {
    // @ts-ignore
    return walletClient.ikeplr.enable(chains);
  }

  throw new Error("Unsupported wallet");
}

export async function getAccount(walletClient: WalletClient, chainId: string) {
  if (walletClient.getAccount) {
    return walletClient.getAccount(chainId);
  }

  throw new Error("unsupported wallet");
}

export async function getOfflineSigner(
  walletClient: WalletClient,
  chainId: string
) {
  if (walletClient.getOfflineSignerDirect) {
    return walletClient.getOfflineSignerDirect(chainId);
  }

  throw new Error("unsupported wallet");
}

export async function getOfflineSignerOnlyAmino(
  walletClient: WalletClient,
  chainId: string
) {
  if (walletClient.getOfflineSignerAmino) {
    const signer = walletClient.getOfflineSignerAmino(chainId);
    return signer;
  }

  throw new Error("unsupported wallet");
}

export function getFee(chainID: string) {
  const chain = getChainByID(chainID);

  const feeInfo = chain.fees?.fee_tokens[0];

  if (!feeInfo) {
    throw new Error("No fee info found");
  }

  let averageGasPrice = 0;
  if (feeInfo.average_gas_price) {
    averageGasPrice = feeInfo.average_gas_price;
  }

  const amountNeeded = averageGasPrice * 1000000;

  return amountNeeded;
}

export async function isLedger(walletClient: WalletClient, chainID: string) {
  if (walletClient instanceof KeplrClient && window.keplr) {
    const key = await window.keplr.getKey(chainID);
    return key.isNanoLedger;
  }

  if (walletClient instanceof CosmostationClient) {
    // @ts-ignore
    const account = await window.cosmostation.cosmos.request({
      method: "cos_account",
      params: { chainName: chainID },
    });
    return account.isLedger;
  }

  if (walletClient instanceof LeapClient) {
    // @ts-ignore
    const key = await window.leap.getKey(chainID);

    return key.isNanoLedger;
  }

  return false;
}

// TODO: planning on refactoring the tx process, where this will find a better home.
export async function signAmino(
  client: SigningStargateClient,
  signer: OfflineAminoSigner,
  signerAddress: string,
  messages: readonly EncodeObject[],
  fee: StdFee,
  memo: string,
  { accountNumber, sequence, chainId }: SignerData
) {
  const aminoTypes = new AminoTypes(createDefaultAminoConverters());

  const accountFromSigner = (await signer.getAccounts()).find(
    (account) => account.address === signerAddress
  );
  if (!accountFromSigner) {
    throw new Error("Failed to retrieve account from signer");
  }

  const pubkey = encodePubkey(encodeSecp256k1Pubkey(accountFromSigner.pubkey));

  const signMode = SignMode.SIGN_MODE_LEGACY_AMINO_JSON;

  const msgs = messages.map((msg) => aminoTypes.toAmino(msg));

  msgs[0].value.memo = messages[0].value.memo;

  const signDoc = makeSignDoc(
    msgs,
    fee,
    chainId,
    memo,
    accountNumber,
    sequence
  );

  const { signature, signed } = await signer.signAmino(signerAddress, signDoc);

  const signedTxBody = {
    messages: signed.msgs.map((msg) => aminoTypes.fromAmino(msg)),
    memo: signed.memo,
  };

  signedTxBody.messages[0].value.memo = messages[0].value.memo;

  const signedTxBodyEncodeObject: TxBodyEncodeObject = {
    typeUrl: "/cosmos.tx.v1beta1.TxBody",
    value: signedTxBody,
  };

  const signedTxBodyBytes = client.registry.encode(signedTxBodyEncodeObject);

  const signedGasLimit = Int53.fromString(signed.fee.gas).toNumber();
  const signedSequence = Int53.fromString(signed.sequence).toNumber();

  const signedAuthInfoBytes = makeAuthInfoBytes(
    [{ pubkey, sequence: signedSequence }],
    signed.fee.amount,
    signedGasLimit,
    signed.fee.granter,
    signed.fee.payer,
    signMode
  );

  return TxRaw.fromPartial({
    bodyBytes: signedTxBodyBytes,
    authInfoBytes: signedAuthInfoBytes,
    signatures: [fromBase64(signature.signature)],
  });
}
