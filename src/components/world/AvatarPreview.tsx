'use client';

import { useId } from 'react';
import type { AvatarRequest, VisualBlueprint } from '@/lib/hyper-engine/schemas';
import { fx, shade } from '@/components/create/fx/toy';

/** Colours used to draw the live, local avatar preview (no AI involved). */
export const HAIR_HEX: Record<VisualBlueprint['hairColor'], string> = {
  black: '#1f1b1a',
  dark_brown: '#3b2416',
  brown: '#6b4226',
  auburn: '#8e3b1f',
  red: '#c2461f',
  blond: '#d9a441',
  light_blond: '#ecd18a',
  grey: '#a8a8b3',
  blue: '#4f8de0',
  pink: '#ef7fb2',
};
export const SKIN_HEX: Record<VisualBlueprint['skinTone'], string> = {
  tone1: '#fde3d3',
  tone2: '#f5cfb2',
  tone3: '#e3b08c',
  tone4: '#c68b62',
  tone5: '#9b6643',
  tone6: '#6b432b',
};
export const EYE_HEX: Record<VisualBlueprint['eyeColor'], string> = {
  brown: '#6b4226',
  dark_brown: '#3b2416',
  hazel: '#8d7b3c',
  green: '#3f8f5a',
  blue: '#3f7fd0',
  grey: '#7d8794',
};
export const OUTFIT_COLOR: Record<AvatarRequest['outfit'], string> = {
  explorer: '#7FC85C',
  astronaut: '#F59E0B',
  wizard: '#8B5CF6',
  chef: '#F1F3F7',
  artist: '#F472B6',
  pirate: '#EF4444',
  princess: '#EC4899',
  hero: '#3B82F6',
  scientist: '#F8FAFC',
  sporty: '#22C55E',
};

const LEN = { very_short: 0, short: 1, medium: 2, long: 3 } as const;

/** The hat or accessory of each outfit, drawn over the hair. */
function Hat({ outfit, color, id }: { outfit: AvatarRequest['outfit']; color: string; id: string }) {
  switch (outfit) {
    case 'explorer':
      return (
        <g>
          <ellipse cx="100" cy="54" rx="80" ry="14" fill="#c9a35a" />
          <path d="M46 54 Q48 8 100 8 Q152 8 154 54 Z" fill={`url(#${id}-hat)`} />
          <path d="M47 44 Q100 32 153 44 L154 54 Q100 42 46 54 Z" fill="#7a5a26" />
          <ellipse cx="80" cy="22" rx="16" ry="6" fill="#fff" opacity="0.3" transform="rotate(-20 80 22)" />
        </g>
      );
    case 'wizard':
      return (
        <g>
          <path d="M60 54 Q84 32 104 2 Q118 34 144 52 Z" fill={`url(#${id}-hat)`} />
          <ellipse cx="102" cy="54" rx="66" ry="12" fill={shade(color, -0.25)} />
          <path d="M104 22 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" fill="#FFD447" />
          <circle cx="122" cy="40" r="2.5" fill="#fff" opacity="0.8" />
          <circle cx="86" cy="42" r="2" fill="#fff" opacity="0.7" />
        </g>
      );
    case 'chef':
      return (
        <g>
          <circle cx="72" cy="30" r="20" fill="#fff" />
          <circle cx="128" cy="30" r="20" fill="#fff" />
          <circle cx="100" cy="22" r="25" fill="#fff" />
          <rect x="64" y="36" width="72" height="22" rx="7" fill="#f3f4f8" />
          <path d="M66 52 H134" stroke="#dfe2ea" strokeWidth="3" />
          <ellipse cx="90" cy="14" rx="10" ry="5" fill="#fff" opacity="0.9" />
        </g>
      );
    case 'artist':
      return (
        <g transform="rotate(-12 96 46)">
          <ellipse cx="96" cy="46" rx="58" ry="20" fill={`url(#${id}-hat)`} />
          <path d="M96 26 q2 -10 8 -12" stroke={shade(color, -0.3)} strokeWidth="5" strokeLinecap="round" fill="none" />
          <ellipse cx="78" cy="38" rx="16" ry="5" fill="#fff" opacity="0.35" />
        </g>
      );
    case 'pirate':
      return (
        <g>
          <path d="M42 80 Q44 32 100 30 Q156 32 158 80 Q130 58 100 58 Q70 58 42 80 Z" fill={`url(#${id}-hat)`} />
          {[
            [72, 48],
            [100, 40],
            [128, 48],
            [86, 60],
            [114, 60],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3.6" fill="#fff" opacity="0.9" />
          ))}
          <path d="M156 70 l16 -8 -2 16z M156 72 l12 12 -14 2z" fill={shade(color, -0.2)} />
        </g>
      );
    case 'princess':
      return (
        <g>
          <path d="M64 50 L70 16 L86 34 L100 8 L114 34 L130 16 L136 50 Z" fill={`url(#${id}-gold)`} stroke="#d99a16" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="100" cy="40" r="5" fill="#ec4899" />
          <circle cx="80" cy="43" r="3.5" fill="#5fb6ea" />
          <circle cx="120" cy="43" r="3.5" fill="#7fc85c" />
          <circle cx="100" cy="8" r="3.5" fill="#fff6c8" />
        </g>
      );
    case 'scientist':
      return (
        <g>
          <path d="M44 66 Q100 44 156 66" stroke="#3b3b4f" strokeWidth="7" fill="none" />
          <circle cx="80" cy="58" r="14" fill="#7dd3fc" stroke="#3b3b4f" strokeWidth="5" />
          <circle cx="120" cy="58" r="14" fill="#7dd3fc" stroke="#3b3b4f" strokeWidth="5" />
          <circle cx="75" cy="53" r="4" fill="#fff" opacity="0.85" />
          <circle cx="115" cy="53" r="4" fill="#fff" opacity="0.85" />
        </g>
      );
    case 'sporty':
      return (
        <g>
          <path d="M43 72 Q100 48 157 72 L157 84 Q100 60 43 84 Z" fill={`url(#${id}-hat)`} />
          <path d="M45 77 Q100 54 155 77" stroke="#fff" strokeWidth="3" fill="none" opacity="0.9" />
        </g>
      );
    default:
      return null;
  }
}

