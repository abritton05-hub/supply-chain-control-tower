'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

import { SlideOver } from '@/components/overlay-ui';

export type DrillRecord = {
  id: string;
  label: string;
  description: string;
  href: string;
  hrefLabel?: string;
  metadata?: Array<{ label: string; value: ReactNode }>;
  relatedLinks?: Array<{ label: string; href: string }>;
};

export type DrillContent = {
  eyebrow?: string;
  title: string;
  summary: string;
  records: DrillRecord[];
};

export function DashboardDrillDrawer({ open, content, onClose }: { open: boolean; content: DrillContent | null; onClose: () => void }) {
  return (
    <SlideOver open={open} title={content?.title ?? 'Detail'} onClose={onClose}>
      {!content ? null : (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            {content.eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{content.eyebrow}</p> : null}
            <p className="mt-2 text-sm leading-6 text-slate-700">{content.summary}</p>
          </div>

          <section className="space-y-3">
            <h4 className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">Related Records</h4>
            <div className="space-y-3">
              {content.records.length === 0 ? <p className="text-sm text-slate-500">No related records found.</p> : null}
              {content.records.map((record) => (
                <article key={record.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{record.label}</p>
                      <p className="mt-1 text-sm text-slate-600">{record.description}</p>
                    </div>
                    <Link href={record.href} className="inline-flex cursor-pointer items-center rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
                      {record.hrefLabel ?? 'Open record'}
                    </Link>
                  </div>

                  {record.metadata?.length ? (
                    <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                      {record.metadata.map((item) => (
                        <div key={`${record.id}-${item.label}`} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt>
                          <dd className="mt-1 text-sm text-slate-800">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

                  {record.relatedLinks?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {record.relatedLinks.map((item) => (
                        <Link key={`${record.id}-${item.href}`} href={item.href} className="inline-flex cursor-pointer items-center rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </SlideOver>
  );
}
