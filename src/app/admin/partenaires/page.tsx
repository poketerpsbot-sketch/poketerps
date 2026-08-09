import type { Metadata } from "next";
import Link from "next/link";
import { AdminPartnerActions } from "@/components/admin/admin-actions";
import { PartnerAdminForm } from "@/components/admin/partner-admin-form";
import type { PartnerDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState, StatusPill } from "@/components/ui/states";

export const metadata: Metadata = { title: "Partenaires" };

export default async function AdminPartnersPage() {
  const result = await serverApi<unknown>("/api/admin/partners?limit=100&offset=0");
  const partners = unwrapList<PartnerDto>(result.data, ["partners"]);
  return (
    <>
      <header className="page-header page-header--compact">
        <div className="page-header__copy">
          <p className="eyebrow">Réseau du Pokédex</p>
          <h1 className="page-title">Partenaires</h1>
          <p>Crée, masque et mets en avant les partenaires sans donnée fictive.</p>
        </div>
      </header>
      <PartnerAdminForm />
      {result.error ? (
        <ErrorState message={result.error} retryHref="/admin/partenaires" />
      ) : partners.length === 0 ? (
        <EmptyState
          title="Aucun partenaire"
          description="Utilise le formulaire pour créer le premier partenaire."
        />
      ) : (
        <div className="admin-list">
          {partners.map((partner) => (
            <article className="content-panel admin-list__item" key={String(partner.id)}>
              <div className="admin-list__copy">
                <div className="button-row">
                  <StatusPill value={partner.isActive ? "ACTIVE" : "INACTIVE"} />
                  {partner.isFeatured && <StatusPill value="FEATURED" />}
                </div>
                <h2>{partner.name}</h2>
                <p>{partner.description ?? "Aucune description."}</p>
                <Link className="text-link" href={`/partenaires/${partner.slug}`}>
                  Voir la page publique <span aria-hidden="true">→</span>
                </Link>
              </div>
              <AdminPartnerActions
                partnerId={String(partner.id)}
                isActive={Boolean(partner.isActive)}
                isFeatured={Boolean(partner.isFeatured)}
              />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
