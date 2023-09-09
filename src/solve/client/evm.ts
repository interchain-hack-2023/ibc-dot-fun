import { AxiosInstance, AxiosResponse } from "axios";
import { QueryFunctionContext } from "react-query";
import {
  GetMetadataResponseDto,
  GetBalanceRequestDto,
  BalanceOfToken,
  GetBalanceResponseDto,
  PostQuoteRequestDto,
  PostQuoteResponseDtoV2,
  PostBuildRequestDto,
  PostBuildResponseDto,
} from "../types";

export class EvmService {
  private httpClient: AxiosInstance;

  constructor(httpClient: AxiosInstance) {
    this.httpClient = httpClient;
  }

  async getChainMetadata(chainId: number) {
    const { data } = await this.httpClient.get<GetMetadataResponseDto>(
      `${process.env.NEXT_PUBLIC_API_ENDPOINT}/v1/chains/${chainId}/metadata`
    );
    return data.result;
  }

  async getBalances(dto: GetBalanceRequestDto): Promise<BalanceOfToken[]> {
    const { chainId, ...params } = dto;
    const { data } = await this.httpClient.get<GetBalanceResponseDto>(
      `v1/chains/${chainId}/balances`,
      {
        params,
      }
    );
    return data.result;
  }

  async postQuoteV2(dto: PostQuoteRequestDto) {
    const { chainId, ...rest } = dto;
    const { data } = await this.httpClient.post<PostQuoteResponseDtoV2>(
      `v1/chains/${chainId}/quote`,
      rest
    );
    return data.result;
  }

  async postBuild(params: PostBuildRequestDto) {
    const { chainId, ...rest } = params;

    const { data } = await this.httpClient.post<PostBuildResponseDto>(
      `v1/chains/${chainId}/build`,
      rest
    );

    return data.result;
  }
}
