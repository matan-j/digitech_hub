import { requireUser } from '@/lib/auth';
import { UserCog, ShoppingBag } from 'lucide-react';
import SubscriptionCard from '@/components/account/SubscriptionCard';
import ContactInfoCard from '@/components/account/ContactInfoCard';
import PurchasesTable from '@/components/account/PurchasesTable';
import LogoutButton from '@/components/auth/LogoutButton';
import { getUserPurchases } from '@/lib/payments/purchase-history';

export const metadata = {
  title: 'החשבון שלי · DigiTech HUB',
};

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const { email, profile } = await requireUser('/learn/account');
  const purchases = await getUserPurchases(profile.id);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-2xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <UserCog className="w-4 h-4 text-brand-purple-700" />
            <span className="text-[11px] font-extrabold text-brand-purple-700 uppercase tracking-[0.18em]">החשבון שלי</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950">הפרטים והמנוי שלי</h1>
        </div>
        <LogoutButton className="text-sm text-neutral-600 hover:text-neutral-900 font-medium shrink-0">
          התנתק
        </LogoutButton>
      </header>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-lg font-extrabold text-neutral-950 mb-3">פרטי משתמש</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">מייל</dt>
              <dd className="font-medium text-neutral-900" dir="ltr">{email}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">תפקיד</dt>
              <dd className="font-medium text-neutral-900">
                {profile.role === 'admin' ? 'אדמין' : 'משתמש'}
              </dd>
            </div>
          </dl>
        </div>

        <ContactInfoCard initialName={profile.full_name} initialPhone={profile.phone} />

        <SubscriptionCard profile={profile} />

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-4 h-4 text-brand-purple-700" />
            <h2 className="text-lg font-extrabold text-neutral-950">הרכישות שלי</h2>
          </div>
          <PurchasesTable rows={purchases} emptyText="עדיין לא ביצעת רכישות." />
        </div>
      </div>
    </div>
  );
}
