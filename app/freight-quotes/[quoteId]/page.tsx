import { notFound } from 'next/navigation';
import { freightQuotes } from '@/lib/data/mock-data';

export default function FreightQuoteDetailPage({ params }: { params: { quoteId: string } }) {
  const quote = freightQuotes.find((row) => row.quoteId === params.quoteId);
  if (!quote) return notFound();
  return <div className="erp-card p-4"><h2 className="text-lg font-semibold">{quote.quoteId}</h2><p className="text-sm text-slate-600">{quote.originZip} → {quote.destinationZip} · {quote.serviceType}</p></div>;
}
