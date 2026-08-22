const CURRENCY_SYMBOL: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  ALL: "L",
};

export function currencySymbol(currency = "EUR"): string {
  return CURRENCY_SYMBOL[currency] ?? currency + " ";
}

export function formatMoney(amount: number, currency = "EUR"): string {
  const symbol = currencySymbol(currency);
  const rounded = Number.isInteger(amount) ? amount.toString() : amount.toFixed(2);
  return `${symbol}${rounded}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Local wall-clock time "HH:mm". */
export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** e.g. "Mon, 25 Aug 2026" */
export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** e.g. "Monday, 25 August 2026" */
export function formatDateLong(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/** "YYYY-MM-DD" in local time (safe for date-only keys). */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Parse "YYYY-MM-DD" into a local Date at midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(y, m - 1, day, 0, 0, 0, 0);
}

export function relativeDayLabel(d: Date): string {
  const today = new Date();
  const a = toDateKey(d);
  const b = toDateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (a === b) return "Today";
  if (a === toDateKey(tomorrow)) return "Tomorrow";
  return WEEKDAYS_SHORT[d.getDay()];
}

export { MONTHS, MONTHS_SHORT, WEEKDAYS, WEEKDAYS_SHORT };
