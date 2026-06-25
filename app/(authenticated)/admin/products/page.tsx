import Link from 'next/link';
import { listContent } from '@/lib/learn/db';
import { Plus, Package } from 'lucide-react';

export const metadata = { title: 'מוצרים — Digitech Learning Hub' };
export const dynamic = 'force-dynamic';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const CURRENCY_SYMBOL: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' };

function priceLabel(price: number | null, sale: number | null, currency: string) {
  const sym = CURRENCY_SYMBOL[currency] ?? '₪';
  if (price == null) return '—';
  const hasSale = sale != null && sale > 0 && sale < price;
  const final = hasSale ? sale! : price;
  return `${sym}${final % 1 === 0 ? final : final.toFixed(2)}`;
}

export default async function ProductsAdminIndex() {
  // Bundles are content_items with type='bundle' (migration 036).
  const bundles = await listContent('bundle');

  return (
    <div className="px-8 py-8 max-w-5xl">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-950">מוצרים</h1>
          <p className="text-sm text-neutral-500 mt-1">מוצרים שאינם קורסים. כרגע: באנדלים — חבילות שמכילות מספר קורסים.</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> מוצר חדש
        </Link>
      </header>

      {bundles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-pill bg-brand-purple-50 flex items-center justify-center text-brand-purple-600">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-neutral-900 mb-1">עוד אין מוצרים</h3>
          <p className="text-sm text-neutral-500 mb-4">צור באנדל ראשון — חבילה שמכילה מספר קורסים במחיר אחד.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">כותרת</th>
                <th className="text-right px-4 py-3 font-semibold">סוג</th>
                <th className="text-right px-4 py-3 font-semibold">מחיר</th>
                <th className="text-right px-4 py-3 font-semibold">סטטוס</th>
                <th className="text-right px-4 py-3 font-semibold">עודכן</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((b) => (
                <tr key={b.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${b.slug}`} className="font-semibold text-neutral-900 hover:text-brand-purple-700">
                      {b.title}
                    </Link>
                    {b.tagline && <p className="text-xs text-neutral-500 mt-0.5 truncate max-w-md">{b.tagline}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-brand-purple-100 text-brand-purple-800">
                      באנדל
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700 font-medium">
                    {priceLabel(b.price_amount, b.sale_amount, b.price_currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold',
                        b.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700',
                      ].join(' ')}
                    >
                      {b.status === 'published' ? 'פורסם' : 'טיוטה'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">{formatDate(b.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
