import type { NextRequest } from "next/server";

import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { listPartners } from "@/lib/services/partners";
import { partnerQuerySchema } from "@/lib/validation/partners";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const query = parseSearchParams(request, partnerQuerySchema);
    const result = await listPartners({ ...query, includeInactive: false });
    return apiList(result.partners, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
