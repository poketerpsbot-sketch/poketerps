import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";
import { serverApi, unwrapList } from "@/components/data/server-api";
import type { SubmissionDto } from "@/components/data/types";
import { SubmissionList } from "@/components/profiles/profile-view";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Mes propositions" };

export default async function SubmissionsPage() {
  const result = await serverApi<unknown>("/api/submissions");
  const submissions = unwrapList<SubmissionDto>(result.data, ["submissions"]);
  return (
    <div className="page-shell page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Suivi communautaire</p>
          <h1 className="page-title">Mes propositions</h1>
          <p>Consulte l’état des captures et corrections envoyées à la modération.</p>
        </div>
        <Lightbulb className="page-header__mark" size={58} aria-hidden="true" />
      </header>
      {result.error ? (
        <ErrorState message={result.error} retryHref="/profil/propositions" />
      ) : (
        <SubmissionList submissions={submissions} />
      )}
    </div>
  );
}
