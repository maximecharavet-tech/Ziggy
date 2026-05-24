import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
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
[3-4 paragraphes précis sur les patterns émotionnels observés dans les réponses. Citations implicites des réponses sans les citer mot pour mot. Langage dense, poétique mais ancré.]

## Patterns Récurrents
[2-3 paragraphes sur les schémas qui se répètent — dans les comportements, les silences, les formulations. Ce qui revient sans être dit directement.]

## Ce Que Vous Portez
[1-2 paragraphes sur l'héritage personnel — les blessures, les modèles intériorisés, ce qui vient de plus loin que cette relation.]

## Questions à Porter
[5-7 questions ouvertes, numérotées. Pas des questions rhétoriques — des questions qui méritent d'être vécues, pas juste pensées. Questions intimes, précises, non accusatoires.]

Longueur totale : 700-900 mots. Ton : lucide, bienveillant, sans complaisance.`;

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

    // Verify Stripe payment
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        { error: "Configuration serveur manquante" },
        { status: 500 }
      );
    }

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

    // Validate answers
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

    // Call Claude API
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json(
        { error: "Configuration API manquante" },
        { status: 500 }
      );
    }

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
