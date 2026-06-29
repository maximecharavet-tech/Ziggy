export default function Loading() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-green/10 flex items-center justify-center mx-auto mb-4 animate-float">
          <svg width="32" height="32" viewBox="0 0 64 64" className="text-green">
            <rect x="8" y="16" width="48" height="40" rx="12" fill="currentColor" opacity="0.2" />
            <circle cx="24" cy="34" r="5" fill="currentColor" />
            <circle cx="40" cy="34" r="5" fill="currentColor" />
            <path d="M 26 46 Q 32 52 38 46" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <span className="w-2 h-2 bg-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-sm text-text-muted mt-3">Ziggy is getting ready...</p>
      </div>
    </div>
  );
}
