interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div className={`bg-bg-card rounded-2xl border border-border p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${hover ? 'transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-green/30 hover:-translate-y-1' : ''} ${className}`}>
      {children}
    </div>
  );
}
