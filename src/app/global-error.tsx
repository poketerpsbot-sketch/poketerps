"use client";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#7f0c1d",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <main
          style={{
            width: "min(100%, 620px)",
            padding: 32,
            border: "3px solid #17191b",
            borderRadius: 20,
            background: "#0d211c",
            boxShadow: "0 6px 0 #17191b",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#97e86e", fontFamily: "monospace", textTransform: "uppercase" }}>
            Erreur critique
          </p>
          <h1>Le Pokédex doit redémarrer</h1>
          <p style={{ color: "#9dd4b8" }}>
            La coque principale n’a pas pu être chargée. Réessaie sans fermer Telegram.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 46,
              marginTop: 14,
              padding: "10px 18px",
              border: "2px solid #17191b",
              borderRadius: 10,
              background: "#f8f2e9",
              boxShadow: "0 4px 0 #17191b",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
