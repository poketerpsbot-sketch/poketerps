"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, Send, X } from "lucide-react";
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
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");

  async function run(action: Action) {
    if (
      reasonRequired &&
      !reason.trim() &&
      ["CHANGES_REQUESTED", "REJECTED", "HIDDEN"].includes(action.status)
    ) {
      setFeedback("Ajoute un motif avant cette action.");
      return;
    }
    if (!window.confirm(`Confirmer l’action « ${action.label} » ?`)) return;
    setPending(action.status);
    setFeedback("");
    const result = await submitJson(endpoint, "PATCH", {
      status: action.status,
      reason: reason.trim() || undefined,
    });
    setPending("");
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setFeedback("Action enregistrée.");
    router.refresh();
  }

  return (
    <div className="admin-action-stack">
      {reasonRequired && (
        <div className="field">
          <label htmlFor={`reason-${endpoint.replaceAll("/", "-")}`}>Motif ou note</label>
          <input
            id={`reason-${endpoint.replaceAll("/", "-")}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      )}
      <div className="button-row">
        {actions.map((action) => (
          <button
            className={`button${action.tone === "danger" ? " button--danger" : action.tone === "secondary" ? " button--secondary" : ""}`}
            type="button"
            disabled={Boolean(pending)}
            onClick={() => run(action)}
            key={action.status}
          >
            {action.status === "REJECTED" ? (
              <X size={15} aria-hidden="true" />
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
