import NewProductForm from './NewProductForm';

export const metadata = { title: 'מוצר חדש — Digitech Learning Hub' };

export default function NewProductPage() {
  return (
    <div className="px-8 py-8 max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-neutral-950">מוצר חדש</h1>
        <p className="text-sm text-neutral-500 mt-1">בחר סוג מוצר והגדר כותרת ראשונית. אחר כך תגדיר מחיר ותבחר קורסים בעורך.</p>
      </header>
      <NewProductForm />
    </div>
  );
}
