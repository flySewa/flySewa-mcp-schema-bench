// Shared test inputs for the equivalence check. Every input is plain JSON,
// the same shape an MCP client sends in tools/call arguments.
// Each tool has at least 20 valid and 20 invalid inputs.

const U1 = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
const U2 = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
const U3 = '00000000-0000-0000-0000-000000000000';
const U4 = 'ABCDEF12-3456-7890-ABCD-EF1234567890';

const with_ = (base, patch) => ({ ...base, ...patch });
const without = (base, key) => {
  const copy = { ...base };
  delete copy[key];
  return copy;
};

// ---------------------------------------------------------------- register_user
const ru = { name: 'Ada Lovelace', email: 'ada@example.com', age: 36 };
const register_user = {
  valid: [
    ru,
    with_(ru, { name: 'A' }),
    with_(ru, { name: 'x'.repeat(100) }),
    with_(ru, { age: 13 }),
    with_(ru, { age: 120 }),
    with_(ru, { email: 'first.last@sub.example.co.uk' }),
    with_(ru, { email: 'user+tag@example.org' }),
    with_(ru, { email: 'o_brien@example.ie' }),
    with_(ru, { email: 'UPPER@EXAMPLE.COM' }),
    with_(ru, { email: 'a@b.io' }),
    with_(ru, { email: 'user-name@my-domain.dev' }),
    with_(ru, { email: 'n0.dots.allowed@example.travel' }),
    with_(ru, { name: 'Zoë Ündërwood' }),
    with_(ru, { name: '李小龙' }),
    with_(ru, { name: '  padded  ' }),
    with_(ru, { age: 64 }),
    with_(ru, { age: 13.0 }),
    with_(ru, { extra: 'ignored' }),
    with_(ru, { email: '123@example.com' }),
    with_(ru, { name: 'Grace Hopper', email: 'grace@navy.mil', age: 85 }),
  ],
  invalid: [
    {},
    without(ru, 'name'),
    without(ru, 'email'),
    without(ru, 'age'),
    with_(ru, { name: '' }),
    with_(ru, { name: 'x'.repeat(101) }),
    with_(ru, { name: 42 }),
    with_(ru, { name: null }),
    with_(ru, { email: 'not-an-email' }),
    with_(ru, { email: 'a@b' }),
    with_(ru, { email: 'a..b@example.com' }),
    with_(ru, { email: '.a@example.com' }),
    with_(ru, { email: 'a@-example.com' }),
    with_(ru, { email: 'a@example.c' }),
    with_(ru, { email: 'a b@example.com' }),
    with_(ru, { age: 12 }),
    with_(ru, { age: 121 }),
    with_(ru, { age: 30.5 }),
    with_(ru, { age: '36' }),
    with_(ru, { age: -1 }),
    null,
    'Ada',
  ],
};

// --------------------------------------------------------------- schedule_event
const se = {
  title: 'Design review',
  startsAt: '2026-03-10T14:00:00Z',
  endsAt: '2026-03-10T15:00:00Z',
};
const schedule_event = {
  valid: [
    se,
    with_(se, { startsAt: '2026-03-10T14:00:00+01:00', endsAt: '2026-03-10T15:30:00+01:00' }),
    with_(se, { startsAt: '2026-03-10T14:00:00.123Z', endsAt: '2026-03-10T14:00:00.456Z' }),
    with_(se, { startsAt: '2026-03-10T23:30:00-05:00', endsAt: '2026-03-11T05:00:00Z' }),
    with_(se, { date: '2026-03-10' }),
    with_(se, { date: '2024-02-29' }),
    with_(se, { date: '2000-02-29' }),
    with_(se, { attendees: [] }),
    with_(se, { attendees: ['a@example.com', 'b@example.org'] }),
    with_(se, { attendees: Array.from({ length: 50 }, (_, i) => `p${i}@example.com`) }),
    with_(se, { reminderMinutes: 0 }),
    with_(se, { reminderMinutes: 10080 }),
    with_(se, { reminderMinutes: 30 }),
    with_(se, { title: 'x'.repeat(200) }),
    with_(se, { title: 'Q' }),
    with_(se, { startsAt: '2026-12-31T23:59:59Z', endsAt: '2027-01-01T00:00:00Z' }),
    with_(se, { startsAt: '2026-03-10T14:00:00.1+05:30', endsAt: '2026-03-10T14:00:00.2+05:30' }),
    with_(se, { endsAt: '2026-03-10T14:00:01Z' }),
    with_(se, {
      date: '2026-03-10',
      attendees: ['team@example.com'],
      reminderMinutes: 60,
    }),
    with_(se, { startsAt: '2028-02-29T09:00:00Z', endsAt: '2028-02-29T10:00:00Z' }),
  ],
  invalid: [
    {},
    without(se, 'title'),
    without(se, 'startsAt'),
    without(se, 'endsAt'),
    with_(se, { title: '' }),
    with_(se, { title: 'x'.repeat(201) }),
    with_(se, { endsAt: '2026-03-10T13:00:00Z' }),
    with_(se, { endsAt: se.startsAt }),
    with_(se, { startsAt: '2026-03-10T14:00:00' }),
    with_(se, { startsAt: '2026-03-10T14:00Z' }),
    with_(se, { startsAt: '2026-03-10 14:00:00Z' }),
    with_(se, { startsAt: '2026-02-30T14:00:00Z', endsAt: '2026-03-10T15:00:00Z' }),
    with_(se, { startsAt: '2026-03-10T14:00:00+0100' }),
    with_(se, { startsAt: '2026-03-10T24:00:00Z' }),
    with_(se, { startsAt: 'next tuesday' }),
    with_(se, { date: '2026-02-29' }),
    with_(se, { date: '2026-13-01' }),
    with_(se, { date: '2026-3-10' }),
    with_(se, { attendees: ['not-an-email'] }),
    with_(se, { attendees: Array.from({ length: 51 }, (_, i) => `p${i}@example.com`) }),
    with_(se, { reminderMinutes: -1 }),
    with_(se, { reminderMinutes: 10081 }),
    with_(se, { reminderMinutes: 2.5 }),
  ],
};

