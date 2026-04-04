import './globals.css';
import { Sidebar } from '@/components/sidebar';
import { TopHeader } from '@/components/top-header';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen bg-slate-100">
          <Sidebar />

          <main className="min-w-0 flex-1 flex flex-col">
            <TopHeader />
            <div className="p-6 pt-2">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}