import type { NextRequest } from "next/server";

import { apiJson, handleApi } from "@/lib/http";
import { getHomeData } from "@/lib/services/home";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => apiJson(await getHomeData()));
}
