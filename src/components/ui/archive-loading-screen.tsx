export function ArchiveLoadingScreen({
  message = "Synchronisation des captures et de la taxonomie…",
}: {
  message?: string;
}) {
  return (
    <div className="archive-loading page-shell" role="status" aria-live="polite" aria-busy="true">
      <section className="archive-loading__device device-panel">
        <div className="archive-loading__screen">
          <div className="archive-loading__visual" aria-hidden="true">
            <span className="scanner-orbit archive-loading__orbit" />
            <span className="archive-loading__scan" />
            <span className="archive-loading__signal">
              <span className="pokeball archive-loading__ball" />
            </span>
          </div>
          <div className="archive-loading__copy">
            <p className="eyebrow">Signal système</p>
            <h1>Connexion aux archives</h1>
            <p>{message}</p>
            <span className="archive-loading__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
