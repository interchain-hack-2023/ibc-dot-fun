import {
  enableChains,
  getAddressForChain,
  getChainByID,
  getOfflineSigner,
  getOfflineSignerOnlyAmino,
  getSigningCosmWasmClientForChainID,
  getSigningStargateClientForChainID,
  getStargateClientForChainID,
  isLedger,
  signAmino,
  signAndBroadcastEvmos,
  signAndBroadcastInjective,
  getAccount,
  createCosmosMessageMsgEthereumTx,
  signAndBroadcastEvmosRaw,
} from "@/utils/utils";

import { evmosToEth } from "@evmos/address-converter";
import { getBigInt, keccak256 } from "ethers";

import {
  getEVMChainId,
  cosmoToERCMap,
  cosmoToErcChainIdMap,
  tokenChainMap,
} from "./utils";
import { EncodeObject, OfflineSigner, coin } from "@cosmjs/proto-signing";
import { GasPrice, DeliverTxResponse } from "@cosmjs/stargate";
import { MsgTransfer as MsgTransferInjective } from "@injectivelabs/sdk-ts";
import { WalletClient } from "@cosmos-kit/core";
import { LeapClient, MsgsRequest, RouteResponse } from "./client";
import Long from "long";
import { OfflineAminoSigner } from "@keplr-wallet/types";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { MsgsResponse } from "./client";
import { PostBuildRequestDto, MetamaskTransaction } from "./types";

import { ethers } from "ethers";
import { MsgEthereumTx } from "@evmos/proto/dist/proto/ethermint/evm/tx";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function buildEVMHexData(
  leapClient: LeapClient,
  evmSenderAddr: string,
  route: RouteResponse
) {
  if (!route.dex_aggregate) {
    throw new Error("No dex aggregate found");
  }
  const cosmoTargetChainTokenIn: string =
    tokenChainMap[route.source_asset_chain_id][
      cosmoToERCMap[route.source_asset_chain_id][route.source_asset_denom].name
    ];
  const cosmoTargetChainTokenOut: string =
    tokenChainMap[route.source_asset_chain_id][
      cosmoToERCMap[route.source_asset_chain_id][route.dest_asset_denom].name
    ];

  const ercTokenInAddr: string =
    cosmoToERCMap[route.source_asset_chain_id][cosmoTargetChainTokenIn].address;
  const ercTokenOutAddr: string =
    cosmoToERCMap[route.source_asset_chain_id][cosmoTargetChainTokenOut]
      .address;

  const postBuildRequestDto: PostBuildRequestDto = {
    chainId: cosmoToErcChainIdMap[route.source_asset_chain_id].chainId,
    tokenInAddr: ercTokenInAddr.toLowerCase(),
    tokenOutAddr: ercTokenOutAddr.toLowerCase(),
    from: evmSenderAddr,
    amount: route.amount_in,
    slippageBps: 100,
    maxSplit: 15,
    dexAgg: route.dex_aggregate,
  };

  return await leapClient.evm.postBuild(postBuildRequestDto);
}

async function getEVMConfig(address: string, chainID: string) {
  const provider = new ethers.JsonRpcProvider(
    cosmoToErcChainIdMap[chainID].rpc
  );
  const nonce = await provider.getTransactionCount(address);
  let gasPrice;
  try {
    gasPrice = await provider._perform({ method: "getGasPrice" });
  } catch (error) {
    gasPrice = getBigInt(250000000000);
  }

  return { nonce, gasPrice };
}

