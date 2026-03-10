import { inventoryItems } from '@/lib/data/mock-data';
import { inventoryMetrics } from '@/lib/logic';

const xBands = ['0-5', '6-10', '11-20', '21+'];
const yBands = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'];

function bucket(daysCover: number) {
  if (daysCover <= 5) return '0-5';
  if (daysCover <= 10) return '6-10';
  if (daysCover <= 20) return '11-20';
  return '21+';
}

function severity(criticality: string, coverBand: string) {
  const criticalWeight = criticality === 'CRITICAL' ? 4 : criticality === 'HIGH' ? 3 : criticality === 'NORMAL' ? 2 : 1;
  const coverWeight = coverBand === '0-5' ? 4 : coverBand === '6-10' ? 3 : coverBand === '11-20' ? 2 : 1;
  return criticalWeight * coverWeight;
}

export function HeatMapWidget() {
  const cells = yBands.map((criticality) =>
    xBands.map((days) => {
      const count = inventoryItems.filter((item) => {
        const m = inventoryMetrics(item);
        return item.criticality === criticality && bucket(m.daysCover) === days;
      }).length;
      const score = severity(criticality, days) + count;
      const intensity = score >= 14 ? 'bg-rose-500 text-white' : score >= 10 ? 'bg-orange-400 text-white' : score >= 6 ? 'bg-amber-300 text-slate-900' : 'bg-emerald-100 text-slate-800';
      return { count, intensity };
    }),
  );

  return (
    <div className="erp-card p-4">
      <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">Inventory Risk Heat Map (Criticality x Days Cover)</h3>
      <div className="grid grid-cols-5 gap-2 text-xs">
        <div />
        {xBands.map((x) => <div key={x} className="text-center font-semibold text-slate-600">{x}</div>)}
        {yBands.map((y, rowIdx) => (
          <>
            <div key={`${y}-label`} className="font-semibold text-slate-600">{y}</div>
            {cells[rowIdx].map((cell, colIdx) => <div key={`${y}-${colIdx}`} className={`rounded p-3 text-center font-semibold ${cell.intensity}`}>{cell.count}</div>)}
          </>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">Higher intensity represents more severe criticality-cover combinations.</p>
    </div>
  );
}
