import * as v from 'valibot';
import { ENUMS, SERVICE_ID_REGEX, TOOLS } from './meta.js';
import { isStrictDate, isStrictTimestamp } from './strict-dates.js';

/**
 * Builds the five tool input schemas with Valibot.
 * @param {{ describe: boolean }} options When true, field descriptions are attached.
 */
export function buildValibotSchemas({ describe }) {
  const d = (tool) => (schema, field) =>
    describe ? v.pipe(schema, v.description(TOOLS[tool].fields[field])) : schema;

  // Closest match for z.iso.datetime({ offset: true }) and z.iso.date().
  const timestamp = () =>
    v.pipe(
      v.string(),
      v.isoTimestamp(),
      v.check(isStrictTimestamp, 'Invalid ISO 8601 timestamp'),
    );
  const date = () =>
    v.pipe(v.string(), v.isoDate(), v.check(isStrictDate, 'Invalid ISO 8601 date'));
  const email = () => v.pipe(v.string(), v.email());
  const uuid = () => v.pipe(v.string(), v.uuid());

  const ru = d('register_user');
  const register_user = v.object({
    name: ru(v.pipe(v.string(), v.minLength(1), v.maxLength(100)), 'name'),
    email: ru(email(), 'email'),
    age: ru(v.pipe(v.number(), v.integer(), v.minValue(13), v.maxValue(120)), 'age'),
  });

  const se = d('schedule_event');
  const schedule_event = v.pipe(
    v.object({
      title: se(v.pipe(v.string(), v.minLength(1), v.maxLength(200)), 'title'),
      startsAt: se(timestamp(), 'startsAt'),
      endsAt: se(timestamp(), 'endsAt'),
      date: v.optional(se(date(), 'date')),
      attendees: v.optional(se(v.pipe(v.array(email()), v.maxLength(50)), 'attendees')),
      reminderMinutes: v.optional(
        se(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10080)), 'reminderMinutes'),
        15,
      ),
    }),
    v.forward(
      v.partialCheck(
        [['startsAt'], ['endsAt']],
        (input) => Date.parse(input.endsAt) > Date.parse(input.startsAt),
        'endsAt must be after startsAt',
      ),
      ['endsAt'],
    ),
  );

  const sp = d('search_products');
  const search_products = v.object({
    query: sp(v.pipe(v.string(), v.minLength(1), v.maxLength(500)), 'query'),
    filters: v.optional(
      sp(
        v.object({
          category: v.optional(sp(v.picklist(ENUMS.category), 'category')),
          minPrice: v.optional(sp(v.pipe(v.number(), v.minValue(0)), 'minPrice')),
          maxPrice: v.optional(sp(v.pipe(v.number(), v.minValue(0)), 'maxPrice')),
          inStock: v.optional(sp(v.boolean(), 'inStock')),
          tags: v.optional(
            sp(
              v.pipe(
                v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(50))),
                v.maxLength(10),
              ),
              'tags',
            ),
          ),
        }),
        'filters',
      ),
    ),
    sort: v.optional(sp(v.picklist(ENUMS.sort), 'sort'), 'relevance'),
    limit: v.optional(
      sp(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 'limit'),
      20,
    ),
    // safeInteger() matches z.int(), which rejects integers beyond 2^53 - 1.
    page: v.optional(sp(v.pipe(v.number(), v.safeInteger(), v.minValue(1)), 'page'), 1),
  });

  const uc = d('update_config');
  const update_config = v.object({
    service: uc(v.pipe(v.string(), v.maxLength(63), v.regex(SERVICE_ID_REGEX)), 'service'),
    environment: uc(v.picklist(ENUMS.environment), 'environment'),
    database: uc(
      v.object({
        host: uc(v.pipe(v.string(), v.minLength(1), v.maxLength(253)), 'host'),
        port: uc(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535)), 'port'),
        pool: uc(
          v.object({
            min: uc(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100)), 'min'),
            max: uc(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 'max'),
          }),
          'pool',
        ),
      }),
      'database',
    ),
    cache: v.optional(
      uc(
        v.object({
          enabled: uc(v.boolean(), 'enabled'),
          ttlSeconds: v.optional(
            uc(
              v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(86400)),
              'ttlSeconds',
            ),
            300,
          ),
        }),
        'cache',
      ),
    ),
    featureFlags: v.optional(uc(v.record(v.string(), v.boolean()), 'featureFlags')),
    logging: uc(
      v.object({
        level: v.optional(uc(v.picklist(ENUMS.logLevel), 'level'), 'info'),
        format: v.optional(uc(v.picklist(ENUMS.logFormat), 'format'), 'json'),
      }),
      'logging',
    ),
    webhookUrl: v.optional(uc(v.pipe(v.string(), v.url()), 'webhookUrl')),
  });

  const bt = d('bulk_update_tickets');
  const bulk_update_tickets = v.object({
    ticketIds: bt(v.pipe(v.array(uuid()), v.minLength(1), v.maxLength(100)), 'ticketIds'),
    status: v.optional(bt(v.picklist(ENUMS.status), 'status')),
    priority: v.optional(bt(v.picklist(ENUMS.priority), 'priority')),
    labels: v.optional(bt(v.pipe(v.array(v.picklist(ENUMS.label)), v.maxLength(5)), 'labels')),
    notify: v.optional(bt(v.array(v.picklist(ENUMS.channel)), 'notify'), ['email']),
    assigneeIds: v.optional(bt(v.pipe(v.array(uuid()), v.maxLength(3)), 'assigneeIds')),
  });

  return { register_user, schedule_event, search_products, update_config, bulk_update_tickets };
}
