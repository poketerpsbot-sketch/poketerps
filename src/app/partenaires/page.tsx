import type { Metadata } from "next";
import { Handshake } from "lucide-react";
import { serverApi, unwrapList } from "@/components/data/server-api";
import type { PartnerDto } from "@/components/data/types";
import { PartnerCard, PartnerGrid } from "@/components/partners/partner-card";
import { EmptyState, ErrorState, SectionHeading } from "@/components/ui/states";

export const metadata: Metadata = { title: "Partenaires" };

export default async function PartnersPage() {
  const result = await serverApi<unknown>("/api/partners?limit=60&offset=0");
  const partners = unwrapList<PartnerDto>(result.data, ["partners"]);
  const featured = partners.find((partner) => partner.isFeatured);
  const others = featured ? partners.filter((partner) => partner.id !== featured.id) : partners;

  return (
    <div className="page-shell page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Réseau communautaire</p>
          <h1 className="page-title">Nos partenaires</h1>
          <p>
            Communautés, médias, associations et créateurs qui soutiennent un catalogue éditorial
            indépendant.
          </p>
        </div>
        <Handshake className="page-header__mark" size={58} aria-hidden="true" />
      </header>
      {result.error ? (
        <ErrorState message={result.error} retryHref="/partenaires" />
      ) : partners.length === 0 ? (
        <EmptyState
          title="Aucun partenaire public"
          description="Les partenaires actifs apparaîtront ici après validation."
        />
      ) : (
        <>
          {featured && (
            <section className="section-stack">
              <SectionHeading eyebrow="À la une" title="Partenaire sélectionné" />
              <PartnerCard partner={featured} />
            </section>
          )}
          {others.length > 0 && (
            <section className="section-stack">
              <SectionHeading eyebrow="Réseau" title="Tous les partenaires" />
              <PartnerGrid partners={others} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
