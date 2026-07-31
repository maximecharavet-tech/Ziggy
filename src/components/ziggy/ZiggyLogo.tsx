interface ZiggyLogoProps {
  size?: number;
  className?: string;
  /** Draw the soft peach blob behind the letters (hero use). */
  withBlob?: boolean;
}

/** x is the glyph centre, hand-tuned so the narrow I doesn't leave gaps. */
const LETTERS = [
  { char: 'Z', x: 34, fill: '#F2647B', shade: '#C93E56' },
  { char: 'I', x: 75, fill: '#F9A8C4', shade: '#D97AA0' },
  { char: 'G', x: 120, fill: '#7FC85C', shade: '#559B3A' },
  { char: 'G', x: 182, fill: '#5FB6EA', shade: '#3A8CC0' },
  { char: 'Y', x: 241, fill: '#4FC9C0', shade: '#2E9E96' },
];

/**
 * The ZIGGY wordmark — puffy modelling-clay letters, each in its own colour.
 */
export function ZiggyLogo({ size = 160, className = '', withBlob = false }: ZiggyLogoProps) {
  const height = size * (withBlob ? 0.565 : 0.37);

  return (
    <svg
      width={size}
      height={height}
      viewBox={withBlob ? '0 0 276 156' : '0 0 276 102'}
      className={className}
      role="img"
      aria-label="Ziggy"
    >
      <defs>
        <radialGradient id="zl-blob" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#FFD9A0" />
          <stop offset="100%" stopColor="#F9BE7C" />
        </radialGradient>
        <filter id="zl-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#8A5A2B" floodOpacity="0.18" />
        </filter>
      </defs>

      {withBlob && (
        <>
          <ellipse cx="138" cy="80" rx="134" ry="72" fill="#FBC9C4" opacity="0.55" />
          <ellipse cx="138" cy="70" rx="122" ry="60" fill="url(#zl-blob)" />
        </>
      )}

      <g
        fontFamily="var(--font-sans), ui-rounded, system-ui, sans-serif"
        fontSize="76"
        fontWeight="900"
        textAnchor="middle"
        filter="url(#zl-soft)"
      >
        {LETTERS.map((l, i) => {
          const x = l.x;
          const y = withBlob ? 96 : 76;
          return (
            <g key={i}>
              {/* Extruded underside */}
              <text x={x} y={y + 4} fill={l.shade}>
                {l.char}
              </text>
              {/* Face with a soft outline for the puffy clay edge */}
              <text
                x={x}
                y={y}
                fill={l.fill}
                stroke={l.shade}
                strokeWidth="2.5"
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {l.char}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
