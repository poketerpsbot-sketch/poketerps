import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { deleteSession } from "@/lib/auth/session";
import { readSession } from "@/lib/auth/session";
import { apiJson, handleApi } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { touchUserSession } from "@/lib/services/user-activity";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const user = await requireCurrentUser();
    const session = await readSession();
    if (session) await touchUserSession(session.sessionId).catch(() => undefined);
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

export async function DELETE(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    await guardBrowserMutation(request, rateLimits.auth);
    await deleteSession();
    return apiJson({ authenticated: false });
  });
}
