"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";
import { submitJson } from "@/components/forms/form-api";

const roles = ["OWNER", "ADMIN", "MODERATOR", "EDITOR", "MEMBER", "BANNED"] as const;

export function UserAdminActions({
  userId,
  role,
  isBanned,
  suspensionReason,
  suspensionUntil,
}: {
  userId: string;
  role: string;
  isBanned: boolean;
  suspensionReason?: string | null;
  suspensionUntil?: string | null;
}) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState(role);
  const [reason, setReason] = useState(suspensionReason ?? "");
  const [restorationReason, setRestorationReason] = useState("");
  const [durationMode, setDurationMode] = useState("7");
  const [customUntil, setCustomUntil] = useState("");
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");
  const endpoint = `/api/admin/users/${encodeURIComponent(userId)}`;

  async function update(body: Record<string, unknown>, action: string) {
    if (
      (action === "ban" && !isBanned && !reason.trim()) ||
      (action === "role" && selectedRole === "BANNED" && !reason.trim())
    ) {
      setFeedback("Indique un motif avant de suspendre ce compte.");
      return;
    }
    if (action === "restore" && !restorationReason.trim()) {
      setFeedback("Indique pourquoi la suspension peut être levée.");
      return;
    }
    if (!window.confirm("Confirmer cette modification du compte ?")) return;
    setPending(action);
    setFeedback("");
    const result = await submitJson(endpoint, "PATCH", body);
    setPending("");
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setFeedback("Compte mis à jour.");
    router.refresh();
  }

  function suspensionEnd(): { valid: true; value: string | null } | { valid: false } {
    if (durationMode === "permanent") return { valid: true, value: null };
    if (durationMode === "custom") {
      const timestamp = Date.parse(customUntil);
      if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
        setFeedback("Choisis une date personnalisée située dans le futur.");
        return { valid: false };
      }
      return { valid: true, value: new Date(timestamp).toISOString() };
    }
    const days = Number(durationMode);
    return {
      valid: true,
      value: new Date(Date.now() + days * 24 * 60 * 60 * 1_000).toISOString(),
    };
  }

  function saveRole() {
    if (!reason.trim()) {
      setFeedback("Indique le motif du changement de rôle.");
      return;
    }
    const end = selectedRole === "BANNED" ? suspensionEnd() : null;
    if (end && !end.valid) return;
    void update(
      {
        role: selectedRole,
        ...(selectedRole === "BANNED"
          ? {
              isBanned: true,
              suspensionReason: reason.trim(),
              suspensionUntil: end?.value,
            }
          : { roleChangeReason: reason.trim() }),
      },
      "role",
    );
  }

  return (
    <div className="admin-action-stack admin-user-actions">
      <div className="field">
        <label htmlFor={`role-${userId}`}>Rôle</label>
        <select
          id={`role-${userId}`}
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value)}
        >
          {roles.map((value) => (
            <option value={value} key={value}>
              {value.toLocaleLowerCase("fr-FR")}
            </option>
          ))}
        </select>
      </div>
      <button
        className="button button--secondary"
        type="button"
        disabled={Boolean(pending) || selectedRole === role || isBanned}
        onClick={saveRole}
      >
        <ShieldCheck size={15} aria-hidden="true" />
        {pending === "role" ? "Enregistrement…" : "Enregistrer le rôle"}
      </button>
      <div className="field">
        <label htmlFor={`suspension-${userId}`}>Motif interne</label>
        <input
          id={`suspension-${userId}`}
          value={reason}
          maxLength={1_000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Motif de sanction ou de changement de rôle"
        />
      </div>
      {isBanned ? (
        <>
          <div className="notice admin-user-sanction-summary">
            <strong>Compte suspendu</strong>
            <span>
              {suspensionUntil
                ? `Jusqu’au ${new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(suspensionUntil))}`
                : "Sans date de fin enregistrée"}
            </span>
          </div>
          <div className="field">
            <label htmlFor={`restoration-${userId}`}>Motif de réactivation</label>
            <textarea
              id={`restoration-${userId}`}
              value={restorationReason}
              maxLength={2_000}
              onChange={(event) => setRestorationReason(event.target.value)}
              placeholder="Décision vérifiée par l’équipe…"
            />
          </div>
          <button
            className="button button--secondary"
            type="button"
            disabled={Boolean(pending)}
            onClick={() =>
              update(
                {
                  isBanned: false,
                  suspensionReason: null,
                  suspensionUntil: null,
                  restorationReason: restorationReason.trim(),
                },
                "restore",
              )
            }
          >
            <UserRoundCheck size={15} aria-hidden="true" />
            {pending === "restore" ? "Réactivation…" : "Lever la suspension"}
          </button>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor={`duration-${userId}`}>
              <CalendarClock size={15} aria-hidden="true" /> Durée de suspension
            </label>
            <select
              id={`duration-${userId}`}
              value={durationMode}
              onChange={(event) => setDurationMode(event.target.value)}
            >
              <option value="1">24 heures</option>
              <option value="3">3 jours</option>
              <option value="7">7 jours</option>
              <option value="30">30 jours</option>
              <option value="90">90 jours</option>
              <option value="365">1 an</option>
              <option value="custom">Date personnalisée</option>
              <option value="permanent">Permanent</option>
            </select>
          </div>
          {durationMode === "custom" && (
            <div className="field">
              <label htmlFor={`custom-suspension-${userId}`}>Fin personnalisée</label>
              <input
                id={`custom-suspension-${userId}`}
                type="datetime-local"
                value={customUntil}
                onChange={(event) => setCustomUntil(event.target.value)}
                required
              />
            </div>
          )}
          {durationMode === "permanent" && (
            <p className="notice">
              Le compte restera bloqué jusqu’à une levée manuelle de la suspension.
            </p>
          )}
          <button
            className="button button--danger"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => {
              const end = suspensionEnd();
              if (!end.valid) return;
              void update(
                {
                  isBanned: true,
                  suspensionReason: reason.trim(),
                  suspensionUntil: end.value,
                },
                "ban",
              );
            }}
          >
            <UserRoundX size={15} aria-hidden="true" />
            {pending === "ban"
              ? "Suspension…"
              : durationMode === "permanent"
                ? "Bannir définitivement"
                : "Suspendre le compte"}
          </button>
        </>
      )}
      {feedback && (
        <p className="admin-action-feedback" aria-live="polite">
          {feedback}
        </p>
      )}
    </div>
  );
}
