import { redirect } from "next/navigation";

// This product is just the booking flow + admin dashboard — the root goes
// straight to the reservation widget.
export default function Home() {
  redirect("/reserve");
}
