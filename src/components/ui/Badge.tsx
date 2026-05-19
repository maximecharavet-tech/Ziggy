interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-green/10 text-green ${className}`}>
      {children}
    </span>
  );
}
