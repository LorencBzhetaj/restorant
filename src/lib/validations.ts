import { z } from "zod";

export const customerDetailsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().min(6, "A valid phone number is required").max(30),
  email: z.string().trim().email("A valid email is required — we send your confirmation there").max(120),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CustomerDetailsInput = z.infer<typeof customerDetailsSchema>;

export const areaEnum = z.enum(["indoor", "outdoor", "no_preference"]);

export const createReservationSchema = customerDetailsSchema.extend({
  tableId: z.string().min(1, "Select a table"),
  start: z.string().min(1),
  partySize: z.coerce.number().int().min(1).max(30),
  requestedArea: areaEnum.default("no_preference"),
});

export const walkInSchema = z.object({
  tableId: z.string().min(1),
  start: z.string().min(1),
  partySize: z.coerce.number().int().min(1).max(30),
  requestedArea: areaEnum.default("no_preference"),
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().min(6, "Phone is required").max(30),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const tableSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  seats: z.coerce.number().int().min(1).max(30),
  section: z.string().trim().min(1, "Section is required").max(40),
  areaId: z.string().optional().or(z.literal("")),
  shape: z.enum(["square", "round", "rect"]).default("square"),
  x: z.coerce.number().int().min(0).max(11),
  y: z.coerce.number().int().min(0).max(7),
  w: z.coerce.number().int().min(1).max(4),
  h: z.coerce.number().int().min(1).max(4),
  isActive: z.boolean().default(true),
});

export const areaSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  kind: z.enum(["indoor", "outdoor"]).default("indoor"),
  weatherDependent: z.boolean().default(false),
  priority: z.coerce.number().int().min(0).max(99).default(0),
});

export const areaClosureSchema = z
  .object({
    areaId: z.string().min(1, "Select an area"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    fullDay: z.boolean().default(true),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    reason: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .refine((v) => v.fullDay || (!!v.startTime && !!v.endTime), {
    message: "Set a start and end time (or choose full day)",
    path: ["startTime"],
  })
  .refine((v) => v.fullDay || (v.startTime ?? "") < (v.endTime ?? ""), {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const combinationSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(60),
    areaId: z.string().min(1, "Select an area"),
    maxSeats: z.coerce.number().int().min(2, "Max seats must be at least 2").max(60),
    minSeats: z.coerce.number().int().min(0).max(60).optional(),
    priority: z.coerce.number().int().min(0).max(99).default(0),
    isActive: z.boolean().default(true),
    tableIds: z.array(z.string().min(1)).min(2, "A combination needs at least two tables"),
  })
  .refine((v) => new Set(v.tableIds).size === v.tableIds.length, {
    message: "A table cannot appear twice in the same combination",
    path: ["tableIds"],
  })
  .refine((v) => !v.minSeats || v.minSeats <= v.maxSeats, {
    message: "Min seats cannot exceed max seats",
    path: ["minSeats"],
  });

// Floor-plan editor: a batch of table position/size/shape/rotation updates.
// Grid is 12 x 8; a table must stay fully inside the canvas (never lost off-grid).
const FLOOR_COLS = 12;
const FLOOR_ROWS = 8;
export const floorTableLayoutSchema = z
  .object({
    id: z.string().min(1),
    x: z.coerce.number().int().min(0).max(FLOOR_COLS - 1),
    y: z.coerce.number().int().min(0).max(FLOOR_ROWS - 1),
    w: z.coerce.number().int().min(1).max(FLOOR_COLS),
    h: z.coerce.number().int().min(1).max(FLOOR_ROWS),
    shape: z.enum(["square", "round", "rect"]),
    rotation: z.coerce.number().int().refine((v) => [0, 90, 180, 270].includes(v), "Rotation must be 0/90/180/270"),
  })
  .refine((t) => t.x + t.w <= FLOOR_COLS, { message: "Table extends past the right edge", path: ["x"] })
  .refine((t) => t.y + t.h <= FLOOR_ROWS, { message: "Table extends past the bottom edge", path: ["y"] });

export const floorLayoutSchema = z.object({
  tables: z.array(floorTableLayoutSchema).min(1).max(200),
});

export const openingHourSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const closureSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().max(120).optional().or(z.literal("")),
  currency: z.string().trim().min(1).max(8),
  turnDurationMinutes: z.coerce.number().int().min(30).max(360),
  bookingInterval: z.coerce.number().int().min(15).max(120),
  seatingBuffer: z.coerce.number().int().min(0).max(120),
  maxPartySize: z.coerce.number().int().min(1).max(30),
  maxReservationsPerSlot: z.coerce.number().int().min(0).max(200),
  maxCoversPerSlot: z.coerce.number().int().min(0).max(1000),
});

export const slotLimitSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(-1).max(6), // -1 = every day
  time: z.string().regex(/^\d{2}:\d{2}$/),
  areaKind: z.enum(["global", "indoor", "outdoor"]).default("global"),
  maxReservations: z.coerce.number().int().min(0).max(200),
  maxCovers: z.coerce.number().int().min(0).max(1000).optional(),
});
