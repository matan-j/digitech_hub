import type { GuideBlock } from '@/lib/learn/types';
import RichContentRenderer from './RichContentRenderer';

/**
 * Thin back-compat wrapper. Guide bodies now render through the shared
 * RichContentRenderer (semantic HTML, callouts, prompt blocks, etc.).
 */
export default function GuideBlocks({ blocks }: { blocks: GuideBlock[] }) {
  return <RichContentRenderer content={blocks} emptyLabel="הדרכה זו עוד ריקה." />;
}
