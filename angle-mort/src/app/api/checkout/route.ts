import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

    // Simulation mode — skip Stripe entirely
    if (process.env.SIMULATION_MODE === "true") {
      const simId = `SIM_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return NextResponse.json({
        url: `${baseUrl}/rapport?session_id=${simId}`,
      });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        { error: "Configuration Stripe manquante" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { answers } = body as { answers?: string[] };

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Angle Mort — Audit de lucidité relationnelle",
              description:
                "Diagnostic introspectif personnalisé. Propulsé par Hyper AI Engine™.",
              images: [],
            },
            unit_amount: 1400,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/rapport?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/diagnostic`,
      metadata: {
        answers_count: String(answers?.length ?? 0),
        product: "angle-mort-diagnostic",
      },
      locale: "fr",
      custom_text: {
        submit: {
          message: "Accédez immédiatement à votre rapport après paiement.",
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du paiement" },
      { status: 500 }
    );
  }
}
