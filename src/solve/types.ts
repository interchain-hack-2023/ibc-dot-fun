import { createQueryKeys } from "@lukemorales/query-key-factory";
import { QueryFunctionContext } from "@tanstack/query-core";
export interface ResponseDto<T extends unknown> {
  result: T;
}

export interface Asset {
  denom: string;
  chain_id: string;

  origin_denom: string;
  origin_chain_id: string;

  evm_address?: string;

  symbol?: string;
  name?: string;
  logo_uri?: string;
  decimals?: number;
}

export interface TokenWithName {
  address: string;
  name: string;
}

export type AssetWithMetadata = Required<Asset>;

export interface Chain {
  chain_name: string;
  chain_id: string;
  evm_chain_id?: string;

  pfm_enabled: boolean;
  cosmos_sdk_version: string;
  modules: Record<string, ModuleVersionInfo>;
  supports_memos?: boolean;
  cosmos_module_support?: CosmosModuleSupport;
}

export interface CosmosModuleSupport {
  authz: boolean;
  freegrant: boolean;
}

export interface ChainTransaction {
  chain_id: string;
  tx_hash: string;
}

export interface ModuleVersionInfo {
  path: string;
  version: string;
  sum: string;
}

export interface Packet {
  send_tx?: ChainTransaction;
  receive_tx?: ChainTransaction;
  acknowledge_tx?: ChainTransaction;
  timeout_tx?: ChainTransaction;

  error?: PacketError;
}

export interface PacketError {
  code: number;
  message: string;
}

export interface StatusError {
  code: number;
  message: string;
}

export type StatusState =
  | "STATE_UNKNOWN"
  | "STATE_SUBMITTED"
  | "STATE_PENDING"
  | "STATE_COMPLETED";

export interface SwapVenue {
  name: string;
  chain_id: string;
}

export interface SwapOperation {
  pool: string;
  denom_in: string;
  denom_out: string;
}

export interface SwapExactCoinOut {
  swap_venue: SwapVenue;
  swap_operations: SwapOperation[];
  swap_amount_out: string;
}

export interface SwapIn {
  swap_venue: SwapVenue;
  swap_operations: SwapOperation[];
  swap_amount_in?: string;
}

export interface Transfer {
  port: string;
  channel: string;
  chain_id: string;
  pfm_enabled: boolean;
  dest_denom: string;
}

export interface Swap {
  swap_in?: SwapIn;
  swap_out?: SwapExactCoinOut;
  estimated_affiliate_fee?: string;
}

export interface ConvertVenue {
  name: string;
  chain_id: string;
}

export interface ConvertOperation {
  denom: string;
  venue: ConvertVenue
}

export interface ERC20ConvertMessage {
  contractAddress: string;
  amount: string;
  receiver: string;
  sender: string;
}

export interface ERC20Convert {
  convert_message: ERC20ConvertMessage;
  convert_operation: ConvertOperation;
}

export interface OperationWithSwap {
  swap: Swap;
  transfer: never |undefined;
  erc20Convert: never | undefined;
}

export interface OperationWithTransfer {
  swap: never | undefined;
  transfer: Transfer;
  erc20Convert: never | undefined;
}

export interface OperationWithERC20Convert {
  swap: never | undefined;
  transfer: never | undefined;
  erc20Convert: ERC20Convert;
}

export type Operation = OperationWithSwap | OperationWithTransfer | OperationWithERC20Convert;

export function isSwapOperation(
  operation: Operation
): operation is OperationWithSwap {
  return operation.swap !== undefined;
}

export function isTransferOperation(
  operation: Operation
): operation is OperationWithTransfer {
  return operation.transfer !== undefined;
}

export function isERC20ConvertOperation(
  operation: Operation
): operation is OperationWithERC20Convert {
  return operation.erc20Convert !== undefined;
}

export interface Affiliate {
  basis_points_fee: string;
  address: string;
}

export interface MultiChainMsg {
  chain_id: string;
  path: string[];
  msg: string;
  msg_type_url: string;
}

export interface ErrorResponse {
  description: string;
  code: number;
  message: string;
  details: {
    typeUrl: string;
    value: string;
  }[];
}

export interface FetchBalanceResponseDto {
  error?: ErrorResponse;
  ts: string;
  result: {
    tokenAddress: string;
    amount: string;
    priceUsdc: number;
  }[];
}

export interface ContractsMetadata {
  multicall2: string;
  approve: string;
  approveProxy: string;
  routeProxy: string;
  permit2?: string;
}
export interface TokenV2 {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  icon: string;
}

