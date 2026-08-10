import type { NextRequest } from "next/server";

import { getOptionalCurrentUser } from "@/lib/auth/current-user";
import { apiJson, handleApi } from "@/lib/http";
import { getPublicContest } from "@/lib/services/contests";
import { idOrSlugSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const [{ slug }, viewer] = await Promise.all([context.params, getOptionalCurrentUser()]);
    return apiJson(await getPublicContest(idOrSlugSchema.parse(slug), viewer?.id));
  });
}
