/**
 * Course pricing in more than one currency.
 *
 * Fire settles like-for-like only — a sterling payment request needs a
 * sterling account, a euro one needs a euro account. So an Irish parent can't
 * pay a GBP request at all; they reach the bank picker and quietly fail. The
 * practice holds both accounts, so the fix is to raise the request in the
 * currency the buyer actually holds.
 *
 * Euro prices are typed in by hand, not converted. A fixed €30 stays a clean
 * number on the page, doesn't need re-checking when the rate moves, and can't
 * drift into selling below cost.
 */

export const CURRENCIES = ["GBP", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: "£",
  EUR: "€",
};

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

/** "£27" / "€30" — whole units, which is how course prices are stored. */
export function formatPrice(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${amount}`;
}

/** "£27.00" — for receipts, where the pennies belong. */
export function formatExact(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${amount.toFixed(2)}`;
}

/**
 * What a course costs in a given currency, or null when it isn't sold in it.
 * A course with no euro price is sterling-only and the euro option is never
 * offered — so nothing changes for a course until someone sets one.
 */
export function priceIn(
  course: { price: number; priceEur?: number | null },
  currency: Currency,
): number | null {
  if (currency === "GBP") return course.price;
  return typeof course.priceEur === "number" ? course.priceEur : null;
}

/** The currencies a course can actually be bought in. Always includes GBP. */
export function availableCurrencies(course: {
  price: number;
  priceEur?: number | null;
}): Currency[] {
  return typeof course.priceEur === "number" ? ["GBP", "EUR"] : ["GBP"];
}
