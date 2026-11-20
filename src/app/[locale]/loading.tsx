import { ZiggyWait } from '@/components/sections/magic/ZiggyWait';

/**
 * While a page wakes up: Ziggy waits with the child. The box is a full screen
 * tall so the footer stays below the fold until the page arrives (it used to
 * sit at 80vh and jump away — a 0.2 layout shift on large screens), and Ziggy
 * only fades in after a moment, so a fast load shows nothing at all.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4">
      <ZiggyWait late={700} size="lg" />
    </div>
  );
}
