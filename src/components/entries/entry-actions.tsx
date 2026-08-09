"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Check, Heart, MessageSquarePlus, PencilLine } from "lucide-react";

type Props = {
  entryId: string;
  slug: string;
  initialLiked?: boolean;
  initialFavorited?: boolean;
  initialLikeCount?: number;
};

async function mutation(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    message?: string;
  } | null;
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? payload?.message ?? "Action impossible pour le moment.",
    );
  }
}

export function EntryActions({
  entryId,
  slug,
  initialLiked = false,
  initialFavorited = false,
  initialLikeCount = 0,
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [pending, setPending] = useState<"like" | "favorite" | null>(null);
  const [feedback, setFeedback] = useState("");

  async function toggleLike() {
    if (pending) return;
    const next = !liked;
    setPending("like");
    setFeedback("");
    try {
      await mutation(`/api/entries/${encodeURIComponent(entryId)}/likes`, next ? "PUT" : "DELETE");
      setLiked(next);
      setLikeCount((current) => Math.max(0, current + (next ? 1 : -1)));
      setFeedback(next ? "Ajouté aux fiches aimées." : "J’aime retiré.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setPending(null);
    }
  }

  async function toggleFavorite() {
    if (pending) return;
    const next = !favorited;
    setPending("favorite");
    setFeedback("");
    try {
      await mutation(
        next ? "/api/favorites" : `/api/favorites/${encodeURIComponent(entryId)}`,
        next ? "POST" : "DELETE",
        next ? { entryId } : undefined,
      );
      setFavorited(next);
      setFeedback(next ? "Capture ajoutée aux favoris." : "Capture retirée des favoris.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="interaction-bar">
        <button
          className={liked ? "button" : "button button--secondary"}
          type="button"
          onClick={toggleLike}
          disabled={pending !== null}
          aria-pressed={liked}
        >
          <Heart fill={liked ? "currentColor" : "none"} size={17} aria-hidden="true" />
          {liked ? "Aimé" : "J’aime"} · {likeCount.toLocaleString("fr-CH")}
        </button>
        <button
          className={favorited ? "button" : "button button--secondary"}
          type="button"
          onClick={toggleFavorite}
          disabled={pending !== null}
          aria-pressed={favorited}
        >
          {favorited ? (
            <Check size={17} aria-hidden="true" />
          ) : (
            <Bookmark size={17} aria-hidden="true" />
          )}
          {favorited ? "En favoris" : "Favori"}
        </button>
        <Link
          className="button button--secondary"
          href={`/fiches/${encodeURIComponent(slug)}/avis`}
        >
          <MessageSquarePlus size={17} aria-hidden="true" /> Ajouter un avis
        </Link>
        <Link
          className="button button--secondary"
          href={`/fiches/${encodeURIComponent(slug)}/correction`}
        >
          <PencilLine size={17} aria-hidden="true" /> Corriger
        </Link>
      </div>
      {feedback && (
        <p className="interaction-feedback" aria-live="polite">
          {feedback}
        </p>
      )}
    </div>
  );
}
