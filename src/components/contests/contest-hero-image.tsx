"use client";

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";

export function ContestHeroImage({ title, imageUrl }: { title: string; imageUrl: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("contest-image-modal-open");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("contest-image-modal-open");
    };
  }, [open]);

  return (
    <>
      <button
        className="contest-detail-hero__image-button"
        type="button"
        style={{ backgroundImage: `url(${imageUrl})` }}
        aria-label={`Ouvrir la photo du concours ${title} en grand`}
        onClick={() => setOpen(true)}
      >
        <span className="contest-detail-hero__image-hint">
          <Maximize2 aria-hidden="true" /> Toucher pour agrandir
        </span>
      </button>

      {open && (
        <div
          className="contest-image-modal"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <section
            className="contest-image-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contest-image-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="contest-image-modal__header">
              <h2 id="contest-image-modal-title">Photo à observer</h2>
              <button
                className="icon-button contest-image-modal__close"
                type="button"
                aria-label="Fermer la photo"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="contest-image-modal__content">
              {/* eslint-disable-next-line @next/next/no-img-element -- the public contest image has dynamic dimensions. */}
              <img src={imageUrl} alt={`Photo du concours ${title}`} />
            </div>
            <p>Observe attentivement la photo, puis ferme-la pour participer.</p>
          </section>
        </div>
      )}
    </>
  );
}
