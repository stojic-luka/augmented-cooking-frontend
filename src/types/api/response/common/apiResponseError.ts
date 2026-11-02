import type { BaseResponse } from "./baseResponse";

interface ResponseError {
    code: string;
    message: string;
}

export interface ApiResponseError extends BaseResponse {
  error?: ResponseError;
}