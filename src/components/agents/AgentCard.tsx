'use client';

import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { AgentAvatar } from './AgentAvatar';

interface AgentCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  index: number;
}

export function AgentCard({ id, name, description, color, index }: AgentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: 'easeOut' }}
      className="h-full"
    >
      <Link href={`/agents/${id}` as '/agents/sales'} className="block h-full group">
        <div
          className="relative h-full rounded-2xl p-[1.5px] transition-all duration-300 group-hover:-translate-y-1.5"
          style={{
            background: `linear-gradient(160deg, ${color}30, transparent 40%, transparent 60%, ${color}20)`,
          }}
        >
          <div
            className="relative h-full glass-strong rounded-2xl border border-border/50 p-6 overflow-hidden transition-shadow duration-300 group-hover:shadow-xl"
            style={{ ['--agent-glow' as string]: `${color}18` }}
          >
            {/* Hover glow */}
            <div
              className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: `radial-gradient(circle, ${color}25 0%, transparent 70%)` }}
            />

            <div className="flex items-start justify-between mb-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
                style={{ backgroundColor: `${color}12` }}
              >
                <AgentAvatar agentId={id} color={color} size={52} />
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0"
                style={{ backgroundColor: `${color}15` }}
              >
                <MessageCircle size={14} style={{ color }} />
              </div>
            </div>

            <h3 className="text-lg font-extrabold mb-2 tracking-tight" style={{ color }}>
              {name}
            </h3>
            <p className="text-sm text-text-muted leading-relaxed mb-5">
              {description}
            </p>
            <div
              className="inline-flex items-center gap-1.5 text-xs font-bold transition-all duration-300 group-hover:gap-2.5"
              style={{ color }}
            >
              <span>Try now</span>
              <ArrowRight size={14} className="rtl:rotate-180" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
