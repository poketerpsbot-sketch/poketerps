import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { PartnerDto } from "@/components/data/types";

function categoryName(partner: PartnerDto) {
  if (!partner.category) return "Partenaire";
  return typeof partner.category === "string" ? partner.category : partner.category.name;
}

export function PartnerCard({ partner }: { partner: PartnerDto }) {
  return (
    <article className="partner-card">
      <div className="partner-card__top">
        <span className="partner-card__logo" aria-hidden="true">
          {partner.logoUrl ? (
            <Image src={partner.logoUrl} alt="" width={62} height={62} />
          ) : (
            partner.name.charAt(0).toLocaleUpperCase("fr-FR")
          )}
        </span>
        <div>
          <span className="type-badge">{categoryName(partner)}</span>
          <h3>{partner.name}</h3>
        </div>
      </div>
      {partner.description && <p>{partner.description}</p>}
      <div className="partner-card__links">
        {partner.isFeatured && (
          <span className="tag">
            <Sparkles size={13} aria-hidden="true" /> À la une
          </span>
        )}
        <Link className="text-link" href={`/partenaires/${encodeURIComponent(partner.slug)}`}>
          Voir le partenaire <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function PartnerGrid({ partners }: { partners: PartnerDto[] }) {
  return (
    <div className="partner-grid">
      {partners.map((partner) => (
        <PartnerCard partner={partner} key={String(partner.id)} />
      ))}
    </div>
  );
}
