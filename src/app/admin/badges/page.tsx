import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/admin-header";
import {
  BadgeAdmin,
  type AdminBadge,
  type AdminBadgeAssignment,
  type BadgeUserOption,
} from "@/components/admin/badge-admin";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Badges · Administration" };

export default async function AdminBadgesPage() {
  const [badgeResult, userResult] = await Promise.all([
    serverApi<unknown>("/api/admin/badges?limit=100&offset=0&includeInactive=true"),
    serverApi<unknown>("/api/admin/users?limit=100&offset=0&banned=false"),
  ]);
  const badges = unwrapList<AdminBadge>(badgeResult.data, ["badges"]);
  const users = unwrapList<BadgeUserOption>(userResult.data, ["users"])
    .filter((user) => !user.isSystem)
    .map((user) => ({
      id: user.id,
      displayName: user.displayName,
      telegramUsername: user.telegramUsername ?? null,
    }));
  const assignmentResults = await Promise.all(
    badges.map((badge) =>
      serverApi<unknown>(
        `/api/admin/badges/${encodeURIComponent(String(badge.id))}/assignments?limit=100&offset=0&active=true`,
      ),
    ),
  );
  const assignments = assignmentResults.flatMap((result) =>
    unwrapList<AdminBadgeAssignment>(result.data, ["assignments"]),
  );
  const assignmentError = assignmentResults.find((result) => result.error)?.error;
  return (
    <>
      <AdminHeader
        eyebrow="Reconnaissance communautaire"
        title="Badges"
        description="Crée les distinctions, contrôle leur disponibilité et attribue-les aux profils."
      />
      {badgeResult.error ? (
        <ErrorState message={badgeResult.error} retryHref="/admin/badges" />
      ) : badges.length === 0 ? (
        <>
          <BadgeAdmin badges={[]} users={users} assignments={[]} />
          <EmptyState
            title="Aucun badge"
            description="Crée le premier badge avec le formulaire ci-dessus."
          />
        </>
      ) : (
        <BadgeAdmin badges={badges} users={users} assignments={assignments} />
      )}
      {userResult.error && (
        <p className="admin-action-feedback" role="alert">
          Les utilisateurs n’ont pas pu être chargés pour l’attribution : {userResult.error}
        </p>
      )}
      {assignmentError && (
        <p className="admin-action-feedback" role="alert">
          Les attributions actives n’ont pas toutes pu être chargées : {assignmentError}
        </p>
      )}
    </>
  );
}
