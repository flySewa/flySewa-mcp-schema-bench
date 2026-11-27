// Shared tool metadata. Both libraries read names and descriptions from here,
// so any text that ends up in a schema is byte-identical across variants.

export const TOOLS = {
  register_user: {
    title: 'Register user',
    description: 'Create a new user account.',
    fields: {
      name: 'Full display name of the user.',
      email: 'Email address used to sign in.',
      age: 'Age in whole years. Must be at least 13.',
    },
  },
  schedule_event: {
    title: 'Schedule event',
    description: 'Schedule a calendar event between two points in time.',
    fields: {
      title: 'Short title shown on the calendar.',
      startsAt: 'Start time as an ISO 8601 timestamp with a UTC offset.',
      endsAt: 'End time as an ISO 8601 timestamp with a UTC offset. Must be after startsAt.',
      date: 'Calendar date the event belongs to (YYYY-MM-DD).',
      attendees: 'Email addresses of people to invite.',
      reminderMinutes: 'Minutes before the start to send a reminder.',
    },
  },
  search_products: {
    title: 'Search products',
    description: 'Search the product catalog with optional filters.',
    fields: {
      query: 'Free-text search query.',
      filters: 'Optional filters that narrow the results.',
      category: 'Restrict results to one category.',
      minPrice: 'Minimum price in USD.',
      maxPrice: 'Maximum price in USD.',
      inStock: 'Only return products that are in stock.',
      tags: 'Only return products that carry all of these tags.',
      sort: 'Sort order for the results.',
      limit: 'Maximum number of results to return.',
      page: 'Page number, starting at 1.',
    },
  },
  update_config: {
    title: 'Update service configuration',
    description: 'Update the deployment configuration of a service.',
    fields: {
      service: 'Service identifier in lowercase kebab-case.',
      environment: 'Target deployment environment.',
      database: 'Database connection settings.',
      host: 'Database host name.',
      port: 'Database port.',
      pool: 'Connection pool limits.',
      min: 'Minimum open connections.',
      max: 'Maximum open connections.',
      cache: 'Optional cache settings.',
      enabled: 'Whether the cache is enabled.',
      ttlSeconds: 'Cache entry lifetime in seconds.',
      featureFlags: 'Feature flag names mapped to on or off.',
      logging: 'Logging settings.',
      level: 'Minimum log level.',
      format: 'Log output format.',
      webhookUrl: 'Optional URL notified after the change is applied.',
    },
  },
  bulk_update_tickets: {
    title: 'Bulk update tickets',
    description: 'Apply the same change to several support tickets.',
    fields: {
      ticketIds: 'IDs of the tickets to update.',
      status: 'New ticket status.',
      priority: 'New ticket priority.',
      labels: 'Labels to apply.',
      notify: 'Channels used to notify watchers.',
      assigneeIds: 'IDs of agents to assign.',
    },
  },
};

export const TOOL_NAMES = Object.keys(TOOLS);

// Enum values shared by both implementations.
export const ENUMS = {
  category: ['electronics', 'books', 'clothing', 'home', 'toys'],
  sort: ['relevance', 'price_asc', 'price_desc', 'newest'],
  environment: ['development', 'staging', 'production'],
  logLevel: ['debug', 'info', 'warn', 'error'],
  logFormat: ['json', 'text'],
  status: ['open', 'pending', 'resolved', 'closed'],
  priority: ['low', 'medium', 'high', 'urgent'],
  label: ['bug', 'billing', 'feature-request', 'account', 'outage'],
  channel: ['email', 'sms', 'push', 'slack'],
};

export const SERVICE_ID_REGEX = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
