import type { UserRole } from "@/lib/db/schema";
import { normalizeUserRole, roleLabels } from "@/lib/auth/ui-access";

export function RoleBadge({
  role,
  compact = false,
}: {
  role: UserRole | string;
  compact?: boolean;
}) {
  const normalized = normalizeUserRole(role);
  return (
    <span
      className={`role-badge role-badge--${normalized.toLocaleLowerCase("fr-FR")}${compact ? " role-badge--compact" : ""}`}
    >
      {roleLabels[normalized]}
    </span>
  );
}
