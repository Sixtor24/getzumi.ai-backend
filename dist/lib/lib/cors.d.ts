export declare function corsHeaders(origin?: string | null): {
    'Access-Control-Allow-Origin': string;
    'Access-Control-Allow-Methods': string;
    'Access-Control-Allow-Headers': string;
    'Access-Control-Allow-Credentials': string;
};
export declare function handleCorsResponse(data: any, status?: number, origin?: string | null): any;
export declare function handleCorsError(message: string, status?: number, origin?: string | null): any;
//# sourceMappingURL=cors.d.ts.map