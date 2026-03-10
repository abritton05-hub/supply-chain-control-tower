import { notFound } from 'next/navigation';
import { serialRecords } from '@/lib/data/mock-data';

export default function SerialDetailPage({ params }: { params: { serialNumber: string } }) {
  const record = serialRecords.find((row) => row.serialNumber === params.serialNumber);
  if (!record) return notFound();
  return <div className="erp-card p-4"><h2 className="text-lg font-semibold">{record.serialNumber}</h2><p className="text-sm text-slate-600">{record.itemId} · {record.currentLocation} · {record.status}</p></div>;
}
