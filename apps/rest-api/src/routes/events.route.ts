import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import * as Effect from 'effect/Effect';
import type { CreateEventCommand } from '@horaya/application/event/createEvent';
import { createEvent } from '@horaya/application/event/createEvent';
import { MainLayer } from '@horaya/infrastructure/MainLayer';
import { EventMapper } from '../mappers/event.mapper';

// Schémas OpenAPI
const EventSchema = z.object({
  id: z.string().uuid().openapi({ 
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Identifiant unique de l\'événement (UUID v4)',
  }),
  tenantId: z.string().uuid().openapi({ 
    example: '123e4567-e89b-12d3-a456-426614174001',
    description: 'Identifiant du tenant propriétaire de l\'événement',
  }),
  title: z.string().min(1).openapi({ 
    example: 'Concert de Jazz',
    description: 'Titre de l\'événement',
  }),
  start: z.string().datetime().openapi({ 
    example: '2024-12-25T20:00:00Z',
    description: 'Date et heure de début (ISO 8601)',
  }),
  end: z.string().datetime().openapi({ 
    example: '2024-12-25T23:00:00Z',
    description: 'Date et heure de fin (ISO 8601)',
  }),
  capacity: z.number().int().positive().openapi({ 
    example: 100,
    description: 'Capacité maximale de participants',
  }),
  description: z.string().openapi({ 
    example: 'Un magnifique concert de jazz',
    description: 'Description détaillée de l\'événement',
  }),
});

const CreateEventSchema = EventSchema;

const ErrorSchema = z.object({
  error: z.string().openapi({ example: 'Failed to create event' }),
});

// Route GET - Liste des événements
const listEventsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Events'],
  summary: 'Liste tous les événements',
  description: 'Récupère la liste complète des événements disponibles',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(EventSchema),
        },
      },
      description: 'Liste des événements récupérée avec succès',
    },
  },
});

// Route GET - Liste des événements par tenantId
const listEventsByTenantIdRoute = createRoute({
  method: 'get',
  path: '/tenants/:tenantId',
  tags: ['Events'],
  summary: 'Liste les événements pour un tenant donné',
  description: 'Récupère la liste des événements associés à un tenant spécifique',
  request: {
    params: z.object({
      tenantId: z.string().uuid().openapi({
        example: '123e4567-e89b-12d3-a456-426614174001',
        description: 'Identifiant du tenant propriétaire des événements',
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(EventSchema),
        },
      },
      description: 'Liste des événements récupérée avec succès',
    },
  },
});

// Route POST - Créer un événement
const createEventRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Events'],
  summary: 'Créer un nouvel événement',
  description: 'Crée un événement avec toutes ses informations (titre, dates, capacité, etc.)',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateEventSchema,
        },
      },
      description: 'Informations de l\'événement à créer',
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: EventSchema,
        },
      },
      description: 'Événement créé avec succès',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Données invalides',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Erreur serveur',
    },
  },
});

export const eventsRoutes = new OpenAPIHono()
  .openapi(createEventRoute, async (c) => {
    const validatedData = c.req.valid('json');

    const program = Effect.gen(function* () {
      const command: CreateEventCommand = {
        id: validatedData.id,
        tenantId: validatedData.tenantId,
        title: validatedData.title,
        start: new Date(validatedData.start),
        end: new Date(validatedData.end),
        capacity: validatedData.capacity,
        description: validatedData.description,
      };
      const event = yield* createEvent(command);
      return event;
    });

    try {
      const event = await Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
      return c.json(EventMapper.toResponse(event), 201);
    } catch (error) {
      console.error('Error creating event:', error);
      return c.json({ error: 'Failed to create event' }, 500);
    }
  });
