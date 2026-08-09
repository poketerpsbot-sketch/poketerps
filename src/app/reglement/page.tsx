import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Règlement communautaire" };

export default function RulesPage() {
  return (
    <LegalPage eyebrow="Cadre de contribution" title="Règlement">
      <h2>Contributions autorisées</h2>
      <ul>
        <li>Informations descriptives, sourcées et présentées comme déclaratives.</li>
        <li>Photographies dont le contributeur possède les droits nécessaires.</li>
        <li>Avis personnels respectueux, sans attaque ni affirmation médicale.</li>
        <li>Corrections précises et de bonne foi.</li>
      </ul>
      <h2>Contenus interdits</h2>
      <ul>
        <li>
          Prix, vente, commande, livraison, réservation ou coordonnées commerciales dissimulées.
        </li>
        <li>Procédure de fabrication dangereuse ou illégale.</li>
        <li>
          Promotion trompeuse, spam, usurpation, harcèlement ou données personnelles de tiers.
        </li>
        <li>Contenu médical présenté comme diagnostic, prescription ou garantie.</li>
      </ul>
      <h2>Modération</h2>
      <p>
        L’équipe peut demander une modification, refuser, masquer ou archiver un contenu. Les
        décisions et changements administratifs importants sont journalisés. Un signalement peut
        être envoyé depuis la page de contact.
      </p>
    </LegalPage>
  );
}
