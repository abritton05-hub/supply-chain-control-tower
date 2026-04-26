import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Supply Chain Control Tower',
    template: '%s | Supply Chain Control Tower',
  },
  description: 'Mobile-ready ERP operations dashboard for warehouse and delivery workflows.',
  applicationName: 'Supply Chain Control Tower',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SCCT',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/denali-logo.png', type: 'image/png' },
    ],
    apple: [
      { url: '/denali-logo.png', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
