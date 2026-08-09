import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Avertissements" };

export default function WarningsPage() {
  return (
    <LegalPage eyebrow="À lire avant utilisation" title="Avertissements">
      <div className="notice">
        <strong>Public averti</strong>Respecte l’âge minimum et la réglementation applicables dans
        ton pays ou ta région.
      </div>
      <h2>Information uniquement</h2>
      <p>
        Les fiches, avis, notes, microns et caractéristiques sont des informations éditoriales ou
        déclarées. Ils ne constituent ni une garantie de qualité, ni une incitation à l’achat ou à
        la consommation.
      </p>
      <h2>Santé</h2>
      <p>
        Les informations publiées sont descriptives et ne remplacent pas un avis médical. En cas de
        question de santé, contacte un professionnel qualifié.
      </p>
      <h2>Légalité</h2>
      <p>
        La législation varie selon le territoire. Chaque utilisateur reste responsable de vérifier
        et respecter les règles qui lui sont applicables.
      </p>
      <h2>Aucune transaction</h2>
      <p>
        Le Pokédex n’organise aucune vente, commande, livraison, réservation ou mise en relation
        commerciale.
      </p>
    </LegalPage>
  );
}
