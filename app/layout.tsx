import type { Metadata } from 'next';
import { Rubik, Space_Grotesk } from 'next/font/google';
import './globals.css';
import CartProvider from '@/components/cart/CartProvider';
import MiniCart from '@/components/cart/MiniCart';
import PopupRenderer from '@/components/popups/PopupRenderer';

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  variable: '--font-rubik',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'DigiTech HUB · השכלה פרקטית',
    template: '%s · DigiTech HUB',
  },
  description: 'מועדון הלמידה של Digitech — קורסים, הדרכות ופלייבוקים ב-AI ובדיגיטל',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${spaceGrotesk.variable}`}>
      <body className={`${rubik.className} min-h-screen antialiased`}>
        <CartProvider>
          {children}
          <MiniCart />
        </CartProvider>
        <PopupRenderer />
      </body>
    </html>
  );
}
