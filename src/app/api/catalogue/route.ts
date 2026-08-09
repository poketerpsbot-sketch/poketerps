import type { NextRequest } from "next/server";

import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { searchCatalogue } from "@/lib/services/catalogue";
import { catalogueQuerySchema } from "@/lib/validation/entries";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const query = parseSearchParams(request, catalogueQuerySchema);
    const result = await searchCatalogue(query);
    return apiList(result.entries, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
