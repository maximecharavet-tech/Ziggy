"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

function TypewriterText({
  text,
  speed = 18,
}: {
  text: string;
  speed?: number;
}) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const i = useRef(0);

  useEffect(() => {
    i.current = 0;
    setDisplayed("");
    setDone(false);

    const interval = setInterval(() => {
      if (i.current < text.length) {
        setDisplayed(text.slice(0, i.current + 1));
        i.current++;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!done && <span className="typewriter-cursor" />}
    </span>
  );
}

function LoadingCinematic() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2.5rem",
        padding: "2rem",
      }}
    >
      {/* Aperture animation */}
      <div
        style={{
          position: "relative",
          width: 80,
          height: 80,
        }}
      >
        {[0, 45, 90, 135].map((angle) => (
          <div
            key={angle}
            style={{
              position: "absolute",
              inset: 0,
              border: "1px solid rgba(201,169,107,0.25)",
              borderRadius: "50%",
              animation: `pulse-ring ${1.5 + angle * 0.01}s ease-in-out infinite`,
              transform: `scale(${1 + angle * 0.006})`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: "30%",
            background: "var(--gold)",
            borderRadius: "50%",
            opacity: 0.7,
            animation: "pulse-core 1.5s ease-in-out infinite",
          }}
        />
      </div>

      <div style={{ textAlign: "center" }}>
        <p
          className="font-display"
          style={{
            fontSize: "1.8rem",
            color: "var(--ivory)",
            marginBottom: "0.75rem",
          }}
        >
          Hyper AI Engine™ analyse vos réponses
        </p>
        <p
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.85rem",
            color: "var(--ivory-dim)",
            lineHeight: 1.7,
            maxWidth: 380,
          }}
        >
          Identification des patterns. Cartographie des zones d&apos;ombre.
          Formulation du diagnostic.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.4rem" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "var(--gold)",
              opacity: 0.5,
              animation: `dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

    </div>
  );
}

function RapportContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<
    "checking" | "loading-diagnostic" | "ready" | "error" | "no-payment"
  >("checking");
  const [diagnostic, setDiagnostic] = useState<string>("");
  const [sections, setSections] = useState<
    { title: string; content: string }[]
  >([]);
  const [activeSection, setActiveSection] = useState(0);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setStatus("no-payment");
      return;
    }
    if (hasFetched.current) return;
    hasFetched.current = true;

    const run = async () => {
      // Verify payment
      let answers: string[] = [];
      try {
        const stored = sessionStorage.getItem("am_answers");
        if (stored) answers = JSON.parse(stored);
      } catch {
        // ignore
      }

      setStatus("loading-diagnostic");

      try {
        const res = await fetch("/api/diagnostic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, answers }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (err.error === "payment_required") {
            setStatus("no-payment");
          } else {
            setStatus("error");
          }
          return;
        }

        const data = await res.json();
        const text: string = data.diagnostic || "";
        setDiagnostic(text);

        // Parse sections
        const parsed: { title: string; content: string }[] = [];
        const lines = text.split("\n");
        let current: { title: string; content: string } | null = null;

        for (const line of lines) {
          if (line.startsWith("## ") || line.startsWith("# ")) {
            if (current) parsed.push(current);
            current = { title: line.replace(/^#+\s*/, ""), content: "" };
          } else if (current) {
            current.content += (current.content ? "\n" : "") + line;
          } else {
            if (!parsed.length) {
              current = { title: "Préambule", content: line };
            }
          }
        }
        if (current) parsed.push(current);

        if (parsed.length === 0) {
          parsed.push({ title: "Votre diagnostic", content: text });
        }

        setSections(parsed);
        setStatus("ready");

        // Clear storage after success
        sessionStorage.removeItem("am_answers");
      } catch {
        setStatus("error");
      }
    };

    run();
  }, [sessionId]);

  if (status === "checking" || status === "loading-diagnostic") {
    return <LoadingCinematic />;
  }

  if (status === "no-payment") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1
          className="font-display"
          style={{ fontSize: "3rem", color: "var(--ivory)" }}
        >
          Accès non autorisé
        </h1>
        <p
          style={{
            fontFamily: "var(--font-archivo)",
            color: "var(--ivory-dim)",
            maxWidth: 400,
            lineHeight: 1.7,
          }}
        >
          Un paiement valide est requis pour accéder à votre diagnostic.
        </p>
        <a href="/diagnostic">
          <button className="btn-gold">
            <span>Commencer l&apos;audit</span>
          </button>
        </a>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1
          className="font-display"
          style={{ fontSize: "2.5rem", color: "var(--ivory)" }}
        >
          Une erreur est survenue
        </h1>
        <p
          style={{
            fontFamily: "var(--font-archivo)",
            color: "var(--ivory-dim)",
            maxWidth: 420,
            lineHeight: 1.7,
          }}
        >
          Votre paiement a bien été effectué. Veuillez contacter le support en
          indiquant votre session ID :{" "}
          <code
            style={{
              color: "var(--gold)",
              fontSize: "0.75rem",
              background: "rgba(201,169,107,0.08)",
              padding: "0.2rem 0.4rem",
            }}
          >
            {sessionId}
          </code>
        </p>
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--obsidian)",
        paddingTop: "6rem",
        paddingBottom: "6rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          padding: "0 1.5rem",
          marginBottom: "4rem",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.65rem",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "var(--gold)",
            opacity: 0.7,
            marginBottom: "1.25rem",
          }}
        >
          Hyper AI Engine™ · Votre diagnostic
        </p>
        <h1
          className="font-display text-glow"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 5rem)",
            color: "var(--ivory)",
            lineHeight: 1.1,
            marginBottom: "1.5rem",
          }}
        >
          Votre Angle Mort
        </h1>
        <div
          className="divider-gold"
          style={{ margin: "0 auto" }}
        />
      </div>

      {/* Section tabs */}
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "0 1.5rem",
        }}
      >
        {sections.length > 1 && (
          <div
            style={{
              display: "flex",
              gap: "0.25rem",
              marginBottom: "3rem",
              flexWrap: "wrap",
            }}
          >
            {sections.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSection(i)}
                style={{
                  fontFamily: "var(--font-archivo)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  padding: "0.5rem 1rem",
                  border: "1px solid",
                  borderColor:
                    i === activeSection
                      ? "var(--gold)"
                      : "rgba(201,169,107,0.15)",
                  background:
                    i === activeSection
                      ? "rgba(201,169,107,0.08)"
                      : "transparent",
                  color:
                    i === activeSection ? "var(--gold)" : "var(--ivory-dim)",
                  transition: "all 0.3s ease",
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            {sections.length > 1 && (
              <h2
                className="font-display"
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
                  color: "var(--gold)",
                  marginBottom: "1.5rem",
                }}
              >
                {sections[activeSection]?.title}
              </h2>
            )}

            <div
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "1rem",
                color: "var(--ivory-dim)",
                lineHeight: 1.9,
                whiteSpace: "pre-wrap",
              }}
            >
              {activeSection === 0 && sections.length > 0 ? (
                <TypewriterText
                  text={sections[0]?.content ?? diagnostic}
                  speed={12}
                />
              ) : (
                sections[activeSection]?.content
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation between sections */}
        {sections.length > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "3rem",
              paddingTop: "2rem",
              borderTop: "1px solid rgba(201,169,107,0.1)",
            }}
          >
            <button
              onClick={() => setActiveSection((i) => Math.max(0, i - 1))}
              disabled={activeSection === 0}
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.7rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color:
                  activeSection === 0
                    ? "rgba(243,239,230,0.15)"
                    : "rgba(243,239,230,0.45)",
                background: "transparent",
                border: "none",
              }}
            >
              ← Section précédente
            </button>
            <button
              onClick={() =>
                setActiveSection((i) =>
                  Math.min(sections.length - 1, i + 1)
                )
              }
              disabled={activeSection === sections.length - 1}
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.7rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color:
                  activeSection === sections.length - 1
                    ? "rgba(243,239,230,0.15)"
                    : "var(--gold)",
                background: "transparent",
                border: "none",
              }}
            >
              Section suivante →
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer
        style={{
          marginTop: "6rem",
          borderTop: "1px solid rgba(201,169,107,0.1)",
          padding: "3rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
          textAlign: "center",
        }}
      >
        <Link
          href="/"
          className="font-display"
          style={{ fontSize: "1.25rem", color: "var(--gold)", opacity: 0.7, textDecoration: "none" }}
        >
          Angle Mort
        </Link>
        <p
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.7rem",
            color: "var(--ivory-dim)",
            letterSpacing: "0.1em",
          }}
        >
          Fondateur : Maxime Charavet
        </p>
        <p
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.6rem",
            color: "rgba(201,169,107,0.35)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Powered by Hyper AI Engine™
        </p>
        <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.25rem" }}>
          {[
            { label: "Mentions légales", href: "/mentions-legales" },
            { label: "CGU", href: "/cgu" },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.6rem",
                color: "rgba(243,239,230,0.3)",
                letterSpacing: "0.1em",
                textDecoration: "none",
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </footer>
    </main>
  );
}

export default function RapportPage() {
  return (
    <Suspense fallback={<LoadingCinematic />}>
      <RapportContent />
    </Suspense>
  );
}
