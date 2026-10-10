import type { VisualBlueprint } from '@/lib/hyper-engine/schemas';

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

const LEN = { very_short: 0, short: 1, medium: 2, long: 3 } as const;

/** A cute cartoon face drawn from the blueprint, instantly, for everyone. */
export function AvatarPreview({ b, outfitColor = '#5FB6EA', size = 220, label }: { b: VisualBlueprint; outfitColor?: string; size?: number; label: string }) {
  const hair = HAIR_HEX[b.hairColor];
  const skin = SKIN_HEX[b.skinTone];
  const eye = EYE_HEX[b.eyeColor];
  const len = LEN[b.hairLength];
  const covered = b.hairStyle === 'covered';
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label={label}>
      {/* Back hair (long styles) */}
      {!covered && len >= 2 ? <path d={`M40 90 Q35 ${150 + len * 12} 70 ${160 + len * 10} L130 ${160 + len * 10} Q165 ${150 + len * 12} 160 90 Z`} fill={hair} /> : null}
      {covered ? <path d="M38 100 Q30 40 100 28 Q170 40 162 100 L170 175 Q100 195 30 175 Z" fill="#9b8cd8" /> : null}
      {/* Body */}
      <path d="M45 220 Q50 168 100 165 Q150 168 155 220 Z" fill={outfitColor} />
      <rect x="88" y="145" width="24" height="24" rx="8" fill={skin} />
      {/* Head */}
      <ellipse cx="100" cy="100" rx="58" ry="60" fill={skin} />
      <ellipse cx="44" cy="106" rx="9" ry="13" fill={skin} />
      <ellipse cx="156" cy="106" rx="9" ry="13" fill={skin} />
      {/* Front hair */}
      {!covered ? (
        b.hairStyle === 'curly' || b.hairStyle === 'coily' ? (
          <g fill={hair}>
            {[46, 62, 80, 100, 120, 138, 154].map((x, i) => (
              <circle key={x} cx={x} cy={i % 2 ? 48 : 56} r={b.hairStyle === 'coily' ? 18 : 15} />
            ))}
          </g>
        ) : (
          <path d={len === 0 ? 'M48 78 Q60 36 100 36 Q140 36 152 78 Q120 60 100 62 Q80 60 48 78 Z' : 'M42 96 Q40 34 100 32 Q160 34 158 96 Q150 64 120 58 Q100 72 72 60 Q52 66 42 96 Z'} fill={hair} />
        )
      ) : (
        <path d="M44 82 Q48 36 100 34 Q152 36 156 82 Q130 58 100 58 Q70 58 44 82 Z" fill="#b5a8ec" />
      )}
      {!covered && b.hairStyle === 'ponytail' ? <path d="M150 70 Q190 90 170 150 Q160 110 145 92 Z" fill={hair} /> : null}
      {!covered && b.hairStyle === 'buns' ? (
        <g fill={hair}>
          <circle cx="52" cy="44" r="18" />
          <circle cx="148" cy="44" r="18" />
        </g>
      ) : null}
      {!covered && b.hairStyle === 'braids' ? (
        <g fill={hair}>
          {[0, 1, 2, 3].map((i) => (
            <ellipse key={`l${i}`} cx="46" cy={120 + i * 16} rx="9" ry="9" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <ellipse key={`r${i}`} cx="154" cy={120 + i * 16} rx="9" ry="9" />
          ))}
        </g>
      ) : null}
      {/* Face */}
      <g>
        <ellipse cx="78" cy="104" rx="9" ry="11" fill="#fff" />
        <ellipse cx="122" cy="104" rx="9" ry="11" fill="#fff" />
        <circle cx="79" cy="106" r="6" fill={eye} />
        <circle cx="123" cy="106" r="6" fill={eye} />
        <circle cx="81" cy="103" r="2" fill="#fff" />
        <circle cx="125" cy="103" r="2" fill="#fff" />
        <ellipse cx="66" cy="126" rx="9" ry="5" fill="#f28b9a" opacity="0.45" />
        <ellipse cx="134" cy="126" rx="9" ry="5" fill="#f28b9a" opacity="0.45" />
        <path d="M86 132 Q100 146 114 132" stroke="#5a2a2a" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
      {b.freckles ? (
        <g fill="#a0522d" opacity="0.6">
          {[[70, 118], [76, 122], [64, 121], [130, 118], [124, 122], [136, 121]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" />
          ))}
        </g>
      ) : null}
      {b.glasses ? (
        <g stroke="#2b2b3a" strokeWidth="3.5" fill="none">
          <circle cx="78" cy="105" r="15" />
          <circle cx="122" cy="105" r="15" />
          <path d="M93 104 L107 104" />
        </g>
      ) : null}
    </svg>
  );
}
