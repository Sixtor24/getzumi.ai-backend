
import { POST } from '../app/api/video/generate/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

// Mocks
jest.mock('jsonwebtoken');
jest.mock('../lib/mongodb', () => {
    return Promise.resolve({
        db: () => ({
            collection: () => ({
                insertOne: jest.fn().mockResolvedValue({}),
                updateOne: jest.fn().mockResolvedValue({})
            })
        })
    });
});

// Mock FFMPEG to avoid runtime errors in tests
jest.mock('fluent-ffmpeg', () => {
    const mockFfmpeg = jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
        screenshots: jest.fn(),
        mergeToFile: jest.fn(),
        input: jest.fn().mockReturnThis(),
    }));
    // Static method setFfmpegPath
    (mockFfmpeg as any).setFfmpegPath = jest.fn();
    return mockFfmpeg;
});
jest.mock('@ffmpeg-installer/ffmpeg', () => ({ path: 'mock-path' }));

global.fetch = jest.fn();

describe('Image to Video Generation Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.APIYI_API_KEY = "test-key";
        process.env.APIYI_BASE_URL = "https://api.test";
        (jwt.verify as jest.Mock).mockReturnValue({ userId: 'test-user' });
    });

    const createRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api/video/generate', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                'Cookie': 'auth_token=valid-token'
            }
        });
    };

    // Helper to consume the stream so the internal logic runs
    const runStream = async (response: Response) => {
        if (!response.body) return;
        const reader = response.body.getReader();
        while (true) {
            const { done } = await reader.read();
            if (done) break;
        }
    };

    it('should correctly handle Sora Image-to-Video parameters', async () => {
        // Setup successful API response
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ id: '12345', status: 'queued' }),
            body: {
                getReader: () => ({
                    read: jest.fn()
                        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"id":"123"}\n\n') })
                        .mockResolvedValueOnce({ done: true })
                })
            }
        });

        const req = createRequest({
            prompt: "A cinematic shot",
            model: "sora-2-pro",
            input_image: "data:image/jpeg;base64,ZmFrZmltYWdl", // "fakeimage" base64
            seconds: "5" // Short video, no loop
        });

        const res = await POST(req);
        await runStream(res);

        // Verify Fetch Calls
        // We expect the first call to be to /v1/videos
        const fetchCalls = (global.fetch as jest.Mock).mock.calls;
        const generationCall = fetchCalls.find(call => call[0].includes('/v1/videos'));
        
        expect(generationCall).toBeDefined();
        
        const options = generationCall[1];
        const formData = options.body as FormData;

        // Check Form Data keys
        expect(formData.get('model')).toBe('sora-2-pro');
        expect(formData.get('prompt')).toBe('A cinematic shot');
        
        // Critical: SORA uses 'input_image'
        expect(formData.has('input_image')).toBe(true);
        expect(formData.has('input_reference')).toBe(false); 

        // Validate file presence (Blob)
        const file = formData.get('input_image') as File;
        expect(file.size).toBeGreaterThan(0);
    });

    it('should correctly handle Veo Image-to-Video parameters', async () => {
        // Setup successful API response
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ id: 'veo-task-1', status: 'queued' }),
             body: {
                getReader: () => ({
                    read: jest.fn()
                        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"id":"veo-task-1"}\n\n') })
                        .mockResolvedValueOnce({ done: true })
                })
            }
        });

        const req = createRequest({
            prompt: "A drone shot",
            model: "veo-3.1",
            input_image: "data:image/jpeg;base64,ZmFrZmltYWdl", // "fakeimage"
            aspect_ratio: "16:9",
            seconds: "5"  // Short video
        });

        const res = await POST(req);
        await runStream(res);

        const fetchCalls = (global.fetch as jest.Mock).mock.calls;
        const generationCall = fetchCalls.find(call => call[0].includes('/v1/videos'));
        
        expect(generationCall).toBeDefined();
        
        const options = generationCall[1];
        const formData = options.body as FormData;

        // Check Form Data keys
        // Model logic: veo-3.1 + 16:9 -> veo-3.1-landscape + hasImage -> veo-3.1-landscape-fl
        expect(formData.get('model')).toBe('veo-3.1-landscape-fl');
        
        // Critical: VEO uses 'input_reference'
        expect(formData.has('input_reference')).toBe(true);
        expect(formData.has('input_image')).toBe(false);

        // Verify prompt
        expect(formData.get('prompt')).toBe('A drone shot');
    });

    it('should construct correct Veo model name for Portrait without images', async () => {
         // Setup
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ id: 'veo-task-2' }),
             body: { getReader: () => ({ read: async () => ({ done: true }) }) }
        });

        const req = createRequest({
            prompt: "Text only",
            model: "veo-3.1",
            aspect_ratio: "9:16",
            seconds: "5"
        });

        const res = await POST(req);
        await runStream(res);

        const fetchCalls = (global.fetch as jest.Mock).mock.calls;
        const generationCall = fetchCalls.find(call => call[0].includes('/v1/videos'));
        const formData = generationCall[1].body as FormData;

        // "veo-3.1" base. 9:16 is default/portrait. No images.
        // Expected: "veo-3.1" (or "veo-3.1-portrait" if code adds it, but checking logic:
        // Logic: if ratio == 16:9 add landscape. Else nothing (default is portrait).
        // if hasImages add -fl.
        // So expected: "veo-3.1"
        
        // Let's check what the code actually does.
        // Code: baseModel.replace(...) then if 16:9 add landscape. 
        // Then if fast add fast. Then if images add fl.
        expect(formData.get('model')).toBe('veo-3.1');
        expect(formData.has('input_reference')).toBe(false);
    });
});
