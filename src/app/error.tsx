"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Route rendering failed", error);
  }, [error]);
  return (
    <div className="not-found">
      <div className="not-found__panel" role="alert">
        <AlertTriangle size={60} aria-hidden="true" />
        <div>
          <p className="eyebrow">Erreur système</p>
          <h1>Signal interrompu</h1>
        </div>
        <p>
          Une anomalie inattendue a coupé l’analyse. Aucune donnée saisie n’a été publiée
          automatiquement.
        </p>
        <button className="button button--secondary" type="button" onClick={() => retry()}>
          <RotateCcw size={17} aria-hidden="true" /> Relancer l’analyse
        </button>
      </div>
    </div>
  );
}
