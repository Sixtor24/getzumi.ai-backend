// __tests__/my-audios.test.ts
import { GET as getMyAudiosHandler } from '../app/api/my-audios/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

// Mock MongoDB
jest.mock('../lib/mongodb', () => {
    const mockToArray = jest.fn();
    const mockFind = jest.fn(() => ({
        sort: jest.fn().mockReturnThis(),
        toArray: mockToArray,
    }));
    const mockCollection = {
        find: mockFind,
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

describe('My Audios API Endpoint', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockCollection: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockFindResult: any;
    
    beforeEach(async () => {
        jest.clearAllMocks();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const client = await require('../lib/mongodb').default;
        mockCollection = client.db().collection();
        mockFindResult = mockCollection.find(); 
        
        // Mock toArray to return list of audios
        mockFindResult.toArray.mockResolvedValue([
            { _id: 'audio1', user_id: 'test-user-id', prompt: 'test prompt 1', provider: 'cartesia', created_at: new Date() },
            { _id: 'audio2', user_id: 'test-user-id', prompt: 'test prompt 2', provider: 'elevenlabs', created_at: new Date() }
        ]);

        (jwt.verify as jest.Mock).mockReturnValue({ userId: 'test-user-id' });
    });

    it('should return 401 if no auth cookie is present', async () => {
        const req = {
            cookies: {
                get: jest.fn().mockReturnValue(undefined),
            },
        } as unknown as NextRequest;

        const res = await getMyAudiosHandler(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.success).toBe(false);
    });

    it('should fetch audios for the correct user', async () => {
        const req = {
            cookies: {
                get: jest.fn().mockReturnValue({ value: 'valid-token' }),
            },
            nextUrl: { origin: 'http://test.com' }
        } as unknown as NextRequest;

        const res = await getMyAudiosHandler(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.audios).toHaveLength(2);
        expect(mockCollection.find).toHaveBeenLastCalledWith(
             { user_id: 'test-user-id' },
             expect.any(Object)
        );
    });
});
