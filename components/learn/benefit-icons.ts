import {
  Compass, Users, Sparkles, Rocket, Target, Zap, Shield, Heart,
  Star, BookOpen, GraduationCap, Trophy, Lightbulb, Clock, CheckCircle, TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { BenefitIconKey } from '@/lib/learn/homepage';

/**
 * Curated allowlist of icons an admin can pick for a benefit card.
 * The KEYS live in lib/learn/homepage.ts (pure validator, no lucide import);
 * this map binds each key to a concrete lucide component for rendering.
 * Shared by the public homepage and the admin Studio so both stay in sync.
 */
export const BENEFIT_ICONS: Record<BenefitIconKey, LucideIcon> = {
  compass: Compass,
  users: Users,
  sparkles: Sparkles,
  rocket: Rocket,
  target: Target,
  zap: Zap,
  shield: Shield,
  heart: Heart,
  star: Star,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  trophy: Trophy,
  lightbulb: Lightbulb,
  clock: Clock,
  'check-circle': CheckCircle,
  'trending-up': TrendingUp,
};
