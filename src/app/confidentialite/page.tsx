import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Protection des données" title="Confidentialité">
      <h2>Données utilisées</h2>
      <p>
        L’identité principale provient de Telegram : nom affiché, pseudonyme, photo éventuelle et
        identifiant technique. L’identifiant Telegram interne n’est jamais affiché sur les profils
        publics.
      </p>
      <p>
        La plateforme conserve aussi les contributions, avis, favoris, J’aime, événements de vue
        dédupliqués, messages envoyés à l’équipe et journaux nécessaires à la sécurité.
      </p>
      <h2>Finalités</h2>
      <ul>
        <li>authentifier la Mini App ;</li>
        <li>publier et attribuer les contributions validées ;</li>
        <li>modérer les contenus et traiter les signalements ;</li>
        <li>établir des statistiques et classements communautaires ;</li>
        <li>prévenir les abus et sécuriser le service.</li>
      </ul>
      <h2>Visibilité et conservation</h2>
      <p>
        Les brouillons, messages et avis en attente ne sont pas publics. Les suppressions peuvent
        être logiques afin de préserver l’intégrité de la modération et de l’audit. Pour une demande
        relative aux données, utiliser la page Contacter l’équipe.
      </p>
    </LegalPage>
  );
}
