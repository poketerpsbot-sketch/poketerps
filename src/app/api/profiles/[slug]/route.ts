import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiJson, handleApi } from "@/lib/http";
import { getPublicProfile } from "@/lib/services/profiles";

const publicSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const { slug } = await context.params;
    return apiJson(await getPublicProfile(publicSlugSchema.parse(slug)));
  });
}
