"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { safeInternalHref } from "@/lib/navigation";

export function BackLink({
  fallbackHref,
  label = "Retour",
  className = "text-link contest-back-link",
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const returnTo = (searchParams as { get: (key: string) => string | null } | null)?.get(
    "returnTo",
  );
  const href = safeInternalHref(returnTo, fallbackHref);
  return (
    <Link className={className} href={href}>
      <ArrowLeft aria-hidden="true" /> {label}
    </Link>
  );
}
