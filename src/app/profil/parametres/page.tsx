import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Settings, ShieldCheck } from "lucide-react";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import { extractProfilePayload } from "@/components/profiles/profile-view";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Paramètres du profil" };

export default async function ProfileSettingsPage() {
  const result = await serverApi<unknown>("/api/me");
  const profile = extractProfilePayload(unwrapObject<Record<string, unknown>>(result.data));
  if (result.error || !profile)
    return (
      <div className="page-shell">
        <ErrorState
          message={result.error ?? "Profil introuvable."}
          retryHref="/profil/parametres"
        />
      </div>
    );
  return (
    <div className="page-shell page-shell--narrow page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Compte Telegram</p>
          <h1 className="page-title">Paramètres</h1>
          <p>Les informations affichées sont celles actuellement conservées par le Pokédex.</p>
        </div>
        <Settings className="page-header__mark" size={58} aria-hidden="true" />
      </header>
      <section className="content-panel">
        <h2>Identité publique</h2>
        <dl className="data-list">
          <div>
            <dt>Nom affiché</dt>
            <dd>{profile.displayName}</dd>
          </div>
          <div>
            <dt>Pseudo</dt>
            <dd>{profile.telegramUsername ? `@${profile.telegramUsername}` : "Non renseigné"}</dd>
          </div>
          <div>
            <dt>Visibilité</dt>
            <dd>{profile.profileVisibility ?? "Publique"}</dd>
          </div>
          <div>
            <dt>Rôle</dt>
            <dd>{profile.role ?? "MEMBER"}</dd>
          </div>
        </dl>
      </section>
      <section className="content-panel">
        <h2>
          <ShieldCheck size={20} aria-hidden="true" /> Confidentialité
        </h2>
        <p>
          L’identifiant Telegram interne n’est jamais affiché publiquement. Les modifications
          sensibles doivent être confirmées par l’équipe tant qu’aucune route de modification de
          profil n’est disponible.
        </p>
        <div className="button-row">
          <Link className="button button--secondary" href="/confidentialite">
            <Lock size={17} aria-hidden="true" /> Politique de confidentialité
          </Link>
          <Link className="button" href="/contact">
            Demander une modification
          </Link>
        </div>
      </section>
    </div>
  );
}
