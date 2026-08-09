import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { apiJson, handleApi } from "@/lib/http";
import { getMyProfile } from "@/lib/services/profiles";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireCurrentUser();
    return apiJson(await getMyProfile(actor));
  });
}
