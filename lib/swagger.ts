import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Getzumi AI API',
      version: '1.0.0',
      description: 'API for getzumi.ai',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development Server',
      },
      {
        url: 'https://getzumiai-backend.vercel.app/',
        description: 'Production Server',
      }
    ],
  },
  // Use a manual approach since automatic scanning in Next.js App Router can be tricky with paths.
  // We will define paths directly here for simplicity and reliability.
  apis: [], // We'll add paths manually below or in separate files if needed.
};

const swaggerSpec = swaggerJsdoc(options);

// Manual path definitions to ensure they are correct without relying on comment parsing in TS files
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(swaggerSpec as any).paths = {
  '/api/auth/signup': {
    post: {
      summary: 'Register a new user',
      description: 'Creates a new user account if username and email do not exist.',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['fullName', 'username', 'email', 'password'],
              properties: {
                fullName: { type: 'string', example: 'John Doe' },
                username: { type: 'string', example: 'johndoe123' },
                email: { type: 'string', format: 'email', example: 'john@example.com' },
                password: { type: 'string', format: 'password', example: 'securePassword123' },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'User registered successfully',
          headers: {
            'Set-Cookie': {
              description: 'Session cookie (auth_token)',
              schema: { type: 'string' }
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  message: { type: 'string' },
                  token: { type: 'string', description: 'JWT Session Token' },
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      username: { type: 'string' },
                      email: { type: 'string' },
                      fullName: { type: 'string' },
                    }
                  }
                },
              },
            },
          },
        },
        409: { description: 'Username or Email already exists' },
      },
    },
  },
  '/api/auth/signin': {
    post: {
      summary: 'User Login',
      description: 'Authenticates a user via Username OR Email + Password.',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['identifier', 'password'],
              properties: {
                identifier: { 
                  type: 'string', 
                  description: 'Username or Email address',
                  example: 'john@example.com' 
                },
                password: { 
                    type: 'string', 
                    format: 'password', 
                    example: 'securePassword123' 
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Login successful',
          headers: {
            'Set-Cookie': {
              description: 'Session cookie (auth_token)',
              schema: { type: 'string' }
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  message: { type: 'string' },
                  token: { type: 'string', description: 'JWT Session Token' },
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      username: { type: 'string' },
                      email: { type: 'string' },
                      fullName: { type: 'string' },
                    }
                  }
                },
              },
            },
          },
        },
        401: { description: 'Invalid credentials' },
      },
    },
  },
  '/api/auth/signout': {
    post: {
      summary: 'User Logout',
      description: 'Invalidates the user session by clearing the auth cookie.',
      tags: ['Authentication'],
      responses: {
        200: {
          description: 'Logged out successfully',
          content: {
             'application/json': {
                 schema: {
                     type: 'object',
                     properties: {
                         success: { type: 'boolean' },
                         message: { type: 'string' }
                     }
                 }
             }
          }
        },
      },
    },
  },
  '/api/generate': {
    post: {
      summary: 'Generate image candidates',
      description: 'Generates up to 4 image candidates based on a text prompt and optional reference images.',
      tags: ['Images'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['prompt', 'model'],
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Text description of the image to generate',
                  example: 'A cyberpunk cat in neon lights',
                },
                model: {
                  type: 'string',
                  description: 'Model ID to use for generation',
                  enum: ['nano-banana-pro', 'sora_image', 'seedream-4-5-251128'],
                  default: 'nano-banana-pro',
                },
                input_images: {
                  type: 'array',
                  description: 'Optional list of base64 encoded strings for image-to-image reference',
                  items: {
                    type: 'string',
                    format: 'base64',
                  },
                  maxItems: 3,
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Successful generation',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  candidates: {
                    type: 'array',
                    items: {
                      type: 'string',
                      description: 'Base64 encoded image string',
                    },
                    description: 'Array of 4 generated image candidates',
                  },
                  success: {
                    type: 'boolean',
                  },
                },
              },
            },
          },
        },
        500: {
          description: 'Server error',
        },
      },
    },
  },
  '/api/save-image': {
    post: {
      summary: 'Save selected image',
      description: 'Saves the user-selected candidate to the database and returns a permanent view URL.',
      tags: ['Images'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['prompt', 'model', 'imageData'],
              properties: {
                prompt: {
                  type: 'string',
                },
                model: {
                  type: 'string',
                },
                imageData: {
                  type: 'string',
                  description: 'The selected base64 image string to save',
                },
                input_images: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Original input images to save context',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Image saved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  view_url: { 
                    type: 'string',
                    description: 'URL to view the saved image',
                  },
                  id: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export default swaggerSpec;
