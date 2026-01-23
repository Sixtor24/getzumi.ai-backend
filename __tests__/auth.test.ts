// __tests__/auth.test.ts
import { POST as signupHandler } from '../app/api/auth/signup/route';
import { POST as signinHandler } from '../app/api/auth/signin/route';
import { POST as signoutHandler } from '../app/api/auth/signout/route';
import clientPromise from '../lib/mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

// 1. Define the Mock Factory
jest.mock('../lib/mongodb', () => {
    const mockFindOne = jest.fn();
    const mockInsertOne = jest.fn();
    const mockCollection = {
        findOne: mockFindOne,
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

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('Auth API Endpoints', () => {
    // Access the mocked functions via the imported clientPromise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockCollection: any;
    
    beforeEach(async () => {
        jest.clearAllMocks();
        
        // Retrieve the mocked structure
        const client = await clientPromise;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = client.db('test'); // args don't matter due to mock
        mockCollection = db.collection('users');

        // Setup default behaviors
        (mockCollection.findOne as jest.Mock).mockResolvedValue(null);
        (mockCollection.insertOne as jest.Mock).mockResolvedValue({ insertedId: 'new-id' });

        (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
        (jwt.sign as jest.Mock).mockReturnValue('mock-token');
    });

    // --- SIGNUP TESTS ---
    describe('POST /api/auth/signup', () => {
        it('should return 400 if fields are missing', async () => {
            const req = {
                json: async () => ({ username: 'test' }), 
            } as unknown as NextRequest;

            const res = await signupHandler(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.message).toBe("Missing required fields");
        });

        it('should return 409 if user already exists', async () => {
            (mockCollection.findOne as jest.Mock).mockResolvedValueOnce({ _id: '123', email: 'test@test.com' }); 

            const req = {
                json: async () => ({ 
                    fullName: 'Test User',
                    username: 'testuser',
                    email: 'test@test.com',
                    password: 'password123'
                }),
            } as unknown as NextRequest;

            const res = await signupHandler(req);
            const data = await res.json();

            expect(res.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.message).toMatch(/exists/);
        });

        it('should register user and return 201 with token', async () => {
            (mockCollection.findOne as jest.Mock).mockResolvedValueOnce(null); 
            (mockCollection.insertOne as jest.Mock).mockResolvedValueOnce({ insertedId: 'new-user-id' });

            const req = {
                json: async () => ({ 
                    fullName: 'Test User',
                    username: 'newuser',
                    email: 'new@test.com',
                    password: 'password123'
                }),
            } as unknown as NextRequest;

            const res = await signupHandler(req);
            const data = await res.json();

            expect(mockCollection.findOne).toHaveBeenCalled();
            expect(bcrypt.hash).toHaveBeenCalledWith('password123', 'salt');
            expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
                username: 'newuser',
                email: 'new@test.com',
                password: 'hashedPassword'
            }));

            expect(res.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.token).toBe('mock-token');

            const cookies = res.headers.get('set-cookie');
            expect(cookies).toMatch(/auth_token=mock-token/);
        });
    });

    // --- SIGNIN TESTS ---
    describe('POST /api/auth/signin', () => {
        it('should return 400 if fields are missing', async () => {
            const req = {
                json: async () => ({ }),
            } as unknown as NextRequest;

            const res = await signinHandler(req);
            expect(res.status).toBe(400);
        });

        it('should return 401 if user not found', async () => {
            (mockCollection.findOne as jest.Mock).mockResolvedValueOnce(null);

            const req = {
                json: async () => ({ identifier: 'unknown', password: 'pass' }),
            } as unknown as NextRequest;

            const res = await signinHandler(req);
            const data = await res.json();

            expect(res.status).toBe(401);
            expect(data.message).toBe('Invalid credentials');
        });

        it('should return 401 if password does not match', async () => {
            (mockCollection.findOne as jest.Mock).mockResolvedValueOnce({ 
                _id: '123', 
                password: 'hashedRealPassword',
                username: 'user' 
            });
            (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false); 

            const req = {
                json: async () => ({ identifier: 'user', password: 'wrongpass' }),
            } as unknown as NextRequest;

            const res = await signinHandler(req);
            expect(res.status).toBe(401);
        });

        it('should login and return 200 with token on success', async () => {
            (mockCollection.findOne as jest.Mock).mockResolvedValueOnce({ 
                _id: '123', 
                password: 'hashedRealPassword',
                username: 'validUser',
                email: 'valid@test.com',
                fullName: 'Valid Name'
            });
            (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true); 

            const req = {
                json: async () => ({ identifier: 'validUser', password: 'correctpass' }),
            } as unknown as NextRequest;

            const res = await signinHandler(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.token).toBe('mock-token');

            const cookies = res.headers.get('set-cookie');
            expect(cookies).toMatch(/auth_token=mock-token/);
        });
    });

    // --- SIGNOUT TESTS ---
    describe('POST /api/auth/signout', () => {
        it('should clear the cookie and return 200', async () => {
            const req = {} as unknown as NextRequest;
            const res = await signoutHandler(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.message).toMatch(/Logged out/);

            const cookies = res.headers.get('set-cookie');
            expect(cookies).toMatch(/auth_token=/);
            expect(cookies).toMatch(/Max-Age=-1/); 
        });
    });

});

