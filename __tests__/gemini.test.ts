// __tests__/gemini.test.ts
import { GeminiImageService } from '../lib/gemini';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GeminiImageService Unit Tests', () => {
    let service: GeminiImageService;
    const API_KEY = "test-api-key";

    beforeEach(() => {
        service = new GeminiImageService(API_KEY);
        mockFetch.mockClear();
    });

    /**
     * Test 1: Nano Banana Pro
     * Expected behavior: 
     * - Uses /v1/chat/completions
     * - Parses Base64 from content
     */
    test('Nano Banana Pro: Should parse Base64 from chat content', async () => {
        const prompt = "A test banana";
        const model = "nano-banana-pro";
        
        // Mock successful chat completion response with Base64 image
        const fakeBase64 = "U29tZSBmYWtlIGltYWdlIGRhdGE="; // "Some fake image data"
        const mockResponse = {
            ok: true,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: `Here is your image: ![img](data:image/jpeg;base64,${fakeBase64})`
                        }
                    }
                ]
            })
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const result = await service.generateImageBytes(prompt, model);

        expect(mockFetch).toHaveBeenCalledWith(
            "https://api.apiyi.com/v1/chat/completions",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                }),
                body: expect.stringContaining(model)
            })
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        // Check if buffer content matches raw base64 decoded
        expect(result.data?.toString()).toBe("Some fake image data");
    });

    /**
     * Test 2: Sora Image
     * Expected behavior:
     * - Uses /v1/chat/completions
     * - Parses URL from markdown
     * - Fetches that URL to get bytes
     */
    test('Sora Image: Should parse URL from markdown and fetch it', async () => {
        const prompt = "A test sora scene";
        const model = "sora_image";
        const fakeImageUrl = "https://example.com/sora-result.jpg";
        
        const fakeImageContent = Buffer.from("Sora image bytes");
        // Create a dedicated ArrayBuffer copy to avoid Node.js Buffer pool leaking shared memory
        const dedicatedBuffer = fakeImageContent.buffer.slice(
            fakeImageContent.byteOffset, 
            fakeImageContent.byteOffset + fakeImageContent.length
        );

        // 1st Call: API Response with Markdown URL
        const mockApiResponse = {
            ok: true,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: `Image generated: ![generated](${fakeImageUrl})`
                        }
                    }
                ]
            })
        };

        // 2nd Call: Fetching the image URL
        const mockImageFetchResponse = {
            ok: true,
            arrayBuffer: async () => dedicatedBuffer
        };


        mockFetch
            .mockResolvedValueOnce(mockApiResponse) // First call
            .mockResolvedValueOnce(mockImageFetchResponse); // Second call

        const result = await service.generateImageBytes(prompt, model);

        // Verify first call (API)
        expect(mockFetch).toHaveBeenNthCalledWith(1, 
            "https://api.apiyi.com/v1/chat/completions",
            expect.any(Object)
        );

        // Verify second call (Image Download)
        expect(mockFetch).toHaveBeenNthCalledWith(2, fakeImageUrl);

        expect(result.success).toBe(true);
        expect(result.data?.toString()).toBe("Sora image bytes");
    });

    /**
     * Test 3: SeeDream
     * Expected behavior:
     * - Uses /v1/images/generations
     * - Parses b64_json from data array
     */
    test('SeeDream: Should parse b64_json from image generation response', async () => {
        const prompt = "A dream scene";
        const model = "seedream-4-5-251128";
        const fakeBase64 = "U2VlRHJlYW1EYXRh"; // "SeeDreamData"

        // Mock successful image generation response
        const mockResponse = {
            ok: true,
            json: async () => ({
                data: [
                    {
                        b64_json: fakeBase64
                    }
                ]
            })
        };

        mockFetch.mockResolvedValueOnce(mockResponse);

        const result = await service.generateImageBytes(prompt, model);

        // Verify endpoint change
        expect(mockFetch).toHaveBeenCalledWith(
            "https://api.apiyi.com/v1/images/generations",
            expect.objectContaining({
                body: expect.stringContaining('"response_format":"b64_json"')
            })
        );

        expect(result.success).toBe(true);
        expect(result.data?.toString()).toBe("SeeDreamData");
    });
});
