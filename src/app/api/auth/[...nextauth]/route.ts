import NextAuth from 'next-auth';
import { authOptions } from '@/server/auth';

/**
 * @swagger
 * /api/auth/callback/credentials:
 *   post:
 *     summary: Sign in with Credentials
 *     description: >
 *       Authenticates a user using username and password.
 *       On success, it sets `next-auth.session-token` cookie and returns the user object (if `json: true`).
 *     tags:
 *       - Auth
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 default: admin
 *               password:
 *                 type: string
 *                 format: password
 *                 default: admin123
 *               csrfToken:
 *                 type: string
 *                 description: Required if CSRF is enabled. Fetch from /api/auth/csrf.
 *               json:
 *                 type: boolean
 *                 default: true
 *                 description: Set to true to receive a JSON response instead of a redirect.
 *     responses:
 *       200:
 *         description: Login successful. Session cookie set.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: Redirect URL (usually means success if present)
 *       401:
 *         description: Invalid credentials
 */

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
