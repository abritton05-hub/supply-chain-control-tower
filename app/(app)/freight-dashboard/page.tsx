'use client';

import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { freightQuotes } from '@/lib/data/mock-data';

type FreightMode = 'LTL' | 'RAIL' | 'FULL_TRUCKLOAD';

type EstimateResult = {
  mode: FreightMode;
  low: number;
  high: number;
  midpoint: number;
  costPerMile: number;
  costPerLb: number;
  summary: string;
};

type EstimateRow = {
  id: string;
  createdAt: string;
  miles: number;
  weight: number;
  palletCount: number;
  mode: FreightMode;
  low: number;
  high: number;
  midpoint: number;
};

function currency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function pacificTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function estimateFreight(input: {
  miles: number;
  weight: number;
  palletCount: number;
  mode: FreightMode;
  hazmat: boolean;
  residential: boolean;
  liftgate: boolean;
  expedited: boolean;
}): EstimateResult {
  const { miles, weight, palletCount, mode, hazmat, residential, liftgate, expedited } = input;

  let low = 0;
  let high = 0;

  if (mode === 'LTL') {
    let lowPerMile = 0;
    let highPerMile = 0;

    if (miles <= 150) {
      lowPerMile = 1.5;
      highPerMile = 2.5;
    } else if (miles <= 500) {
      lowPerMile = 1.0;
      highPerMile = 2.0;
    } else if (miles <= 1000) {
      lowPerMile = 0.75;
      highPerMile = 1.5;
    } else if (miles <= 1500) {
      lowPerMile = 0.6;
      highPerMile = 1.25;
    } else {
      lowPerMile = 0.5;
      highPerMile = 1.0;
    }

    low = miles * lowPerMile;
    high = miles * highPerMile;

    low += weight * 0.06 + palletCount * 18;
    high += weight * 0.12 + palletCount * 30;
  }

  if (mode === 'RAIL') {
    low = miles * 0.7 + weight * 0.05 + palletCount * 10;
    high = miles * 1.05 + weight * 0.09 + palletCount * 18;
  }

  if (mode === 'FULL_TRUCKLOAD') {
    low = miles * 2.1 + weight * 0.04 + palletCount * 8;
    high = miles * 2.85 + weight * 0.08 + palletCount * 15;
  }

  if (hazmat) {
    low += 175;
    high += 350;
  }

  if (residential) {
    low += 90;
    high += 180;
  }

  if (liftgate) {
    low += 75;
    high += 150;
  }

  if (expedited) {
    low *= 1.22;
    high *= 1.4;
  }

  const midpoint = (low + high) / 2;
  const costPerMile = midpoint / Math.max(miles, 1);
  const costPerLb = midpoint / Math.max(weight, 1);

  let summary = 'Balanced estimate for general freight planning.';
  if (mode === 'LTL') {
    summary = 'LTL uses distance-band pricing, then adjusts for weight, pallets, and accessorials.';
  }
  if (mode === 'RAIL') {
    summary = 'Rail is better for longer-haul, heavier freight where lower cost matters more than speed.';
  }
  if (mode === 'FULL_TRUCKLOAD') {
    summary = 'Full Truckload is best for dedicated trailer moves, faster handling, and simpler routing.';
  }

  return {
    mode,
    low: Math.round(low),
    high: Math.round(high),
    midpoint: Math.round(midpoint),
    costPerMile: Number(costPerMile.toFixed(2)),
    costPerLb: Number(costPerLb.toFixed(2)),
    summary,
  };
}

