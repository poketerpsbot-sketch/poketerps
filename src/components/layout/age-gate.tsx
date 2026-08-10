"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { type FormEvent, useEffect, useRef, useSyncExternalStore } from "react";
import {
  AGE_GATE_CONFIRMED_VALUE,
  AGE_GATE_COOKIE_NAME,
  AGE_GATE_MAX_AGE_SECONDS,
  AGE_GATE_STORAGE_KEY,
} from "@/lib/age-gate";

const CONFIRMED_EVENT = "pokedex:age-confirmed";

function hasStoredConfirmation() {
  if (document.documentElement.dataset.ageGateConfirmed === "true") return true;
  try {
    return window.localStorage.getItem(AGE_GATE_STORAGE_KEY) === AGE_GATE_CONFIRMED_VALUE;
  } catch {
    return false;
  }
}

function persistConfirmation() {
  try {
    window.localStorage.setItem(AGE_GATE_STORAGE_KEY, AGE_GATE_CONFIRMED_VALUE);
  } catch {
    // The cookie and in-memory state still keep the confirmation usable.
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AGE_GATE_COOKIE_NAME}=${AGE_GATE_CONFIRMED_VALUE}; Path=/; Max-Age=${AGE_GATE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  document.documentElement.dataset.ageGateConfirmed = "true";
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

type AgeGateProps = {
  enabled: boolean;
  initiallyConfirmed: boolean;
  minimumAge: number;
};

export function AgeGate({ enabled, initiallyConfirmed, minimumAge }: AgeGateProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const confirmed = useSyncExternalStore(
    subscribe,
    () => !enabled || initiallyConfirmed || hasStoredConfirmation(),
    () => !enabled || initiallyConfirmed,
  );
  const visible = enabled && !confirmed;

  useEffect(() => {
    if (!enabled || initiallyConfirmed || !hasStoredConfirmation()) return;

    // Migrate confirmations made by the previous localStorage-only version so
    // subsequent server renders also know that the visitor already accepted.
    persistConfirmation();
  }, [enabled, initiallyConfirmed]);

  useEffect(() => {
    if (!visible) return;

    document.body.classList.add("is-age-gate-open");
    confirmButtonRef.current?.focus({ preventScroll: true });
    return () => document.body.classList.remove("is-age-gate-open");
  }, [visible]);

  function confirmAge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    persistConfirmation();
  }

  if (!visible) return null;

  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <form
        className="age-gate__panel"
        action="/api/age-confirmation"
        method="post"
        onSubmit={confirmAge}
      >
        <ShieldAlert size={52} aria-hidden="true" />
        <p className="eyebrow">Accès réservé au public averti</p>
        <h1 id="age-gate-title">As-tu au moins {minimumAge} ans ?</h1>
        <p>
          Cette plateforme est uniquement informative et éditoriale. Elle ne propose ni vente, ni
          commande, ni livraison.
        </p>
        <div className="button-row">
          <button ref={confirmButtonRef} className="button" type="submit">
            Oui, continuer
          </button>
          <a className="button button--secondary" href="https://telegram.org">
            Quitter
          </a>
        </div>
        <Link className="text-link" href="/avertissements">
          Lire les avertissements
        </Link>
      </form>
    </div>
  );
}
