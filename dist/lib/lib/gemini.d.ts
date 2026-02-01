interface GenerateImageResult {
    success: boolean;
    data?: Buffer[];
    error?: string;
}
export declare class GeminiImageService {
    private apiKey;
    private apiUrl;
    private headers;
    constructor(apiKey: string);
    private extractImageFromResponse;
    generateImages(prompt: string, model: string, inputImages?: string[], count?: number): Promise<GenerateImageResult>;
    generateImageBytes(prompt: string, model: string, inputImages?: string[]): Promise<GenerateImageResult>;
}
export {};
//# sourceMappingURL=gemini.d.ts.map