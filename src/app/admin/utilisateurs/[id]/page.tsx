import type { Metadata } from "next";
import { UserRoundSearch } from "lucide-react";

import { AdminHeader } from "@/components/admin/admin-header";
import { AdminUserDetail } from "@/components/admin/admin-user-detail";
import type { AdminUserDetailDto } from "@/components/admin/user-activity-types";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import { ErrorState } from "@/components/ui/states";
import { BackLink } from "@/components/ui/back-link";

export const metadata: Metadata = { title: "Dossier utilisateur · Administration" };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await serverApi<unknown>(`/api/admin/users/${encodeURIComponent(id)}`);
  const detail = unwrapObject<AdminUserDetailDto>(result.data);
  if (result.error || !detail?.user) {
    return (
      <ErrorState
        title="Dossier inaccessible"
        message={result.error ?? "L’utilisateur n’a pas pu être chargé."}
        retryHref="/admin/utilisateurs"
      />
    );
  }
  return (
    <>
      <BackLink fallbackHref="/admin/utilisateurs" label="Retour aux utilisateurs" />
      <AdminHeader
        eyebrow="Compte et historique"
        title={detail.user.displayName}
        description="Sessions, activité interne, rôles, sanctions, notes et communications PokéTerps."
        actions={<UserRoundSearch aria-hidden="true" />}
      />
      <AdminUserDetail initialDetail={detail} />
    </>
  );
}
