import type { UserRole } from "@/lib/db/schema";

export const roleLabels: Record<UserRole, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MODERATOR: "Modérateur",
  EDITOR: "Éditeur",
  MEMBER: "Membre",
  BANNED: "Suspendu",
};

export function formatActivityAction(action: string) {
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
  };
  return labels[action] ?? action.replaceAll("_", " ").toLocaleLowerCase("fr-FR");
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
