'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { scenePalette, type ScenePalette } from './themes';

const Ctx = createContext<ScenePalette | null>(null);

/** The scene a game is played in (sky, hills, day or night), for mechanics that draw their own world. */
export function StageThemeProvider({ palette, children }: { palette: ScenePalette; children: ReactNode }) {
  return <Ctx.Provider value={palette}>{children}</Ctx.Provider>;
}

export function useStageTheme(color: string): ScenePalette {
  return useContext(Ctx) ?? scenePalette(color);
}
