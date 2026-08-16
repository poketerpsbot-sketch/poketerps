"use client";

import { useState } from "react";

function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toLocaleUpperCase("fr-FR") || "?"
  );
}

export function safeUserAvatarUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function UserAvatar({
  displayName,
  src,
  className = "",
  eager = false,
}: {
  displayName: string;
  src?: string | null;
  className?: string;
  eager?: boolean;
}) {
  const safeSrc = safeUserAvatarUrl(src);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(safeSrc && failedUrl !== safeSrc);

  return (
    <span
      className={`avatar user-avatar${showImage ? " user-avatar--image" : ""}${className ? ` ${className}` : ""}`}
      role={showImage ? "img" : undefined}
      aria-label={showImage ? `Photo de profil de ${displayName}` : undefined}
      aria-hidden={showImage ? undefined : true}
    >
      {showImage && safeSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- Telegram peut fournir une URL SVG t.me; ce composant gère aussi l'échec réseau.
        <img
          src={safeSrc}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(safeSrc)}
        />
      ) : (
        initials(displayName)
      )}
    </span>
  );
}
