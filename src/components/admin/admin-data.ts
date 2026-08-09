import "server-only";

import { cache } from "react";
import { serverApi } from "@/components/data/server-api";

export const getAdminDashboard = cache(() => serverApi<unknown>("/api/admin/dashboard"));
