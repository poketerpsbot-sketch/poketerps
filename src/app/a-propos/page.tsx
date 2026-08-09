import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "À propos" };

export default function AboutPage() {
  return (
    <LegalPage eyebrow="Mission communautaire" title="À propos du Pokédex">
      <p>
        Le Pokédex est un catalogue éditorial communautaire consacré à la documentation de produits
        liés au cannabis. Les contributeurs, appelés Dresseurs, proposent des découvertes qui sont
        relues avant publication.
      </p>
      <h2>Une archive, pas une boutique</h2>
      <p>
        La plateforme ne vend rien et ne permet ni commande, ni paiement, ni livraison, ni
        réservation, ni mise en relation entre acheteurs et vendeurs.
      </p>
      <h2>Comment participer</h2>
      <p>
        Une capture peut être proposée depuis l’application. Les informations, images et avis
        passent par un workflow de vérification. Les corrections restent attribuées à leur auteur
        original.
      </p>
      <p>
        <Link href="/capturer">Proposer une capture</Link> ou{" "}
        <Link href="/contact">contacter l’équipe</Link>.
      </p>
    </LegalPage>
  );
}
