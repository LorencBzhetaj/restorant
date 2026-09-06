import { Suspense } from "react";
import { BrandMark } from "@/components/site/brand-mark";
import { LoginForm } from "@/components/admin/login-form";
import { getRestaurant } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff login" };

export default async function LoginPage() {
  const s = await getRestaurant();
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandMark name={s.name} />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <h1 className="mb-1 font-heading text-xl font-semibold">Staff sign in</h1>
          <p className="mb-6 text-sm text-muted-foreground">Enter the password to access the dashboard.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
