import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api', // define api folder
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'getzumi.ai API',
        version: '1.0.0',
        description: 'API backend for getzumi.ai SaaS platform',
        contact: {
          name: 'Support',
          email: 'support@getzumi.ai',
        },
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [],
      servers: [
        {
          url: '/',
          description: 'Current Host'
        }
      ]
    },
  });
  return spec;
};
