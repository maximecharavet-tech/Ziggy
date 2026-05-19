'use client';

import { useMousePosition } from '@/hooks/useMousePosition';

interface ZiggyRobotProps {
  size?: number;
  className?: string;
}

export function ZiggyRobot({ size = 200, className = '' }: ZiggyRobotProps) {
  const { normalizedX, normalizedY } = useMousePosition();
  const pupilOffsetX = normalizedX * 6;
  const pupilOffsetY = normalizedY * 4;

  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 200 240" className={className} aria-label="Ziggy the robot">
      <defs>
        <radialGradient id="bodyGradient" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#F5F7FA" />
          <stop offset="100%" stopColor="#E8ECEF" />
        </radialGradient>
        <filter id="greenGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="softShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.1" />
        </filter>
      </defs>
      <g>
        <line x1="75" y1="50" x2="65" y2="15" stroke="#B0B8C0" strokeWidth="2.5" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" values="-3 75 50;3 75 50;-3 75 50" dur="2s" repeatCount="indefinite" />
        </line>
        <circle cx="65" cy="15" r="7" fill="#4ADE80" filter="url(#greenGlow)">
          <animateTransform attributeName="transform" type="rotate" values="-3 75 50;3 75 50;-3 75 50" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <line x1="125" y1="50" x2="135" y2="15" stroke="#B0B8C0" strokeWidth="2.5" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" values="3 125 50;-3 125 50;3 125 50" dur="2s" repeatCount="indefinite" />
        </line>
        <circle cx="135" cy="15" r="7" fill="#4ADE80" filter="url(#greenGlow)">
          <animateTransform attributeName="transform" type="rotate" values="3 125 50;-3 125 50;3 125 50" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" />
        </circle>
      </g>
      <g filter="url(#softShadow)">
        <animateTransform attributeName="transform" type="translate" values="0,0;0,-6;0,0" dur="3s" repeatCount="indefinite" />
        <ellipse cx="100" cy="130" rx="65" ry="75" fill="url(#bodyGradient)" stroke="#D1D5DB" strokeWidth="1" />
        <ellipse cx="28" cy="130" rx="12" ry="18" fill="#F5F7FA" stroke="#D1D5DB" strokeWidth="1" />
        <ellipse cx="172" cy="130" rx="12" ry="18" fill="#F5F7FA" stroke="#D1D5DB" strokeWidth="1" />
        <rect x="70" y="165" width="60" height="3" rx="1.5" fill="#22C55E" opacity="0.6" />
        <rect x="78" y="172" width="44" height="2" rx="1" fill="#22C55E" opacity="0.4" />
        <ellipse cx="78" cy="110" rx="18" ry="20" fill="white" stroke="#D1D5DB" strokeWidth="0.5" />
        <ellipse cx="122" cy="110" rx="18" ry="20" fill="white" stroke="#D1D5DB" strokeWidth="0.5" />
        <circle cx={78 + pupilOffsetX} cy={110 + pupilOffsetY} r="8" fill="#22C55E">
          <animate attributeName="r" values="8;8;1;1;8;8" keyTimes="0;0.45;0.48;0.52;0.55;1" dur="5s" repeatCount="indefinite" />
        </circle>
        <circle cx={78 + pupilOffsetX - 2} cy={110 + pupilOffsetY - 3} r="2.5" fill="white" opacity="0.9" />
        <circle cx={122 + pupilOffsetX} cy={110 + pupilOffsetY} r="8" fill="#22C55E">
          <animate attributeName="r" values="8;8;1;1;8;8" keyTimes="0;0.45;0.48;0.52;0.55;1" dur="5s" repeatCount="indefinite" />
        </circle>
        <circle cx={122 + pupilOffsetX - 2} cy={110 + pupilOffsetY - 3} r="2.5" fill="white" opacity="0.9" />
        <circle cx="60" cy="130" r="10" fill="#F9A8D4" opacity="0.3" />
        <circle cx="140" cy="130" r="10" fill="#F9A8D4" opacity="0.3" />
        <path d="M 88 142 Q 100 154 112 142" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
