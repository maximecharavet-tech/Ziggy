interface AgentAvatarProps {
  agentId: string;
  color: string;
  size?: number;
  className?: string;
}

/**
 * Unique SVG robot avatar per agent. Each shares Ziggy's DNA (rounded head,
 * glowing eyes, antenna) but carries a profession-specific accessory.
 */
export function AgentAvatar({ agentId, color, size = 64, className = '' }: AgentAvatarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`head-${agentId}`} cx="50%" cy="35%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E8ECEF" />
        </radialGradient>
      </defs>

      {/* Antenna */}
      <line x1="32" y1="12" x2="32" y2="6" stroke="#B0B8C0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3" fill={color}>
        <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Head */}
      <rect x="12" y="12" width="40" height="36" rx="14" fill={`url(#head-${agentId})`} stroke="#D1D5DB" strokeWidth="1" />

      {/* Ears */}
      <rect x="8" y="24" width="5" height="12" rx="2.5" fill={color} opacity="0.85" />
      <rect x="51" y="24" width="5" height="12" rx="2.5" fill={color} opacity="0.85" />

      {/* Eyes */}
      <circle cx="24" cy="28" r="5" fill={color}>
        <animate attributeName="r" values="5;5;1;5;5" keyTimes="0;0.46;0.5;0.54;1" dur="4.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="40" cy="28" r="5" fill={color}>
        <animate attributeName="r" values="5;5;1;5;5" keyTimes="0;0.46;0.5;0.54;1" dur="4.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="22.5" cy="26.5" r="1.5" fill="white" opacity="0.9" />
      <circle cx="38.5" cy="26.5" r="1.5" fill="white" opacity="0.9" />

      {/* Smile */}
      <path d="M 26 38 Q 32 43 38 38" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Profession accessory */}
      {agentId === 'sales' && (
        // Scout: necktie
        <g>
          <path d="M 32 48 L 28 52 L 32 62 L 36 52 Z" fill={color} />
          <path d="M 29 48 L 35 48 L 32 52 Z" fill={color} opacity="0.7" />
        </g>
      )}
      {agentId === 'marketing' && (
        // Pixel: pixel-frame glasses
        <g stroke={color} strokeWidth="2.5" fill="none">
          <rect x="17" y="22" width="14" height="12" rx="2" />
          <rect x="33" y="22" width="14" height="12" rx="2" />
          <line x1="31" y1="28" x2="33" y2="28" />
        </g>
      )}
      {agentId === 'finance' && (
        // Penny: coin held above head
        <g>
          <circle cx="49" cy="10" r="7" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" />
          <text x="49" y="13.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#92400E">€</text>
        </g>
      )}
      {agentId === 'accounting' && (
        // Tally: bow tie + tally marks on forehead
        <g>
          <path d="M 24 52 L 32 55 L 24 58 Z" fill={color} />
          <path d="M 40 52 L 32 55 L 40 58 Z" fill={color} />
          <circle cx="32" cy="55" r="2" fill={color} opacity="0.7" />
          <g stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5">
            <line x1="27" y1="16" x2="27" y2="20" />
            <line x1="31" y1="16" x2="31" y2="20" />
            <line x1="35" y1="16" x2="35" y2="20" />
          </g>
        </g>
      )}
      {agentId === 'advertising' && (
        // Spark: beret + paint splash
        <g>
          <path d="M 14 16 Q 32 4 50 16 Q 42 12 32 12 Q 22 12 14 16 Z" fill={color} />
          <circle cx="44" cy="9" r="2.5" fill={color} />
          <circle cx="52" cy="42" r="2" fill={color} opacity="0.6" />
          <circle cx="55" cy="47" r="1.3" fill={color} opacity="0.4" />
        </g>
      )}
    </svg>
  );
}
