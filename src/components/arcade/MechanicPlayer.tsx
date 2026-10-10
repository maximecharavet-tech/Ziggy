'use client';

import dynamic from 'next/dynamic';
import type { MechanicProps } from '@/lib/arcade/types';
import { ChoiceMechanic } from './mechanics/ChoiceMechanic';
import { PairsMechanic } from './mechanics/PairsMechanic';
import { OrderMechanic } from './mechanics/OrderMechanic';
import { SortMechanic } from './mechanics/SortMechanic';
import { SpellMechanic } from './mechanics/SpellMechanic';
import { MixMechanic } from './mechanics/MixMechanic';
import { DigMechanic } from './mechanics/DigMechanic';
import { MelodyMechanic } from './mechanics/MelodyMechanic';
import { SlideMechanic } from './mechanics/SlideMechanic';

/** Phaser is heavy and browser-only: it only loads for runner games. */
const RunnerMechanic = dynamic(() => import('./mechanics/RunnerMechanic').then((m) => m.RunnerMechanic), {
  ssr: false,
  loading: () => <RunnerLoading />,
});

function RunnerLoading() {
  return (
    <div className="w-full min-h-[420px] rounded-3xl border border-border/60 bg-bg-card flex items-center justify-center" aria-busy="true">
      <span className="text-5xl animate-pulse" aria-hidden="true">
        👟
      </span>
    </div>
  );
}

/** Plays any arcade game: picks the mechanic from the content's kind. */
export function MechanicPlayer(props: MechanicProps) {
  switch (props.content.kind) {
    case 'choice':
      return <ChoiceMechanic {...props} />;
    case 'runner':
      return <RunnerMechanic {...props} />;
    case 'pairs':
      return <PairsMechanic {...props} />;
    case 'order':
      return <OrderMechanic {...props} />;
    case 'sort':
      return <SortMechanic {...props} />;
    case 'spell':
      return <SpellMechanic {...props} />;
    case 'mix':
      return <MixMechanic {...props} />;
    case 'dig':
      return <DigMechanic {...props} />;
    case 'melody':
      return <MelodyMechanic {...props} />;
    case 'slide':
      return <SlideMechanic {...props} />;
    default: {
      const _never: never = props.content;
      return _never;
    }
  }
}
