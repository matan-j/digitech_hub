import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import SubscriptionCard from '@/components/account/SubscriptionCard';
import ContactInfoCard from '@/components/account/ContactInfoCard';
import LogoutButton from '@/components/auth/LogoutButton';

export const metadata = {
  title: 'החשבון שלי — Digitech Learning Hub',
};

export default async function AccountPage() {
  const { email, profile } = await requireUser('/account');

  return (
    <main className="min-h-screen px-4 py-10" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/learn" className="text-sm text-brand-purple-700 hover:text-brand-purple-800 font-medium">
              ← חזרה ל-Hub
            </Link>
            <h1 className="text-3xl font-extrabold text-neutral-950 mt-2">החשבון שלי</h1>
          </div>
          <LogoutButton className="text-sm text-neutral-600 hover:text-neutral-900 font-medium">
            התנתק
          </LogoutButton>
        </div>

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
        </div>
      </div>
    </main>
  );
}
