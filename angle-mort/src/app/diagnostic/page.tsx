"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { questions, depthLabels } from "@/lib/questions";
import { motion, AnimatePresence } from "framer-motion";

const DEPTH_ORDER = ["surface", "pensee", "emotion", "pattern", "ombre"] as const;

function ResonanceCanvas({ text }: { text: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const intensity = Math.min(1, wordCount / 60);
    const waves = 3 + Math.floor(intensity * 4);

    const draw = () => {
      timeRef.current += 0.012;
      ctx.clearRect(0, 0, W, H);

      for (let w = 0; w < waves; w++) {
        ctx.beginPath();
        const amp = 8 + intensity * 20 + w * 3;
        const freq = 0.008 + w * 0.003;
        const phase = timeRef.current * (0.6 + w * 0.3) + w * 1.2;
        const yBase = H * (0.3 + w * 0.15);

        for (let x = 0; x <= W; x += 2) {
          const y = yBase + Math.sin(x * freq + phase) * amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = `rgba(201,169,107,${0.06 + intensity * 0.1 - w * 0.01})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => cancelAnimationFrame(animRef.current);
  }, [text]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={200}
      className="resonance-canvas"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

function DepthMeter({
  currentDepth,
  answered,
}: {
  currentDepth: string;
  answered: number;
}) {
  const pct = (answered / questions.length) * 100;
  const currentIdx = DEPTH_ORDER.indexOf(
    currentDepth as (typeof DEPTH_ORDER)[number]
  );

  return (
    <div
      style={{
        position: "fixed",
        left: "clamp(0.5rem, 2vw, 2rem)",
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
        zIndex: 10,
      }}
    >
      {/* Labels */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          alignItems: "flex-end",
          marginBottom: "0.5rem",
        }}
      >
        {[...DEPTH_ORDER].reverse().map((depth, i) => {
          const depthIdx = DEPTH_ORDER.length - 1 - i;
          const isActive = depthIdx === currentIdx;
          const isPast = depthIdx < currentIdx;
          return (
            <span
              key={depth}
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.55rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: isActive
                  ? "var(--gold)"
                  : isPast
                  ? "rgba(201,169,107,0.4)"
                  : "rgba(243,239,230,0.15)",
                transition: "color 0.5s ease",
                whiteSpace: "nowrap",
              }}
            >
              {depthLabels[depth]}
            </span>
          );
        })}
      </div>

      {/* Bar */}
      <div
        style={{
          width: 1,
          height: 180,
          background: "rgba(201,169,107,0.12)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="depth-meter-fill"
          style={{
            position: "absolute",
            bottom: 0,
            width: "100%",
            height: `${pct}%`,
          }}
        />
      </div>

      <span
        style={{
          fontFamily: "var(--font-archivo)",
          fontSize: "0.55rem",
          color: "rgba(201,169,107,0.4)",
          letterSpacing: "0.1em",
        }}
      >
        {answered}/{questions.length}
      </span>
    </div>
  );
}

export default function DiagnosticPage() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>(
    Array(questions.length).fill("")
  );
  const [direction, setDirection] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(null!);

  const currentQuestion = questions[currentIdx];
  const currentAnswer = answers[currentIdx];
  const answeredCount = answers.filter((a) => a.trim().length > 20).length;

  const handleAnswer = useCallback(
    (val: string) => {
      setIsTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setIsTyping(false), 1200);
      const next = [...answers];
      next[currentIdx] = val;
      setAnswers(next);
    },
    [answers, currentIdx]
  );

  const goNext = () => {
    if (currentIdx < questions.length - 1) {
      setDirection(1);
      setCurrentIdx((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) {
      setDirection(-1);
      setCurrentIdx((i) => i - 1);
    }
  };

  useEffect(() => {
    textareaRef.current?.focus();
  }, [currentIdx]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    sessionStorage.setItem("am_answers", JSON.stringify(answers));

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Erreur lors de la création du paiement. Veuillez réessayer.");
        setIsSubmitting(false);
      }
    } catch {
      alert("Erreur réseau. Veuillez réessayer.");
      setIsSubmitting(false);
    }
  };

  const allAnswered = answers.every((a) => a.trim().length > 10);
  const isLast = currentIdx === questions.length - 1;

  const variants = {
    enter: (d: number) => ({
      x: d > 0 ? 60 : -60,
      opacity: 0,
      filter: "blur(4px)",
    }),
    center: { x: 0, opacity: 1, filter: "blur(0px)" },
    exit: (d: number) => ({
      x: d > 0 ? -60 : 60,
      opacity: 0,
      filter: "blur(4px)",
    }),
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--obsidian)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem 2rem 4rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(201,169,107,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <DepthMeter
        currentDepth={currentQuestion.depth}
        answered={answeredCount}
      />

      {/* Progress bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: "rgba(201,169,107,0.1)",
          zIndex: 20,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${((currentIdx + 1) / questions.length) * 100}%`,
            background: "var(--gold)",
            transition: "width 0.5s ease",
          }}
        />
      </div>

      {/* Header */}
      <div
        style={{
          position: "fixed",
          top: "1.5rem",
          right: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          zIndex: 20,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.65rem",
            color: "rgba(201,169,107,0.5)",
            letterSpacing: "0.15em",
          }}
        >
          {currentIdx + 1} / {questions.length}
        </span>
        <a
          href="/"
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(243,239,230,0.3)",
            textDecoration: "none",
          }}
        >
          Angle Mort
        </a>
      </div>

      {/* Question area */}
      <div style={{ width: "100%", maxWidth: 700, position: "relative", zIndex: 1 }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIdx}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.32, 0, 0.67, 0] }}
          >
            {/* Depth badge */}
            <p
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.6rem",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "var(--gold)",
                opacity: 0.6,
                marginBottom: "1.5rem",
              }}
            >
              {depthLabels[currentQuestion.depth]}
            </p>

            {/* Question text */}
            <h2
              className={`font-display ${isTyping ? "breathe-animation stopped" : "breathe-animation"}`}
              style={{
                fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
                color: "var(--ivory)",
                lineHeight: 1.3,
                marginBottom: "2rem",
              }}
            >
              {currentQuestion.question}
            </h2>

            {/* Text area with resonance canvas */}
            <div
              style={{
                position: "relative",
                borderBottom: "1px solid rgba(201,169,107,0.3)",
                marginBottom: "0.5rem",
                overflow: "hidden",
              }}
            >
              <ResonanceCanvas text={currentAnswer} />
              <textarea
                ref={textareaRef}
                value={currentAnswer}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder={currentQuestion.placeholder}
                rows={6}
                style={{
                  position: "relative",
                  zIndex: 1,
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontFamily: "var(--font-archivo)",
                  fontSize: "1rem",
                  color: "var(--ivory)",
                  lineHeight: 1.8,
                  padding: "1rem 0",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "2.5rem",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-archivo)",
                  fontSize: "0.65rem",
                  color: "rgba(201,169,107,0.4)",
                  letterSpacing: "0.05em",
                }}
              >
                {currentAnswer.split(/\s+/).filter(Boolean).length} mots
              </span>
              {currentAnswer.trim().length > 0 && currentAnswer.trim().length < 20 && (
                <span
                  style={{
                    fontFamily: "var(--font-archivo)",
                    fontSize: "0.65rem",
                    color: "rgba(201,169,107,0.5)",
                    fontStyle: "italic",
                  }}
                >
                  Prenez le temps d&apos;aller plus loin...
                </span>
              )}
            </div>

            {/* Navigation */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              {currentIdx > 0 && (
                <button
                  onClick={goPrev}
                  style={{
                    fontFamily: "var(--font-archivo)",
                    fontSize: "0.7rem",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "rgba(243,239,230,0.35)",
                    background: "transparent",
                    border: "none",
                    padding: "0.75rem 0",
                  }}
                >
                  ← Précédent
                </button>
              )}

              <div style={{ flex: 1 }} />

              {isLast ? (
                <button
                  className="btn-gold"
                  onClick={handleSubmit}
                  disabled={!allAnswered || isSubmitting}
                  style={{
                    opacity: !allAnswered || isSubmitting ? 0.4 : 1,
                  }}
                >
                  <span>
                    {isSubmitting
                      ? "Préparation du rapport..."
                      : "Obtenir mon diagnostic — 14 €"}
                  </span>
                </button>
              ) : (
                <button
                  className="btn-gold"
                  onClick={goNext}
                >
                  <span>Question suivante</span>
                  <span>→</span>
                </button>
              )}
            </div>

            {isLast && !allAnswered && (
              <p
                style={{
                  fontFamily: "var(--font-archivo)",
                  fontSize: "0.7rem",
                  color: "rgba(201,169,107,0.5)",
                  textAlign: "right",
                  marginTop: "0.75rem",
                  fontStyle: "italic",
                }}
              >
                Complétez toutes les questions pour continuer.
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Dot navigation */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            justifyContent: "center",
            marginTop: "3rem",
          }}
        >
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > currentIdx ? 1 : -1);
                setCurrentIdx(i);
              }}
              style={{
                width: i === currentIdx ? 20 : 6,
                height: 1,
                background:
                  i === currentIdx
                    ? "var(--gold)"
                    : answers[i].trim().length > 10
                    ? "rgba(201,169,107,0.5)"
                    : "rgba(243,239,230,0.12)",
                border: "none",
                padding: 0,
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* Loading overlay */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(5,7,13,0.92)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2rem",
              zIndex: 100,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                border: "1px solid rgba(201,169,107,0.2)",
                borderTop: "1px solid var(--gold)",
                borderRadius: "50%",
                animation: "spin 1.2s linear infinite",
              }}
            />
            <p
              className="font-display"
              style={{
                fontSize: "1.5rem",
                color: "var(--ivory)",
                opacity: 0.8,
              }}
            >
              Préparation de votre espace d&apos;analyse...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        textarea::placeholder {
          color: rgba(243,239,230,0.2);
          font-style: italic;
          font-size: 0.875rem;
        }
      `}</style>
    </main>
  );
}
