// Currency catalogue and helpers.
//
// GBP and EUR are "core" — always enabled and cannot be removed from the
// accepted list. Other codes (USD, CAD, AUD, …) are optional and configurable
// through Settings → Payments.

export const CORE_CURRENCIES = ["GBP", "EUR"] as const;
export type CoreCurrency = (typeof CORE_CURRENCIES)[number];

// Catalogue of currencies the app knows how to display/format.
// Extend when a new market is needed.
export const CURRENCY_LABELS: Record<string, string> = {
  GBP: "GBP — United Kingdom",
  EUR: "EUR — Ireland / EU",
  USD: "USD — United States",
  CAD: "CAD — Canada",
  AUD: "AUD — Australia",
  NZD: "NZD — New Zealand",
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "\u00a3",
  EUR: "\u20ac",
  USD: "$",
  CAD: "C$",
  AUD: "A$",
  NZD: "NZ$",
};

// All currency codes the app will recognise, even if they aren't currently
// enabled. Used for validation and the "Add currency" picker.
export const KNOWN_CURRENCIES = Object.keys(CURRENCY_LABELS);

export function isCoreCurrency(code: string): boolean {
  return (CORE_CURRENCIES as readonly string[]).includes(code);
}

// Ensure GBP and EUR are always present and de-dupe the list.
export function ensureCore(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of CORE_CURRENCIES) {
    seen.add(c);
    out.push(c);
  }
  for (const c of list) {
    if (!seen.has(c) && KNOWN_CURRENCIES.includes(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}
