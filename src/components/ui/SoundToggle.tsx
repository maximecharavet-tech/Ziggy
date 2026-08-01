'use client';

import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { useSound } from '@/hooks/useSound';

export function SoundToggle() {
  const { muted, toggleMute, play } = useSound();

  return (
    <button
      onClick={() => {
        if (muted) play('pop'); // preview the sound being turned back on
        toggleMute();
      }}
      className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:text-green hover:bg-green/10 transition-all"
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
    >
      <motion.span
        key={muted ? 'off' : 'on'}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex"
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </motion.span>
    </button>
  );
}
