import { NextResponse } from "next/server";
import {
  AGE_GATE_CONFIRMED_VALUE,
  AGE_GATE_COOKIE_NAME,
  AGE_GATE_MAX_AGE_SECONDS,
  safeAgeGateReturnUrl,
  trustedAgeGateRequestUrl,
} from "@/lib/age-gate";

export async function POST(request: Request) {
  const publicRequestUrl = trustedAgeGateRequestUrl(request.url, process.env.NEXT_PUBLIC_APP_URL);
  const response = NextResponse.redirect(
    safeAgeGateReturnUrl(publicRequestUrl.href, request.headers.get("referer")),
    303,
  );

  response.cookies.set({
    name: AGE_GATE_COOKIE_NAME,
    value: AGE_GATE_CONFIRMED_VALUE,
    httpOnly: false,
    maxAge: AGE_GATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: publicRequestUrl.protocol === "https:",
  });

  return response;
}
