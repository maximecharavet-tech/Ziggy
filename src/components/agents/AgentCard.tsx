'use client';

import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { ArrowRight } from 'lucide-react';

interface AgentCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  index: number;
}

export function AgentCard({ id, name, description, icon, color, index }: AgentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Link href={`/agents/${id}` as '/agents/sales'}>
        <div className="group glass-strong rounded-2xl border border-border/50 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer h-full">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
            style={{ backgroundColor: `${color}15` }}
          >
            {icon}
          </div>
          <h3 className="text-lg font-bold text-text-body mb-2 group-hover:text-opacity-90 transition-colors" style={{ color }}>
            {name}
          </h3>
          <p className="text-sm text-text-muted leading-relaxed mb-4">
            {description}
          </p>
          <div className="flex items-center gap-1 text-xs font-semibold transition-all group-hover:gap-2" style={{ color }}>
            <span>Try now</span>
            <ArrowRight size={14} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
