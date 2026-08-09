import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/rbac";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { createEntry } from "@/lib/services/entries";
import { createEntrySchema } from "@/lib/validation/entries";

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireCurrentUser();
    assertPermission(actor.role, "entry:create");
    await guardBrowserMutation(request, rateLimits.submission, actor.id);
    const input = await parseJson(request, createEntrySchema);
    return apiJson(await createEntry(input, actor, requestId), { status: 201 });
  });
}
