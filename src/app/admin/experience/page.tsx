import type { Metadata } from "next";

import { AdminHeader } from "@/components/admin/admin-header";
import {
  ExperienceAdmin,
  type ExperienceRuleAdmin,
  type LevelDefinitionAdmin,
} from "@/components/admin/experience-admin";
import { serverApi } from "@/components/data/server-api";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "XP & niveaux · Administration" };

type ExperienceConfiguration = {
  rules: ExperienceRuleAdmin[];
  levels: LevelDefinitionAdmin[];
};

export default async function AdminExperiencePage() {
  const result = await serverApi<ExperienceConfiguration>("/api/admin/experience");
  return (
    <>
      <AdminHeader
        eyebrow="Configuration Owner"
        title="XP & niveaux"
        description="Règle les récompenses et les paliers de progression sans réattribuer les événements déjà gagnés."
      />
      {result.error || !result.data ? (
        <ErrorState
          message={result.error ?? "Configuration indisponible."}
          retryHref="/admin/experience"
        />
      ) : (
        <ExperienceAdmin rules={result.data.rules} levels={result.data.levels} />
      )}
    </>
  );
}
