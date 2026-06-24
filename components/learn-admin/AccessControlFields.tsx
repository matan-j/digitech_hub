'use client';

import type { AccessLevel, CatalogVisibility } from '@/lib/learn/types';

export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = {
  open: 'פתוח — תוכן ציבורי מלא',
  login_required: 'דורש התחברות',
  purchase_required: 'דורש רכישה',
  subscription_required: 'דורש מנוי',
};

const ACCESS_LEVEL_HINT: Record<AccessLevel, string> = {
  open: 'כל התוכן גלוי. התחברות נדרשת רק לפעולות (התקדמות, שמירה, הורדה).',
  login_required: 'המטא-דאטה ציבורי; הגוף המלא נפתח אחרי התחברות.',
  purchase_required: 'המטא-דאטה ציבורי; הגוף המלא נפתח אחרי רכישה.',
  subscription_required: 'המטא-דאטה ציבורי; הגוף המלא נפתח למנויים בלבד.',
};

const VISIBILITY_LABEL: Record<CatalogVisibility, string> = {
  public: 'ציבורי — מופיע בקטלוג ובחיפוש',
  unlisted: 'מוסתר — נגיש בלינק ישיר בלבד',
};

const selectCls =
  'w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm bg-white';

type Props = {
  catalogVisibility: CatalogVisibility;
  onCatalogVisibility: (v: CatalogVisibility) => void;
  /** Omit to render visibility-only (e.g. playlists). */
  accessLevel?: AccessLevel;
  onAccessLevel?: (v: AccessLevel) => void;
  /** Omit to hide the preview toggle (e.g. playlists). */
  previewEnabled?: boolean;
  onPreviewEnabled?: (v: boolean) => void;
  /** Pass price props to render the price block (content_items only). */
  priceAmount?: string;
  onPriceAmount?: (v: string) => void;
  /** Discounted price (migration 024). Optional. */
  saleAmount?: string;
  onSaleAmount?: (v: string) => void;
  priceCurrency?: string;
  onPriceCurrency?: (v: string) => void;
};

const CURRENCY_SYMBOL: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' };

/**
 * Shared "access & visibility" admin section for the public-first access model
 * (migration 018). Renders only the controls whose props are supplied, so the
 * same component serves content items (full set), playbooks (no price) and
 * playlists (visibility only).
 */
export default function AccessControlFields({
  catalogVisibility,
  onCatalogVisibility,
  accessLevel,
  onAccessLevel,
  previewEnabled,
  onPreviewEnabled,
  priceAmount,
  onPriceAmount,
  saleAmount,
  onSaleAmount,
  priceCurrency,
  onPriceCurrency,
}: Props) {
  const hasAccess = accessLevel !== undefined && onAccessLevel !== undefined;
  const hasPreview = previewEnabled !== undefined && onPreviewEnabled !== undefined;
  const hasPrice =
    priceAmount !== undefined &&
    onPriceAmount !== undefined &&
    priceCurrency !== undefined &&
    onPriceCurrency !== undefined;
  const hasSale = saleAmount !== undefined && onSaleAmount !== undefined;
  const showPrice = hasPrice && accessLevel === 'purchase_required';

  // Live, client-side price validation + final-price preview. The server
  // recomputes authoritatively; this is UX only.
  const origNum = Number(priceAmount);
  const saleNum = Number(saleAmount);
  const sym = CURRENCY_SYMBOL[priceCurrency ?? 'ILS'] ?? '₪';
  const saleValid = !saleAmount || (Number.isFinite(saleNum) && saleNum >= 0 && saleNum <= origNum);
  const finalNum =
    hasSale && saleAmount && saleNum > 0 && saleNum < origNum ? saleNum : (Number.isFinite(origNum) ? origNum : 0);
  const isFreeFinal = !(finalNum > 0);

  return (
    <section className="bg-white rounded-2xl border border-neutral-200 p-5">
      <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide mb-3">גישה ונראות</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {hasAccess && (
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">רמת גישה</label>
            <select
              value={accessLevel}
              onChange={(e) => onAccessLevel!(e.target.value as AccessLevel)}
              className={selectCls}
            >
              {(Object.keys(ACCESS_LEVEL_LABEL) as AccessLevel[]).map((lvl) => (
                <option key={lvl} value={lvl}>{ACCESS_LEVEL_LABEL[lvl]}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-neutral-500">{ACCESS_LEVEL_HINT[accessLevel]}</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">נראות בקטלוג</label>
          <select
            value={catalogVisibility}
            onChange={(e) => onCatalogVisibility(e.target.value as CatalogVisibility)}
            className={selectCls}
          >
            {(Object.keys(VISIBILITY_LABEL) as CatalogVisibility[]).map((v) => (
              <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
            ))}
          </select>
        </div>

        {showPrice && (
          <>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">מחיר מלא (לפני הנחה)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={priceAmount}
                onChange={(e) => onPriceAmount!(e.target.value)}
                placeholder="לדוגמה: 149"
                className={selectCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">מטבע</label>
              <select
                value={priceCurrency}
                onChange={(e) => onPriceCurrency!(e.target.value)}
                className={selectCls}
              >
                <option value="ILS">₪ ILS</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>
            {hasSale && (
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">מחיר מבצע (אופציונלי)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={saleAmount}
                  onChange={(e) => onSaleAmount!(e.target.value)}
                  placeholder="לדוגמה: 99"
                  className={`${selectCls} ${saleValid ? '' : 'border-red-400 focus:border-red-400'}`}
                />
                {!saleValid && (
                  <p className="mt-1 text-[11px] text-red-600">מחיר המבצע חייב להיות בין 0 למחיר המלא.</p>
                )}
              </div>
            )}
            <div className="sm:col-span-2">
              <div className="rounded-lg bg-brand-purple-50/60 border border-brand-purple-100 px-3 py-2 text-sm">
                <span className="font-semibold text-neutral-600">מחיר סופי לתלמיד: </span>
                {isFreeFinal ? (
                  <span className="font-extrabold text-emerald-700">חינם — גישה תינתן מיידית</span>
                ) : (
                  <span className="font-extrabold text-brand-purple-800">
                    {sym}{finalNum % 1 === 0 ? finalNum : finalNum.toFixed(2)}
                    {hasSale && saleAmount && saleNum > 0 && saleNum < origNum && (
                      <span className="ms-2 text-xs font-medium text-neutral-400 line-through">
                        {sym}{origNum % 1 === 0 ? origNum : origNum.toFixed(2)}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {hasPreview && accessLevel !== 'open' && (
        <label className="mt-4 flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={previewEnabled}
            onChange={(e) => onPreviewEnabled!(e.target.checked)}
            className="w-3.5 h-3.5 accent-brand-purple-700"
          />
          <span className="font-medium text-neutral-700">אפשר תצוגה מקדימה ציבורית מוגבלת</span>
        </label>
      )}
    </section>
  );
}
