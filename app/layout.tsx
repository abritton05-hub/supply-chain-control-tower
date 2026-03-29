'use client';

import './globals.css';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { TopHeader } from '@/components/top-header';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <html lang="en">
      <body>
        {isLoginPage ? (
          <div className="min-h-screen">{children}</div>
        ) : (
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 bg-slate-100">
              <TopHeader />
              <div className="p-6 pt-2">{children}</div>
            </main>
          </div>
        )}
      </body>
    </html>
  );
}