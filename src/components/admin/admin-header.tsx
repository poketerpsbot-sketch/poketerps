import type { ReactNode } from "react";

export function AdminHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header page-header--compact admin-page-header">
      <div className="page-header__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="button-row">{actions}</div>}
    </header>
  );
}
