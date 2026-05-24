"use client";

import { useEffect } from "react";

export default function LenisProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    let lenis: import("lenis").default | null = null;

    import("lenis").then(({ default: Lenis }) => {
      lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        smoothWheel: true,
      });

      const raf = (time: number) => {
        lenis!.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    });

    return () => {
      lenis?.destroy();
    };
  }, []);

  return <>{children}</>;
}
