import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { apiJson, apiList, handleApi, parseJson, parseSearchParams } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { createCorrection, listSubmissions } from "@/lib/services/submissions";
import { notifyTelegramAdmins } from "@/lib/services/telegram-client";
import { paginationSchema } from "@/lib/validation/common";
import { correctionSchema } from "@/lib/validation/entries";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireCurrentUser();
    const query = parseSearchParams(request, paginationSchema);
    return apiList(await listSubmissions(actor, query.limit, query.offset), query);
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireCurrentUser();
    await guardBrowserMutation(request, rateLimits.submission, actor.id);
    const input = await parseJson(request, correctionSchema);
    const result = await createCorrection(input, actor, requestId);
    await notifyTelegramAdmins(
      `<b>Nouvelle correction</b>\nProposition de ${actor.displayName.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}`,
    );
    return apiJson(result, { status: 201 });
  });
}
