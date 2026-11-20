'use client';

import { useEffect, useRef } from 'react';
import { ConfettiCannon, type ConfettiCannonHandle } from './fx/ConfettiCannon';

/**
 * A burst of confetti for a win: two party cannons from the bottom corners
 * (paper, ribbons, stars, hearts and Ziggy's antenna balls). Same props as
 * before; now drawn on the shared canvas stage, so it is cheaper, lasts under
 * 2 s, never catches a tap, fades over buttons, pauses with the tab and does
 * not appear at all under reduced motion. Silent: the screen that shows it
 * already plays its win sound.
 */
export function Confetti({ trigger, count = 40 }: { trigger: boolean; count?: number }) {
  const cannon = useRef<ConfettiCannonHandle>(null);

  useEffect(() => {
    if (!trigger) cannon.current?.clear();
  }, [trigger]);

  // Canvas pieces are cheap: a little more paper than the old DOM version (the stage still caps it).
  return <ConfettiCannon ref={cannon} fire={trigger} mode="party" count={Math.round(count * 1.5)} sound={false} />;
}
