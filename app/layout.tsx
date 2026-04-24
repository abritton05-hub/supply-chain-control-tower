import './globals.css';

export const metadata = {
  title: 'Supply Chain Control Tower',
  description: 'Internal ERP-style supply chain operations platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}