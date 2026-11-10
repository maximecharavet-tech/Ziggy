'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';

type State = { error: Error | null; tries: number };

/**
 * Keeps an error in the call (an audio, camera or speech API that throws on
 * some phone) from blanking the whole page: the child sees a friendly "line
 * trouble" card with a retry and a way back to the village.
 */
export class SantaCallBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, tries: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[santa-call] crashed', error, info.componentStack);
  }

  retry = () => this.setState((s) => ({ error: null, tries: s.tries + 1 }));

  render() {
    if (this.state.error) return <CallTrouble onRetry={this.retry} />;
    // A new key on retry remounts the call from scratch.
    return <div key={this.state.tries} className="contents">{this.props.children}</div>;
  }
}

function CallTrouble({ onRetry }: { onRetry: () => void }) {
  const fr = useLocale() === 'fr';
  return (
    <section role="alert" className="mx-auto mt-10 max-w-md rounded-3xl border border-amber-100/25 bg-[#fff8e8] p-7 text-center text-[#34253c] shadow-xl">
      <p className="text-5xl" aria-hidden="true">
        🎅📞
      </p>
      <h1 className="mt-4 font-display text-2xl font-bold">{fr ? 'Oh oh… la ligne du Pôle Nord grésille !' : 'Oh oh… the North Pole line is crackling!'}</h1>
      <p className="mt-3 text-base text-[#34253c]/80">{fr ? 'Le Père Noël n’a pas pu décrocher. On réessaie ?' : 'Santa couldn’t pick up. Shall we try again?'}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onRetry} className="rounded-full bg-[#9d3640] px-6 py-3 font-bold text-white">
          {fr ? 'Réessayer' : 'Try again'}
        </button>
        <Link href="/pere-noel" className="rounded-full bg-[#28214d] px-6 py-3 font-semibold text-white">
          {fr ? 'Retour au village' : 'Back to the village'}
        </Link>
      </div>
    </section>
  );
}
