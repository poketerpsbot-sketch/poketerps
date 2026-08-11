"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  Eye,
  EyeOff,
  MessageSquareWarning,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { submitJson } from "@/components/forms/form-api";

type Props = {
  entryId: string;
  slug: string;
  name: string;
  status: string;
  canPermanentlyDelete?: boolean;
};

export function AdminEntryManagementActions({
  entryId,
  slug,
  name,
  status,
  canPermanentlyDelete = false,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");
  const endpoint = `/api/admin/entries/${encodeURIComponent(entryId)}`;

  async function changeStatus(nextStatus: string, label: string) {
    if (!window.confirm(`${label} la fiche « ${name} » ?`)) return;
    setPending(nextStatus);
    setFeedback("");
    const result = await submitJson(endpoint, "PATCH", { status: nextStatus });
    setPending("");
    if (!result.ok) {
      setFeedback(
        result.message || "Impossible de modifier cette fiche. Réessaie dans quelques instants.",
      );
      return;
    }
    router.refresh();
  }

  async function moderate(nextStatus: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED") {
    const labels = {
      APPROVED: "Approuver",
      CHANGES_REQUESTED: "Demander une modification",
      REJECTED: "Refuser",
    } as const;
    let reason = "";
    if (nextStatus !== "APPROVED") {
      const answer = window.prompt(
        nextStatus === "CHANGES_REQUESTED"
          ? "Indique clairement les modifications demandées à l’auteur :"
          : "Indique la raison du refus :",
      );
      if (answer === null) return;
      reason = answer.trim();
      if (!reason) {
        setFeedback("Un message est obligatoire pour informer correctement l’auteur.");
        return;
      }
    } else if (!window.confirm("Approuver cette fiche et la préparer pour publication ?")) {
      return;
    }
    setPending(nextStatus);
    setFeedback("");
    const result = await submitJson(endpoint, "PATCH", { status: nextStatus, reason });
    setPending("");
    if (!result.ok) {
      setFeedback(
        result.message ||
          `Impossible de ${labels[nextStatus].toLowerCase()} cette fiche. Réessaie dans quelques instants.`,
      );
      return;
    }
    router.refresh();
  }

  async function softDelete() {
    if (
      !window.confirm(`Supprimer logiquement la fiche « ${name} » ? Elle ne sera plus publique.`)
    ) {
      return;
    }
    setPending("DELETE");
    setFeedback("");
    const result = await submitJson(endpoint, "DELETE", {});
    setPending("");
    if (!result.ok) {
      setFeedback(result.message || "Impossible de supprimer cette fiche.");
      return;
    }
    router.refresh();
  }

  async function permanentDelete() {
    const confirmation = window.prompt(
      `Suppression définitive et irréversible. Écris exactement : ${name}`,
    );
    if (confirmation !== name) return;
    setPending("PERMANENT_DELETE");
    setFeedback("");
    const result = await submitJson(`${endpoint}?permanent=true`, "DELETE", { confirmation });
    setPending("");
    if (!result.ok) {
      setFeedback(result.message || "Impossible de supprimer définitivement cette fiche.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="admin-action-stack admin-entry-card-actions">
      <div className="button-row">
        <Link className="button button--secondary" href={`/fiches/${encodeURIComponent(slug)}`}>
          <Eye size={15} aria-hidden="true" /> Voir
        </Link>
        <Link className="button" href={`/admin/fiches/${encodeURIComponent(entryId)}/modifier`}>
          <Pencil size={15} aria-hidden="true" /> Modifier
        </Link>
        {status === "PENDING_REVIEW" && (
          <>
            <button
              className="button"
              type="button"
              disabled={Boolean(pending)}
              onClick={() => void moderate("APPROVED")}
            >
              <CheckCircle2 size={15} aria-hidden="true" /> Approuver
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={Boolean(pending)}
              onClick={() => void moderate("CHANGES_REQUESTED")}
            >
              <MessageSquareWarning size={15} aria-hidden="true" /> Demander une modification
            </button>
            <button
              className="button button--danger"
              type="button"
              disabled={Boolean(pending)}
              onClick={() => void moderate("REJECTED")}
            >
              <XCircle size={15} aria-hidden="true" /> Refuser
            </button>
          </>
        )}
        {status === "PUBLISHED" && (
          <button
            className="button button--secondary"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void changeStatus("HIDDEN", "Masquer")}
          >
            <EyeOff size={15} aria-hidden="true" /> Masquer
          </button>
        )}
        {status === "HIDDEN" && (
          <button
            className="button"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void changeStatus("PUBLISHED", "Rendre visible")}
          >
            <Eye size={15} aria-hidden="true" /> Rendre visible
          </button>
        )}
        {status === "PUBLISHED" || status === "HIDDEN" ? (
          <button
            className="button button--secondary"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void changeStatus("ARCHIVED", "Archiver")}
          >
            <Archive size={15} aria-hidden="true" /> Archiver
          </button>
        ) : null}
        {status === "ARCHIVED" && (
          <button
            className="button"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void changeStatus("PUBLISHED", "Restaurer")}
          >
            <RotateCcw size={15} aria-hidden="true" /> Restaurer
          </button>
        )}
        {status === "APPROVED" && (
          <button
            className="button"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void changeStatus("PUBLISHED", "Publier")}
          >
            <Send size={15} aria-hidden="true" /> Publier
          </button>
        )}
        <button
          className="button button--danger"
          type="button"
          disabled={Boolean(pending)}
          onClick={() => void softDelete()}
        >
          <Trash2 size={15} aria-hidden="true" /> Supprimer
        </button>
        {canPermanentlyDelete && (
          <button
            className="button button--danger"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void permanentDelete()}
          >
            <Trash2 size={15} aria-hidden="true" /> Suppression définitive
          </button>
        )}
      </div>
      {feedback && (
        <p className="admin-action-feedback" role="alert">
          {feedback}
        </p>
      )}
    </div>
  );
}
