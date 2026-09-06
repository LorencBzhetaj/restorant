import { prisma } from "./prisma";

export const DEFAULT_SETTINGS = {
  name: "Gjeçaj Alpine Restaurant Cuisine",
  tagline: "Alpine cuisine in the Albanian mountains",
  phone: "+355 69 987 6543",
  whatsapp: "",
  address: "Theth, Shkodër, Albania",
  email: "info@villagjecaj.com",
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
