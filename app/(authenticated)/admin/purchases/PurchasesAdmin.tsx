'use client';

import { useState } from 'react';
import PurchasesTable, { type PurchaseRow } from '@/components/account/PurchasesTable';

export default function PurchasesAdmin({ rows }: { rows: PurchaseRow[] }) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = !q
    ? rows
    : rows.filter((r) =>
        [r.user_email, r.user_name, r.product_title, r.public_order_id, r.content_id]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );

  return (
    <div>
      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי לקוח, מייל, מוצר או מזהה מוצר…"
          className="w-full max-w-md px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm"
        />
      </div>
      <PurchasesTable rows={filtered} showUser emptyText="לא נמצאו רכישות." />
    </div>
  );
}
