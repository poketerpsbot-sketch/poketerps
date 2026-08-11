import { NextResponse } from "next/server";
import {
  AGE_GATE_CONFIRMED_VALUE,
  AGE_GATE_COOKIE_NAME,
  AGE_GATE_MAX_AGE_SECONDS,
  AGE_GATE_REJECTED_VALUE,
  safeAgeGateReturnUrl,
  trustedAgeGateRequestUrl,
} from "@/lib/age-gate";

export async function POST(request: Request) {
  let decision = AGE_GATE_CONFIRMED_VALUE;
  try {
    const formData = await request.formData();
    if (formData.get("decision") === AGE_GATE_REJECTED_VALUE) decision = AGE_GATE_REJECTED_VALUE;
  } catch {
    // Keep backward compatibility with the previous empty native POST.
  }
  const publicRequestUrl = trustedAgeGateRequestUrl(request.url, process.env.NEXT_PUBLIC_APP_URL);
  const response = NextResponse.redirect(
    safeAgeGateReturnUrl(publicRequestUrl.href, request.headers.get("referer")),
    303,
  );

  response.cookies.set({
    name: AGE_GATE_COOKIE_NAME,
    value: decision,
    httpOnly: false,
    maxAge: AGE_GATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: publicRequestUrl.protocol === "https:",
  });

  return response;
}
