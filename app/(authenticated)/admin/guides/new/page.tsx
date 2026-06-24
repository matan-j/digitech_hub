import NewGuideForm from './NewGuideForm';

export const metadata = { title: 'הדרכה חדשה — Digitech Learning Hub' };

export default function NewGuidePage() {
  return (
    <div className="px-8 py-8 max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-neutral-950">הדרכה חדשה</h1>
        <p className="text-sm text-neutral-500 mt-1">קבע כותרת ו-slug, אחר כך תוכל להוסיף בלוקים בעורך.</p>
      </header>
      <NewGuideForm />
    </div>
  );
}
