import Link from "next/link";

export const metadata = {
  title: "Conditions Générales d'Utilisation — Angle Mort",
};

export default function CGU() {
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
            marginBottom: "0.75rem",
          }}
        >
          Conditions Générales d&apos;Utilisation
        </h1>
        <p
          style={{
            fontFamily: "var(--font-archivo, 'Archivo', sans-serif)",
            fontSize: "0.7rem",
            color: "rgba(201,169,107,0.5)",
            letterSpacing: "0.1em",
            marginBottom: "3rem",
          }}
        >
          En vigueur au 1er juin 2025
        </p>

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
          {[
            {
              title: "1. Objet",
              content:
                "Angle Mort propose un service d'audit introspectif relationnel à destination des personnes souhaitant mieux se comprendre avant un engagement majeur. Le service consiste en un questionnaire de 10 questions et un diagnostic généré par intelligence artificielle, remis à l'utilisateur après paiement.",
            },
            {
              title: "2. Nature du service",
              content:
                "Angle Mort est un outil d'introspection, non un dispositif médical, psychologique ou thérapeutique. Le diagnostic généré n'a pas valeur de conseil médical, psychologique ou juridique. Il ne constitue pas une évaluation de la relation ni de la personne partenaire. L'utilisateur reste seul juge des décisions qu'il prend.",
            },
            {
              title: "3. Accès et paiement",
              content:
                "L'accès au rapport complet est conditionné au paiement unique de 14 € TTC. Le paiement est traité par Stripe. Aucun abonnement, aucun renouvellement automatique. Droit de rétractation : conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux contenus numériques fournis immédiatement après paiement avec accord préalable de l'utilisateur.",
            },
            {
              title: "4. Données et confidentialité",
              content:
                "Les réponses au questionnaire sont transmises à l'API Claude (Anthropic) pour générer le diagnostic. Elles ne sont pas conservées par Angle Mort au-delà de la durée de traitement. L'utilisateur est responsable du contenu de ses réponses.",
            },
            {
              title: "5. Limitations de responsabilité",
              content:
                "Angle Mort ne peut être tenu responsable des décisions prises sur la base du diagnostic. La qualité du diagnostic dépend de la profondeur et de l'honnêteté des réponses fournies par l'utilisateur. En cas d'erreur technique empêchant la délivrance du rapport après paiement, l'utilisateur est invité à contacter contact@angle-mort.fr pour obtenir une résolution.",
            },
            {
              title: "6. Propriété intellectuelle",
              content:
                "Le questionnaire, les prompts, le design et l'ensemble du contenu de la plateforme sont la propriété de Maxime Charavet. Le rapport généré est remis à titre personnel et non commercial à l'utilisateur.",
            },
            {
              title: "7. Droit applicable",
              content:
                "Les présentes CGU sont soumises au droit français. Tout litige relève de la compétence des tribunaux français.",
            },
          ].map((section) => (
            <section key={section.title}>
              <h2
                style={{
                  fontFamily:
                    "var(--font-cormorant, 'Cormorant Garamond', serif)",
                  fontStyle: "italic",
                  fontSize: "1.4rem",
                  color: "#c9a96b",
                  marginBottom: "0.75rem",
                }}
              >
                {section.title}
              </h2>
              <p>{section.content}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
