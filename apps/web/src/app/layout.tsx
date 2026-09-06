import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

/**
 * Manrope на весь интерфейс: геометричный гротеск с широкими овалами и плотным
 * начертанием в тяжёлых весах — на нём держатся и крупные суммы, и вордмарк.
 * Кириллица у него родная, поэтому русские подписи не съезжают на подменный шрифт.
 */
const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Expense Tracker',
  description: 'Трекер расходов',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
