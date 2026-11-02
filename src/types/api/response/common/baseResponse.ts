interface ResponseMeta {
    [key: string]: string | number | boolean;
    timestamp: string;
}

export interface BaseResponse {
    success: boolean;
    meta: ResponseMeta | null;
}