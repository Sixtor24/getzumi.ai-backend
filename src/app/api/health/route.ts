export const runtime = 'nodejs';

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Returns the health status of the API
 *     description: Checks if the API is running and returns the server time.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 service:
 *                   type: string
 *                   example: getzumi.ai
 *                 time:
 *                   type: string
 *                   example: "2024-01-01T00:00:00.000Z"
 */
export async function GET() {
  return Response.json({
    ok: true,
    service: 'getzumi.ai',
    time: new Date().toISOString()
  });
}
