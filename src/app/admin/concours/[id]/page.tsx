import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Trophy } from "lucide-react";

import { AdminHeader } from "@/components/admin/admin-header";
import { AdminContestDetail } from "@/components/contests/admin-contest-detail";
import type { AdminContest, AdminContestParticipation } from "@/components/contests/types";
import { serverApi, unwrapList, unwrapObject } from "@/components/data/server-api";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Pilotage du concours" };

export default async function AdminContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const encodedId = encodeURIComponent(id);
  const [contestResult, participationsResult, sessionResult] = await Promise.all([
    serverApi<unknown>(`/api/admin/contests/${encodedId}`),
    serverApi<unknown>(`/api/admin/contests/${encodedId}/participations?limit=100&offset=0`),
    serverApi<unknown>("/api/auth/session"),
  ]);
  const contest = unwrapObject<AdminContest>(contestResult.data);
  const participations = unwrapList<AdminContestParticipation>(participationsResult.data);
  const session = unwrapObject<{ user?: { role?: string }; role?: string }>(sessionResult.data);
  const role = session?.user?.role ?? session?.role;
  const canManage = role === "OWNER" || role === "ADMIN";

  if (contestResult.error || !contest) {
    return (
      <ErrorState
        title="Concours inaccessible"
        message={contestResult.error ?? "Le concours n’a pas pu être chargé."}
        retryHref="/admin/concours"
      />
    );
  }

  return (
    <>
      <Link className="text-link contest-back-link" href="/admin/concours">
        <ArrowLeft aria-hidden="true" /> Retour aux concours
      </Link>
      <AdminHeader
        eyebrow={canManage ? "Pilotage du concours" : "Modération du concours"}
        title={contest.title}
        description={
          canManage
            ? "Configure le défi, traite les candidatures puis publie le palmarès."
            : "Contrôle les candidatures et renseigne leur score avec une trace claire."
        }
        actions={canManage ? <Trophy aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
      />
      {participationsResult.error ? (
        <ErrorState
          message={participationsResult.error}
          retryHref={`/admin/concours/${encodedId}`}
        />
      ) : (
        <AdminContestDetail
          initialContest={contest}
          initialParticipations={participations}
          canManage={canManage}
        />
      )}
    </>
  );
}
