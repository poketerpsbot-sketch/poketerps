"use client";

import Link from "next/link";
import { LoaderCircle, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ContestHallOfFameResult,
  ContestHallOfFameWinner,
  ContestType,
} from "@/components/contests/types";
import { UserAvatar } from "@/components/ui/user-avatar";

const PAGE_SIZE = 20;

const contestTypeLabels: Record<ContestType, string> = {
  GAME: "Jeu",
  DRAW: "Tirage au sort",
  CREATIVE: "Créatif",
  ENTRY: "Fiche",
  EXTERNAL_LINK: "Externe",
  COMMUNITY: "Communautaire",
  OTHER: "Autre",
  WEIGHT_GUESS: "Jeu du poids",
};

type ResultPage = {
  items: ContestHallOfFameResult[];
  total: number;
};

function safeImageUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function formatResultDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Date à confirmer";
  return new Intl.DateTimeFormat("fr-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(date);
}

function formatMeasure(value: number, unit: string | null) {
  return `${new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 6 }).format(value)}${unit ? ` ${unit}` : ""}`;
}

function rankLabel(rank: number, multiple: boolean) {
  if (!multiple) return "🏆 Gagnant";
  if (rank === 1) return "🥇 Première place";
  if (rank === 2) return "🥈 Deuxième place";
  if (rank === 3) return "🥉 Troisième place";
  return `${rank}e place`;
}

