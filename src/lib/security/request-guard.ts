import "server-only";

import { assertSameOrigin } from "@/lib/http";
import {
  enforceRateLimit,
  requestFingerprint,
  type RateLimitPolicy,
} from "@/lib/security/rate-limit";

export const rateLimits = {
  auth: { namespace: "auth", limit: 10, windowSeconds: 300 },
  mutation: { namespace: "mutation", limit: 60, windowSeconds: 600 },
  submission: { namespace: "submission", limit: 20, windowSeconds: 600 },
  upload: { namespace: "upload", limit: 10, windowSeconds: 600 },
  view: { namespace: "view", limit: 120, windowSeconds: 60 },
  admin: { namespace: "admin", limit: 180, windowSeconds: 60 },
} satisfies Record<string, RateLimitPolicy>;

export async function guardBrowserMutation(
  request: Request,
  policy: RateLimitPolicy,
  identifier?: string,
): Promise<void> {
  assertSameOrigin(request);
  await enforceRateLimit(policy, identifier ?? requestFingerprint(request));
}
