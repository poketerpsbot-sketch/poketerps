import type { NextRequest } from "next/server";

import { deleteSession } from "@/lib/auth/session";
import { apiJson, handleApi } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    await guardBrowserMutation(request, rateLimits.auth);
    await deleteSession();
    return apiJson({ authenticated: false });
  });
}
