'use client';

import { Shield, Lock, Globe, Award } from 'lucide-react';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

const badges = [
  { icon: Shield, label: 'GDPR Compliant', color: 'text-green' },
  { icon: Lock, label: 'End-to-End Encrypted', color: 'text-blue' },
  { icon: Globe, label: 'EU Data Hosting', color: 'text-purple' },
  { icon: Award, label: 'COPPA Certified', color: 'text-yellow' },
];

export function TrustBar() {
  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 border-y border-border/30">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal variant="fade">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {badges.map((badge) => (
              <div key={badge.label} className="flex items-center gap-2 text-sm text-text-muted">
                <badge.icon size={18} className={badge.color} />
                <span className="font-medium">{badge.label}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
