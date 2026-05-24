export default function Loading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#05070d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2.5rem",
        padding: "2rem",
      }}
    >
      <div style={{ position: "relative", width: 80, height: 80 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: `${i * 8}%`,
              border: "1px solid rgba(201,169,107,0.2)",
              borderRadius: "50%",
              animation: `pulse-ring ${1.4 + i * 0.2}s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: "35%",
            background: "#c9a96b",
            borderRadius: "50%",
            opacity: 0.6,
            animation: "pulse-core 1.5s ease-in-out infinite",
          }}
        />
      </div>
      <p
        style={{
          fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
          fontStyle: "italic",
          fontSize: "1.5rem",
          color: "rgba(243,239,230,0.8)",
        }}
      >
        Chargement de votre diagnostic...
      </p>
    </main>
  );
}
