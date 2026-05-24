"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#05070d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
          fontStyle: "italic",
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          color: "#f3efe6",
        }}
      >
        Une erreur est survenue
      </h2>
      <p
        style={{
          fontFamily: "var(--font-archivo, 'Archivo', sans-serif)",
          fontSize: "0.9rem",
          color: "rgba(243,239,230,0.5)",
          maxWidth: 380,
          lineHeight: 1.7,
        }}
      >
        Quelque chose s&apos;est mal passé. Votre session est préservée.
      </p>
      <button className="btn-gold" onClick={reset}>
        <span>Réessayer</span>
      </button>
    </main>
  );
}
