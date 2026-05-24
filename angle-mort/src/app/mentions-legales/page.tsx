import Link from "next/link";

export const metadata = {
  title: "Mentions légales — Angle Mort",
};

export default function MentionsLegales() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#05070d",
        padding: "6rem 1.5rem",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-archivo, 'Archivo', sans-serif)",
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(201,169,107,0.5)",
            textDecoration: "none",
            display: "inline-block",
            marginBottom: "3rem",
          }}
        >
          ← Retour
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
            fontStyle: "italic",
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            color: "#f3efe6",
            marginBottom: "3rem",
          }}
        >
          Mentions légales
        </h1>

        <div
          style={{
            fontFamily: "var(--font-archivo, 'Archivo', sans-serif)",
            fontSize: "0.9rem",
            color: "rgba(243,239,230,0.55)",
            lineHeight: 1.9,
            display: "flex",
            flexDirection: "column",
            gap: "2rem",
          }}
        >
          <section>
            <h2
              style={{
                fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
                fontStyle: "italic",
                fontSize: "1.4rem",
                color: "#c9a96b",
                marginBottom: "0.75rem",
              }}
            >
              Éditeur
            </h2>
            <p>
              Le site Angle Mort est édité par Maxime Charavet, entrepreneur individuel.
            </p>
            <p>
              Fondateur : Maxime Charavet<br />
              Contact : contact@angle-mort.fr
            </p>
          </section>

          <section>
            <h2
              style={{
                fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
                fontStyle: "italic",
                fontSize: "1.4rem",
                color: "#c9a96b",
                marginBottom: "0.75rem",
              }}
            >
              Hébergement
            </h2>
            <p>
              Ce site est hébergé par Vercel Inc.<br />
              340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis.
            </p>
          </section>

          <section>
            <h2
              style={{
                fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
                fontStyle: "italic",
                fontSize: "1.4rem",
                color: "#c9a96b",
                marginBottom: "0.75rem",
              }}
            >
              Intelligence artificielle
            </h2>
            <p>
              Les diagnostics sont générés par Hyper AI Engine™, propulsé par la technologie Claude d&apos;Anthropic.
              Les réponses de l&apos;utilisateur sont transmises à l&apos;API Anthropic pour traitement et ne sont
              pas stockées de manière permanente sur nos serveurs.
            </p>
          </section>

          <section>
            <h2
              style={{
                fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
                fontStyle: "italic",
                fontSize: "1.4rem",
                color: "#c9a96b",
                marginBottom: "0.75rem",
              }}
            >
              Paiement
            </h2>
            <p>
              Les paiements sont traités par Stripe, Inc. Aucune donnée de carte bancaire
              n&apos;est stockée sur nos serveurs. Le service est proposé à 14 € TTC, paiement unique,
              sans abonnement.
            </p>
          </section>

          <section>
            <h2
              style={{
                fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
                fontStyle: "italic",
                fontSize: "1.4rem",
                color: "#c9a96b",
                marginBottom: "0.75rem",
              }}
            >
              Propriété intellectuelle
            </h2>
            <p>
              L&apos;ensemble du contenu de ce site — textes, visuels, questionnaire, prompts —
              est la propriété exclusive de Maxime Charavet. Toute reproduction sans autorisation
              expresse est interdite.
            </p>
          </section>

          <section>
            <h2
              style={{
                fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
                fontStyle: "italic",
                fontSize: "1.4rem",
                color: "#c9a96b",
                marginBottom: "0.75rem",
              }}
            >
              Données personnelles
            </h2>
            <p>
              Les réponses au questionnaire sont transmises à l&apos;API Claude (Anthropic) pour
              générer votre diagnostic, puis supprimées de notre environnement. Aucun profil
              persistant n&apos;est créé. Conformément au RGPD, vous pouvez exercer vos droits
              en contactant contact@angle-mort.fr.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
