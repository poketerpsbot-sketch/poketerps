import type { NextRequest } from "next/server";
import { z } from "zod";

import { getOptionalCurrentUser } from "@/lib/auth/current-user";
import { apiJson, handleApi } from "@/lib/http";
import { getPartnerBySlug } from "@/lib/services/partners";
import { tryRecordUserActivityEvent } from "@/lib/services/user-activity";

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await getOptionalCurrentUser();
    const { slug } = await context.params;
    const partner = await getPartnerBySlug(slugSchema.parse(slug));
    if (actor) {
      await tryRecordUserActivityEvent({
        userId: actor.id,
        eventType: "PARTNER_VIEW",
        entityType: "PARTNER",
        entityId: partner.id,
      });
    }
    return apiJson(partner);
  });
}
