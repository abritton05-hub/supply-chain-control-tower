import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { freightQuotes } from '@/lib/data/mock-data';
import { freightEstimates } from '@/lib/logic';

export default function FreightQuotesPage() {
  return <div><SectionHeader title="Freight Quotes" subtitle="Quick quote matrix with low / average / high estimate bands" actions={<button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Add Freight Quote</button>} /><DataTable><thead><tr>{['Quote ID','Date','Origin Zip','Destination Zip','Miles','Weight','Pallet Count','Service Type','Low Estimate','Average Estimate','High Estimate','Cost Per Mile','Cost Per Lb'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{freightQuotes.map((q)=>{const fx=freightEstimates(q);return <tr key={q.quoteId}><td>{q.quoteId}</td><td>{q.date}</td><td>{q.originZip}</td><td>{q.destinationZip}</td><td>{q.miles}</td><td>{q.weight}</td><td>{q.palletCount}</td><td>{q.serviceType}</td><td>${fx.low}</td><td>${fx.avg}</td><td>${fx.high}</td><td>${fx.costPerMile}</td><td>${fx.costPerLb}</td></tr>;})}</tbody></DataTable></div>;
}
