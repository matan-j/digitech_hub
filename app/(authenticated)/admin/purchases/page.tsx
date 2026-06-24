import { requireAdmin } from '@/lib/auth';
import { getAllPurchases } from '@/lib/payments/purchase-history';
import PurchasesAdmin from './PurchasesAdmin';
import SumitWebhookControl from './SumitWebhookControl';

export const metadata = { title: 'רכישות — Digitech Learning Hub' };
export const dynamic = 'force-dynamic';

export default async function PurchasesAdminPage() {
  await requireAdmin();
  const rows = await getAllPurchases();

  return (
    <div className="px-8 py-8 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-neutral-950">רכישות</h1>
        <p className="text-sm text-neutral-500 mt-1">{rows.length} רכישות וניסיונות תשלום של כל המשתמשים.</p>
      </header>
      <div className="mb-6">
        <SumitWebhookControl />
      </div>
      <PurchasesAdmin rows={rows} />
    </div>
  );
}
