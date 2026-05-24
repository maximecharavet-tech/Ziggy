"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const ParticleCanvas = dynamic(() => import("@/components/ParticleCanvas"), {
  ssr: false,
});

export default function HomePage() {
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const heroSubRef = useRef<HTMLParagraphElement>(null);
  const heroCTARef = useRef<HTMLDivElement>(null);
  const section2Ref = useRef<HTMLElement>(null);
  const section3Ref = useRef<HTMLElement>(null);
  const section4Ref = useRef<HTMLElement>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ctx: any = null;

    Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
    ]).then(([{ default: gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        // Hero entrance
        const tl = gsap.timeline({ delay: 0.3 });
        tl.fromTo(
          heroTitleRef.current,
          { opacity: 0, y: 60, filter: "blur(12px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.4, ease: "power3.out" }
        )
          .fromTo(
            heroSubRef.current,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 1, ease: "power2.out" },
            "-=0.8"
          )
          .fromTo(
            heroCTARef.current,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
            "-=0.6"
          );

        // Scroll-triggered reveals
        const revealEls = document.querySelectorAll("[data-reveal]");
        revealEls.forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0, y: 50 },
            {
              opacity: 1,
              y: 0,
              duration: 1,
              ease: "power2.out",
              scrollTrigger: {
                trigger: el,
                start: "top 85%",
                once: true,
              },
            }
          );
        });

        // Stagger card reveals
        const cards = document.querySelectorAll("[data-card]");
        if (cards.length) {
          gsap.fromTo(
            cards,
            { opacity: 0, y: 40 },
            {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: "power2.out",
              stagger: 0.15,
              scrollTrigger: {
                trigger: cards[0],
                start: "top 80%",
                once: true,
              },
            }
          );
        }
      });
    });

    return () => ctx?.revert();
  }, []);

  return (
    <main style={{ position: "relative", zIndex: 1 }}>
      <ParticleCanvas />

      {/* ── HERO ── */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 1.5rem",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Vignette overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(5,7,13,0.7) 100%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 900 }}>
          <p
            style={{
              fontFamily: "var(--font-archivo)",
              fontSize: "0.65rem",
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: "2.5rem",
              opacity: 0.75,
            }}
          >
            Hyper AI Engine™
          </p>

          <h1
            ref={heroTitleRef}
            className="font-display text-glow"
            style={{
              fontSize: "clamp(5rem, 14vw, 12rem)",
              lineHeight: 0.9,
              color: "var(--ivory)",
              letterSpacing: "-0.02em",
              marginBottom: "2rem",
              opacity: 0,
            }}
          >
            Angle<br />Mort
          </h1>

          <p
            ref={heroSubRef}
            style={{
              fontFamily: "var(--font-archivo)",
              fontSize: "clamp(0.95rem, 2vw, 1.2rem)",
              color: "var(--ivory-dim)",
              lineHeight: 1.7,
              maxWidth: 560,
              margin: "0 auto 3.5rem",
              opacity: 0,
            }}
          >
            Avant un engagement majeur, ce que vous ne voyez pas peut tout changer.
            <br />
            Un audit d&apos;introspection relationnelle. Sans score. Sans verdict.
          </p>

          <div ref={heroCTARef} style={{ opacity: 0 }}>
            <Link href="/diagnostic">
              <button className="btn-gold">
                <span>Commencer l&apos;audit</span>
                <span style={{ marginLeft: "0.25rem" }}>→</span>
              </button>
            </Link>
            <p
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.7rem",
                color: "var(--gold)",
                letterSpacing: "0.15em",
                marginTop: "1.25rem",
                opacity: 0.6,
              }}
            >
              14 € · Paiement unique · Aucun abonnement
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: "absolute",
            bottom: "2.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            opacity: 0.4,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-archivo)",
              fontSize: "0.6rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "var(--ivory)",
            }}
          >
            Défiler
          </span>
          <div
            style={{
              width: 1,
              height: 48,
              background: "linear-gradient(to bottom, var(--ivory), transparent)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
        </div>
      </section>

      {/* ── CONCEPT ── */}
      <section
        ref={section2Ref}
        style={{
          padding: "clamp(6rem, 12vw, 10rem) 1.5rem",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4rem",
            alignItems: "center",
          }}
        >
          <div data-reveal>
            <p
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.65rem",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "var(--gold)",
                marginBottom: "1.5rem",
                opacity: 0.7,
              }}
            >
              Le concept
            </p>
            <h2
              className="font-display"
              style={{
                fontSize: "clamp(2.5rem, 5vw, 4rem)",
                color: "var(--ivory)",
                lineHeight: 1.15,
                marginBottom: "2rem",
              }}
            >
              Le plus grand angle mort en amour,{" "}
              <span style={{ color: "var(--gold)" }}>c&apos;est soi-même.</span>
            </h2>
            <div className="divider-gold" style={{ marginBottom: "1.5rem" }} />
            <p
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "1rem",
                color: "var(--ivory-dim)",
                lineHeight: 1.8,
              }}
            >
              Nous investiguons les relations, les comportements du partenaire,
              les incompatibilités. Rarement nous-mêmes. Or ce que nous apportons
              à une relation — nos blessures, nos patterns, nos attentes informulées —
              détermine plus que tout ce que la relation sera.
            </p>
          </div>

          <div
            data-reveal
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "1.5rem",
            }}
          >
            {[
              { label: "Pas un test.", desc: "Aucune grille d'évaluation. Aucun algorithme de compatibilité." },
              { label: "Pas un verdict.", desc: "Nous ne vous dirons pas si votre relation est viable ou non." },
              { label: "Un miroir.", desc: "Uniquement ce que vos réponses révèlent de vous-même." },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  borderLeft: "1px solid var(--gold-mid)",
                  paddingLeft: "1.5rem",
                  paddingTop: "0.25rem",
                  paddingBottom: "0.25rem",
                }}
              >
                <p
                  className="font-display"
                  style={{
                    fontSize: "1.5rem",
                    color: "var(--gold)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {item.label}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-archivo)",
                    fontSize: "0.9rem",
                    color: "var(--ivory-dim)",
                    lineHeight: 1.6,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROCESS ── */}
      <section
        ref={section3Ref}
        style={{
          padding: "clamp(5rem, 10vw, 9rem) 1.5rem",
          borderTop: "1px solid rgba(201,169,107,0.07)",
          borderBottom: "1px solid rgba(201,169,107,0.07)",
          background:
            "linear-gradient(180deg, transparent, rgba(201,169,107,0.03) 50%, transparent)",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p
            data-reveal
            style={{
              fontFamily: "var(--font-archivo)",
              fontSize: "0.65rem",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "var(--gold)",
              textAlign: "center",
              marginBottom: "1rem",
              opacity: 0.7,
            }}
          >
            Comment ça fonctionne
          </p>
          <h2
            data-reveal
            className="font-display"
            style={{
              fontSize: "clamp(2rem, 4vw, 3.5rem)",
              color: "var(--ivory)",
              textAlign: "center",
              marginBottom: "clamp(3rem, 6vw, 5rem)",
            }}
          >
            Trois étapes. Une seule question.
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "2rem",
            }}
          >
            {[
              {
                num: "I",
                title: "Introspection",
                desc: "10 questions conçues pour aller là où vous n'avez pas encore regardé. Prenez le temps qu'il faut.",
              },
              {
                num: "II",
                title: "Analyse",
                desc: "Hyper AI Engine™ détecte vos patterns, vos silences, vos schémas récurrents. Aucun score. Aucun verdict.",
              },
              {
                num: "III",
                title: "Rapport",
                desc: "Un diagnostic personnel, littéraire et précis. Des zones d'ombre nommées. Des questions à porter.",
              },
            ].map((step) => (
              <div
                data-card
                key={step.num}
                style={{
                  textAlign: "center",
                  padding: "2rem 1.5rem",
                  border: "1px solid rgba(201,169,107,0.1)",
                  position: "relative",
                }}
              >
                <p
                  className="font-display"
                  style={{
                    fontSize: "4rem",
                    color: "rgba(201,169,107,0.15)",
                    lineHeight: 1,
                    marginBottom: "1rem",
                  }}
                >
                  {step.num}
                </p>
                <p
                  className="font-display"
                  style={{
                    fontSize: "1.5rem",
                    color: "var(--gold)",
                    marginBottom: "0.75rem",
                  }}
                >
                  {step.title}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-archivo)",
                    fontSize: "0.875rem",
                    color: "var(--ivory-dim)",
                    lineHeight: 1.7,
                  }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <div
            data-reveal
            style={{
              textAlign: "center",
              marginTop: "3rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                border: "1px solid rgba(201,169,107,0.25)",
                padding: "0.6rem 2rem",
                fontFamily: "var(--font-archivo)",
                fontSize: "0.75rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--gold)",
              }}
            >
              14 € · Paiement unique
            </span>
          </div>
        </div>
      </section>

      {/* ── WHAT IT REVEALS ── */}
      <section
        ref={section4Ref}
        style={{
          padding: "clamp(6rem, 12vw, 10rem) 1.5rem",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <p
          data-reveal
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.65rem",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "var(--gold)",
            marginBottom: "1rem",
            textAlign: "center",
            opacity: 0.7,
          }}
        >
          Ce que révèle l&apos;audit
        </p>
        <h2
          data-reveal
          className="font-display"
          style={{
            fontSize: "clamp(2rem, 4vw, 3.5rem)",
            color: "var(--ivory)",
            textAlign: "center",
            marginBottom: "clamp(3rem, 6vw, 5rem)",
          }}
        >
          Ce qui vous appartient dans ce que vous vivez.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "2px",
          }}
        >
          {[
            {
              title: "Vos angles morts émotionnels",
              desc: "Les émotions que vous évitez de nommer, les besoins que vous n'exprimez pas, les peurs que vous rationalisez.",
            },
            {
              title: "Vos schémas relationnels",
              desc: "Ce qui se répète. Les dynamiques que vous recréez sans le choisir. L'histoire personnelle qui parle à travers vous.",
            },
            {
              title: "Vos attentes informulées",
              desc: "Ce que vous espérez sans l'avoir dit. Les contrats tacites que vous avez signés seul. Leur origine.",
            },
            {
              title: "Les questions à porter",
              desc: "Non pas des réponses — mais les bonnes questions. Celles qui méritent d'être portées avec sérieux avant l'engagement.",
            },
          ].map((item) => (
            <div
              data-card
              key={item.title}
              style={{
                padding: "2.5rem",
                background: "rgba(201,169,107,0.03)",
                border: "1px solid rgba(201,169,107,0.08)",
              }}
            >
              <p
                className="font-display"
                style={{
                  fontSize: "1.4rem",
                  color: "var(--ivory)",
                  marginBottom: "0.75rem",
                }}
              >
                {item.title}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-archivo)",
                  fontSize: "0.9rem",
                  color: "var(--ivory-dim)",
                  lineHeight: 1.75,
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <p
          data-reveal
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.8rem",
            color: "var(--gold)",
            textAlign: "center",
            marginTop: "2.5rem",
            letterSpacing: "0.1em",
            opacity: 0.7,
          }}
        >
          Aucun score. Aucun jugement. Uniquement la vérité sur vous-même.
        </p>
      </section>

      {/* ── PHILOSOPHY ── */}
      <section
        style={{
          padding: "clamp(6rem, 12vw, 10rem) 1.5rem",
          background:
            "linear-gradient(180deg, transparent, rgba(201,169,107,0.04) 50%, transparent)",
          borderTop: "1px solid rgba(201,169,107,0.07)",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div
            data-reveal
            className="font-display"
            style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)",
              color: "var(--ivory)",
              lineHeight: 1.4,
              marginBottom: "2rem",
            }}
          >
            &ldquo;Ce n&apos;est pas votre relation qui est auditée.
            <br />
            C&apos;est{" "}
            <span style={{ color: "var(--gold)" }}>
              votre rapport à vous-même
            </span>{" "}
            au sein de cette relation.&rdquo;
          </div>
          <div className="divider-gold" style={{ margin: "0 auto" }} />
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        style={{
          padding: "clamp(6rem, 12vw, 10rem) 1.5rem",
          textAlign: "center",
        }}
      >
        <h2
          data-reveal
          className="font-display"
          style={{
            fontSize: "clamp(2rem, 5vw, 4rem)",
            color: "var(--ivory)",
            marginBottom: "1.5rem",
          }}
        >
          Êtes-vous prêt à vous voir clairement ?
        </h2>
        <p
          data-reveal
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.95rem",
            color: "var(--ivory-dim)",
            maxWidth: 440,
            margin: "0 auto 3rem",
            lineHeight: 1.7,
          }}
        >
          10 questions. Environ 20 minutes.
          Un rapport généré par Hyper AI Engine™, conçu pour vous.
        </p>
        <div data-reveal>
          <Link href="/diagnostic">
            <button className="btn-gold">
              <span>Commencer mon audit — 14 €</span>
            </button>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        style={{
          borderTop: "1px solid rgba(201,169,107,0.1)",
          padding: "3rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
          textAlign: "center",
        }}
      >
        <p
          className="font-display"
          style={{
            fontSize: "1.5rem",
            color: "var(--gold)",
            opacity: 0.8,
          }}
        >
          Angle Mort
        </p>
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
            fontSize: "0.65rem",
            color: "rgba(201,169,107,0.45)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Powered by Hyper AI Engine™
        </p>
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            marginTop: "0.5rem",
          }}
        >
          {["Mentions légales", "CGU", "Contact"].map((link) => (
            <span
              key={link}
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.65rem",
                color: "var(--ivory-dim)",
                letterSpacing: "0.1em",
                textDecoration: "none",
              }}
            >
              {link}
            </span>
          ))}
        </div>
      </footer>
    </main>
  );
}
