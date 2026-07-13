import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://terrazas.app'),
  title: 'Terrazas Lawn Care & Tree Service | Liberal, KS',
  description:
    'Schedule lawn mowing or get a free quote for tree removal, trimming, stump grinding, landscaping and more. Family-owned, serving Southwest Kansas, the Oklahoma Panhandle, and Perryton TX.',
  keywords: ['lawn care', 'tree service', 'tree removal', 'stump grinding', 'landscaping', 'mowing', 'Liberal KS', 'Southwest Kansas'],
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Terrazas Lawn Care & Tree Service',
    description: 'Book lawn care or request a free quote for tree work in Southwest Kansas.',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://terrazas.app',
    siteName: 'Terrazas Lawn Care & Tree Service',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#059669',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
