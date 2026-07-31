export interface GameConfig {
  /** Stable id, also used as the route segment and translation key. */
  id: string;
  /** Main accent colour (hex) used for theming the game UI. */
  color: string;
  /** Soft/tinted variant of the accent colour used for backgrounds. */
  colorSoft: string;
  /** lucide-react icon NAME (resolved at render time). */
  icon: string;
}

export const GAMES: GameConfig[] = [
  {
    id: 'memory',
    color: '#8B5CF6',
    colorSoft: '#EDE9FE',
    icon: 'Brain',
  },
  {
    id: 'math',
    color: '#22C55E',
    colorSoft: '#DCFCE7',
    icon: 'Calculator',
  },
  {
    id: 'logic',
    color: '#3B82F6',
    colorSoft: '#DBEAFE',
    icon: 'Puzzle',
  },
  {
    id: 'quiz',
    color: '#F59E0B',
    colorSoft: '#FEF3C7',
    icon: 'Sparkles',
  },
];

export function getGame(id: string): GameConfig | undefined {
  return GAMES.find((g) => g.id === id);
}

export const GAME_IDS = GAMES.map((g) => g.id);
