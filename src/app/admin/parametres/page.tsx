import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/admin-header";
import { SettingsAdmin, type AdminSetting } from "@/components/admin/settings-admin";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Paramètres · Administration" };

export default async function AdminSettingsPage() {
  const result = await serverApi<unknown>("/api/admin/settings?limit=100&offset=0");
  const settings = unwrapList<AdminSetting>(result.data, ["settings"]);
  return (
    <>
      <AdminHeader
        eyebrow="Configuration applicative"
        title="Paramètres"
        description="Modifie le vocabulaire, les limites et les options éditoriales sans redéployer l’application."
      />
      {result.error ? (
        <ErrorState message={result.error} retryHref="/admin/parametres" />
      ) : settings.length === 0 ? (
        <EmptyState
          title="Aucun paramètre"
          description="Les paramètres initiaux doivent être chargés par la migration SQL."
        />
      ) : (
        <SettingsAdmin settings={settings} />
      )}
    </>
  );
}
