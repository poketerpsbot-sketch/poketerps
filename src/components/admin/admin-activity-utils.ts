import type { UserRole } from "@/lib/db/schema";

export const roleLabels: Record<UserRole, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MODERATOR: "Modérateur",
  EDITOR: "Éditeur",
  MEMBER: "Membre",
  BANNED: "Suspendu",
};

export type ActivityCategory =
  | "Tout"
  | "Avis"
  | "Fiches"
  | "Concours"
  | "Utilisateurs"
  | "Messages"
  | "Partenaires"
  | "Système"
  | "Navigation"
  | "Recherche";

export const activityCategories: ActivityCategory[] = [
  "Tout",
  "Avis",
  "Fiches",
  "Concours",
  "Utilisateurs",
  "Messages",
  "Partenaires",
  "Système",
  "Navigation",
  "Recherche",
];

export function activityCategory(action: string): ActivityCategory {
  if (action === "SEARCH") return "Recherche";
  if (action === "APP_OPEN") return "Navigation";
  if (action.startsWith("REVIEW_")) return "Avis";
  if (
    action.startsWith("ENTRY_") ||
    action === "LIKE" ||
    action === "UNLIKE" ||
    action === "FAVORITE"
  )
    return "Fiches";
  if (action.startsWith("CONTEST_")) return "Concours";
  if (action.startsWith("USER_")) return "Utilisateurs";
  if (action.includes("MESSAGE")) return "Messages";
  if (action.startsWith("PARTNER_")) return "Partenaires";
  return "Système";
}

export function formatActivityAction(action: string, metadata?: Record<string, unknown>) {
  const entryName = typeof metadata?.entryName === "string" ? metadata.entryName : null;
  const username = typeof metadata?.username === "string" ? metadata.username : null;
  const labels: Record<string, string> = {
    USER_SESSION_STARTED: "Connexion à PokéTerps",
    USER_SESSION_ENDED: "Déconnexion de PokéTerps",
    USER_BANNED: "Compte suspendu",
    USER_RESTORED: "Suspension levée",
    USER_ROLE_CHANGED: "Rôle modifié",
    USER_INTERNAL_NOTE_ADDED: "Note interne ajoutée",
    USER_TELEGRAM_MESSAGE_SENT: "Message Telegram envoyé",
    ENTRY_PUBLISHED: "Fiche publiée",
    ENTRY_REJECTED: "Fiche refusée",
    REVIEW_PUBLISHED: "Avis publié",
    REVIEW_REJECTED: "Avis refusé",
    CONTEST_PARTICIPATION_MODERATED: "Participation à un concours modérée",
    APP_OPEN: "A ouvert PokéTerps",
    ENTRY_VIEW: entryName ? `A consulté la fiche ${entryName}` : "A consulté une fiche",
    SEARCH: "A effectué une recherche",
    LIKE: entryName ? `A aimé la fiche ${entryName}` : "A aimé une fiche",
    UNLIKE: entryName ? `A retiré son J’aime sur ${entryName}` : "A retiré un J’aime",
    FAVORITE: entryName ? `A ajouté ${entryName} aux favoris` : "A ajouté une fiche aux favoris",
    REVIEW_SUBMIT: entryName ? `A proposé un avis sur ${entryName}` : "A proposé un avis",
    ENTRY_SUBMIT: entryName ? `A proposé la fiche ${entryName}` : "A proposé une fiche",
    PARTNER_VIEW: "A consulté un partenaire",
    MESSAGE_SENT: username ? `A envoyé un message à @${username}` : "A envoyé un message",
    CONTEST_JOIN: "A rejoint un concours",
    REVIEW_APPROVED: "A approuvé un avis",
    REVIEW_CHANGES_REQUESTED: "A demandé une modification d’avis",
    ENTRY_APPROVED: "A approuvé une fiche",
    ENTRY_CHANGES_REQUESTED: "A demandé une modification de fiche",
  };
  return (
    labels[action] ??
    `A effectué l’action « ${action.replaceAll("_", " ").toLocaleLowerCase("fr-FR")} »`
  );
}

export function activityEntityHref(entityType?: string | null, entityId?: string | null) {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "USER":
      return `/admin/utilisateurs/${encodeURIComponent(entityId)}`;
    case "ENTRY":
      return `/admin/fiches?entryId=${encodeURIComponent(entityId)}`;
    case "REVIEW":
      return `/admin/avis?reviewId=${encodeURIComponent(entityId)}`;
    case "CONTEST":
      return `/admin/concours/${encodeURIComponent(entityId)}`;
    case "ADMIN_MESSAGE":
    case "MESSAGE":
      return "/admin/messages";
    default:
      return null;
  }
}

export function sessionState(endedAt: string | null) {
  if (endedAt) return "Terminée";
  return "Active";
}

export function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Donnée non affichable";
  }
}