export default function FreightEstimatorPage() {
  const [miles, setMiles] = useState('925');
  const [weight, setWeight] = useState('6800');
  const [palletCount, setPalletCount] = useState('8');
  const [mode, setMode] = useState<FreightMode>('LTL');
  const [hazmat, setHazmat] = useState(false);
  const [residential, setResidential] = useState(false);
  const [liftgate, setLiftgate] = useState(false);
  const [expedited, setExpedited] = useState(false);

  const [result, setResult] = useState<EstimateResult | null>(null);
  const [history, setHistory] = useState<EstimateRow[]>(
    freightQuotes.map((q) => {
      const mappedMode: FreightMode =
        q.serviceType === 'LTL' ? 'LTL' : q.serviceType === 'FTL' ? 'FULL_TRUCKLOAD' : 'RAIL';

      const estimate = estimateFreight({
        miles: q.miles,
        weight: q.weight,
        palletCount: q.palletCount,
        mode: mappedMode,
        hazmat: false,
        residential: false,
        liftgate: false,
        expedited: q.serviceType === 'EXPEDITED',
      });

      return {
        id: q.id,
        createdAt: pacificTimestamp(new Date(q.date)),
        miles: q.miles,
        weight: q.weight,
        palletCount: q.palletCount,
        mode: mappedMode,
        low: estimate.low,
        high: estimate.high,
        midpoint: estimate.midpoint,
      };
    }),
  );

  const modeSummary = useMemo(() => {
    if (mode === 'LTL') return 'Use LTL when the freight does not justify dedicating a full trailer.';
    if (mode === 'RAIL') return 'Use Rail when cost matters more than the fastest delivery timeline.';
    return 'Use Full Truckload when capacity, speed, or dedicated handling matters most.';
  }, [mode]);

  const calculate = () => {
    const estimate = estimateFreight({
      miles: Number(miles) || 0,
      weight: Number(weight) || 0,
      palletCount: Number(palletCount) || 0,
      mode,
      hazmat,
      residential,
      liftgate,
      expedited,
    });

    setResult(estimate);

    const row: EstimateRow = {
      id: `est-${Date.now()}`,
      createdAt: pacificTimestamp(),
      miles: Number(miles) || 0,
      weight: Number(weight) || 0,
      palletCount: Number(palletCount) || 0,
      mode,
      low: estimate.low,
      high: estimate.high,
      midpoint: estimate.midpoint,
    };

    setHistory((prev) => [row, ...prev].slice(0, 8));
  };

  const reset = () => {
    setMiles('925');
    setWeight('6800');
    setPalletCount('8');
    setMode('LTL');
    setHazmat(false);
    setResidential(false);
    setLiftgate(false);
    setExpedited(false);
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Freight Estimator"
        subtitle="Interactive freight calculator for LTL, Rail, and Full Truckload"
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="erp-card p-4">
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Miles</label>
              <input
                className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Weight (lbs)</label>
              <input
                className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Pallet Count</label>
              <input
                className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                value={palletCount}
                onChange={(e) => setPalletCount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Shipment Type / Mode</label>
              <select
                className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value as FreightMode)}
              >
                <option value="LTL">LTL</option>
                <option value="RAIL">Rail</option>
                <option value="FULL_TRUCKLOAD">Full Truckload</option>
              </select>
            </div>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hazmat} onChange={(e) => setHazmat(e.target.checked)} />
              Hazmat
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={residential} onChange={(e) => setResidential(e.target.checked)} />
              Residential
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={liftgate} onChange={(e) => setLiftgate(e.target.checked)} />
              Liftgate
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={expedited} onChange={(e) => setExpedited(e.target.checked)} />
              Expedited
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={calculate} className="rounded border border-cyan-600 bg-cyan-600 px-4 py-2 text-sm text-white">
              Calculate
            </button>
            <button onClick={reset} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
              Reset
            </button>
          </div>
        </div>

        <div className="erp-card p-4">
          <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">Estimate Result</h3>
          <p className="mb-3 text-sm text-slate-600">{modeSummary}</p>

          {result ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">Low</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">{currency(result.low)}</div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">Midpoint</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">{currency(result.midpoint)}</div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">High</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">{currency(result.high)}</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border border-slate-200 bg-white p-3 text-sm">
                  <div className="text-xs font-semibold text-slate-500">Cost Per Mile</div>
                  <div className="mt-1 font-semibold text-slate-900">{currency(result.costPerMile)}</div>
                </div>
                <div className="rounded border border-slate-200 bg-white p-3 text-sm">
                  <div className="text-xs font-semibold text-slate-500">Cost Per lb</div>
                  <div className="mt-1 font-semibold text-slate-900">${result.costPerLb.toFixed(2)}</div>
                </div>
              </div>

              <div className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <span className="font-semibold">Mode Recommendation:</span> {result.summary}
              </div>
            </div>
          ) : (
            <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Run the calculator to see the freight estimate range.
            </div>
          )}
        </div>
      </div>

      <div className="erp-card p-4">
        <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">
          Recent Estimates
        </h3>
        <DataTable>
          <thead>
            <tr>{['Created (Pacific)', 'Mode', 'Miles', 'Weight', 'Low', 'High', 'Midpoint'].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td>{row.createdAt}</td>
                <td>{row.mode}</td>
                <td>{row.miles}</td>
                <td>{row.weight}</td>
                <td>{currency(row.low)}</td>
                <td>{currency(row.high)}</td>
                <td>{currency(row.midpoint)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </div>
  );
}