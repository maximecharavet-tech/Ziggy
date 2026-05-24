import Link from "next/link";

export default function NotFound() {
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
      <p
        style={{
          fontFamily: "var(--font-archivo, 'Archivo', sans-serif)",
          fontSize: "0.65rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "rgba(201,169,107,0.6)",
        }}
      >
        404
      </p>
      <h1
        style={{
          fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
          fontStyle: "italic",
          fontSize: "clamp(3rem, 8vw, 6rem)",
          color: "#f3efe6",
          lineHeight: 1,
        }}
      >
        Zone inconnue
      </h1>
      <p
        style={{
          fontFamily: "var(--font-archivo, 'Archivo', sans-serif)",
          fontSize: "0.95rem",
          color: "rgba(243,239,230,0.5)",
          maxWidth: 360,
          lineHeight: 1.7,
        }}
      >
        Cette page n&apos;existe pas. Certaines zones d&apos;ombre ne méritent pas d&apos;être explorées.
      </p>
      <Link href="/">
        <button className="btn-gold">
          <span>Retour à l&apos;accueil</span>
        </button>
      </Link>
    </main>
  );
}
