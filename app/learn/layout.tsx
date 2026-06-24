import NavSidebar from '@/components/learn/NavSidebar';
import MobileTopBar from '@/components/learn/MobileTopBar';
import AccessModalProvider from '@/components/auth/AccessModalProvider';
import ContactInfoProvider from '@/components/auth/ContactInfoProvider';
import { getCurrentUser } from '@/lib/auth';
import { getBrandSettings } from '@/lib/brand';

export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [auth, brand] = await Promise.all([getCurrentUser(), getBrandSettings()]);
  return (
    <AccessModalProvider initialAuthed={Boolean(auth)}>
      {/* Contact gate: prompts for a valid name + phone on first login and
          before a purchase. Auto-prompt only when authenticated. */}
      <ContactInfoProvider
        initialName={auth?.profile.full_name ?? ''}
        initialPhone={auth?.profile.phone ?? ''}
        autoPrompt={Boolean(auth)}
      >
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-main)' }}>
          <NavSidebar auth={auth} brand={brand} />
          <MobileTopBar auth={auth} logoUrl={brand.logoUrl} />
          <main className="lg:mr-64 pt-14 lg:pt-0 min-h-screen">
            {children}
          </main>
        </div>
      </ContactInfoProvider>
    </AccessModalProvider>
  );
}
