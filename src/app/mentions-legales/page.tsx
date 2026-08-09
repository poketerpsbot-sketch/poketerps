import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalNoticePage() {
  return (
    <LegalPage eyebrow="Informations de publication" title="Mentions légales">
      <p>
        Le nom de l’exploitant, l’adresse de contact et les informations d’hébergement doivent
        correspondre aux valeurs légales configurées par le propriétaire du déploiement.
      </p>
      <h2>Hébergement</h2>
      <p>
        L’application web est conçue pour être hébergée sur Render. Les données applicatives et les
        médias sont conservés dans le projet Supabase PostgreSQL et Storage configuré par
        l’exploitant.
      </p>
      <h2>Responsabilité éditoriale</h2>
      <p>
        Les contenus communautaires sont vérifiés avant publication, sans garantie d’exhaustivité.
        Toute erreur peut être signalée depuis la messagerie interne.
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        Les marques, noms et images restent la propriété de leurs titulaires. Un contributeur doit
        disposer des droits nécessaires sur les médias transmis.
      </p>
    </LegalPage>
  );
}