export interface ChainMetadata {
  id: string;
  name: string;
  nativeSymbol: string;
  contracts: ContractsMetadata;
  tokens: TokenV2[];
  dexes?: {
    dexId: string;
    logoUrl: string;
    name: string;
  }[];
  blockExplorerUrl: string;
  wrappedNativeToken: string;
  nativeToken: string;
}

export interface GetMetadataResponseDto extends ResponseDto<ChainMetadata> {}

export interface GetBalanceRequestDto {
  chainId: number;
  walletAddress: string;
}
export interface BalanceOfToken {
  tokenAddress: string;
  balance: string;
  allowance: string;
}
export interface GetBalanceResponseDto extends ResponseDto<BalanceOfToken[]> {}

export interface FetchBalanceResponseDto {
  error?: ErrorResponse;
  ts: string;
  result: {
    tokenAddress: string;
    amount: string;
    priceUsdc: number;
  }[];
}

export type GetERC20AllowanceParams = {
  tokenInAddress: string;
  address: string;
  spender: string;
};
export type GetPermit2Allowance = {
  permit2Address: string;
  address: string;
  tokenAddress: string;
  spender: string;
};
export type GetTokenBalanceParams =
  | { tokenAddress: string; isNativeToken: false }
  | { isNativeToken: true };

export interface PostQuoteRequestDto {
  chainId: number;
  tokenInAddr: string;
  tokenOutAddr: string;
  from: string;
  /**
   * TODO: decimals
   */
  amount: string;
  /**
   * slippage tolerance 10000 => 100%, 30 => 0.3%
   */
  slippageBps: number;
  /**
   * amount max split
   */
  maxSplit: number;
  /**
   * max edge of graph
   */
  maxEdge: number;
  /**
   * set true if Flash Loan(false if normal swap)
   */
  withCycle: boolean;
}

export interface SingleSwap {
  fromToken: string;
  toToken: string;
  dexId: string;
  pool: string;
}

export interface MetamaskTransaction {
  from: string;
  to: string;
  value: string;
  data: string;
  gasLimit: number;
  estimatedGas: number;
}

export interface SplitPath {
  weight: number;
  swapInfos: SingleSwap[];
}

export interface AggregateSwap {
  fromToken: string;
  amountIn: string;
  toToken: string;
  splitInfos: SplitPath[];
  expectedAmountOut: string;
}

interface ArbitrageCycle {
  token: string;
  amountIn: string;
  swapInfos: SingleSwap[];
  expectedAmountOut: string;
  expectedProfit: string;
}

interface SingleDexSwap {
  dexId: string;
  fromToken: string;
  amountIn: string;
  toToken: string;
  expectedAmountOut: string;
}

interface CexQuoteInfo {
  cexId: string;
  amountIn: string;
  expectedAmountOut: string;
}

export interface PostQuoteResponseWithPath {
  isSwapPathExists: true;
  dexAgg: AggregateSwap;
  cycles: ArbitrageCycle[];
  singleDexes: SingleDexSwap[];
  cexes: CexQuoteInfo[];
}

export interface PostQuoteResponseWithoutPath {
  isSwapPathExists: false;
  dexAgg: null;
  cycles: unknown[];
  singleDexes: unknown[];
}

export interface PostBuildRequestDto {
  /** chainId is used in client */
  chainId: number;
  tokenInAddr: string;
  tokenOutAddr: string;
  from: string;
  amount: string;
  slippageBps: number;
  maxSplit: number;
  permit?: PermitSingleDto;
  permitSignature?: string;
  dexAgg: PostQuoteResponseWithPath["dexAgg"];
}

export interface PostBuildResponseDto extends ResponseDto<MetamaskTransaction> {
  cycles: {
    amountIn: string;
    expectedAmountOut: string;
    expectedProfit: string;
    swapInfos: {
      dexId: string;
      fromToken: string;
      pool: string;
      toToken: string;
    }[];
    token: string;
  }[];
}

export interface PermitSingleDto {
  details: {
    token: string;
    amount: string;
    expiration: string;
    nonce: string;
  };
  spender: string;
  sigDeadline: string;
}

export interface PostQuoteResponseDtoV2
  extends ResponseDto<
    PostQuoteResponseWithPath | PostQuoteResponseWithoutPath
  > {}

export type ContextFromQueryKey<
  QueryKeyFunc extends (...args: any[]) => readonly any[]
> = QueryFunctionContext<ReturnType<QueryKeyFunc>>;
