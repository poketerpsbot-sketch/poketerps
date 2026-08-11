"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, FilePenLine, Send, X } from "lucide-react";
import { submitJson } from "@/components/forms/form-api";

type Action = { status: string; label: string; tone?: "danger" | "secondary" };

export function AdminModerationActions({
  endpoint,
  actions,
  reasonRequired = false,
}: {
  endpoint: string;
  actions: Action[];
  reasonRequired?: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");
  const dialogId = `moderation-dialog-${endpoint.replaceAll("/", "-")}`;

  function requiresReason(action: Action) {
    return reasonRequired && ["CHANGES_REQUESTED", "REJECTED", "HIDDEN"].includes(action.status);
  }

  async function run(action: Action, suppliedReason?: string) {
    const normalizedReason = suppliedReason?.trim() ?? "";
    if (requiresReason(action) && !normalizedReason) {
      setFeedback("Le message destiné à l’utilisateur est obligatoire.");
      return;
    }
    if (!requiresReason(action) && !window.confirm(`Confirmer l’action « ${action.label} » ?`))
      return;
    setPending(action.status);
    setFeedback("");
    const result = await submitJson(endpoint, "PATCH", {
      status: action.status,
      reason: normalizedReason || undefined,
    });
    setPending("");
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setFeedback("Action enregistrée.");
    setSelectedAction(null);
    setReason("");
    router.refresh();
  }

  return (
    <div className="admin-action-stack">
      <div className="button-row">
        {actions.map((action) => (
          <button
            className={`button${action.tone === "danger" ? " button--danger" : action.tone === "secondary" ? " button--secondary" : ""}`}
            type="button"
            disabled={Boolean(pending)}
            onClick={() => {
              if (requiresReason(action)) {
                setReason("");
                setFeedback("");
                setSelectedAction(action);
              } else {
                void run(action);
              }
            }}
            key={action.status}
          >
            {action.status === "REJECTED" ? (
              <X size={15} aria-hidden="true" />
            ) : action.status === "CHANGES_REQUESTED" ? (
              <FilePenLine size={15} aria-hidden="true" />
            ) : action.status === "HIDDEN" || action.status === "ARCHIVED" ? (
              <EyeOff size={15} aria-hidden="true" />
            ) : action.status === "PUBLISHED" ? (
              <Send size={15} aria-hidden="true" />
            ) : (
              <Check size={15} aria-hidden="true" />
            )}
            {pending === action.status ? "Traitement…" : action.label}
          </button>
        ))}
      </div>
      {feedback && (
        <p className="admin-action-feedback" aria-live="polite">
          {feedback}
        </p>
      )}
      {selectedAction && (
        <div className="moderation-dialog" role="presentation">
          <div
            className="moderation-dialog__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogId}
          >
            <div className="moderation-dialog__heading">
              <div>
                <p className="eyebrow">Message obligatoire</p>
                <h2 id={dialogId}>
                  {selectedAction.status === "REJECTED"
                    ? "Pourquoi refuses-tu cet avis ?"
                    : selectedAction.status === "CHANGES_REQUESTED"
                      ? "Explique à l’utilisateur ce qu’il doit modifier"
                      : "Indique le motif de cette action"}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Fermer"
                onClick={() => setSelectedAction(null)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="field">
              <label htmlFor={`reason-${endpoint.replaceAll("/", "-")}`}>
                {selectedAction.status === "REJECTED"
                  ? "Motif du refus"
                  : "Message pour l’utilisateur"}
              </label>
              <textarea
                id={`reason-${endpoint.replaceAll("/", "-")}`}
                rows={6}
                maxLength={2_000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="moderation-dialog__actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={Boolean(pending)}
                onClick={() => setSelectedAction(null)}
              >
                Annuler
              </button>
              <button
                className={selectedAction.tone === "danger" ? "button button--danger" : "button"}
                type="button"
                disabled={Boolean(pending) || !reason.trim()}
                onClick={() => void run(selectedAction, reason)}
              >
                {pending
                  ? "Traitement…"
                  : selectedAction.status === "REJECTED"
                    ? "Confirmer le refus"
                    : "Envoyer la demande"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminMessageActions({ messageId }: { messageId: string }) {
  return (
    <AdminModerationActions
      endpoint={`/api/admin/messages/${encodeURIComponent(messageId)}`}
      actions={[
        { status: "READ", label: "Lu", tone: "secondary" },
        { status: "IN_PROGRESS", label: "Prendre en charge" },
        { status: "RESOLVED", label: "Résoudre" },
        { status: "ARCHIVED", label: "Archiver", tone: "secondary" },
      ]}
    />
  );
}

export function AdminPartnerActions({
  partnerId,
  isActive,
  isFeatured,
}: {
  partnerId: string;
  isActive: boolean;
  isFeatured: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function update(body: Record<string, unknown>) {
    setPending(true);
    setFeedback("");
    const result = await submitJson(
      `/api/admin/partners/${encodeURIComponent(partnerId)}`,
      "PATCH",
      body,
    );
    setPending(false);
    if (!result.ok) setFeedback(result.message);
    else router.refresh();
  }
  return (
    <div className="admin-action-stack">
      <div className="button-row">
        <button
          className="button button--secondary"
          type="button"
          disabled={pending}
          onClick={() => update({ isActive: !isActive })}
        >
          {isActive ? "Masquer" : "Restaurer"}
        </button>
        <button
          className="button"
          type="button"
          disabled={pending}
          onClick={() => update({ isFeatured: !isFeatured })}
        >
          {isFeatured ? "Retirer de la une" : "Mettre à la une"}
        </button>
      </div>
      {feedback && (
        <p className="admin-action-feedback" role="alert">
          {feedback}
        </p>
      )}
    </div>
  );
}
