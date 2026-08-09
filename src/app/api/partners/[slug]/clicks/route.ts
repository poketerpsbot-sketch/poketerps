import type { NextRequest } from "next/server";

import { getAnonymousSessionHash } from "@/lib/auth/anonymous";
import { getOptionalCurrentUser } from "@/lib/auth/current-user";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { getPartnerBySlug, recordPartnerClick } from "@/lib/services/partners";
import { idOrSlugSchema } from "@/lib/validation/common";
import { partnerClickSchema } from "@/lib/validation/partners";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await getOptionalCurrentUser();
    const anonymousSessionHash = actor ? null : await getAnonymousSessionHash();
    await guardBrowserMutation(
      request,
      rateLimits.mutation,
      actor?.id ?? anonymousSessionHash ?? undefined,
    );
    const { slug } = await context.params;
    const identifier = idOrSlugSchema.parse(slug);
    const partnerId = /^[0-9a-f-]{36}$/i.test(identifier)
      ? identifier
      : (await getPartnerBySlug(identifier)).id;
    const input = await parseJson(request, partnerClickSchema);
    await recordPartnerClick(partnerId, input.target, {
      userId: actor?.id,
      anonymousSessionHash,
    });
    return apiJson({ recorded: true }, { status: 201 });
  });
}
