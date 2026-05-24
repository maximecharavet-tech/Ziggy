"use client";

import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mouse = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
      }
    };

    const tick = () => {
      ring.current.x += (mouse.current.x - ring.current.x) * 0.11;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.11;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ring.current.x}px, ${ring.current.y}px) translate(-50%, -50%)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const onEnterInteractive = () => {
      if (ringRef.current) {
        ringRef.current.style.width = "52px";
        ringRef.current.style.height = "52px";
        ringRef.current.style.borderColor = "rgba(201,169,107,0.9)";
      }
      if (dotRef.current) dotRef.current.style.opacity = "0";
    };

    const onLeaveInteractive = () => {
      if (ringRef.current) {
        ringRef.current.style.width = "30px";
        ringRef.current.style.height = "30px";
        ringRef.current.style.borderColor = "rgba(201,169,107,0.45)";
      }
      if (dotRef.current) dotRef.current.style.opacity = "1";
    };

    document.addEventListener("mousemove", onMove);

    const addListeners = () => {
      document.querySelectorAll("a,button,[data-hover]").forEach((el) => {
        el.addEventListener("mouseenter", onEnterInteractive);
        el.addEventListener("mouseleave", onLeaveInteractive);
      });
    };
    addListeners();

    const observer = new MutationObserver(addListeners);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div
        ref={ringRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 30,
          height: 30,
          border: "1px solid rgba(201,169,107,0.45)",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 9999,
          transition: "width 0.3s ease, height 0.3s ease, border-color 0.3s ease",
          willChange: "transform",
        }}
      />
      <div
        ref={dotRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 4,
          height: 4,
          background: "#c9a96b",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 9999,
          transition: "opacity 0.2s ease",
          willChange: "transform",
        }}
      />
    </>
  );
}
