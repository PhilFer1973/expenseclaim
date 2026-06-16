// UK English helpers — currency + dates (dd-mm-yyyy).
export function formatGBP(amount: number | null | undefined): string {
  const n = typeof amount === "number" ? amount : 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** UK date: dd-mm-yyyy from any ISO-ish input. */
export function formatUKDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Back-compat alias used by older imports.
export const formatLongDate = formatUKDate;

/** Convert dd-mm-yyyy → yyyy-mm-dd. Returns null if invalid/empty. */
export function ukToISO(uk: string | null | undefined): string | null {
  if (!uk) return null;
  const m = uk.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : iso;
}

/** Convert yyyy-mm-dd → dd-mm-yyyy. */
export function isoToUK(iso: string | null | undefined): string {
  return formatUKDate(iso);
}

/**
 * Progressively format raw keypad input into dd-mm-yyyy as the user types.
 * Strips non-digits and inserts the dashes automatically, so a numeric
 * keypad (no dash key) can still enter a full date. "07122018" → "07-12-2018".
 */
export function formatUKDateInput(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  let out = dd;
  if (digits.length > 2) out += `-${mm}`;
  if (digits.length > 4) out += `-${yyyy}`;
  return out;
}

export function todayUK(): string {
  return formatUKDate(new Date().toISOString());
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
