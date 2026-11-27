import * as z from 'zod';
import { ENUMS, SERVICE_ID_REGEX, TOOLS } from './meta.js';

/**
 * Builds the five tool input schemas with Zod.
 * @param {{ describe: boolean }} options When true, field descriptions are attached.
 */
export function buildZodSchemas({ describe }) {
  const d = (tool) => (schema, field) =>
    describe ? schema.describe(TOOLS[tool].fields[field]) : schema;

  const ru = d('register_user');
  const register_user = z.object({
    name: ru(z.string().min(1).max(100), 'name'),
    email: ru(z.email(), 'email'),
    age: ru(z.int().min(13).max(120), 'age'),
  });

  const se = d('schedule_event');
  const schedule_event = z
    .object({
      title: se(z.string().min(1).max(200), 'title'),
      startsAt: se(z.iso.datetime({ offset: true }), 'startsAt'),
      endsAt: se(z.iso.datetime({ offset: true }), 'endsAt'),
      date: se(z.iso.date(), 'date').optional(),
      attendees: se(z.array(z.email()).max(50), 'attendees').optional(),
      reminderMinutes: se(z.int().min(0).max(10080), 'reminderMinutes').default(15),
    })
    .refine((input) => Date.parse(input.endsAt) > Date.parse(input.startsAt), {
      message: 'endsAt must be after startsAt',
      path: ['endsAt'],
    });

  const sp = d('search_products');
  const search_products = z.object({
    query: sp(z.string().min(1).max(500), 'query'),
    filters: sp(
      z.object({
        category: sp(z.enum(ENUMS.category), 'category').optional(),
        minPrice: sp(z.number().min(0), 'minPrice').optional(),
        maxPrice: sp(z.number().min(0), 'maxPrice').optional(),
        inStock: sp(z.boolean(), 'inStock').optional(),
        tags: sp(z.array(z.string().min(1).max(50)).max(10), 'tags').optional(),
      }),
      'filters',
    ).optional(),
    sort: sp(z.enum(ENUMS.sort), 'sort').default('relevance'),
    limit: sp(z.int().min(1).max(100), 'limit').default(20),
    page: sp(z.int().min(1), 'page').default(1),
  });

  const uc = d('update_config');
  const update_config = z.object({
    service: uc(z.string().max(63).regex(SERVICE_ID_REGEX), 'service'),
    environment: uc(z.enum(ENUMS.environment), 'environment'),
    database: uc(
      z.object({
        host: uc(z.string().min(1).max(253), 'host'),
        port: uc(z.int().min(1).max(65535), 'port'),
        pool: uc(
          z.object({
            min: uc(z.int().min(0).max(100), 'min'),
            max: uc(z.int().min(1).max(100), 'max'),
          }),
          'pool',
        ),
      }),
      'database',
    ),
    cache: uc(
      z.object({
        enabled: uc(z.boolean(), 'enabled'),
        ttlSeconds: uc(z.int().min(0).max(86400), 'ttlSeconds').default(300),
      }),
      'cache',
    ).optional(),
    featureFlags: uc(z.record(z.string(), z.boolean()), 'featureFlags').optional(),
    logging: uc(
      z.object({
        level: uc(z.enum(ENUMS.logLevel), 'level').default('info'),
        format: uc(z.enum(ENUMS.logFormat), 'format').default('json'),
      }),
      'logging',
    ),
    webhookUrl: uc(z.url(), 'webhookUrl').optional(),
  });

  const bt = d('bulk_update_tickets');
  const bulk_update_tickets = z.object({
    // z.guid() is used instead of z.uuid(): z.uuid() only accepts RFC 9562
    // version and variant nibbles, while Valibot's uuid() accepts any
    // 8-4-4-4-12 hex string. z.guid() matches Valibot's behaviour.
    ticketIds: bt(z.array(z.guid()).min(1).max(100), 'ticketIds'),
    status: bt(z.enum(ENUMS.status), 'status').optional(),
    priority: bt(z.enum(ENUMS.priority), 'priority').optional(),
    labels: bt(z.array(z.enum(ENUMS.label)).max(5), 'labels').optional(),
    notify: bt(z.array(z.enum(ENUMS.channel)), 'notify').default(['email']),
    assigneeIds: bt(z.array(z.guid()).max(3), 'assigneeIds').optional(),
  });

  return { register_user, schedule_event, search_products, update_config, bulk_update_tickets };
}
