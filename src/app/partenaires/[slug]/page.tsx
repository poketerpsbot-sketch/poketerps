import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Handshake } from "lucide-react";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import type { PartnerDto } from "@/components/data/types";
import { PartnerLinks } from "@/components/partners/partner-links";
import { ErrorState } from "@/components/ui/states";

type Props = { params: Promise<{ slug: string }> };

async function getPartner(slug: string) {
  const result = await serverApi<unknown>(`/api/partners/${encodeURIComponent(slug)}`);
  return { result, partner: unwrapObject<PartnerDto>(result.data, ["partner"]) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { partner } = await getPartner(slug);
  return {
    title: partner?.name ?? "Partenaire",
    description: partner?.description ?? "Partenaire du Pokédex communautaire.",
  };
}

function categoryName(partner: PartnerDto) {
  return typeof partner.category === "string"
    ? partner.category
    : (partner.category?.name ?? "Partenaire");
}

export default async function PartnerPage({ params }: Props) {
  const { slug } = await params;
  const { result, partner } = await getPartner(slug);
  if (result.status === 404) notFound();
  if (result.error || !partner)
    return (
      <div className="page-shell">
        <ErrorState
          message={result.error ?? "Ce partenaire ne peut pas être affiché."}
          retryHref={`/partenaires/${encodeURIComponent(slug)}`}
        />
      </div>
    );
  return (
    <div className="page-shell page-stack">
      <article className="partner-feature">
        <div className="partner-feature__visual">
          {partner.coverUrl ? (
            <Image
              className="partner-feature__image"
              src={partner.coverUrl}
              alt={`Couverture de ${partner.name}`}
              fill
              sizes="(max-width: 819px) 100vw, 40vw"
              priority
            />
          ) : partner.logoUrl ? (
            <Image src={partner.logoUrl} alt={`Logo de ${partner.name}`} width={180} height={180} />
          ) : (
            <span aria-hidden="true">{partner.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="partner-feature__copy">
          <p className="eyebrow">
            {categoryName(partner)}
            {partner.isFeatured ? " · À la une" : ""}
          </p>
          <h1>{partner.name}</h1>
          <p>{partner.description ?? "Présentation à venir."}</p>
          <PartnerLinks partner={partner} />
        </div>
      </article>
      <section className="notice">
        <strong>
          <Handshake size={17} aria-hidden="true" /> Transparence
        </strong>
        La présence d’un partenaire est éditoriale. Le Pokédex ne propose ni vente, ni commande, ni
        mise en relation commerciale.
      </section>
    </div>
  );
}
