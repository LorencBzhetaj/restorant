"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders the restaurant logo from a settings URL, with a graceful fallback to
 * the name initial if the image is missing or fails to load. The container is a
 * fixed square so there is no layout shift while the image loads or on error.
 */
export function LogoImage({
  src,
  name,
  light = false,
  className,
}: {
  src: string;
  name: string;
  light?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "G";

  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border",
        light ? "border-white/20 bg-white/5" : "border-brand/30 bg-brand/10",
        className,
      )}
    >
      {failed ? (
        <span className={cn("font-heading text-base font-semibold text-brand")} aria-hidden>
          {initial}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name} logo`}
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
