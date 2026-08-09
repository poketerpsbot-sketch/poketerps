import { NextResponse, type NextRequest } from "next/server";

import { checkDatabase } from "@/lib/db";

export async function GET(request: NextRequest): Promise<Response> {
  if (request.nextUrl.searchParams.get("db") !== "1") {
    return NextResponse.json({ status: "ok" });
  }

  try {
    await checkDatabase();
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
