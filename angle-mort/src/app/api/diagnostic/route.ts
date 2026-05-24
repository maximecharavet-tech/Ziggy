import { NextRequest, NextResponse } from "next/server";
import { questions } from "@/lib/questions";

const SYSTEM_PROMPT = `Tu es l'intelligence analytique d'Angle Mort, un outil d'audit de lucidité relationnelle.
Tu reçois les réponses introspectives d'une personne sur le point de s'engager dans une relation majeure.

RÈGLES ABSOLUES — non négociables :
1. Tu ne donnes JAMAIS de score, de note, ni de verdict.
2. Tu ne fais AUCUNE mention du partenaire — ton analyse porte UNIQUEMENT sur la personne elle-même : ses patterns, ses besoins, ses mécanismes de défense, ses blessures.
3. Tu n'utilises JAMAIS les mots "problème", "erreur", "mauvais" — tu emploies "zone d'ombre", "angle mort", "espace non exploré", "pattern", "schéma".
4. Tu ne rassures PAS et ne valides PAS les choix — tu révèles des dynamiques intérieures.
5. Tu utilises un langage précis, littéraire, jamais clinique ni condescendant.
6. Chaque observation est une invitation à la réflexion, jamais une conclusion définitive.
7. Tu parles à la deuxième personne du singulier, avec respect et profondeur.
8. Tu ne juges pas. Tu observes.

FORMAT OBLIGATOIRE (en markdown avec ## pour les titres) :

## Zones d'Ombre Identifiées
[3-4 paragraphes précis sur les patterns émotionnels observés dans les réponses.]

## Patterns Récurrents
[2-3 paragraphes sur les schémas qui se répètent.]

## Ce Que Vous Portez
[1-2 paragraphes sur l'héritage personnel.]

## Questions à Porter
[5-7 questions ouvertes, numérotées.]

Longueur totale : 700-900 mots. Ton : lucide, bienveillant, sans complaisance.`;

