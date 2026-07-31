interface AgentAvatarProps {
  agentId: string;
  color: string;
  size?: number;
  className?: string;
}

/**
 * Ziggy's friends — same plush green DNA as the mascot, each wearing the
 * gear of their profession and accented in their own colour.
 */
export function AgentAvatar({ agentId, color, size = 64, className = '' }: AgentAvatarProps) {
  const uid = `av-${agentId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${uid}-felt`} cx="42%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#A3DE7B" />
          <stop offset="50%" stopColor="#7FC85C" />
          <stop offset="100%" stopColor="#5AA83E" />
        </radialGradient>
        <radialGradient id={`${uid}-soft`} cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#8FD167" />
          <stop offset="100%" stopColor="#63B045" />
        </radialGradient>
        <radialGradient id={`${uid}-iris`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={color} stopOpacity="0.75" />
          <stop offset="100%" stopColor={color} />
        </radialGradient>
      </defs>

      {/* Antennae — tipped in the agent's colour */}
      <path d="M23 14 C20 10 18.5 8 18 6" stroke="#6DBF4C" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="17.5" cy="5" r="3.4" fill={color}>
        <animate attributeName="opacity" values="0.65;1;0.65" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <path d="M41 14 C44 10 45.5 8 46 6" stroke="#6DBF4C" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="46.5" cy="5" r="3.4" fill={color}>
        <animate attributeName="opacity" values="1;0.65;1" dur="2.4s" repeatCount="indefinite" />
      </circle>

      {/* Ear discs */}
      <ellipse cx="8" cy="32" rx="4.6" ry="7" fill={`url(#${uid}-soft)`} />
      <ellipse cx="56" cy="32" rx="4.6" ry="7" fill={`url(#${uid}-soft)`} />

      {/* Head */}
      <ellipse cx="32" cy="31" rx="24" ry="21" fill={`url(#${uid}-felt)`} />

      {/* Eyebrows */}
      <path d="M18 22.5 C20 19.8 24.5 19.4 26.5 21.2" stroke="#1F2937" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M37.5 21.2 C39.5 19.4 44 19.8 46 22.5" stroke="#1F2937" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* Eyes */}
      <ellipse cx="23" cy="31" rx="7.6" ry="8.4" fill="#FFFFFF" />
      <ellipse cx="41" cy="31" rx="7.6" ry="8.4" fill="#FFFFFF" />
      <circle cx="23" cy="31" r="5.1" fill={`url(#${uid}-iris)`}>
        <animate attributeName="r" values="5.1;5.1;0.6;5.1;5.1" keyTimes="0;0.45;0.5;0.55;1" dur="5s" repeatCount="indefinite" />
      </circle>
      <circle cx="41" cy="31" r="5.1" fill={`url(#${uid}-iris)`}>
        <animate attributeName="r" values="5.1;5.1;0.6;5.1;5.1" keyTimes="0;0.45;0.5;0.55;1" dur="5s" repeatCount="indefinite" />
      </circle>
      <circle cx="23" cy="31" r="2.9" fill="#12100E" />
      <circle cx="41" cy="31" r="2.9" fill="#12100E" />
      <circle cx="21.6" cy="29.3" r="1.4" fill="#FFFFFF" />
      <circle cx="39.6" cy="29.3" r="1.4" fill="#FFFFFF" />

      {/* Blush + smile */}
      <ellipse cx="13.5" cy="38" rx="4.2" ry="2.8" fill="#F9A8D4" opacity="0.42" />
      <ellipse cx="50.5" cy="38" rx="4.2" ry="2.8" fill="#F9A8D4" opacity="0.42" />
      <path d="M26.5 40 Q32 45 37.5 40" stroke="#1F2937" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* ── Profession gear ── */}
      {agentId === 'sales' && (
        <g>
          <path d="M28.5 52 L32 55.5 L35.5 52 L32 50 Z" fill={color} />
          <path d="M32 55.5 L29.5 64 L32 62 L34.5 64 Z" fill={color} />
        </g>
      )}

      {agentId === 'marketing' && (
        <g stroke={color} strokeWidth="2.2" fill="none">
          <rect x="14.5" y="24.5" width="17" height="13" rx="3.5" />
          <rect x="32.5" y="24.5" width="17" height="13" rx="3.5" />
          <line x1="31.5" y1="31" x2="32.5" y2="31" />
        </g>
      )}

      {agentId === 'finance' && (
        <g>
          <circle cx="50" cy="12" r="7.5" fill="#FBBF24" stroke="#D97706" strokeWidth="1.6" />
          <text x="50" y="16" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#8A5A0B">€</text>
        </g>
      )}

      {agentId === 'accounting' && (
        <g>
          <path d="M23 52 L31 55 L23 58 Z" fill={color} />
          <path d="M41 52 L33 55 L41 58 Z" fill={color} />
          <circle cx="32" cy="55" r="2.4" fill={color} />
          <g stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
            <line x1="27" y1="14" x2="27" y2="18" />
            <line x1="31" y1="14" x2="31" y2="18" />
            <line x1="35" y1="14" x2="35" y2="18" />
            <line x1="25.5" y1="18.5" x2="36.5" y2="13.5" />
          </g>
        </g>
      )}

      {agentId === 'advertising' && (
        <g>
          <path d="M11 17 Q32 3 53 17 Q43 11 32 11 Q21 11 11 17 Z" fill={color} />
          <circle cx="46" cy="9.5" r="3" fill={color} />
          <circle cx="55" cy="45" r="2.2" fill={color} opacity="0.6" />
          <circle cx="58" cy="50" r="1.4" fill={color} opacity="0.4" />
        </g>
      )}
    </svg>
  );
}
