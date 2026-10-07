/** Profile-owned color. `gold` is granted by the home instance to its admins. */
export function normalizeNameColor(value: unknown): string | null {
  if (value === 'gold') return value;
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  return null;
}