const SIMULATION_DIAGNOSTIC = `## Zones d'Ombre Identifiées

Ce qui frappe en premier dans vos réponses, c'est la précision avec laquelle vous nommez vos sensations — et la distance, presque imperceptible, que vous maintenez avec elles. Vous décrivez ce que vous ressentez comme on décrirait le ciel : avec justesse, mais depuis une fenêtre fermée. Cette posture d'observateur de votre propre vie intérieure est à la fois une force — elle vous protège des débordements — et un angle mort : ce que vous ne permettez pas d'entrer pleinement ne peut pas non plus être pleinement connu.

Il y a dans vos réponses quelque chose qui ressemble à de l'attente sans objet nommé. Vous attendez, mais vous n'avez pas encore dit clairement ce que vous attendez. Les espoirs les plus puissants sont souvent ceux qu'on ne formule pas — parce qu'une fois nommés, ils deviennent vulnérables. Cet espace entre l'espoir et sa formulation est précisément là où les malentendus prennent racine.

Vous savez ce que vous ne voulez pas. C'est net, précis, articulé. Ce que vous voulez, en revanche, reste dans une zone de flou confortable. Cette asymétrie — savoir ses limites mieux que ses désirs — est révélatrice d'une façon d'être dans les relations qui protège davantage qu'elle n'expose. Vous êtes expert·e en frontières. Peut-être moins en portes grandes ouvertes.

## Patterns Récurrents

Un schéma traverse plusieurs de vos réponses : vous observez, vous analysez, vous comprenez — et vous agissez ensuite avec une certaine retenue. Comme si comprendre suffisait, ou comme si agir avant d'avoir tout compris était dangereux. Ce pattern a probablement été utile. Il vous a sans doute évité des erreurs. Mais il crée aussi une forme de latence entre ce que vous vivez et ce que vous en faites — une latence dans laquelle beaucoup de choses non dites ont le temps de se solidifier.

Ce qui revient également, de manière voilée, c'est la question de la réciprocité. Non pas posée frontalement, mais présente dans la façon dont vous formulez vos besoins — toujours légèrement relativisés, mis en perspective, presque excusés. Comme si vouloir quelque chose pour vous-même demandait une justification supplémentaire. Cette façon de minimiser vos propres besoins est peut-être si ancienne que vous ne la reconnaissez plus comme un choix.

## Ce Que Vous Portez

Il y a quelque chose qui vient de plus loin que cette relation. Une façon d'apprendre à se rendre indispensable plutôt qu'à se rendre visible. Une conviction, peut-être jamais formulée, que l'amour se mérite par ce qu'on fait plutôt que par ce qu'on est. Ce n'est pas une certitude — c'est une hypothèse que vos réponses invitent à examiner. Demandez-vous : dans les moments où vous n'êtes rien d'autre que vous-même, sans rôle, sans utilité — vous sentez-vous toujours légitime à être aimé·e ?

## Questions à Porter

1. Qu'est-ce que vous permettriez à quelqu'un de voir de vous, si vous étiez certain·e de ne pas être jugé·e pour cela ?

2. Quand vous minimisez un besoin ou une attente, est-ce par générosité — ou par peur de ce qui se passerait si vous l'exprimiez pleinement ?

3. Y a-t-il une version de vous-même que vous avez mise de côté pour entrer dans cette relation ? Est-ce un sacrifice conscient ou un oubli progressif ?

4. Si vous n'aviez aucun passé relationnel — aucune blessure, aucun modèle intériorisé — qu'est-ce que vous demanderiez différemment à cette relation ?

5. La distance que vous maintenez parfois avec vos propres émotions vous semble-t-elle une sagesse ou une habitude ? Savez-vous faire la différence entre les deux ?

6. Qu'est-ce qui vous rendrait heureux·se dans cette relation, indépendamment de ce que vous en attendez pour l'autre ?

7. Si dans dix ans vous regardiez en arrière sur ce moment d'engagement — quelle question aimeriez-vous vous être posé·e aujourd'hui, et que vous ne vous posez pas encore ?`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, answers } = body as {
      session_id: string;
      answers: string[];
    };

    if (!session_id) {
      return NextResponse.json(
        { error: "payment_required" },
        { status: 402 }
      );
    }

    // Simulation mode — bypass Stripe verification and return mock diagnostic
    const isSimulation =
      process.env.SIMULATION_MODE === "true" ||
      session_id.startsWith("SIM_");

    if (isSimulation) {
      // Add a small delay to make the loading animation visible
      await new Promise((r) => setTimeout(r, 2800));
      return NextResponse.json({ diagnostic: SIMULATION_DIAGNOSTIC });
    }

    // Production: verify Stripe payment
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        { error: "Configuration serveur manquante" },
        { status: 500 }
      );
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);
    let paymentVerified = false;

    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      paymentVerified = session.payment_status === "paid";
    } catch {
      return NextResponse.json(
        { error: "payment_required" },
        { status: 402 }
      );
    }

    if (!paymentVerified) {
      return NextResponse.json(
        { error: "payment_required" },
        { status: 402 }
      );
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: "Réponses manquantes" },
        { status: 400 }
      );
    }

    // Build user message from Q&A
    const formattedAnswers = questions
      .map((q, i) => {
        const answer = (answers[i] || "").trim();
        return `**Question ${i + 1} — ${q.question}**\n${answer || "[Pas de réponse fournie]"}`;
      })
      .join("\n\n---\n\n");

    const userMessage = `Voici les réponses à l'audit introspectif :\n\n${formattedAnswers}`;

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json(
        { error: "Configuration API manquante" },
        { status: 500 }
      );
    }

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: anthropicKey });

    const message = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textContent = message.content.find((c) => c.type === "text");
    const diagnostic = textContent ? textContent.text : "";

    return NextResponse.json({ diagnostic });
  } catch (error) {
    console.error("Diagnostic API error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
