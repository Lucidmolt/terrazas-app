import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://terrazas-app.vercel.app'),
  title: 'Terrazas | Premium On-Demand Lawn Care',
  description:
    'Instantly book verified lawn professionals. No phone calls, no waiting for quotes. Uber-style dispatch for yard services.',
  keywords: ['lawn care', 'landscaping', 'on-demand', 'mowing', 'yard service'],
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Terrazas | Premium On-Demand Lawn Care',
    description: 'Instantly book verified lawn professionals.',
    url: 'https://terrazas-app.vercel.app',
    siteName: 'Terrazas',
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
      <body className="bg-white text-slate-900 overflow-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
