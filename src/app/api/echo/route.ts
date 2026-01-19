export const runtime = 'nodejs';

/**
 * @swagger
 * /api/echo:
 *   post:
 *     summary: Echoes back the JSON body
 *     description: Useful for creating and testing POST requests.
 *     tags:
 *       - System
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example: { "hello": "world" }
 *     responses:
 *       200:
 *         description: Successful echo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 received:
 *                   type: object
 *       400:
 *         description: Invalid JSON
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  return Response.json({ ok: true, received: body });
}

/**
 * @swagger
 * /api/echo:
 *   get:
 *     summary: Hint for using the echo endpoint
 *     description: Tells you to use POST.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Hint message
 */
export async function GET() {
  return Response.json({
    ok: true,
    hint: 'POST JSON to /api/echo'
  });
}
