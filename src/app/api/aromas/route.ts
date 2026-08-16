import type { NextRequest } from "next/server";

import { apiJson, handleApi } from "@/lib/http";
import { listAromaFamilies } from "@/lib/services/aromas";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => apiJson(await listAromaFamilies()));
}
