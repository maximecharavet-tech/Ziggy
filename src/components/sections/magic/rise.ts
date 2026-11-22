import type { CSSProperties } from 'react';

/** Inline style giving an `mg-rise` child its place in a `Stagger` queue (server or client). */
export const rise = (i: number): CSSProperties => ({ '--i': i }) as CSSProperties;
