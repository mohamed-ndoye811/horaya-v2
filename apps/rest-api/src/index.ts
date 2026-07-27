import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { eventsRoutes } from './routes/events.route';

const app = new OpenAPIHono();

// Routes de l'API
app.route('/events', eventsRoutes);

// Documentation OpenAPI JSON
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Horaya API',
    version: '1.0.0',
    description: 'API REST pour la gestion d\'événements et de réservations',
    contact: {
      name: 'Support Horaya',
      email: 'support@horaya.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Serveur de développement',
    },
    {
      url: 'https://api.horaya.com',
      description: 'Serveur de production',
    },
  ],
  tags: [
    {
      name: 'Events',
      description: 'Gestion des événements',
    },
  ],
});

// Interface Scalar pour la documentation
app.get(
  '/docs',
  apiReference({
    spec: {
      url: '/openapi.json',
    },
    theme: 'purple',
    layout: 'modern',
    darkMode: true,
    defaultHttpClient: {
      targetKey: 'javascript',
      clientKey: 'fetch',
    },
    authentication: {
      preferredSecurityScheme: 'bearerAuth',
    },
  })
);

// Route de test
app.get('/', (c) => {
  return c.json({
    message: 'Horaya API',
    documentation: '/docs',
  });
});

export default app;
