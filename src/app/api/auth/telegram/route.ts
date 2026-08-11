import type { NextRequest } from "next/server";

import { createSession } from "@/lib/auth/session";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { authenticateTelegram } from "@/lib/services/auth";
import { telegramLoginSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    await guardBrowserMutation(request, rateLimits.auth);
    const { initData } = await parseJson(request, telegramLoginSchema, 12_000);
    const user = await authenticateTelegram(initData, requestId);
    await createSession(user.id, { platform: "MINI_APP" });
    return apiJson({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        publicSlug: user.publicSlug,
        profilePhotoUrl: user.profilePhotoUrl,
        role: user.role,
      },
    });
  });
}
