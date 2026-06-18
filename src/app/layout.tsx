import type { Metadata, Viewport } from 'next';
import { Outfit, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Lemisphere',
    template: '%s · Lemisphere',
  },
  description:
    'Your premium personal life-management hub. Track fitness, gaming, habits, goals, and more — beautifully.',
  keywords: ['personal dashboard', 'habit tracker', 'fitness tracker', 'life management'],
  authors: [{ name: 'Lemisphere' }],
  robots: 'noindex, nofollow', // private personal app
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#131217',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
