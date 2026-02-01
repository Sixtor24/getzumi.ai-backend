interface SoraGenerationContext {
    prompt: string;
    model: string;
    totalSeconds: number;
    userId: string;
    sendChunk: (msg: string) => void;
    aspectRatio?: string;
    initialImage?: string;
    apiKey: string;
    baseUrl: string;
    reqHost: string;
    reqProto: string;
}
export declare function generateSoraLoop(ctx: SoraGenerationContext): Promise<string>;
export {};
//# sourceMappingURL=sora-generator.d.ts.map