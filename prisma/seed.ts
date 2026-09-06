import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260819);
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const randInt = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

function atMidnight(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function dateAt(day: Date, minutes: number) {
  const x = atMidnight(day);
  x.setMinutes(minutes);
  return x;
}
const overlap = (aS: Date, aE: Date, bS: Date, bE: Date) => aS < bE && bS < aE;

const TURN = 120;
const BUFFER = 15;
// Opening shifts (minutes from midnight): lunch 12:00-15:00, dinner 18:00-23:00
const SHIFTS: [number, number][] = [
  [12 * 60, 15 * 60],
  [18 * 60, 23 * 60],
];
function slotStarts([start, end]: [number, number]): number[] {
  const out: number[] = [];
  for (let t = start; t + TURN <= end; t += 30) out.push(t);
  return out;
}

// Floor plan on a 12 x 8 grid
const TABLES = [
  { name: "W1", seats: 2, section: "Window", shape: "round", x: 0, y: 0, w: 2, h: 2 },
  { name: "W2", seats: 2, section: "Window", shape: "round", x: 3, y: 0, w: 2, h: 2 },
  { name: "W3", seats: 2, section: "Window", shape: "round", x: 6, y: 0, w: 2, h: 2 },
  { name: "W4", seats: 2, section: "Window", shape: "round", x: 9, y: 0, w: 2, h: 2 },
  { name: "M1", seats: 4, section: "Main hall", shape: "square", x: 0, y: 3, w: 2, h: 2 },
  { name: "M2", seats: 4, section: "Main hall", shape: "square", x: 3, y: 3, w: 2, h: 2 },
  { name: "M3", seats: 4, section: "Main hall", shape: "square", x: 6, y: 3, w: 2, h: 2 },
  { name: "M4", seats: 4, section: "Main hall", shape: "square", x: 9, y: 3, w: 2, h: 2 },
  { name: "G1", seats: 6, section: "Garden", shape: "rect", x: 0, y: 6, w: 3, h: 2 },
  { name: "G2", seats: 6, section: "Garden", shape: "rect", x: 4, y: 6, w: 3, h: 2 },
  { name: "G3", seats: 8, section: "Garden", shape: "rect", x: 8, y: 6, w: 4, h: 2 },
];

async function main() {
  console.log("Clearing existing data…");
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.openingHour.deleteMany();
  await prisma.closure.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.restaurantSetting.deleteMany();

  await prisma.restaurantSetting.create({
    data: {
      name: "Gjeçaj Alpine Restaurant Cuisine",
      tagline: "Modern Mediterranean dining in the heart of Tirana",
      phone: "+355 69 987 6543",
      whatsapp: "+355 69 987 6543",
      address: "Rruga Ismail Qemali 15, Tirana, Albania",
      email: "reservations@terrazza.al",
      currency: "EUR",
      turnDurationMinutes: TURN,
      bookingInterval: 30,
      seatingBuffer: BUFFER,
      maxPartySize: 12,
      timezone: "Europe/Tirane",
    },
  });

  for (let dow = 0; dow < 7; dow++) {
    for (const [s, e] of SHIFTS) {
      const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      await prisma.openingHour.create({ data: { dayOfWeek: dow, startTime: hh(s), endTime: hh(e) } });
    }
  }

  const tables = [];
  for (let i = 0; i < TABLES.length; i++) {
    tables.push(await prisma.restaurantTable.create({ data: { ...TABLES[i], sortOrder: i + 1 } }));
  }

  const today = atMidnight(new Date());
  await prisma.closure.create({
    data: { startDate: addDays(today, 9), endDate: addDays(today, 9), reason: "Private event" },
  });

  const firstNames = ["Andi", "Besnik", "Dritan", "Elton", "Fatjon", "Gentian", "Ilir", "Jetmir", "Kreshnik", "Lorenc", "Marsel", "Neritan", "Orges", "Petrit", "Redon", "Sokol", "Taulant", "Valon", "Arben", "Enea", "Elira", "Klara", "Blerta", "Genta"];
  const lastNames = ["Hysa", "Dervishi", "Prifti", "Leka", "Bardhi", "Gjoni", "Rama", "Basha", "Cela", "Duka", "Shehu", "Zeqiri", "Nikaj", "Berisha", "Kraja", "Mema", "Vata", "Toska", "Lala", "Marku", "Currila", "Bushi", "Frasheri", "Cani"];
  const customers = [];
  for (let i = 0; i < 24; i++) {
    const firstName = firstNames[i];
    const lastName = lastNames[i];
    const phone = `+355 69 ${randInt(200, 799)} ${randInt(1000, 9999)}`;
    customers.push(
      await prisma.customer.create({
        data: {
          firstName,
          lastName,
          phone,
          whatsappNumber: phone,
          email: rnd() > 0.4 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com` : null,
          notes: rnd() > 0.85 ? pick(["Regular — prefers the terrace.", "Allergic to shellfish.", "Celebrates anniversary here.", "Likes a quiet corner table."]) : null,
        },
      }),
    );
  }

  const now = new Date();
  const booked: Record<string, { s: Date; e: Date }[]> = {};
  for (const t of tables) booked[t.id] = [];

  type Payload = {
    tableId: string; customerId: string; startDateTime: Date; endDateTime: Date;
    partySize: number; status: string; source: string;
  };
  const reservations: Payload[] = [];

  for (let offset = -14; offset <= 10; offset++) {
    const day = addDays(today, offset);
    if (offset === 9) continue; // closure day
    for (const table of tables) {
      for (const shift of SHIFTS) {
        const isDinner = shift[0] >= 16 * 60;
        let prob = isDinner ? 0.28 : 0.14;
        if (offset === 0) prob += 0.25;
        if (Math.abs(offset) <= 2) prob += 0.08;
        if (rnd() > prob) continue;

        const t = pick(slotStarts(shift));
        const s = dateAt(day, t);
        const e = dateAt(day, t + TURN);
        const bufMs = BUFFER * 60000;
        if (booked[table.id].some((b) => overlap(new Date(s.getTime() - bufMs), new Date(e.getTime() + bufMs), b.s, b.e))) continue;
        booked[table.id].push({ s, e });

        const partySize = Math.max(1, randInt(table.seats - 2, table.seats));

        let status: string;
        if (offset < 0) {
          const r = rnd();
          status = r < 0.85 ? "Completed" : r < 0.93 ? "Cancelled" : "NoShow";
        } else if (offset === 0) {
          status = isDinner ? "Confirmed" : "Completed";
        } else {
          status = "Confirmed";
        }

        reservations.push({
          tableId: table.id,
          customerId: pick(customers).id,
          startDateTime: s,
          endDateTime: e,
          partySize,
          status,
          source: rnd() > 0.7 ? (rnd() > 0.5 ? "Walk-in" : "Phone") : "Online",
        });
      }
    }
  }

  const pastCompleted = reservations.filter((r) => r.status === "Completed" && r.endDateTime < now);
  if (!reservations.some((r) => r.status === "NoShow") && pastCompleted[0]) pastCompleted[0].status = "NoShow";
  if (!reservations.some((r) => r.status === "Cancelled") && pastCompleted[1]) pastCompleted[1].status = "Cancelled";

  for (const r of reservations) {
    const created = await prisma.reservation.create({ data: r });
    await prisma.notification.create({
      data: {
        reservationId: created.id,
        type: "BookingConfirmation",
        channel: "Email",
        status: "Sent",
        message: "Booking confirmation sent.",
        recipient: "",
        createdAt: new Date(created.startDateTime.getTime() - 24 * 3600 * 1000),
      },
    });
    if (r.status === "Completed") {
      await prisma.notification.create({
        data: { reservationId: created.id, type: "Completed", channel: "Email", status: "Sent", message: "Thank you for dining with us!", recipient: "", createdAt: r.endDateTime },
      });
    }
  }

  const counts = reservations.reduce<Record<string, number>>((a, r) => {
    a[r.status] = (a[r.status] ?? 0) + 1;
    return a;
  }, {});
  console.log(`Seeded: ${tables.length} tables, ${customers.length} customers, ${reservations.length} reservations`);
  console.log("Status breakdown:", counts);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
