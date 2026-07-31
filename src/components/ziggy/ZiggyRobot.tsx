'use client';

import { useMousePosition } from '@/hooks/useMousePosition';

interface ZiggyRobotProps {
  size?: number;
  className?: string;
  /** Show the full body (arms, legs, heart). When false, only the head is drawn. */
  fullBody?: boolean;
  /** Open, cheering mouth instead of the calm smile. */
  excited?: boolean;
}

/**
 * Ziggy - the plush robot mascot.
 * Soft felt body, glowing heart core, coiled limbs, eyes that follow the cursor.
 */
export function ZiggyRobot({
  size = 200,
  className = '',
  fullBody = true,
  excited = false,
}: ZiggyRobotProps) {
  const { normalizedX, normalizedY } = useMousePosition();
  const px = normalizedX * 5;
  const py = normalizedY * 3.5;

  const height = fullBody ? size * 1.3 : size;
  const viewBox = fullBody ? '0 0 200 260' : '10 20 180 130';

  return (
    <svg
      width={size}
      height={height}
      viewBox={viewBox}
      className={className}
      role="img"
      aria-label="Ziggy the friendly robot"
    >
      <defs>
        <radialGradient id="zg-felt" cx="42%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#A3DE7B" />
          <stop offset="45%" stopColor="#7FC85C" />
          <stop offset="100%" stopColor="#5AA83E" />
        </radialGradient>
        <radialGradient id="zg-felt-body" cx="45%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#9AD873" />
          <stop offset="55%" stopColor="#76C154" />
          <stop offset="100%" stopColor="#519B37" />
        </radialGradient>
        <radialGradient id="zg-felt-soft" cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#8FD167" />
          <stop offset="100%" stopColor="#63B045" />
        </radialGradient>

        <radialGradient id="zg-warm" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE08A" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFE08A" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="zg-heart" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#FFFDF0" />
          <stop offset="40%" stopColor="#FFE87A" />
          <stop offset="100%" stopColor="#FFB938" />
        </radialGradient>
        <filter id="zg-heart-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id="zg-iris" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#8FD167" />
          <stop offset="70%" stopColor="#4F9E33" />
          <stop offset="100%" stopColor="#2F6B1C" />
        </radialGradient>

        <linearGradient id="zg-metal" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8A9199" />
          <stop offset="35%" stopColor="#C7CDD3" />
          <stop offset="100%" stopColor="#79808A" />
        </linearGradient>

        <filter id="zg-fabric">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="d" />
          <feComposite in="d" in2="SourceGraphic" operator="in" result="tex" />
          <feBlend in="SourceGraphic" in2="tex" mode="multiply" />
        </filter>

        <filter id="zg-shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#2F6B1C" floodOpacity="0.22" />
        </filter>
      </defs>

      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-2.5 100 60; 2.5 100 60; -2.5 100 60"
          dur="4s"
          repeatCount="indefinite"
        />
        <path d="M 78 42 C 70 30 64 22 62 14" stroke="#6DBF4C" strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="61" cy="12" r="9" fill="url(#zg-felt-soft)" />
        <circle cx="58" cy="9" r="3" fill="#B9E89A" opacity="0.6" />

        <path d="M 122 42 C 130 30 136 22 138 14" stroke="#6DBF4C" strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="139" cy="12" r="9" fill="url(#zg-felt-soft)" />
        <circle cx="136" cy="9" r="3" fill="#B9E89A" opacity="0.6" />
      </g>

      <g filter="url(#zg-shadow)">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 0,-5; 0,0"
          dur="4s"
          repeatCount="indefinite"
        />

        {fullBody && (
          <>
            <g>
              {[0, 1, 2, 3].map((i) => (
                <rect
                  key={`la-${i}`}
                  x={34 - i * 3}
                  y={172 + i * 9}
                  width="17"
                  height="8"
                  rx="4"
                  fill="url(#zg-metal)"
                />
              ))}
              <ellipse cx="29" cy="214" rx="13" ry="15" fill="url(#zg-felt-soft)" transform="rotate(-16 29 214)" />

              {[0, 1, 2, 3].map((i) => (
                <rect
                  key={`ra-${i}`}
                  x={149 + i * 3}
                  y={172 + i * 9}
                  width="17"
                  height="8"
                  rx="4"
                  fill="url(#zg-metal)"
                />
              ))}
              <ellipse cx="171" cy="214" rx="13" ry="15" fill="url(#zg-felt-soft)" transform="rotate(16 171 214)" />
            </g>

            <g>
              {[0, 1, 2].map((i) => (
                <rect key={`ll-${i}`} x="72" y={216 + i * 9} width="18" height="8" rx="4" fill="url(#zg-metal)" />
              ))}
              <ellipse cx="78" cy="250" rx="19" ry="11" fill="url(#zg-felt-soft)" />

              {[0, 1, 2].map((i) => (
                <rect key={`rl-${i}`} x="110" y={216 + i * 9} width="18" height="8" rx="4" fill="url(#zg-metal)" />
              ))}
              <ellipse cx="122" cy="250" rx="19" ry="11" fill="url(#zg-felt-soft)" />
            </g>

            <ellipse cx="100" cy="180" rx="56" ry="48" fill="url(#zg-felt-body)" filter="url(#zg-fabric)" />
            <path d="M 100 134 L 100 226" stroke="#4F9E33" strokeWidth="1.2" opacity="0.3" />

            <g filter="url(#zg-heart-glow)">
              <path
                d="M 100 200 C 84 186 76 178 76 169 C 76 162 82 157 89 157 C 94 157 98 160 100 164 C 102 160 106 157 111 157 C 118 157 124 162 124 169 C 124 178 116 186 100 200 Z"
                fill="url(#zg-heart)"
                stroke="#F59E0B"
                strokeWidth="2"
              >
                <animate attributeName="opacity" values="0.85;1;0.85" dur="2.4s" repeatCount="indefinite" />
              </path>
            </g>
          </>
        )}

        <ellipse cx="100" cy="88" rx="66" ry="60" fill="url(#zg-felt)" filter="url(#zg-fabric)" />

        <ellipse cx="34" cy="90" rx="13" ry="19" fill="url(#zg-felt-soft)" />
        <ellipse cx="166" cy="90" rx="13" ry="19" fill="url(#zg-felt-soft)" />

        <path d="M 100 28 C 100 40 100 44 100 48" stroke="#4F9E33" strokeWidth="1.2" opacity="0.35" fill="none" />

        {fullBody && <ellipse cx="100" cy="132" rx="40" ry="16" fill="url(#zg-warm)" />}

        <path d="M 56 54 C 62 48 74 47 80 51" stroke="#1F2937" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M 120 51 C 126 47 138 48 144 54" stroke="#1F2937" strokeWidth="4.5" strokeLinecap="round" fill="none" />

        <g>
          <ellipse cx="72" cy="84" rx="21" ry="23" fill="#FFFFFF" />
          <ellipse cx="72" cy="84" rx="21" ry="23" fill="none" stroke="#E2E8F0" strokeWidth="1" />
          <g>
            <animate
              attributeName="opacity"
              values="1;1;0;0;1;1"
              keyTimes="0;0.45;0.475;0.5;0.525;1"
              dur="5.5s"
              repeatCount="indefinite"
            />
            <circle cx={72 + px} cy={84 + py} r="14" fill="url(#zg-iris)" />
            <circle cx={72 + px} cy={84 + py} r="8" fill="#12100E" />
            <circle cx={72 + px - 4} cy={84 + py - 5} r="3.6" fill="#FFFFFF" />
            <circle cx={72 + px + 4} cy={84 + py + 4} r="1.8" fill="#FFFFFF" opacity="0.65" />
          </g>
          <path d="M 54 68 L 49 62" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
          <path d="M 59 63 L 56 56" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
          <path d="M 66 61 L 65 54" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />

          <ellipse cx="128" cy="84" rx="21" ry="23" fill="#FFFFFF" />
          <ellipse cx="128" cy="84" rx="21" ry="23" fill="none" stroke="#E2E8F0" strokeWidth="1" />
          <g>
            <animate
              attributeName="opacity"
              values="1;1;0;0;1;1"
              keyTimes="0;0.45;0.475;0.5;0.525;1"
              dur="5.5s"
              repeatCount="indefinite"
            />
            <circle cx={128 + px} cy={84 + py} r="14" fill="url(#zg-iris)" />
            <circle cx={128 + px} cy={84 + py} r="8" fill="#12100E" />
            <circle cx={128 + px - 4} cy={84 + py - 5} r="3.6" fill="#FFFFFF" />
            <circle cx={128 + px + 4} cy={84 + py + 4} r="1.8" fill="#FFFFFF" opacity="0.65" />
          </g>
          <path d="M 146 68 L 151 62" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
          <path d="M 141 63 L 144 56" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
          <path d="M 134 61 L 135 54" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
        </g>

        <ellipse cx="48" cy="106" rx="12" ry="8" fill="#F9A8D4" opacity="0.4" />
        <ellipse cx="152" cy="106" rx="12" ry="8" fill="#F9A8D4" opacity="0.4" />

        {excited ? (
          <g>
            <path d="M 82 112 Q 100 136 118 112 Q 100 118 82 112 Z" fill="#3B1220" />
            <path d="M 89 116 Q 100 128 111 116 Q 100 120 89 116 Z" fill="#E8607F" />
            <rect x="90" y="111" width="8" height="5" rx="1.6" fill="#FFFFFF" />
            <rect x="102" y="111" width="8" height="5" rx="1.6" fill="#FFFFFF" />
          </g>
        ) : (
          <path
            d="M 84 112 Q 100 126 116 112"
            stroke="#1F2937"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>
    </svg>
  );
}
