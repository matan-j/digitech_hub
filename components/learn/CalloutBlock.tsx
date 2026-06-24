import { Lightbulb, AlertTriangle, Sparkles, Zap, XCircle, Info, CheckCircle2 } from 'lucide-react';
import type { CalloutVariant } from '@/lib/learn/rich-content';

type Meta = { label: string; cls: string; Icon: typeof Lightbulb };

// Tones drawn from the approved Digitech palette (purple / teal / amber /
// signal-mint / danger). No gradients, no decorative glow.
const META: Record<CalloutVariant, Meta> = {
  tip:       { label: 'טיפ חשוב',     cls: 'callout--tip',       Icon: Lightbulb },
  attention: { label: 'שימו לב',       cls: 'callout--attention', Icon: AlertTriangle },
  example:   { label: 'דוגמה',         cls: 'callout--example',   Icon: Sparkles },
  action:    { label: 'פעולה לביצוע',  cls: 'callout--action',    Icon: Zap },
  mistake:   { label: 'טעות נפוצה',    cls: 'callout--mistake',   Icon: XCircle },
  info:      { label: 'מידע',          cls: 'callout--tip',       Icon: Info },
  success:   { label: 'הצלחה',         cls: 'callout--action',    Icon: CheckCircle2 },
  warning:   { label: 'שימו לב',       cls: 'callout--attention', Icon: AlertTriangle },
};

/** Reusable callout box used in guides and lessons. */
export default function CalloutBlock({
  variant,
  children,
}: {
  variant: CalloutVariant;
  children: React.ReactNode;
}) {
  const meta = META[variant] ?? META.info;
  const Icon = meta.Icon;
  return (
    <div className={`callout ${meta.cls}`} dir="rtl">
      <div className="callout__head">
        <Icon className="w-4 h-4 shrink-0" aria-hidden />
        <span className="callout__label">{meta.label}</span>
      </div>
      <div className="callout__body">{children}</div>
    </div>
  );
}
