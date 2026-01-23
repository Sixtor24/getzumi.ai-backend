
import { POST as cartesiaHandler } from '../app/api/tts/cartesia/route';
import { POST as saveAudioHandler } from '../app/api/save-audio/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

// Mock MongoDB
jest.mock('../lib/mongodb', () => {
    const mockInsertOne = jest.fn();
    const mockCollection = {
        insertOne: mockInsertOne,
    };
    const mockDb = {
        collection: jest.fn(() => mockCollection),
    };
    const mockClient = {
        db: jest.fn(() => mockDb),
    };
    return {
        __esModule: true,
        default: Promise.resolve(mockClient),
    };
});

jest.mock('jsonwebtoken');

// Spy on global fetch
global.fetch = jest.fn();

describe('TTS & Audio API', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockCollection: any;
    
    beforeEach(async () => {
        jest.clearAllMocks();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const client = await require('../lib/mongodb').default;
        mockCollection = client.db().collection();
        mockCollection.insertOne.mockResolvedValue({ insertedId: 'new-audio-id' });
        (jwt.verify as jest.Mock).mockReturnValue({ userId: 'test-user-id' });
        process.env.CARTESIA_API_KEY = 'mock-key';
    });

    describe('/api/tts/cartesia', () => {
        it('should return 401 if unauthenticated', async () => {
            const req = {
                cookies: { get: jest.fn().mockReturnValue(undefined) },
                json: async () => ({ text: 'hello' })
            } as unknown as NextRequest;

            const res = await cartesiaHandler(req);
            expect(res.status).toBe(401);
        });

        it('should call Cartesia API and save audio', async () => {
            // Mock Cartesia Response
            const mockAudioBuffer = Buffer.from('mock-audio-data');
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                arrayBuffer: async () => mockAudioBuffer.buffer,
            });

            const req = {
                cookies: { get: jest.fn().mockReturnValue({ value: 'token' }) },
                json: async () => ({ text: 'Hello World', voice_id: 'abc' }),
                nextUrl: { origin: 'http://test.com' }
            } as unknown as NextRequest;

            const res = await cartesiaHandler(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.view_url).toContain('new-audio-id');

            // Verify Cartesia Call
            expect(global.fetch).toHaveBeenCalledWith(
                "https://api.cartesia.ai/tts/bytes",
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({ "X-API-Key": "mock-key" })
                })
            );

            // Verify MongoDB Save
            expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 'test-user-id',
                provider: 'cartesia',
                prompt: 'Hello World'
            }));
        });
    });

    describe('/api/save-audio', () => {
        it('should return 401 if unauthenticated', async () => {
             const req = {
                cookies: { get: jest.fn().mockReturnValue(undefined) },
                json: async () => ({ })
            } as unknown as NextRequest;
            const res = await saveAudioHandler(req);
            expect(res.status).toBe(401);
        });

        it('should save uploaded audio blob', async () => {
            const req = {
                cookies: { get: jest.fn().mockReturnValue({ value: 'token' }) },
                json: async () => ({ 
                    audioData: 'data:audio/mp3;base64,aabbcc',
                    prompt: 'test prompt',
                    provider: 'elevenlabs-puter',
                    mimeType: 'audio/mp3'
                })
            } as unknown as NextRequest;

            const res = await saveAudioHandler(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);

            expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 'test-user-id',
                provider: 'elevenlabs-puter',
                mime_type: 'audio/mp3'
            }));
        });
    });
});
