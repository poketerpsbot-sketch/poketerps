export type ReviewPresentation = {
  label: string;
  description: string;
  tone: "pending" | "changes" | "rejected" | "published" | "neutral";
};

export type ReviewNotification = {
  type: "REVIEW_APPROVED" | "REVIEW_REJECTED" | "REVIEW_CHANGES_REQUESTED";
  title: string;
  message: string;
  actionUrl: string;
};

const presentations: Record<string, ReviewPresentation> = {
  DRAFT: {
    label: "BROUILLON",
    description: "Cet avis n’a pas encore été envoyé.",
    tone: "neutral",
  },
  PENDING_REVIEW: {
    label: "EN ATTENTE",
    description: "Ton avis est en cours de vérification.",
    tone: "pending",
  },
  CHANGES_REQUESTED: {
    label: "MODIFICATION DEMANDÉE",
    description: "L’équipe te demande de modifier cet avis.",
    tone: "changes",
  },
  REJECTED: {
    label: "REFUSÉ",
    description: "Cet avis n’a pas été accepté.",
    tone: "rejected",
  },
  APPROVED: {
    label: "APPROUVÉ",
    description: "Ton avis a été approuvé et sera publié.",
    tone: "published",
  },
  PUBLISHED: {
    label: "PUBLIÉ",
    description: "Cet avis est public.",
    tone: "published",
  },
  HIDDEN: {
    label: "MASQUÉ",
    description: "Cet avis n’est actuellement pas visible publiquement.",
    tone: "neutral",
  },
};

export function reviewPresentation(status?: string | null): ReviewPresentation {
  return (
    presentations[status ?? ""] ?? {
      label: status?.replaceAll("_", " ") ?? "INCONNU",
      description: "Le statut de cet avis est en cours de synchronisation.",
      tone: "neutral",
    }
  );
}

export function reviewNotificationFor(
  status: "PUBLISHED" | "REJECTED" | "CHANGES_REQUESTED",
  entryName: string,
  reason?: string,
): ReviewNotification {
  if (status === "PUBLISHED") {
    return {
      type: "REVIEW_APPROVED",
      title: "Avis approuvé",
      message: "✅ Ton avis a été approuvé et est maintenant publié.",
      actionUrl: "/profil/avis",
    };
  }
  if (status === "REJECTED") {
    return {
      type: "REVIEW_REJECTED",
      title: "Avis refusé",
      message: `❌ Ton avis concernant « ${entryName} » n’a pas été approuvé.\n\nMotif :\n${reason ?? "Aucun motif transmis."}`,
      actionUrl: "/profil/avis",
    };
  }
  return {
    type: "REVIEW_CHANGES_REQUESTED",
    title: "Modification demandée sur ton avis",
    message: `✏️ Une modification a été demandée sur ton avis concernant « ${entryName} ».\n\nMessage de l’équipe :\n${reason ?? ""}`,
    actionUrl: "/profil/avis",
  };
}
