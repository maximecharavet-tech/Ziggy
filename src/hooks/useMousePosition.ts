'use client';

import { useState, useEffect } from 'react';

export function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  const normalizedX = typeof window !== 'undefined' ? (position.x / window.innerWidth) * 2 - 1 : 0;
  const normalizedY = typeof window !== 'undefined' ? (position.y / window.innerHeight) * 2 - 1 : 0;

  return { ...position, normalizedX, normalizedY };
}