export async function executeRoute(
  leapClient: LeapClient,
  walletClient: WalletClient,
  route: RouteResponse,
  onTxSuccess: (tx: any, index: number) => void,
  onError: (error: any) => void
) {
  await enableChains(walletClient, route.chain_ids);

  const userAddresses: Record<string, string> = {};

  // get addresses
  for (const chainID of route.chain_ids) {
    const address = await getAddressForChain(walletClient, chainID);

    userAddresses[chainID] = address;
  }

  let evmExtensionMsgs: MsgsResponse | undefined = undefined;
  if (getEVMChainId(route.source_asset_chain_id) != 0) {
    const cosmoTargetChainTokenIn: string =
      tokenChainMap[route.source_asset_chain_id][
        cosmoToERCMap[route.source_asset_chain_id][route.source_asset_denom]
          .name
      ];
    const cosmoTargetChainTokenOut: string =
      tokenChainMap[route.source_asset_chain_id][
        cosmoToERCMap[route.dest_asset_chain_id][route.dest_asset_denom].name
      ];

    const ercTokenInAddr: string =
      cosmoToERCMap[route.source_asset_chain_id][cosmoTargetChainTokenIn]
        .address;
    const ercTokenOutAddr: string =
      cosmoToERCMap[route.source_asset_chain_id][cosmoTargetChainTokenOut]
        .address;

    if (ercTokenInAddr && ercTokenOutAddr) {
      const account = await getAccount(
        walletClient,
        route.source_asset_chain_id
      );

      const evmSenderAddr = evmosToEth(account.address);
      const { nonce, gasPrice } = await getEVMConfig(
        evmSenderAddr,
        route.source_asset_chain_id
      );
      const buildResult: MetamaskTransaction = await buildEVMHexData(
        leapClient,
        evmSenderAddr,
        route
      );

      const evmTx = await createCosmosMessageMsgEthereumTx(
        route.source_asset_chain_id,
        getBigInt(nonce),
        gasPrice,
        getBigInt(buildResult.gasLimit),
        buildResult.to,
        getBigInt(buildResult.value),
        buildResult.data,
        evmSenderAddr
      );

      const evmMsg = {
        chain_id: route.source_asset_chain_id,
        path: [route.source_asset_chain_id],
        msg: evmTx.toJsonString(),
        msg_type_url: "/ethermint.evm.v1.DynamicFeeTx",
      };
      evmExtensionMsgs = {
        msgs: [evmMsg],
      };

      if (route.source_asset_chain_id !== route.dest_asset_chain_id) {
        const msgRequest: MsgsRequest = {
          source_asset_denom: cosmoTargetChainTokenOut,
          source_asset_chain_id: route.source_asset_chain_id,
          dest_asset_denom: route.dest_asset_denom,
          dest_asset_chain_id: route.dest_asset_chain_id,
          amount_in: route.estimated_amount_out?.toString() ?? "0",
          chain_ids_to_addresses: userAddresses,
          operations: route.operations,

          estimated_amount_out: route.estimated_amount_out,
          slippage_tolerance_percent: "5.0",
          affiliates: [],
        };

        const connectorWithSkipMsgs =
          await leapClient.skipClient.fungible.getMessages(msgRequest);
        evmExtensionMsgs.msgs = [
          ...evmExtensionMsgs.msgs,
          ...connectorWithSkipMsgs.msgs,
        ];
      }
    }
  }

  if (!evmExtensionMsgs) {
    const msgRequest: MsgsRequest = {
      source_asset_denom: route.source_asset_denom,
      source_asset_chain_id: route.source_asset_chain_id,
      dest_asset_denom: route.dest_asset_denom,
      dest_asset_chain_id: route.dest_asset_chain_id,
      amount_in: route.amount_in,
      chain_ids_to_addresses: userAddresses,
      operations: route.operations,

      estimated_amount_out: route.estimated_amount_out,
      slippage_tolerance_percent: "5.0",
      affiliates: [],
    };

    evmExtensionMsgs = await leapClient.skipClient.fungible.getMessages(
      msgRequest
    );
  }

  // const tx = await client.evm.postBuild(postBuildRequestDto);

  // check balances on chains where a tx is initiated
  for (let i = 0; i < evmExtensionMsgs.msgs.length; i++) {
    const multiHopMsg = evmExtensionMsgs.msgs[i];

    const chain = getChainByID(multiHopMsg.chain_id);

    const client = await getStargateClientForChainID(multiHopMsg.chain_id);

    const feeInfo = chain.fees?.fee_tokens[0];

    if (!feeInfo) {
      throw new Error("No fee info found");
    }

    let gasNeeded = 300000;
    if (
      route.does_swap &&
      route.swap_venue?.chain_id === multiHopMsg.chain_id
    ) {
      gasNeeded = 1500000;
    }

    let averageGasPrice = 0;
    if (feeInfo.average_gas_price) {
      averageGasPrice = feeInfo.average_gas_price;
    }

    let amountNeeded = getBigInt(0);
    if (multiHopMsg.msg_type_url === "/ethermint.evm.v1.DynamicFeeTx") {
      if (
        cosmoToERCMap[multiHopMsg.chain_id][route.source_asset_denom]
          .address === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
      ) {
        amountNeeded += getBigInt(route.amount_in);
      }
    }

    amountNeeded += getBigInt(averageGasPrice * gasNeeded);

    const balance = await client.getBalance(
      userAddresses[multiHopMsg.chain_id],
      feeInfo.denom
    );

    if (getBigInt(balance.amount) < amountNeeded) {
      throw new Error(
        `Insufficient fee token to initiate transfer on ${multiHopMsg.chain_id}. Need ${amountNeeded} ${feeInfo.denom}, but only have ${balance.amount} ${feeInfo.denom}.`
      );
    }
  }

  for (let i = 0; i < evmExtensionMsgs.msgs.length; i++) {
    const multiHopMsg = evmExtensionMsgs.msgs[i];

    const signerIsLedger = await isLedger(walletClient, multiHopMsg.chain_id);

    let signer: OfflineSigner;
    if (signerIsLedger) {
      signer = await getOfflineSignerOnlyAmino(
        walletClient,
        multiHopMsg.chain_id
      );
    } else {
      signer = await getOfflineSigner(walletClient, multiHopMsg.chain_id);
    }

    const chain = getChainByID(multiHopMsg.chain_id);

    const feeInfo = chain.fees?.fee_tokens[0];

    if (!feeInfo) {
      throw new Error("No fee info found");
    }

    let gasNeeded = 300000;
    if (
      route.does_swap &&
      route.swap_venue?.chain_id === multiHopMsg.chain_id
    ) {
      gasNeeded = 1500000;
    }

    const msgJSON = JSON.parse(multiHopMsg.msg);

    let msg: EncodeObject;

    let txHash = "";

    if (
      multiHopMsg.msg_type_url === "/ibc.applications.transfer.v1.MsgTransfer"
    ) {
      // transfer using ibc
      let gasPrice: GasPrice | undefined;
      try {
        gasPrice = GasPrice.fromString(
          `${feeInfo.average_gas_price ?? 0}${feeInfo.denom}`
        );
      } catch {
        // ignore error
      }

      const client = await getSigningStargateClientForChainID(
        multiHopMsg.chain_id,
        signer,
        {
          gasPrice,
        }
      );

      msg = {
        typeUrl: multiHopMsg.msg_type_url,
        value: {
          sourcePort: msgJSON.source_port,
          sourceChannel: msgJSON.source_channel,
          token: msgJSON.token,
          sender: msgJSON.sender,
          receiver: msgJSON.receiver,
          timeoutHeight: msgJSON.timeout_height,
          timeoutTimestamp: msgJSON.timeout_timestamp,
          memo: msgJSON.memo,
        },
      };

      if (signerIsLedger) {
        const currentHeight = await client.getHeight();

        msg.value.timeoutHeight = {
          revisionHeight: Long.fromNumber(currentHeight).add(100),
          revisionNumber: Long.fromNumber(currentHeight).add(100),
        };

        msg.value.timeoutTimestamp = Long.fromNumber(0);
      }

      if (multiHopMsg.chain_id === "evmos_9001-2") {
        const tx = await signAndBroadcastEvmos(walletClient, msgJSON.sender, {
          sourcePort: msgJSON.source_port,
          sourceChannel: msgJSON.source_channel,
          receiver: msgJSON.receiver,
          timeoutTimestamp: msgJSON.timeout_timestamp,
          memo: msgJSON.memo,
          amount: msg.value.token.amount,
          denom: msg.value.token.denom,
          revisionNumber: 0,
          revisionHeight: 0,
        });

        // @ts-ignore
        txHash = tx.txhash;
      } else if (multiHopMsg.chain_id === "injective-1") {
        const tx = await signAndBroadcastInjective(
          walletClient,
          msgJSON.sender,
          MsgTransferInjective.fromJSON({
            amount: msgJSON.token,
            memo: msgJSON.memo,
            sender: msgJSON.sender,
            port: msgJSON.source_port,
            receiver: msgJSON.receiver,
            channelId: msgJSON.source_channel,
            timeout: msgJSON.timeout_timestamp,
          }),
          {
            amount: [coin(0, feeInfo.denom)],
            gas: `${gasNeeded}`,
          }
        );

        txHash = tx.txHash;
      } else {
        const acc = await client.getAccount(msgJSON.sender);

        let tx: DeliverTxResponse;

        const simulatedGas = await client.simulate(msgJSON.sender, [msg], "");

        if (signerIsLedger) {
          const txRaw = await signAmino(
            client,
            signer as OfflineAminoSigner,
            msgJSON.sender,
            [
              {
                typeUrl: multiHopMsg.msg_type_url,
                value: msg.value,
              },
            ],
            {
              amount: [coin(0, feeInfo.denom)],
              gas: `${simulatedGas * 1.2}`,
            },
            "",
            {
              accountNumber: acc?.accountNumber ?? 0,
              sequence: acc?.sequence ?? 0,
              chainId: multiHopMsg.chain_id,
            }
          );

          const txBytes = TxRaw.encode(txRaw).finish();

          tx = await client.broadcastTx(txBytes, undefined, undefined);
        } else {
          tx = await client.signAndBroadcast(msgJSON.sender, [msg], "auto");
        }
        txHash = tx.transactionHash;
      }
    } else {
      /// execute msg using cosmwasm

      if (multiHopMsg.chain_id === "evmos_9001-2") {
        const account = await getAccount(
          walletClient,
          route.source_asset_chain_id
        );

        const tx = await signAndBroadcastEvmosRaw(
          walletClient,
          account.address,
          MsgEthereumTx.fromJsonString(multiHopMsg.msg)
        );
        txHash = tx.transactionHash;
      } else {
        msg = {
          typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
          value: {
            sender: msgJSON.sender,
            contract: msgJSON.contract,
            msg: Uint8Array.from(Buffer.from(JSON.stringify(msgJSON.msg))),
            funds: msgJSON.funds,
          },
        };

        const client = await getSigningCosmWasmClientForChainID(
          multiHopMsg.chain_id,
          signer,
          {
            // @ts-ignore
            gasPrice: GasPrice.fromString(
              `${feeInfo.average_gas_price}${feeInfo.denom}`
            ),
          }
        );

        const tx = await client.signAndBroadcast(msgJSON.sender, [msg], {
          amount: [coin(0, feeInfo.denom)],
          gas: `${gasNeeded}`,
        });

        txHash = tx.transactionHash;
      }
    }

    await leapClient.skipClient.transaction.track(txHash, multiHopMsg.chain_id);

    while (true) {
      const statusResponse = await leapClient.skipClient.transaction.status(
        txHash,
        multiHopMsg.chain_id
      );

      if (statusResponse.status === "STATE_COMPLETED") {
        if (statusResponse.error) {
          onError(statusResponse.error);
          return;
        }

        for (const packet of statusResponse.packets) {
          if (packet.error) {
            onError(packet.error);
            return;
          }
        }

        break;
      }

      await wait(1000);
    }

    onTxSuccess({}, i);
  }
}
