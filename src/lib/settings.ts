import { prisma } from "./prisma";

export const DEFAULT_SETTINGS = {
  name: "Terrazza",
  tagline: "Modern Mediterranean dining in the heart of Tirana",
  phone: "+355 69 987 6543",
  whatsapp: "+355 69 987 6543",
  address: "Rruga Ismail Qemali 15, Tirana, Albania",
  email: "reservations@terrazza.al",
  currency: "EUR",
  turnDurationMinutes: 120,
  bookingInterval: 30,
  seatingBuffer: 15,
  maxPartySize: 12,
  timezone: "Europe/Tirane",
};

export async function getRestaurant() {
  let settings = await prisma.restaurantSetting.findFirst();
  if (!settings) {
    settings = await prisma.restaurantSetting.create({ data: DEFAULT_SETTINGS });
  }
  return settings;
}