// -------------------------------------------------------------- search_products
const sp = { query: 'wireless headphones' };
const search_products = {
  valid: [
    sp,
    with_(sp, { query: 'a' }),
    with_(sp, { query: 'x'.repeat(500) }),
    with_(sp, { filters: {} }),
    with_(sp, { filters: { category: 'electronics' } }),
    with_(sp, { filters: { category: 'toys', inStock: true } }),
    with_(sp, { filters: { minPrice: 0, maxPrice: 199.99 } }),
    with_(sp, { filters: { minPrice: 10.5 } }),
    with_(sp, { filters: { tags: [] } }),
    with_(sp, { filters: { tags: ['sale', 'new'] } }),
    with_(sp, { filters: { tags: Array.from({ length: 10 }, (_, i) => `t${i}`) } }),
    with_(sp, { sort: 'price_asc' }),
    with_(sp, { sort: 'newest' }),
    with_(sp, { limit: 1 }),
    with_(sp, { limit: 100 }),
    with_(sp, { page: 1 }),
    with_(sp, { page: 9999 }),
    with_(sp, { page: Number.MAX_SAFE_INTEGER }),
    with_(sp, {
      filters: { category: 'books', minPrice: 5, maxPrice: 50, inStock: false, tags: ['used'] },
      sort: 'relevance',
      limit: 50,
      page: 3,
    }),
    with_(sp, { filters: { inStock: false }, unknownKey: true }),
  ],
  invalid: [
    {},
    with_(sp, { query: '' }),
    with_(sp, { query: 'x'.repeat(501) }),
    with_(sp, { query: 123 }),
    with_(sp, { filters: null }),
    with_(sp, { filters: 'electronics' }),
    with_(sp, { filters: { category: 'garden' } }),
    with_(sp, { filters: { category: 'Electronics' } }),
    with_(sp, { filters: { minPrice: -0.01 } }),
    with_(sp, { filters: { maxPrice: '50' } }),
    with_(sp, { filters: { inStock: 'yes' } }),
    with_(sp, { filters: { tags: [''] } }),
    with_(sp, { filters: { tags: ['x'.repeat(51)] } }),
    with_(sp, { filters: { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) } }),
    with_(sp, { filters: { tags: 'sale' } }),
    with_(sp, { sort: 'popular' }),
    with_(sp, { limit: 0 }),
    with_(sp, { limit: 101 }),
    with_(sp, { limit: 10.5 }),
    with_(sp, { page: 0 }),
    with_(sp, { page: Number.MAX_SAFE_INTEGER + 2 }),
    with_(sp, { sort: null }),
  ],
};