/** Pattern on the outfit. */
function OutfitDetail({ outfit, color }: { outfit: AvatarRequest['outfit']; color: string }) {
  const dark = shade(color, -0.35);
  switch (outfit) {
    case 'explorer':
      return (
        <g>
          <path d="M70 172 L120 220" stroke="#8a6a2f" strokeWidth="7" />
          <rect x="114" y="190" width="22" height="18" rx="4" fill={dark} opacity="0.5" />
        </g>
      );
    case 'astronaut':
      return (
        <g>
          <path d="M60 176 Q100 196 140 176" stroke="#cfd6e4" strokeWidth="9" fill="none" />
          <rect x="88" y="192" width="24" height="16" rx="4" fill="#5fb6ea" />
          <circle cx="94" cy="200" r="2.5" fill="#fff" />
          <circle cx="106" cy="200" r="2.5" fill="#ff7ab8" />
        </g>
      );
    case 'wizard':
      return (
        <g fill="#FFD447">
          <path d="M70 196 l2 5 5 1 -4 3 1 5 -4 -2 -4 2 1 -5 -4 -3 5 -1z" />
          <path d="M128 186 l2 5 5 1 -4 3 1 5 -4 -2 -4 2 1 -5 -4 -3 5 -1z" />
        </g>
      );
    case 'chef':
      return (
        <g fill="#c9ced8">
          {[184, 198, 212].map((y) => (
            <g key={y}>
              <circle cx="90" cy={y} r="3" />
              <circle cx="110" cy={y} r="3" />
            </g>
          ))}
        </g>
      );
    case 'artist':
      return (
        <g>
          <circle cx="72" cy="196" r="7" fill="#FFD447" />
          <circle cx="126" cy="188" r="6" fill="#5FB6EA" />
          <circle cx="110" cy="208" r="5" fill="#7FC85C" />
        </g>
      );
    case 'pirate':
      return (
        <g stroke="#fff" strokeWidth="6" opacity="0.85">
          <path d="M52 192 H148" />
          <path d="M46 208 H154" />
        </g>
      );
    case 'princess':
      return (
        <g>
          <path d="M78 172 Q100 186 122 172" stroke="#FFD447" strokeWidth="3" fill="none" />
          <circle cx="100" cy="184" r="5" fill="#5fb6ea" stroke="#FFD447" strokeWidth="2" />
        </g>
      );
    case 'hero':
      return <path d="M100 180 l8 12 -8 14 -8 -14z" fill="#FFD447" stroke={dark} strokeWidth="2" />;
    case 'scientist':
      return (
        <g>
          <path d="M84 168 L100 196 L116 168" stroke="#d9dde6" strokeWidth="5" fill="none" />
          <rect x="120" y="190" width="18" height="16" rx="3" fill="#e5e9f2" />
          <path d="M126 186 V196" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'sporty':
      return (
        <text x="100" y="210" textAnchor="middle" fontSize="26" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif">
          1
        </text>
      );
    default:
      return null;
  }
}

/**
 * A soft, shaded cartoon portrait drawn from the blueprint, instantly, for
 * everyone (no AI involved). It breathes and blinks, unless motion is reduced.
 */
export function AvatarPreview({
  b,
  outfitColor,
  outfit = 'explorer',
  size = 220,
  label,
  still = false,
  hat = true,
}: {
  b: VisualBlueprint;
  outfitColor?: string;
  outfit?: AvatarRequest['outfit'];
  size?: number;
  label: string;
  still?: boolean;
  /** Show the outfit's hat (hidden while choosing the hair). */
  hat?: boolean;
}) {
  const id = `av${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const hair = HAIR_HEX[b.hairColor];
  const skin = SKIN_HEX[b.skinTone];
  const eye = EYE_HEX[b.eyeColor];
  const cloth = outfitColor ?? OUTFIT_COLOR[outfit];
  const len = LEN[b.hairLength];
  const covered = b.hairStyle === 'covered';
  const brow = shade(hair, -0.25);
  const hatColor = outfit === 'explorer' ? '#e2c27f' : cloth;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label={label} className="overflow-visible">
      <defs>
        <radialGradient id={`${id}-skin`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor={shade(skin, 0.28)} />
          <stop offset="0.55" stopColor={skin} />
          <stop offset="1" stopColor={shade(skin, -0.16)} />
        </radialGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(hair, 0.22)} />
          <stop offset="1" stopColor={shade(hair, -0.18)} />
        </linearGradient>
        <linearGradient id={`${id}-cloth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(cloth, 0.22)} />
          <stop offset="1" stopColor={shade(cloth, -0.18)} />
        </linearGradient>
        <linearGradient id={`${id}-hat`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(hatColor, 0.25)} />
          <stop offset="1" stopColor={shade(hatColor, -0.15)} />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2a8" />
          <stop offset="1" stopColor="#f5b82e" />
        </linearGradient>
        <radialGradient id={`${id}-iris`} cx="50%" cy="38%" r="60%">
          <stop offset="0" stopColor={shade(eye, 0.35)} />
          <stop offset="1" stopColor={shade(eye, -0.2)} />
        </radialGradient>
        <radialGradient id={`${id}-blush`}>
          <stop offset="0" stopColor="#ff8fa3" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff8fa3" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className={still ? '' : fx.breathe}>
        {/* Hero cape, back hair */}
        {outfit === 'hero' ? <path d="M48 176 Q30 210 26 220 L174 220 Q170 210 152 176 Z" fill="#EF4444" /> : null}
        {!covered && len >= 2 ? <path d={`M40 90 Q34 ${150 + len * 12} 70 ${160 + len * 10} L130 ${160 + len * 10} Q166 ${150 + len * 12} 160 90 Z`} fill={`url(#${id}-hair)`} /> : null}
        {covered ? <path d="M38 100 Q30 40 100 28 Q170 40 162 100 L170 175 Q100 195 30 175 Z" fill="#9b8cd8" /> : null}

        {/* Body */}
        <path d="M38 222 Q42 170 100 165 Q158 170 162 222 Z" fill={`url(#${id}-cloth)`} />
        <path d="M58 182 Q100 168 142 182" stroke="#fff" strokeOpacity="0.28" strokeWidth="5" fill="none" strokeLinecap="round" />
        <OutfitDetail outfit={outfit} color={cloth} />
        <rect x="87" y="142" width="26" height="30" rx="10" fill={skin} />
        <ellipse cx="100" cy="150" rx="16" ry="7" fill={shade(skin, -0.3)} opacity="0.35" />

        {/* Head */}
        <ellipse cx="44" cy="106" rx="10" ry="14" fill={skin} />
        <ellipse cx="44" cy="107" rx="5" ry="8" fill={shade(skin, -0.18)} />
        <ellipse cx="156" cy="106" rx="10" ry="14" fill={skin} />
        <ellipse cx="156" cy="107" rx="5" ry="8" fill={shade(skin, -0.18)} />
        <ellipse cx="100" cy="100" rx="58" ry="60" fill={`url(#${id}-skin)`} />

        {/* Front hair */}
        {!covered ? (
          b.hairStyle === 'curly' || b.hairStyle === 'coily' ? (
            <g fill={`url(#${id}-hair)`}>
              {[46, 62, 80, 100, 120, 138, 154].map((x, i) => (
                <circle key={x} cx={x} cy={i % 2 ? 48 : 56} r={b.hairStyle === 'coily' ? 18 : 15} />
              ))}
            </g>
          ) : (
            <path d={len === 0 ? 'M48 78 Q60 36 100 36 Q140 36 152 78 Q120 60 100 62 Q80 60 48 78 Z' : 'M42 96 Q40 34 100 32 Q160 34 158 96 Q150 64 120 58 Q100 72 72 60 Q52 66 42 96 Z'} fill={`url(#${id}-hair)`} />
          )
        ) : (
          <path d="M44 82 Q48 36 100 34 Q152 36 156 82 Q130 58 100 58 Q70 58 44 82 Z" fill="#b5a8ec" />
        )}
        {!covered ? <path d="M66 48 Q86 38 108 40" stroke="#fff" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" fill="none" /> : null}
        {!covered && b.hairStyle === 'ponytail' ? <path d="M150 70 Q190 90 170 150 Q160 110 145 92 Z" fill={`url(#${id}-hair)`} /> : null}
        {!covered && b.hairStyle === 'buns' ? (
          <g fill={`url(#${id}-hair)`}>
            <circle cx="52" cy="44" r="18" />
            <circle cx="148" cy="44" r="18" />
          </g>
        ) : null}
        {!covered && b.hairStyle === 'braids' ? (
          <g fill={`url(#${id}-hair)`}>
            {[0, 1, 2, 3].map((i) => (
              <ellipse key={`l${i}`} cx="46" cy={120 + i * 16} rx="9" ry="9" />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <ellipse key={`r${i}`} cx="154" cy={120 + i * 16} rx="9" ry="9" />
            ))}
          </g>
        ) : null}

        {/* Face */}
        <path d="M70 84 Q78 78 88 82" stroke={brow} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M112 82 Q122 78 130 84" stroke={brow} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        {[78, 122].map((x) => (
          <g key={x} className={still ? '' : fx.blink}>
            <ellipse cx={x} cy="104" rx="10" ry="12" fill="#fff" />
            <path d={`M${x - 10} 101 Q${x} 90 ${x + 10} 101`} fill={shade(skin, -0.1)} opacity="0.35" />
            <circle cx={x + 1} cy="106" r="7" fill={`url(#${id}-iris)`} />
            <circle cx={x + 1} cy="106.5" r="3.4" fill="#1d1d2b" />
            <circle cx={x + 3.6} cy="102.6" r="2.4" fill="#fff" />
            <circle cx={x - 2} cy="109" r="1.1" fill="#fff" />
          </g>
        ))}
        <ellipse cx="64" cy="126" rx="12" ry="8" fill={`url(#${id}-blush)`} />
        <ellipse cx="136" cy="126" rx="12" ry="8" fill={`url(#${id}-blush)`} />
        <path d="M97 116 Q100 120 103 116" stroke={shade(skin, -0.3)} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M86 130 Q100 146 114 130 Q100 136 86 130 Z" fill="#7a2e3a" />
        <path d="M93 137 Q100 142 107 137 Q100 135 93 137 Z" fill="#ff8fa3" />
        {b.freckles ? (
          <g fill={shade(skin, -0.45)} opacity="0.55">
            {[
              [70, 118],
              [76, 122],
              [64, 121],
              [130, 118],
              [124, 122],
              [136, 121],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" />
            ))}
          </g>
        ) : null}
        {b.glasses ? (
          <g>
            <circle cx="78" cy="105" r="15" fill="#dff4ff" fillOpacity="0.25" stroke="#2b2b3a" strokeWidth="3.5" />
            <circle cx="122" cy="105" r="15" fill="#dff4ff" fillOpacity="0.25" stroke="#2b2b3a" strokeWidth="3.5" />
            <path d="M93 104 L107 104" stroke="#2b2b3a" strokeWidth="3.5" />
            <path d="M70 98 Q74 94 79 94" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8" />
          </g>
        ) : null}
        {outfit === 'hero' ? (
          <path
            fillRule="evenodd"
            d="M56 100 Q78 84 100 96 Q122 84 144 100 Q146 118 124 120 Q110 120 100 110 Q90 120 76 120 Q54 118 56 100 Z M68 104 a10 12 0 1 0 20 0 a10 12 0 1 0 -20 0 Z M112 104 a10 12 0 1 0 20 0 a10 12 0 1 0 -20 0 Z"
            fill={cloth}
          />
        ) : null}
        {!covered && hat ? <Hat outfit={outfit} color={cloth} id={id} /> : null}
        {outfit === 'astronaut' ? (
          <g>
            <circle cx="100" cy="104" r="80" fill="#cfeaff" fillOpacity="0.18" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="5" />
            <path d="M46 70 Q60 40 92 30" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.7" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
