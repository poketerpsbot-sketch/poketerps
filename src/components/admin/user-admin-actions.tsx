"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserRoundX } from "lucide-react";
import { submitJson } from "@/components/forms/form-api";

const roles = ["OWNER", "ADMIN", "MODERATOR", "EDITOR", "MEMBER", "BANNED"] as const;

export function UserAdminActions({
  userId,
  role,
  isBanned,
  suspensionReason,
}: {
  userId: string;
  role: string;
  isBanned: boolean;
  suspensionReason?: string | null;
}) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState(role);
  const [reason, setReason] = useState(suspensionReason ?? "");
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
        disabled={Boolean(pending) || selectedRole === role}
        onClick={() =>
          update(
            {
              role: selectedRole,
              ...(selectedRole === "BANNED" ? { suspensionReason: reason.trim() } : {}),
            },
            "role",
          )
        }
      >
        <ShieldCheck size={15} aria-hidden="true" />
        {pending === "role" ? "Enregistrement…" : "Enregistrer le rôle"}
      </button>
      <div className="field">
        <label htmlFor={`suspension-${userId}`}>Motif de suspension</label>
        <input
          id={`suspension-${userId}`}
          value={reason}
          maxLength={1_000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Visible uniquement par l’équipe"
        />
      </div>
      <button
        className={`button${isBanned ? " button--secondary" : " button--danger"}`}
        type="button"
        disabled={Boolean(pending)}
        onClick={() =>
          update({ isBanned: !isBanned, suspensionReason: isBanned ? null : reason.trim() }, "ban")
        }
      >
        <UserRoundX size={15} aria-hidden="true" />
        {pending === "ban" ? "Enregistrement…" : isBanned ? "Lever la suspension" : "Suspendre"}
      </button>
      {feedback && (
        <p className="admin-action-feedback" aria-live="polite">
          {feedback}
        </p>
      )}
    </div>
  );
}
