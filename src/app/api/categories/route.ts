import type { NextRequest } from "next/server";

import { apiJson, handleApi } from "@/lib/http";
import { listCategories } from "@/lib/services/categories";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => apiJson(await listCategories()));
}