// ---------------------------------------------------------------- update_config
const uc = {
  service: 'billing-api',
  environment: 'staging',
  database: { host: 'db.internal', port: 5432, pool: { min: 2, max: 10 } },
  logging: {},
};
const db = (patch) => ({ ...uc.database, ...patch });
const update_config = {
  valid: [
    uc,
    with_(uc, { service: 'a' }),
    with_(uc, { service: 'svc2-v10' }),
    with_(uc, { service: 'a' + 'b'.repeat(62) }),
    with_(uc, { environment: 'production' }),
    with_(uc, { environment: 'development' }),
    with_(uc, { database: db({ port: 1 }) }),
    with_(uc, { database: db({ port: 65535 }) }),
    with_(uc, { database: db({ pool: { min: 0, max: 1 } }) }),
    with_(uc, { database: db({ pool: { min: 100, max: 100 } }) }),
    with_(uc, { cache: { enabled: true } }),
    with_(uc, { cache: { enabled: false, ttlSeconds: 0 } }),
    with_(uc, { cache: { enabled: true, ttlSeconds: 86400 } }),
    with_(uc, { featureFlags: {} }),
    with_(uc, { featureFlags: { newCheckout: true, darkMode: false } }),
    with_(uc, { logging: { level: 'debug', format: 'text' } }),
    with_(uc, { logging: { level: 'error' } }),
    with_(uc, { webhookUrl: 'https://hooks.example.com/deploy?id=1' }),
    with_(uc, { webhookUrl: 'http://localhost:8080/cb' }),
    with_(uc, { database: db({ host: 'x'.repeat(253) }) }),
  ],
  invalid: [
    {},
    without(uc, 'service'),
    without(uc, 'database'),
    without(uc, 'logging'),
    with_(uc, { service: 'Billing-API' }),
    with_(uc, { service: 'billing_api' }),
    with_(uc, { service: '-billing' }),
    with_(uc, { service: 'billing-' }),
    with_(uc, { service: 'a' + 'b'.repeat(63) }),
    with_(uc, { environment: 'prod' }),
    with_(uc, { database: db({ host: '' }) }),
    with_(uc, { database: db({ port: 0 }) }),
    with_(uc, { database: db({ port: 65536 }) }),
    with_(uc, { database: db({ port: '5432' }) }),
    with_(uc, { database: db({ pool: { min: -1, max: 10 } }) }),
    with_(uc, { database: db({ pool: { min: 1, max: 0 } }) }),
    with_(uc, { database: db({ pool: { min: 1 } }) }),
    with_(uc, { cache: { ttlSeconds: 60 } }),
    with_(uc, { cache: { enabled: true, ttlSeconds: 86401 } }),
    with_(uc, { featureFlags: { newCheckout: 'on' } }),
    with_(uc, { logging: { level: 'trace' } }),
    with_(uc, { logging: { format: 'xml' } }),
    with_(uc, { webhookUrl: 'hooks.example.com/deploy' }),
    with_(uc, { webhookUrl: 'https://' }),
  ],
};

// ---------------------------------------------------------- bulk_update_tickets
const bt = { ticketIds: [U1] };
const bulk_update_tickets = {
  valid: [
    bt,
    with_(bt, { ticketIds: [U1, U2, U3] }),
    with_(bt, { ticketIds: [U4] }),
    with_(bt, { ticketIds: Array.from({ length: 100 }, () => U2) }),
    with_(bt, { status: 'open' }),
    with_(bt, { status: 'closed' }),
    with_(bt, { priority: 'urgent' }),
    with_(bt, { priority: 'low' }),
    with_(bt, { labels: [] }),
    with_(bt, { labels: ['bug', 'outage'] }),
    with_(bt, { labels: ['bug', 'billing', 'feature-request', 'account', 'outage'] }),
    with_(bt, { labels: ['bug', 'bug'] }),
    with_(bt, { notify: [] }),
    with_(bt, { notify: ['slack'] }),
    with_(bt, { notify: ['email', 'sms', 'push', 'slack'] }),
    with_(bt, { assigneeIds: [] }),
    with_(bt, { assigneeIds: [U2, U3, U4] }),
    with_(bt, { status: 'resolved', priority: 'medium', labels: ['account'], notify: ['push'] }),
    with_(bt, { ticketIds: ['3F2B8C1E-4A5D-4E6F-9A7B-1C2D3E4F5A6B'] }),
    with_(bt, { status: 'pending', ignored: 1 }),
  ],
  invalid: [
    {},
    with_(bt, { ticketIds: [] }),
    with_(bt, { ticketIds: Array.from({ length: 101 }, () => U2) }),
    with_(bt, { ticketIds: ['not-a-uuid'] }),
    with_(bt, { ticketIds: ['3f2b8c1e4a5d4e6f9a7b1c2d3e4f5a6b'] }),
    with_(bt, { ticketIds: ['3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6'] }),
    with_(bt, { ticketIds: ['{3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b}'] }),
    with_(bt, { ticketIds: U1 }),
    with_(bt, { ticketIds: [123] }),
    with_(bt, { status: 'reopened' }),
    with_(bt, { status: 'OPEN' }),
    with_(bt, { priority: 'critical' }),
    with_(bt, { priority: 1 }),
    with_(bt, { labels: ['bug', 'billing', 'feature-request', 'account', 'outage', 'bug'] }),
    with_(bt, { labels: ['spam'] }),
    with_(bt, { labels: 'bug' }),
    with_(bt, { notify: ['fax'] }),
    with_(bt, { notify: 'email' }),
    with_(bt, { assigneeIds: [U1, U2, U3, U4] }),
    with_(bt, { assigneeIds: ['zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz'] }),
    with_(bt, { ticketIds: [U1], status: null }),
  ],
};

// Inputs where the two libraries' built-in validators disagree. They are not
// part of the pass/fail equivalence check; the benchmark runs them and
// reports the result so the difference is documented, not hidden.
export const KNOWN_DIVERGENCES = [
  {
    tool: 'register_user',
    input: with_(ru, { email: "o'neil@example.com" }),
    note: "Apostrophe in the email local part. Zod's z.email() regex allows ' ; Valibot's email() does not.",
  },
];

export const CASES = {
  register_user,
  schedule_event,
  search_products,
  update_config,
  bulk_update_tickets,
};
