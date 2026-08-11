"use client";

import { ScanLine, ShieldAlert } from "lucide-react";
import { type FormEvent, useEffect, useRef, useSyncExternalStore } from "react";
import {
  AGE_GATE_CONFIRMED_VALUE,
  AGE_GATE_COOKIE_NAME,
  AGE_GATE_MAX_AGE_SECONDS,
  AGE_GATE_REJECTED_VALUE,
  AGE_GATE_STORAGE_KEY,
} from "@/lib/age-gate";

const DECISION_EVENT = "pokedex:age-decision";
type AgeDecision = "confirmed" | "rejected" | null;

function storedDecision(): AgeDecision {
  if (document.documentElement.dataset.ageGateConfirmed === "true") return "confirmed";
  if (document.documentElement.dataset.ageGateRejected === "true") return "rejected";
  try {
    const value = window.localStorage.getItem(AGE_GATE_STORAGE_KEY);
    if (value === AGE_GATE_CONFIRMED_VALUE) return "confirmed";
    if (value === AGE_GATE_REJECTED_VALUE) return "rejected";
    return null;
  } catch {
    return null;
  }
}

function persistDecision(decision: Exclude<AgeDecision, null>) {
  const value = decision === "confirmed" ? AGE_GATE_CONFIRMED_VALUE : AGE_GATE_REJECTED_VALUE;
  try {
    window.localStorage.setItem(AGE_GATE_STORAGE_KEY, value);
  } catch {
    // The cookie and in-memory state still keep the confirmation usable.
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AGE_GATE_COOKIE_NAME}=${value}; Path=/; Max-Age=${AGE_GATE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  document.documentElement.dataset.ageGateConfirmed = decision === "confirmed" ? "true" : "false";
  document.documentElement.dataset.ageGateRejected = decision === "rejected" ? "true" : "false";
  window.dispatchEvent(new Event(DECISION_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(DECISION_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(DECISION_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

type AgeGateProps = {
  enabled: boolean;
  initiallyConfirmed: boolean;
  initiallyRejected?: boolean;
  minimumAge: number;
};

export function AgeGate({
  enabled,
  initiallyConfirmed,
  initiallyRejected = false,
  minimumAge,
}: AgeGateProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const decision = useSyncExternalStore<AgeDecision>(
    subscribe,
    () => (!enabled || initiallyConfirmed ? "confirmed" : storedDecision()),
    () => (!enabled || initiallyConfirmed ? "confirmed" : initiallyRejected ? "rejected" : null),
  );
  const visible = enabled && decision !== "confirmed";

  useEffect(() => {
    if (!enabled || initiallyConfirmed || storedDecision() !== "confirmed") return;

    // Migrate confirmations made by the previous localStorage-only version so
    // subsequent server renders also know that the visitor already accepted.
    persistDecision("confirmed");
  }, [enabled, initiallyConfirmed]);

  useEffect(() => {
    if (!visible) return;

    document.body.classList.add("is-age-gate-open");
    confirmButtonRef.current?.focus({ preventScroll: true });
    return () => document.body.classList.remove("is-age-gate-open");
  }, [visible]);

  function chooseAge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    persistDecision(submitter?.value === AGE_GATE_REJECTED_VALUE ? "rejected" : "confirmed");
  }

  if (!visible) return null;

  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <form
        className={`age-gate__panel${decision === "rejected" ? " age-gate__panel--rejected" : ""}`}
        action="/api/age-confirmation"
        method="post"
        onSubmit={chooseAge}
      >
        {decision === "rejected" ? (
          <>
            <ShieldAlert size={52} aria-hidden="true" />
            <p className="eyebrow">Accès refusé</p>
            <h1 id="age-gate-title">Contenu réservé aux personnes majeures</h1>
            <p>
              Désolé, tu ne peux pas accéder au Pokédex après avoir déclaré avoir moins de{" "}
              {minimumAge} ans.
            </p>
            <a className="button button--secondary" href="https://telegram.org">
              Quitter
            </a>
          </>
        ) : (
          <>
            <ScanLine className="age-gate__scan" size={52} aria-hidden="true" />
            <p className="eyebrow">PokéTerps · Contrôle d’accès</p>
            <h1 id="age-gate-title">Avant d’ouvrir ton Pokédex</h1>
            <p>Ce contenu est réservé aux personnes majeures. Confirme ton âge pour continuer.</p>
            <div className="age-gate__actions">
              <button
                ref={confirmButtonRef}
                className="button"
                type="submit"
                name="decision"
                value={AGE_GATE_CONFIRMED_VALUE}
              >
                J’ai {minimumAge} ans ou plus
              </button>
              <button
                className="button button--secondary"
                type="submit"
                name="decision"
                value={AGE_GATE_REJECTED_VALUE}
              >
                J’ai moins de {minimumAge} ans
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
