import './globals.css';

export const metadata = {
  title: 'Supply Chain Control Tower',
  description: 'Supply Chain Control Tower',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}