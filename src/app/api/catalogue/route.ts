import type { NextRequest } from "next/server";

import { getOptionalCurrentUser } from "@/lib/auth/current-user";
import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { searchCatalogue } from "@/lib/services/catalogue";
import { tryRecordUserActivityEvent } from "@/lib/services/user-activity";
import { catalogueQuerySchema } from "@/lib/validation/entries";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await getOptionalCurrentUser();
    const query = parseSearchParams(request, catalogueQuerySchema);
    const result = await searchCatalogue(query);
    if (actor) {
      await tryRecordUserActivityEvent({
        userId: actor.id,
        eventType: "SEARCH",
        metadata: {
          hasText: Boolean(query.query),
          categoryFiltered: Boolean(query.category),
          results: result.total,
        },
      });
    }
    return apiList(result.entries, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
