import type { Metadata } from "next";
import { Mail, ShieldAlert, Sparkles } from "lucide-react";
import { ContactForm } from "@/components/forms/contact-form";

export const metadata: Metadata = { title: "Contacter l’équipe" };

export default function ContactPage() {
  return (
    <div className="page-shell page-shell--narrow page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Messagerie interne</p>
          <h1 className="page-title">Comment pouvons-nous t’aider ?</h1>
          <p>
            Ton message est transmis uniquement aux membres autorisés de l’équipe et n’est jamais
            publié dans le canal.
          </p>
        </div>
        <Mail className="page-header__mark" size={58} aria-hidden="true" />
      </header>
      <div className="stat-grid" aria-label="Types de demandes">
        <div className="stat-card">
          <Sparkles aria-hidden="true" />
          <span>Amélioration</span>
          <strong>Idée</strong>
        </div>
        <div className="stat-card">
          <ShieldAlert aria-hidden="true" />
          <span>Problème</span>
          <strong>Signalement</strong>
        </div>
      </div>
      <ContactForm />
    </div>
  );
}
