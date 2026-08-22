export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type ReservationStatus =
  | "Confirmed"
  | "Seated"
  | "Completed"
  | "Cancelled"
  | "NoShow";

export const RESERVATION_STATUSES: ReservationStatus[] = [
  "Confirmed",
  "Seated",
  "Completed",
  "Cancelled",
  "NoShow",
];

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  Confirmed: "Confirmed",
  Seated: "Seated",
  Completed: "Completed",
  Cancelled: "Cancelled",
  NoShow: "No-show",
};

export const STATUS_BADGE: Record<ReservationStatus, string> = {
  Confirmed: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  Seated: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
  NoShow: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
};

export const NOTIFICATION_TYPES = {
  BookingConfirmation: "BookingConfirmation",
  Reminder24h: "Reminder24h",
  Reminder2h: "Reminder2h",
  Cancellation: "Cancellation",
  Reschedule: "Reschedule",
  Completed: "Completed",
  NoShow: "NoShow",
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export const NOTIFICATION_LABEL: Record<NotificationType, string> = {
  BookingConfirmation: "Booking confirmation",
  Reminder24h: "24-hour reminder",
  Reminder2h: "2-hour reminder",
  Cancellation: "Cancellation notice",
  Reschedule: "Reschedule notice",
  Completed: "Thank-you message",
  NoShow: "No-show notice",
};

export const ANY_TABLE = "any";

// Floor-map grid dimensions (mobile-first; scales to any width).
export const FLOOR_COLS = 12;
export const FLOOR_ROWS = 8;

export const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
