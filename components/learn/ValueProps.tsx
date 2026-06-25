import { BENEFIT_ICONS } from './benefit-icons';
import InlineRich from './InlineRich';
import type { BenefitItem } from '@/lib/learn/homepage';

/**
 * Benefit ("value props") cards grid. Pure presentational component shared by
 * the public homepage (app/page.tsx) and the admin Studio live preview, so the
 * admin sees exactly what renders. Data-driven from homepage_config — no
 * hardcoded list here.
 */
export default function ValueProps({ items }: { items: BenefitItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((v) => {
        const Icon = BENEFIT_ICONS[v.icon] ?? BENEFIT_ICONS.sparkles;
        return (
          <div
            key={v.key}
            className="bg-white rounded-card border border-neutral-200 p-6"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <span className="inline-flex w-11 h-11 rounded-pill bg-brand-purple-50 text-brand-purple-700 items-center justify-center mb-4">
              <Icon className="w-5 h-5" />
            </span>
            <h3 className="font-extrabold text-neutral-950 mb-1.5">{v.title}</h3>
            <p className="text-sm text-neutral-500 leading-relaxed">
              <InlineRich text={v.body} />
            </p>
          </div>
        );
      })}
    </div>
  );
}
