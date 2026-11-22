interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Small green label ("Recommended", "Save 20%"). Opaque, so it can sit across a
 * card's border, and AA: #166534 on #E0F5E9 is 6.2:1 (was #22C55E on green/10,
 * 2.0:1); dark: #4ADE80 on #0E2624, 9:1.
 */
export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-[#E0F5E9] text-[#166534] dark:bg-[#0E2624] dark:text-green-light ${className}`}>
      {children}
    </span>
  );
}
