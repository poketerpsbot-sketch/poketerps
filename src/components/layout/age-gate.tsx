"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

const STORAGE_KEY = "pokedex-age-gate:v1";
const CONFIRMED_EVENT = "pokedex:age-confirmed";
let confirmedThisSession = false;

function isConfirmed() {
  if (confirmedThisSession) return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "yes";
  } catch {
    return false;
  }
}

function confirmAge() {
  confirmedThisSession = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, "yes");
  } catch {
    // The consent still applies to this tab when storage is unavailable.
  }
  window.dispatchEvent(new Event(CONFIRMED_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(CONFIRMED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CONFIRMED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function AgeGate({ enabled, minimumAge }: { enabled: boolean; minimumAge: number }) {
  const confirmed = useSyncExternalStore(
    subscribe,
    () => !enabled || isConfirmed(),
    () => !enabled,
  );

  if (!enabled || confirmed) return null;

  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="age-gate__panel">
        <ShieldAlert size={52} aria-hidden="true" />
        <p className="eyebrow">Accès réservé au public averti</p>
        <h1 id="age-gate-title">As-tu au moins {minimumAge} ans ?</h1>
        <p>
          Cette plateforme est uniquement informative et éditoriale. Elle ne propose ni vente, ni
          commande, ni livraison.
        </p>
        <div className="button-row">
          <button className="button" type="button" onClick={confirmAge}>
            Oui, continuer
          </button>
          <a className="button button--secondary" href="https://telegram.org">
            Quitter
          </a>
        </div>
        <Link className="text-link" href="/avertissements">
          Lire les avertissements
        </Link>
      </div>
    </div>
  );
}
