import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { vendors } from '@/lib/data/mock-data';

export default function VendorsPage() {
  return <div><SectionHeader title="Vendors" subtitle="Supplier registry prepared for future bulk entry workflows" actions={<div className='flex gap-2 text-xs'><button className='rounded border border-slate-300 px-2 py-1'>Paste Vendors</button><button className='rounded border border-slate-300 px-2 py-1'>Upload CSV</button><button className='rounded border border-slate-300 px-2 py-1'>Import Preview</button></div>} /><DataTable><thead><tr>{['Vendor Name','Category','Contact','Phone','Email','Lead Time Days','Preferred','Notes'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{vendors.map((v)=><tr key={v.vendorName}><td>{v.vendorName}</td><td>{v.category}</td><td>{v.contact}</td><td>{v.phone}</td><td>{v.email}</td><td>{v.leadTimeDays}</td><td>{v.preferred ? 'YES' : 'NO'}</td><td>{v.notes}</td></tr>)}</tbody></DataTable></div>;
}