async function fetchResults(
  limit: number,
  offset: number,
  signal?: AbortSignal,
): Promise<ResultPage> {
  const response = await fetch(`/api/contests/winners?limit=${limit}&offset=${offset}`, {
    headers: { accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error("RESULTS_UNAVAILABLE");
  const payload = (await response.json()) as {
    data?: unknown;
    pagination?: { total?: unknown };
  };
  const items = Array.isArray(payload.data) ? (payload.data as ContestHallOfFameResult[]) : [];
  const total = Number(payload.pagination?.total ?? items.length);
  return { items, total: Number.isFinite(total) ? total : items.length };
}

function WinnerAvatar({ winner }: { winner: ContestHallOfFameWinner }) {
  return (
    <UserAvatar
      className="contest-hall__avatar"
      displayName={winner.participant.displayName}
      src={winner.participant.profilePhotoUrl}
    />
  );
}

function WinnerIdentity({ winner }: { winner: ContestHallOfFameWinner }) {
  const username = winner.participant.username ? `@${winner.participant.username}` : null;
  return (
    <span className="contest-hall__identity">
      <Link href={`/profil/${encodeURIComponent(winner.participant.publicSlug)}`}>
        {username ?? winner.participant.displayName}
      </Link>
      {username && winner.participant.displayName !== winner.participant.username ? (
        <small>{winner.participant.displayName}</small>
      ) : null}
    </span>
  );
}

function RecentResult({ result }: { result: ContestHallOfFameResult }) {
  const winner = result.winners[0];
  if (!winner) return null;
  return (
    <article className="contest-hall__recent-card">
      <span className="contest-hall__winner-badge">🥇 Gagnant</span>
      <WinnerAvatar winner={winner} />
      <div>
        <WinnerIdentity winner={winner} />
        <Link
          className="contest-hall__contest-link"
          href={`/concours/${encodeURIComponent(result.slug)}`}
        >
          {result.title}
        </Link>
        <p>
          {contestTypeLabels[result.contestType]} · {formatResultDate(result.resultPublishedAt)}
        </p>
      </div>
    </article>
  );
}

function WinnerResult({
  winner,
  result,
}: {
  winner: ContestHallOfFameWinner;
  result: ContestHallOfFameResult;
}) {
  const showWeight = result.resultWeight !== null;
  const comparableGuess =
    showWeight && winner.guess && (!result.weightUnit || winner.guess.unit === result.weightUnit)
      ? winner.guess
      : null;
  return (
    <article className="contest-hall__podium-item">
      <span className="contest-hall__podium-label">
        {rankLabel(winner.rank, result.winners.length > 1)}
      </span>
      <WinnerAvatar winner={winner} />
      <WinnerIdentity winner={winner} />
      {showWeight ? (
        <dl className="contest-hall__measurements">
          <div>
            <dt>Résultat</dt>
            <dd>{formatMeasure(result.resultWeight!, result.weightUnit)}</dd>
          </div>
          {winner.guess ? (
            <div>
              <dt>Estimation</dt>
              <dd>{formatMeasure(winner.guess.numericValue, winner.guess.unit)}</dd>
            </div>
          ) : null}
          {comparableGuess ? (
            <div>
              <dt>Écart</dt>
              <dd>
                {formatMeasure(
                  Math.abs(result.resultWeight! - comparableGuess.numericValue),
                  result.weightUnit,
                )}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </article>
  );
}

function ResultCard({ result, close }: { result: ContestHallOfFameResult; close: () => void }) {
  const resultImage = safeImageUrl(result.resultImageUrl);
  return (
    <article className="contest-hall__result-card">
      {resultImage ? (
        <div
          className="contest-hall__result-image"
          style={{ backgroundImage: `url(${resultImage})` }}
          role="img"
          aria-label={`Photo du résultat du concours ${result.title}`}
        />
      ) : null}
      <header>
        <span>{contestTypeLabels[result.contestType]}</span>
        <h3>{result.title}</h3>
        <p>Résultat publié le {formatResultDate(result.resultPublishedAt)}</p>
      </header>
      <div className="contest-hall__podium">
        {result.winners.map((winner) => (
          <WinnerResult winner={winner} result={result} key={winner.id} />
        ))}
      </div>
      {result.resultText ? <p className="contest-hall__result-text">{result.resultText}</p> : null}
      <Link
        className="button button--secondary contest-hall__view-contest"
        href={`/concours/${encodeURIComponent(result.slug)}`}
        onClick={close}
      >
        Voir le concours
      </Link>
    </article>
  );
}

export function ContestHallOfFame() {
  const [recent, setRecent] = useState<ContestHallOfFameResult[] | null>(null);
  const [recentTotal, setRecentTotal] = useState(0);
  const [recentError, setRecentError] = useState(false);
  const [open, setOpen] = useState(false);
  const [allResults, setAllResults] = useState<ContestHallOfFameResult[] | null>(null);
  const [allTotal, setAllTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [modalError, setModalError] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const requestRecent = useCallback((signal?: AbortSignal) => {
    void fetchResults(3, 0, signal)
      .then((page) => {
        setRecent(page.items.slice(0, 3));
        setRecentTotal(page.total);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRecent([]);
        setRecentError(true);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    requestRecent(controller.signal);
    return () => controller.abort();
  }, [requestRecent]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const openButton = openButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      openButton?.focus();
    };
  }, [open]);

  async function loadAll(offset: number, append: boolean) {
    setModalError(false);
    setLoadingMore(true);
    try {
      const page = await fetchResults(PAGE_SIZE, offset);
      setAllResults((current) => (append && current ? [...current, ...page.items] : page.items));
      setAllTotal(page.total);
    } catch {
      setModalError(true);
      if (!append) setAllResults([]);
    } finally {
      setLoadingMore(false);
    }
  }

  function openResults() {
    setOpen(true);
    if (allResults === null) void loadAll(0, false);
  }

  function retryRecent() {
    setRecent(null);
    setRecentError(false);
    requestRecent();
  }

  function closeResults() {
    setOpen(false);
  }

  const showSkeleton = recent === null;
  const hasMore = allResults !== null && allResults.length < allTotal;

  return (
    <section className="contest-hall section-stack" aria-labelledby="contest-hall-title">
      <header className="contest-hall__heading">
        <span className="contest-hall__trophy" aria-hidden="true">
          <Trophy />
        </span>
        <div>
          <p className="eyebrow">Hall of Fame</p>
          <h2 id="contest-hall-title">Derniers gagnants</h2>
          <p>Les derniers champions couronnés par la communauté PokéTerps.</p>
        </div>
      </header>

      {showSkeleton ? (
        <div className="contest-hall__recent-grid" aria-label="Chargement des derniers gagnants">
          {[0, 1, 2].map((item) => (
            <span className="contest-hall__skeleton" key={item} />
          ))}
        </div>
      ) : recentError ? (
        <div className="contest-hall__empty" role="status">
          <p>Les gagnants sont momentanément indisponibles.</p>
          <button className="button button--secondary" type="button" onClick={retryRecent}>
            Réessayer
          </button>
        </div>
      ) : recent.length === 0 ? (
        <p className="contest-hall__empty">Aucun gagnant pour le moment.</p>
      ) : (
        <>
          <div className="contest-hall__recent-grid">
            {recent.slice(0, 3).map((result) => (
              <RecentResult result={result} key={result.id} />
            ))}
          </div>
          <button
            className="button button--dark contest-hall__more"
            type="button"
            onClick={openResults}
            ref={openButtonRef}
          >
            Voir tous les gagnants{recentTotal > 3 ? ` (${recentTotal})` : ""}
          </button>
        </>
      )}

      {open ? (
        <div
          className="contest-hall-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeResults();
          }}
        >
          <section
            className="contest-hall-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contest-hall-modal-title"
          >
            <header className="contest-hall-modal__header">
              <div>
                <p className="eyebrow">Palmarès PokéTerps</p>
                <h2 id="contest-hall-modal-title">🏆 Tous les gagnants</h2>
              </div>
              <button
                className="contest-hall-modal__close"
                type="button"
                onClick={closeResults}
                aria-label="Fermer les résultats des concours"
                ref={closeButtonRef}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="contest-hall-modal__content">
              {allResults === null || (loadingMore && allResults.length === 0) ? (
                <div className="contest-hall-modal__loading" role="status">
                  <LoaderCircle aria-hidden="true" />
                  Chargement du palmarès…
                </div>
              ) : modalError && allResults.length === 0 ? (
                <div className="contest-hall__empty" role="alert">
                  <p>Impossible de charger le palmarès.</p>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => void loadAll(0, false)}
                  >
                    Réessayer
                  </button>
                </div>
              ) : (
                <>
                  <div className="contest-hall__results">
                    {allResults.map((result) => (
                      <ResultCard result={result} close={closeResults} key={result.id} />
                    ))}
                  </div>
                  {modalError ? (
                    <p className="contest-hall__load-error">
                      Le chargement suivant a échoué. Réessaie.
                    </p>
                  ) : null}
                  {hasMore ? (
                    <button
                      className="button button--dark contest-hall__load-more"
                      type="button"
                      disabled={loadingMore}
                      onClick={() => void loadAll(allResults.length, true)}
                    >
                      {loadingMore ? "Chargement…" : "Charger plus"}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
