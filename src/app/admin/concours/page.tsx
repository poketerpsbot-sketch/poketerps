import type { Metadata } from "next";
import { Medal, ShieldCheck } from "lucide-react";

import { AdminHeader } from "@/components/admin/admin-header";
import { AdminContestManager } from "@/components/contests/admin-contest-manager";
import type { AdminContest } from "@/components/contests/types";
import { serverApi, unwrapList, unwrapObject } from "@/components/data/server-api";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Gestion des concours" };

export default async function AdminContestsPage() {
  const [contestsResult, sessionResult] = await Promise.all([
    serverApi<unknown>("/api/admin/contests?limit=100&offset=0"),
    serverApi<unknown>("/api/auth/session"),
  ]);
  const contests = unwrapList<AdminContest>(contestsResult.data);
  const session = unwrapObject<{ user?: { role?: string }; role?: string }>(sessionResult.data);
  const role = session?.user?.role ?? session?.role;
  const canManage = role === "OWNER" || role === "ADMIN";

  return (
    <>
      <AdminHeader
        eyebrow="Arène communautaire"
        title="Concours"
        description={
          canManage
            ? "Crée, programme et pilote les concours, leurs candidatures et leurs gagnants."
            : "Valide les candidatures et protège l’équité des concours."
        }
        actions={canManage ? <Medal aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
      />
      {contestsResult.error ? (
        <ErrorState message={contestsResult.error} retryHref="/admin/concours" />
      ) : (
        <AdminContestManager initialContests={contests} canManage={canManage} />
      )}
    </>
  );
}
