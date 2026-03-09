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

export function HeatMapWidget() {
  const cells = yBands.map((criticality) =>
    xBands.map((days) => {
      const count = inventoryItems.filter((item) => {
        const m = inventoryMetrics(item);
        return item.criticality === criticality && bucket(m.daysCover) === days;
      }).length;
      const intensity = count === 0 ? 'bg-slate-100' : count === 1 ? 'bg-amber-200' : count === 2 ? 'bg-orange-300' : 'bg-rose-400';
      return { count, intensity };
    }),
  );

  return (
    <div className="erp-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Inventory Risk Heat Map</h3>
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
    </div>
  );
}
