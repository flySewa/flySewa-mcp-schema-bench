// Closest-match helpers for Valibot.
//
// Zod 4's z.iso.datetime({ offset: true }) and z.iso.date() reject impossible
// calendar dates (2026-02-30, 2026-02-29), a space instead of "T", and offsets
// without a colon (+0100). Valibot's isoTimestamp() and isoDate() accept those.
// To keep the validation requirements identical, the Valibot schemas add a
// v.check() that applies these rules. A check() cannot be expressed in JSON
// Schema, so it is left out of Valibot's JSON Schema output (see README).

const TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(y, m, d) {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export function isStrictTimestamp(input) {
  const match = TIMESTAMP.exec(input);
  return match !== null && isRealDate(match[1], match[2], match[3]);
}

export function isStrictDate(input) {
  const match = DATE.exec(input);
  return match !== null && isRealDate(match[1], match[2], match[3]);
}
