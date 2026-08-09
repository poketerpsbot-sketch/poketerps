"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-shell">
      <div className="state-card state-card--error" role="alert">
        <AlertTriangle aria-hidden="true" />
        <div>
          <h2>La console a interrompu son chargement</h2>
          <p>
            Réessaie. Si l’erreur persiste, consulte le journal serveur avec l’identifiant affiché.
          </p>
          {error.digest && <code>incident {error.digest}</code>}
        </div>
        <button className="button button--secondary" type="button" onClick={reset}>
          <RotateCcw size={16} aria-hidden="true" /> Réessayer
        </button>
      </div>
    </div>
  );
}
