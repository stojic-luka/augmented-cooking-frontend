import type { BaseResponse } from "./baseResponse";

export interface ApiResponseData<TData> extends BaseResponse{
    data: TData;
}