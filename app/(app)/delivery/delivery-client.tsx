'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StickyNotes } from '@/components/sticky-notes';
import { DELIVERY_DRAFT_STORAGE_KEY } from '@/lib/ai/intake/draft-storage';
import type { DeliveryDraftPayload } from '@/lib/ai/intake/types';
import {
  buildShippingManifestLabelPayload,
  downloadLabelPayloadsCsv,
  downloadSimplePtouchCsv,
  type SimplePtouchLabelRow,
} from '@/lib/labels/p-touch';
import type { DeliveryPageData } from './types';

const DEFAULT_SITE = 'SEA991';
const MANIFEST_START = 1501;
const BOM_START = 13501;
const DENALI_LOGO_SRC = '/denali-logo.png';

type Direction = 'incoming' | 'outgoing';
type ManifestStatusFilter = 'OPEN' | 'COMPLETE' | 'ALL';

type ShippingLocation = {
  code: string;
  display_name: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
};

type StopLineItem = {
  id: string;
  stopId: string;
  partNumber: string;
  itemId: string;
  description: string;
  quantity: string;
  boxCount: string;
  notes: string;
  createdAt: string;
};

type StopRow = {
  id: string;
  manifestNumber: string;
  direction: Direction;
  title: string;
  date: string;
  time: string;
  shipmentTransferId: string;
  reference: string;
  fromLocation: string;
  fromAddress: string;
  toLocation: string;
  toAddress: string;
  contact: string;
  items: string;
  boxCount: string;
  lineItems: StopLineItem[];
  notes: string;
  status: string;
  createdAt: string;
};

type BomDraft = {
  bomNumber: string;
  manifestNumber: string;
  sourceStopId: string;
  createdAt: string;
  reference: string;
  shipFrom: string;
  shipTo: string;
  contact: string;
  items: string;
  notes: string;
};

type SignedBomFile = {
  id: string;
  manifest_number: string | null;
  bom_number: string | null;
  stop_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  signed_url: string | null;
};

type DeliveryClientProps = DeliveryPageData & {
  canManageDelivery: boolean;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clean(value: string | null | undefined) {
  return value?.trim() || '';
}

function fixBadEncodingCharacters(text: string) {
  return text
    .replace(/\u00e2\u20ac\u201d/g, '—')
    .replace(/\u00e2\u20ac\u201c/g, '–')
    .replace(/\u00c3\u2014/g, '×')
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac\u0153/g, '"')
    .replace(/\u00e2\u20ac\u009d/g, '"');
}

function normalizeLocation(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'WH' || normalized === 'A13' || normalized === 'WH/A13') return 'WH/A13';
  return normalized;
}

function formatType(direction: Direction) {
  return direction === 'incoming' ? 'Pickup' : 'Drop Off';
}

function parseManifestNumber(value: string) {
  const numeric = Number(value.replace('DAI-M-', '').replace('DAI-M', ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function createManifestNumber(existingManifestNumbers: string[]) {
  const used = existingManifestNumbers.map(parseManifestNumber).filter((value) => value > 0);
  const next = used.length ? Math.max(...used) + 1 : MANIFEST_START;
  return `DAI-M${next}`;
}

function createBomNumber(existingBomNumbers: string[]) {
  const used = existingBomNumbers
    .map((value) => Number(value.replace('DAI-B-', '').replace('DAI-B', '')))
    .filter((value) => Number.isFinite(value));
  const next = used.length ? Math.max(...used) + 1 : BOM_START;
  return `DAI-B${next}`;
}

function addressForLocation(locations: ShippingLocation[], code: string) {
  const normalized = normalizeLocation(code);
  return locations.find((location) => normalizeLocation(location.code) === normalized)?.address || '';
}

function contactForLocation(locations: ShippingLocation[], code: string) {
  const normalized = normalizeLocation(code);
  const location = locations.find((item) => normalizeLocation(item.code) === normalized);
  if (!location) return '';
  return [location.contact_name || '', location.contact_phone || ''].filter(Boolean).join(' | ');
}

function locationOptionLabel(location: ShippingLocation) {
  const code = normalizeLocation(location.code || '');
  const displayName = clean(location.display_name);
  return displayName ? `${code} — ${displayName}` : code;
}

function displayStopAddress(location: string, address: string) {
  const stopLocation = clean(location);
  const stopAddress = clean(address);
  if (!stopLocation && !stopAddress) return '-';
  if (!stopAddress) return stopLocation;
  if (!stopLocation) return stopAddress;
  return `${stopLocation}\n${stopAddress}`;
}

function oneLine(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
}

function formatUploadedAt(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatStopLineItem(line: StopLineItem) {
  const quantity = clean(line.quantity);
  const part = itemIdentifier(line);
  const description = clean(line.description);
  const boxes = clean(line.boxCount);
  const notes = clean(line.notes);

  return [
    quantity ? `${quantity}x` : '',
    part,
    description,
    boxes && boxes !== '1' ? `Boxes: ${boxes}` : '',
    notes,
  ]
    .filter(Boolean)
    .join(' ');
}

function stopItemsText(row: Pick<StopRow, 'items' | 'lineItems'>) {
  const structuredItems = row.lineItems.map(formatStopLineItem).filter(Boolean);
  return structuredItems.length ? structuredItems.join('\n') : row.items;
}

function formatStopLinesForBom(row: Pick<StopRow, 'items' | 'lineItems'>) {
  const structuredItems = validStructuredLines(row.lineItems).map((line) =>
    [
      parseQuantity(line.quantity) || 1,
      itemIdentifier(line) || '-',
      clean(line.description) || '-',
      parseBoxCount(line.boxCount),
      clean(line.notes),
    ].join('\t')
  );

  return structuredItems.length ? structuredItems.join('\n') : row.items;
}

function parseBomPrintableLines(items: string) {
  return items
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');

      if (parts.length >= 4) {
        return {
          quantity: parts[0] || '-',
          part: parts[1] || '-',
          description: parts[2] || '-',
          boxCount: parts[3] || '0',
        };
      }

      return {
        quantity: '-',
        part: '-',
        description: line,
        boxCount: '-',
      };
    });
}

function printableStopLines(row: Pick<StopRow, 'items' | 'lineItems'>) {
  const structuredItems = validStructuredLines(row.lineItems).map((line) => ({
    quantity: String(parseQuantity(line.quantity) || 1),
    part: itemIdentifier(line) || '-',
    description: clean(line.description) || '-',
    boxCount: String(parseBoxCount(line.boxCount)),
  }));

  if (structuredItems.length) return structuredItems;

  return row.items
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      quantity: '-',
      part: '-',
      description: line,
      boxCount: '-',
    }));
}

function itemIdentifier(line: Pick<StopLineItem, 'partNumber' | 'itemId'>) {
  return clean(line.partNumber) || clean(line.itemId);
}

function parseQuantity(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function parseBoxCount(value: string) {
  if (!clean(value)) return 0;

  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function validStructuredLines(lines: StopLineItem[]) {
  return lines.filter(
    (line) =>
      parseQuantity(line.quantity) > 0 &&
      (itemIdentifier(line) || clean(line.description))
  );
}

function totalItemQuantity(lines: StopLineItem[]) {
  return validStructuredLines(lines).reduce((sum, line) => sum + parseQuantity(line.quantity), 0);
}

function totalLineBoxCount(lines: StopLineItem[]) {
  return validStructuredLines(lines).reduce((sum, line) => sum + parseBoxCount(line.boxCount), 0);
}

function totalLabelCount(lines: StopLineItem[]) {
  return totalLineBoxCount(lines) * 2;
}

function stopStatusIsComplete(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === 'complete' || normalized === 'completed' || normalized === 'closed';
}

function manifestKey(manifestNumber: string, manifestDate: string) {
  return `${manifestDate || 'Unassigned'}::${manifestNumber || 'Unassigned'}`;
}

function manifestRowsAreComplete(rows: StopRow[]) {
  return rows.length > 0 && rows.every((row) => stopStatusIsComplete(row.status));
}

function manifestStatusLabel(rows: StopRow[]) {
  return manifestRowsAreComplete(rows) ? 'Complete' : 'Open';
}

function displayStopStatus(status: string) {
  if (stopStatusIsComplete(status)) return 'Complete';
  return status || '-';
}

function activeManifestRows(rows: StopRow[]) {
  const rowsByManifest = new Map<string, StopRow[]>();

  for (const row of rows) {
    const key = manifestKey(row.manifestNumber, row.date);
    rowsByManifest.set(key, [...(rowsByManifest.get(key) || []), row]);
  }

  const completeManifests = new Set(
    Array.from(rowsByManifest.entries())
      .filter(([, manifestRows]) => manifestRowsAreComplete(manifestRows))
      .map(([key]) => key)
  );

  return rows.filter((row) => !completeManifests.has(manifestKey(row.manifestNumber, row.date)));
}

function createEmptyStopLine(stopId: string): StopLineItem {
  return {
    id: newId('line'),
    stopId,
    partNumber: '',
    itemId: '',
    description: '',
    quantity: '1',
    boxCount: '1',
    notes: '',
    createdAt: new Date().toISOString(),
  };
}

function validateStopLineItems(lines: StopLineItem[]) {
  const errors: string[] = [];

  lines.forEach((line, index) => {
    const label = `Line ${index + 1}`;
    const hasContent =
      itemIdentifier(line) || clean(line.description) || clean(line.notes) || clean(line.quantity);

    if (!hasContent) return;
    if (parseQuantity(line.quantity) <= 0) errors.push(`${label}: qty must be greater than 0.`);
    if (Number(line.boxCount) < 0) errors.push(`${label}: box count cannot be negative.`);
    if (!itemIdentifier(line) && !clean(line.description)) {
      errors.push(`${label}: enter a part/item or description.`);
    }
  });

  return errors;
}

function buildStopLabelPayloads(row: StopRow) {
  const from = displayStopAddress(row.fromLocation, row.fromAddress);
  const to = displayStopAddress(row.toLocation, row.toAddress);
  const direction = formatType(row.direction);
  const location = `${oneLine(from)} to ${oneLine(to)}`;
  const destinationName = clean(row.toLocation);
  const destinationAddress = clean(row.toAddress);
  const contactLine = clean(row.contact);
  const po = clean(row.shipmentTransferId);
  const payloads: ReturnType<typeof buildShippingManifestLabelPayload>[] = [];
  const lines = validStructuredLines(row.lineItems);

  if (lines.length) {
    for (const line of lines) {
      const lineBoxCount = parseBoxCount(line.boxCount);
      if (lineBoxCount <= 0) continue;

      const part = itemIdentifier(line);
      const lineDescription = clean(line.description) || clean(line.notes);

      for (let boxIndex = 1; boxIndex <= lineBoxCount; boxIndex += 1) {
        for (let labelIndex = 1; labelIndex <= 2; labelIndex += 1) {
          payloads.push(
            buildShippingManifestLabelPayload({
              manifestNumber: row.manifestNumber,
              stopId: row.id,
              partNumber: part,
              itemId: line.itemId || line.partNumber || `Box ${boxIndex}/${lineBoxCount}`,
              description: lineDescription,
              quantity: line.quantity,
              location,
              reference: `${row.manifestNumber} / ${direction} / Box ${boxIndex}`,
              po,
              date: row.date,
              destinationName,
              destinationAddress,
              contactLine,
            })
          );
        }
      }
    }

    return payloads;
  }

  const legacyBoxCount = parseBoxCount(row.boxCount);
  const itemsText = stopItemsText(row);
  const legacyDescription =
    oneLine(itemsText) || clean(row.reference) || clean(row.shipmentTransferId) || row.manifestNumber;

  for (let boxIndex = 1; boxIndex <= legacyBoxCount; boxIndex += 1) {
    for (let labelIndex = 1; labelIndex <= 2; labelIndex += 1) {
      payloads.push(
        buildShippingManifestLabelPayload({
          manifestNumber: row.manifestNumber,
          stopId: row.id,
          partNumber: '',
          itemId: `Box ${boxIndex}/${legacyBoxCount} Label ${labelIndex}/2`,
          description: legacyDescription,
          quantity: '1',
          location,
          reference: `${row.manifestNumber} / ${direction} / Box ${boxIndex}`,
          po,
          date: row.date,
          destinationName,
          destinationAddress,
          contactLine,
        })
      );
    }
  }

  return payloads;
}

function buildSimplePtouchRows(row: StopRow): SimplePtouchLabelRow[] {
  const location = row.direction === 'incoming' ? clean(row.toLocation) : clean(row.fromLocation);
  const reference = clean(row.shipmentTransferId) || clean(row.reference) || clean(row.manifestNumber);
  const lines = validStructuredLines(row.lineItems);

  if (lines.length) {
    return lines.map((line) => ({
      identifier: clean(line.itemId) || clean(line.partNumber) || line.id,
      part_number: clean(line.partNumber),
      description: clean(line.description),
      qty: clean(line.quantity) || '1',
      location,
      reference,
    }));
  }

  return [
    {
      identifier: row.id,
      part_number: '',
      description: oneLine(stopItemsText(row)),
      qty: clean(row.boxCount) || '1',
      location,
      reference,
    },
  ];
}

function manifestNumberForDate(date: string, rows: StopRow[], allRows: StopRow[] = rows) {
  const existing = rows
    .filter((row) => row.date === date && row.manifestNumber)
    .sort((a, b) => {
      const manifestDelta =
        parseManifestNumber(a.manifestNumber) - parseManifestNumber(b.manifestNumber);
      if (manifestDelta !== 0) return manifestDelta;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    })[0]?.manifestNumber;

  return existing || createManifestNumber(allRows.map((row) => row.manifestNumber).filter(Boolean));
}

function rowsForManifest(rows: StopRow[], manifestNumber: string, manifestDate: string) {
  if (!manifestNumber || !manifestDate) return [];
  return rows.filter((row) => row.manifestNumber === manifestNumber && row.date === manifestDate);
}

function emptyStop(
  direction: Direction,
  manifestNumber: string,
  stopDate: string,
  locations: ShippingLocation[]
): StopRow {
  const isPickup = direction === 'incoming';
  const fromLocation = isPickup ? '' : DEFAULT_SITE;
  const toLocation = isPickup ? DEFAULT_SITE : '';

  return {
    id: newId(isPickup ? 'pickup' : 'dropoff'),
    manifestNumber,
    direction,
    title: isPickup ? 'Pickup' : 'Drop Off',
    date: stopDate,
    time: '',
    shipmentTransferId: '',
    reference: '',
    fromLocation,
    fromAddress: fromLocation ? addressForLocation(locations, fromLocation) : '',
    toLocation,
    toAddress: toLocation ? addressForLocation(locations, toLocation) : '',
    contact: isPickup ? '' : contactForLocation(locations, toLocation),
    items: '',
    boxCount: '1',
    lineItems: [],
    notes: '',
    status: 'Manual',
    createdAt: new Date().toISOString(),
  };
}

async function loadShippingLocations(): Promise<ShippingLocation[]> {
  const res = await fetch('/api/shipping/locations', { cache: 'no-store' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to load shipping locations.');
  return data.locations || [];
}

async function loadManifestRows(): Promise<StopRow[]> {
  const res = await fetch('/api/shipping/manifest-history', { cache: 'no-store' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to load manifest history.');

  return (data.rows || []).map((row: any) => ({
    id: row.id,
    manifestNumber: row.manifest_number || '',
    direction: row.direction,
    title: row.title || (row.direction === 'incoming' ? 'Pickup' : 'Drop Off'),
    date: row.stop_date || '',
    time: row.stop_time || '',
    shipmentTransferId: row.shipment_transfer_id || '',
    reference: fixBadEncodingCharacters(row.reference || ''),
    fromLocation: row.from_location || '',
    fromAddress: fixBadEncodingCharacters(row.from_address || ''),
    toLocation: row.to_location || '',
    toAddress: fixBadEncodingCharacters(row.to_address || ''),
    contact: fixBadEncodingCharacters(row.contact || ''),
    items: fixBadEncodingCharacters(row.items || ''),
    boxCount: row.box_count ? String(row.box_count) : '1',
    lineItems: (row.line_items || row.stop_items || []).map((item: any) => ({
      id: item.id || '',
      stopId: item.stop_id || row.id || '',
      partNumber: fixBadEncodingCharacters(item.part_number || ''),
      itemId: fixBadEncodingCharacters(item.item_id || ''),
      description: fixBadEncodingCharacters(item.description || ''),
      quantity: item.quantity ? String(item.quantity) : '1',
      boxCount: item.box_count === null || item.box_count === undefined ? '1' : String(item.box_count),
      notes: fixBadEncodingCharacters(item.notes || ''),
      createdAt: item.created_at || '',
    })),
    notes: fixBadEncodingCharacters(row.notes || ''),
    status: row.status || 'Draft',
    createdAt: row.created_at || '',
  }));
}

async function loadBomRows(): Promise<BomDraft[]> {
  const res = await fetch('/api/shipping/bom-history', { cache: 'no-store' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to load BOM history.');

  return (data.rows || []).map((row: any) => ({
    bomNumber: row.bom_number || '',
    manifestNumber: row.manifest_number || '',
    sourceStopId: row.source_stop_id || '',
    createdAt: row.created_at || '',
    reference: fixBadEncodingCharacters(row.reference || ''),
    shipFrom: fixBadEncodingCharacters(row.ship_from || ''),
    shipTo: fixBadEncodingCharacters(row.ship_to || ''),
    contact: fixBadEncodingCharacters(row.contact || ''),
    items: fixBadEncodingCharacters(row.items || ''),
    notes: fixBadEncodingCharacters(row.notes || ''),
  }));
}

async function saveManifestRow(row: StopRow, method: 'POST' | 'PATCH') {
  const structuredLines = validStructuredLines(row.lineItems);
  const savedBoxCount = structuredLines.length
    ? totalLineBoxCount(structuredLines)
    : parseBoxCount(row.boxCount) || 1;

  const res = await fetch('/api/shipping/manifest-history', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: row.id,
      manifest_number: row.manifestNumber,
      direction: row.direction,
      title: row.title,
      stop_date: row.date || null,
      stop_time: row.time,
      shipment_transfer_id: row.shipmentTransferId,
      reference: row.reference,
      from_location: row.fromLocation,
      from_address: row.fromAddress,
      to_location: row.toLocation,
      to_address: row.toAddress,
      contact: row.contact,
      items: row.items,
      box_count: savedBoxCount || 1,
      ...(structuredLines.length
        ? {
            line_items: structuredLines.map((line) => ({
              id: line.id || undefined,
              stop_id: row.id,
              part_number: line.partNumber,
              item_id: line.itemId,
              description: line.description,
              quantity: parseQuantity(line.quantity) || 1,
              box_count: parseBoxCount(line.boxCount),
              notes: line.notes,
            })),
          }
        : {}),
      notes: row.notes,
      status: row.status,
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to save manifest stop.');
}

async function deleteManifestStop(stopId: string) {
  const res = await fetch('/api/shipping/manifest-history', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: stopId }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to delete manifest stop.');
}

async function deleteManifestReceipt(manifestNumber: string, manifestDate: string) {
  const res = await fetch('/api/shipping/manifest-history', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest_number: manifestNumber, stop_date: manifestDate }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to delete delivery receipt.');
}

async function completeManifest(manifestNumber: string, manifestDate: string) {
  const res = await fetch('/api/shipping/manifest-history/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      manifest_number: manifestNumber,
      manifest_date: manifestDate,
    }),
  });
  const data = await res.json();

  if (!data.ok) {
    throw new Error(data.message || 'Failed to complete manifest.');
  }

  return data as { stopCount?: number; message?: string };
}

async function saveBomRow(bom: BomDraft) {
  const res = await fetch('/api/shipping/bom-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bom_number: bom.bomNumber,
      manifest_number: bom.manifestNumber,
      source_stop_id: bom.sourceStopId,
      reference: bom.reference,
      ship_from: bom.shipFrom,
      ship_to: bom.shipTo,
      contact: bom.contact,
      items: bom.items,
      notes: bom.notes,
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to save BOM.');
}

function printElementById(id: string) {
  const element = document.getElementById(id);
  if (!element) return;

  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Print</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1, h2, h3, p { margin: 0; }
          .document { max-width: 980px; margin: 0 auto; }
          .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; }
          .logo { width: 190px; height: auto; object-fit: contain; }
          .title-block { text-align: right; }
          .title-block h1 { font-size: 26px; letter-spacing: 0.02em; }
          .title-block p { margin-top: 6px; font-size: 12px; }
          .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px; }
          .meta-cell { border: 1px solid #cbd5e1; padding: 8px; min-height: 48px; }
          .label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; }
          .value { margin-top: 4px; font-size: 12px; font-weight: 700; white-space: pre-wrap; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; font-size: 11px; }
          th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; }
          pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 11px; margin: 0; }
          .item-lines { display: grid; gap: 3px; min-width: 260px; }
          .item-line { display: grid; grid-template-columns: 34px 92px minmax(120px, 1fr) 42px; gap: 4px; border-bottom: 1px solid #e2e8f0; padding: 2px 0; }
          .item-line:last-child { border-bottom: 0; }
          .item-head { color: #475569; font-size: 9px; font-weight: 800; text-transform: uppercase; }
          .box { border: 1px solid #cbd5e1; padding: 10px; margin-top: 12px; }
          .box-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
          .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 28px; }
          .signature-label { font-size: 12px; font-weight: 800; }
          .signature-line { border-bottom: 1px solid #0f172a; height: 32px; margin-top: 8px; }
          @media print { body { padding: 18px; } .document { max-width: none; } .logo { width: 175px; } }
        </style>
      </head>
      <body>${element.innerHTML}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function StopModal({
  row,
  locations,
  onClose,
  onSave,
  onCreateBom,
  onUploadSignedBom,
  onViewSignedBoms,
}: {
  row: StopRow | null;
  locations: ShippingLocation[];
  onClose: () => void;
  onSave: (row: StopRow, exportLabelsAfterSave: boolean) => void;
  onCreateBom: (row: StopRow) => void;
  onUploadSignedBom: (row: StopRow, file: File) => Promise<void>;
  onViewSignedBoms: (row: StopRow) => void;
}) {
  const [draft, setDraft] = useState<StopRow | null>(row);
  const [exportLabelsAfterSave, setExportLabelsAfterSave] = useState(true);
  const signedBomInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(row);
    setExportLabelsAfterSave(true);
  }, [row]);

  if (!draft) return null;

  const hasStructuredLines = draft.lineItems.length > 0;
  const legacyFallbackVisible = !hasStructuredLines && Boolean(clean(draft.items));
  const totalQuantity = totalItemQuantity(draft.lineItems);
  const totalBoxes = hasStructuredLines ? totalLineBoxCount(draft.lineItems) : parseBoxCount(draft.boxCount);
  const totalLabels = hasStructuredLines ? totalLabelCount(draft.lineItems) : totalBoxes * 2;
  const labelsToCreate = exportLabelsAfterSave ? totalLabels : 0;
  const validationErrors = validateStopLineItems(draft.lineItems);

  function update(field: Exclude<keyof StopRow, 'lineItems'>, value: string) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateLocation(field: 'fromLocation' | 'toLocation', value: string) {
    const normalized = normalizeLocation(value);
    const address = addressForLocation(locations, normalized);
    const contact = contactForLocation(locations, normalized);

    setDraft((current) => {
      if (!current) return current;

      if (field === 'fromLocation') {
        return {
          ...current,
          fromLocation: normalized,
          fromAddress: address,
          contact: current.direction === 'incoming' ? contact || current.contact : current.contact,
        };
      }

      return {
        ...current,
        toLocation: normalized,
        toAddress: address,
        contact: current.direction === 'outgoing' ? contact || current.contact : current.contact,
      };
    });
  }

  function addLine() {
    setDraft((current) =>
      current
        ? {
            ...current,
            lineItems: [...current.lineItems, createEmptyStopLine(current.id)],
          }
        : current
    );
  }

  function removeLine(index: number) {
    setDraft((current) =>
      current
        ? {
            ...current,
            lineItems: current.lineItems.filter((_, lineIndex) => lineIndex !== index),
          }
        : current
    );
  }

  function updateLine(index: number, field: keyof StopLineItem, value: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            lineItems: current.lineItems.map((line, lineIndex) =>
              lineIndex === index ? { ...line, [field]: value } : line
            ),
          }
        : current
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 print:hidden">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              {formatType(draft.direction)} Details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manifest {draft.manifestNumber}. Pick an address book code or type the address
              manually.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          <StickyNotes
            entityType="delivery_stop"
            entityId={draft.id}
            title={`${formatType(draft.direction)} Notes`}
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Manifest #
            <input
              value={draft.manifestNumber}
              readOnly
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"
            />
          </label>

          <TextInput label="Title" value={draft.title} onChange={(value) => update('title', value)} />
          <DateInput label="Date" value={draft.date} onChange={(value) => update('date', value)} />
          <TextInput label="Time / Window" value={draft.time} onChange={(value) => update('time', value)} />
          <NumberInput
            label="Box Count"
            value={draft.boxCount}
            onChange={(value) => update('boxCount', value)}
          />
          <TextInput
            label="PO / Shipment / Transfer ID"
            value={draft.shipmentTransferId}
            onChange={(value) => update('shipmentTransferId', value)}
          />
          <TextInput
            label="Reference / Project"
            value={draft.reference}
            onChange={(value) => update('reference', value)}
          />

          <LocationSelect
            label="From"
            value={draft.fromLocation}
            locations={locations}
            onChange={(value) => updateLocation('fromLocation', value)}
          />
          <LocationSelect
            label="To"
            value={draft.toLocation}
            locations={locations}
            onChange={(value) => updateLocation('toLocation', value)}
          />

          <TextArea
            label="From Address"
            value={draft.fromAddress}
            onChange={(value) => update('fromAddress', value)}
          />
          <TextArea
            label="To Address"
            value={draft.toAddress}
            onChange={(value) => update('toAddress', value)}
          />

          <div className="md:col-span-2">
            <TextInput
              label="Contact / POC"
              value={draft.contact}
              onChange={(value) => update('contact', value)}
            />
          </div>

          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Item Lines</h3>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                  <span>Total qty: {totalQuantity || 0}</span>
                  <span>Total boxes: {totalBoxes || 0}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Add Line
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="w-20 px-3 py-2">Qty</th>
                    <th className="w-36 px-3 py-2">Part #</th>
                    <th className="w-36 px-3 py-2">Item ID</th>
                    <th className="min-w-56 px-3 py-2">Description</th>
                    <th className="w-24 px-3 py-2">Boxes</th>
                    <th className="min-w-48 px-3 py-2">Notes</th>
                    <th className="w-20 px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {draft.lineItems.length ? (
                    draft.lineItems.map((line, index) => (
                      <tr key={line.id || `${draft.id}-line-${index}`} className="align-top">
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.quantity}
                            onChange={(event) => updateLine(index, 'quantity', event.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={line.partNumber}
                            onChange={(event) => updateLine(index, 'partNumber', event.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={line.itemId}
                            onChange={(event) => updateLine(index, 'itemId', event.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={line.description}
                            onChange={(event) => updateLine(index, 'description', event.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={line.boxCount}
                            onChange={(event) => updateLine(index, 'boxCount', event.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={line.notes}
                            onChange={(event) => updateLine(index, 'notes', event.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                        No structured lines yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {validationErrors.length ? (
              <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {validationErrors.join(' ')}
              </div>
            ) : null}
          </div>

          {legacyFallbackVisible ? (
            <div className="md:col-span-2">
              <TextArea
                label="Legacy Items / PN / Qty"
                value={draft.items}
                onChange={(value) => update('items', value)}
              />
            </div>
          ) : null}

          <div className="md:col-span-2">
            <TextArea label="Notes" value={draft.notes} onChange={(value) => update('notes', value)} />
          </div>

          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-700">
                <div className="font-semibold">P-touch labels: 2 per box</div>
                <div className="mt-1 text-slate-500">
                  Total boxes: {totalBoxes || 0} · Total P-touch labels: {totalLabels || 0}
                  {exportLabelsAfterSave ? ` · Labels to export: ${labelsToCreate}` : ''}
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={exportLabelsAfterSave}
                  onChange={(event) => setExportLabelsAfterSave(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-700"
                />
                Export P-touch labels after save
              </label>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onSave(draft, exportLabelsAfterSave)}
            disabled={validationErrors.length > 0}
            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Changes
          </button>

          {draft.direction === 'outgoing' ? (
            <button
              type="button"
              onClick={() => onCreateBom(draft)}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              Create BOM
            </button>
          ) : null}

          {draft.direction === 'outgoing' ? (
            <>
              <button
                type="button"
                onClick={() => signedBomInputRef.current?.click()}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Upload Signed BOM
              </button>
              <button
                type="button"
                onClick={() => onViewSignedBoms(draft)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                View Signed BOMs
              </button>
              <input
                ref={signedBomInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  await onUploadSignedBom(draft, file);
                  event.target.value = '';
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
      />
    </label>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
      />
    </label>
  );
}

function SignedBomFilesModal({
  title,
  files,
  loading,
  onClose,
}: {
  title: string;
  files: SignedBomFile[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-950">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">Signed BOM uploads for this record.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-3">File Name</th>
                <th className="px-3 py-3">Uploaded By</th>
                <th className="px-3 py-3">Uploaded</th>
                <th className="px-3 py-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm font-semibold text-slate-500">
                    Loading signed BOM files...
                  </td>
                </tr>
              ) : files.length ? (
                files.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-semibold text-slate-900">{file.file_name}</td>
                    <td className="px-3 py-3">{file.uploaded_by || '-'}</td>
                    <td className="px-3 py-3">{formatUploadedAt(file.uploaded_at)}</td>
                    <td className="px-3 py-3 text-right">
                      {file.signed_url ? (
                        <a
                          href={file.signed_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Open/View
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                    No signed BOM files uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-[96px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      />
    </label>
  );
}

function LocationSelect({
  label,
  value,
  locations,
  onChange,
}: {
  label: string;
  value: string;
  locations: ShippingLocation[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
      >
        <option value="">Manual / Select location</option>
        {locations.map((location) => (
          <option key={location.code} value={location.code}>
            {locationOptionLabel(location)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PrintableItemLines({
  lines,
}: {
  lines: Array<{ quantity: string; part: string; description: string; boxCount: string }>;
}) {
  if (!lines.length) return <span>-</span>;

  return (
    <div className="item-lines">
      <div className="item-line item-head">
        <span>Qty</span>
        <span>Part / Item</span>
        <span>Description</span>
        <span>Boxes</span>
      </div>
      {lines.map((line, index) => (
        <div key={`${line.part}-${line.description}-${index}`} className="item-line">
          <span>{line.quantity}</span>
          <span>{line.part}</span>
          <span>{line.description}</span>
          <span>{line.boxCount}</span>
        </div>
      ))}
    </div>
  );
}

function PrintableBom({ bom }: { bom: BomDraft }) {
  const bomLines = parseBomPrintableLines(bom.items || '');

  return (
    <div id={`print-bom-${bom.bomNumber}`} className="hidden">
      <div className="document">
        <div className="header">
          <Image
            src={DENALI_LOGO_SRC}
            alt="Denali Advanced Integration"
            width={190}
            height={64}
            className="logo"
            unoptimized
          />
          <div className="title-block">
            <h1>BOM / Release</h1>
            <p>BOM #: {bom.bomNumber}</p>
            <p>Manifest #: {bom.manifestNumber}</p>
          </div>
        </div>

        <div className="meta">
          <MetaCell label="Created" value={bom.createdAt || '-'} />
          <MetaCell label="Reference" value={bom.reference || '-'} />
          <MetaCell label="Contact / POC" value={bom.contact || '-'} />
          <MetaCell label="Status" value="Release" />
        </div>

        <div className="meta">
          <MetaCell label="Ship From" value={bom.shipFrom || '-'} />
          <MetaCell label="Ship To" value={bom.shipTo || '-'} />
        </div>

        <table>
          <thead>
            <tr>
              <th>Line</th>
              <th>Qty</th>
              <th>Part Number / Item ID</th>
              <th>Description</th>
              <th>Box Count</th>
            </tr>
          </thead>
          <tbody>
            {bomLines.length ? (
              bomLines.map((line, index) => (
                <tr key={`${bom.bomNumber}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{line.quantity}</td>
                  <td>{line.part}</td>
                  <td>{line.description}</td>
                  <td>{line.boxCount}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="box">
          <div className="box-title">Notes</div>
          <pre>{bom.notes || '-'}</pre>
        </div>

        <SignatureGrid />
      </div>
    </div>
  );
}

function PrintableManifest({
  manifestNumber,
  manifestDate,
  printId,
  rows,
}: {
  manifestNumber: string;
  manifestDate: string;
  printId: string;
  rows: StopRow[];
}) {
  return (
    <div id={printId} className="hidden">
      <div className="document">
        <div className="header">
          <Image
            src={DENALI_LOGO_SRC}
            alt="Denali Advanced Integration"
            width={190}
            height={64}
            className="logo"
            unoptimized
          />
          <div className="title-block">
            <h1>Driver Manifest</h1>
            <p>Manifest #: {manifestNumber}</p>
            <p>Date: {manifestDate || '-'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Stop</th>
              <th>Type</th>
              <th>Date</th>
              <th>From</th>
              <th>To</th>
              <th>PO / Ref</th>
              <th>Items</th>
              <th>Contact</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`print-row-${row.id}`}>
                <td>{index + 1}</td>
                <td>{formatType(row.direction)}</td>
                <td>{row.date || '-'}</td>
                <td>
                  <pre>{displayStopAddress(row.fromLocation, row.fromAddress)}</pre>
                </td>
                <td>
                  <pre>{displayStopAddress(row.toLocation, row.toAddress)}</pre>
                </td>
                <td>
                  {row.shipmentTransferId || '-'}
                  {row.reference ? (
                    <>
                      <br />
                      {row.reference}
                    </>
                  ) : null}
                </td>
                <td>
                  <PrintableItemLines lines={printableStopLines(row)} />
                </td>
                <td>{row.contact || '-'}</td>
                <td>{displayStopStatus(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <SignatureGrid />
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-cell">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function SignatureGrid() {
  return (
    <div className="signature-grid">
      <div>
        <div className="signature-label">Driver / Authorized By</div>
        <div className="signature-line" />
      </div>
      <div>
        <div className="signature-label">Date / Time</div>
        <div className="signature-line" />
      </div>
      <div>
        <div className="signature-label">Released To</div>
        <div className="signature-line" />
      </div>
      <div>
        <div className="signature-label">Signature</div>
        <div className="signature-line" />
      </div>
    </div>
  );
}

function ManifestModal({
  manifestNumber,
  manifestDate,
  rows,
  viewOnly,
  onClose,
  onSave,
  onPrint,
  onEditStop,
}: {
  manifestNumber: string;
  manifestDate: string;
  rows: StopRow[];
  viewOnly: boolean;
  onClose: () => void;
  onSave: () => void;
  onPrint: () => void;
  onEditStop: (row: StopRow) => void;
}) {
  if (!manifestNumber || !manifestDate) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 print:hidden">
      <div className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Image
              src={DENALI_LOGO_SRC}
              alt="Denali Advanced Integration"
              width={176}
              height={60}
              className="h-auto w-44 object-contain"
              unoptimized
            />
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Manifest {manifestNumber}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {viewOnly
                  ? `Review completed stops for ${manifestDate}.`
                  : `Review every stop for ${manifestDate}. Open any stop to edit it.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            aria-label="Close manifest"
          >
            x
          </button>
        </div>

        <StopsTable rows={rows} mode="manifest" onOpen={onEditStop} readOnly={viewOnly} />

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {!viewOnly ? (
            <button
              type="button"
              onClick={onSave}
              className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800"
            >
              Save Manifest
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPrint}
            disabled={!rows.length}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Print Manifest
          </button>
        </div>

        <PrintableManifest
          manifestNumber={manifestNumber}
          manifestDate={manifestDate}
          printId={`print-manifest-modal-${manifestDate}-${manifestNumber}`}
          rows={rows}
        />
      </div>
    </div>
  );
}

function StopsTable({
  rows,
  mode,
  emptyText,
  onOpen,
  onPrintLabels,
  onExportPtouchLabels,
  onDeleteStop,
  onCreateBom,
  onMarkComplete,
  readOnly = false,
}: {
  rows: StopRow[];
  mode: 'pickup' | 'dropoff' | 'manifest';
  emptyText?: string;
  onOpen: (row: StopRow) => void;
  onPrintLabels?: (row: StopRow) => void;
  onExportPtouchLabels?: (row: StopRow) => void;
  onDeleteStop?: (row: StopRow) => void;
  onCreateBom?: (row: StopRow) => void;
  onMarkComplete?: (row: StopRow) => void;
  readOnly?: boolean;
}) {
  const isManifest = mode === 'manifest';
  const primaryAddressLabel = isManifest || mode === 'pickup' ? 'From' : 'To';
  const secondaryAddressLabel = isManifest ? 'To' : '';

  return (
    <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            {isManifest ? <th className="px-3 py-3">Stop</th> : null}
            {isManifest ? <th className="px-3 py-3">Type</th> : null}
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3">{primaryAddressLabel}</th>
            {isManifest ? <th className="px-3 py-3">{secondaryAddressLabel}</th> : null}
            <th className="px-3 py-3">PO / Ref</th>
            <th className="px-3 py-3">Items</th>
            {isManifest ? <th className="px-3 py-3">Contact</th> : null}
            {isManifest ? <th className="px-3 py-3">Status</th> : null}
            <th className="px-3 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.length ? (
            rows.map((row, index) => {
              const primaryAddress =
                isManifest || mode === 'pickup'
                  ? displayStopAddress(row.fromLocation, row.fromAddress)
                  : displayStopAddress(row.toLocation, row.toAddress);
              const secondaryAddress =
                isManifest || mode === 'pickup'
                  ? displayStopAddress(row.toLocation, row.toAddress)
                  : displayStopAddress(row.fromLocation, row.fromAddress);

              return (
                <tr key={`${mode}-${row.id}`} className="align-top hover:bg-slate-50">
                  {isManifest ? (
                    <td className="px-3 py-3 font-bold text-slate-950">Stop {index + 1}</td>
                  ) : null}
                  {isManifest ? <td className="px-3 py-3">{formatType(row.direction)}</td> : null}
                  <td className="px-3 py-3">{row.date || '-'}</td>
                  <td className="whitespace-pre-line px-3 py-3">{primaryAddress}</td>
                  {isManifest ? (
                    <td className="whitespace-pre-line px-3 py-3">{secondaryAddress}</td>
                  ) : null}
                  <td className="px-3 py-3">
                    <div>{row.shipmentTransferId || '-'}</div>
                    <div className="text-xs text-slate-500">{row.reference || ''}</div>
                  </td>
                  <td className="whitespace-pre-line px-3 py-3">{stopItemsText(row) || '-'}</td>
                  {isManifest ? <td className="px-3 py-3">{row.contact || '-'}</td> : null}
                  {isManifest ? <td className="px-3 py-3">{displayStopStatus(row.status)}</td> : null}
                  <td className="px-3 py-3 text-right">
                    {readOnly ? (
                      <span className="text-xs font-semibold text-slate-500">View-only</span>
                    ) : (
                      <div className="erp-row-actions">
                        <button type="button" onClick={() => onOpen(row)} className="erp-action-primary">
                          Open
                        </button>
                        {onPrintLabels ? (
                          <button
                            type="button"
                            onClick={() => onPrintLabels(row)}
                            disabled={buildStopLabelPayloads(row).length === 0}
                            className="erp-action-secondary"
                          >
                            Print Labels
                          </button>
                        ) : null}
                        {onExportPtouchLabels ? (
                          <button
                            type="button"
                            onClick={() => onExportPtouchLabels(row)}
                            className="erp-action-secondary"
                          >
                            Export P-touch Labels
                          </button>
                        ) : null}
                        {onDeleteStop ? (
                          <button
                            type="button"
                            onClick={() => onDeleteStop(row)}
                            className="erp-action-secondary text-rose-700"
                          >
                            Delete
                          </button>
                        ) : null}
                        {row.direction === 'outgoing' && onCreateBom ? (
                          <button
                            type="button"
                            onClick={() => onCreateBom(row)}
                            className="erp-action-secondary"
                          >
                            Create BOM
                          </button>
                        ) : null}
                        {onMarkComplete ? (
                          <button
                            type="button"
                            onClick={() => onMarkComplete(row)}
                            disabled={stopStatusIsComplete(row.status)}
                            className="erp-action-secondary"
                          >
                            {stopStatusIsComplete(row.status) ? 'Complete' : 'Mark Complete'}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={isManifest ? 10 : 5}
                className="px-3 py-8 text-center text-sm text-slate-500"
              >
                {emptyText || 'No stops found.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DeliveryClient({
  canManageDelivery,
  focusedManifestNumber,
  focusedManifestDate,
  initialManifestHistoryFilter,
}: DeliveryClientProps) {
  const [rows, setRows] = useState<StopRow[]>([]);
  const [locations, setLocations] = useState<ShippingLocation[]>([]);
  const [selectedRow, setSelectedRow] = useState<StopRow | null>(null);
  const [selectedManifestNumber, setSelectedManifestNumber] = useState('');
  const [selectedManifestDate, setSelectedManifestDate] = useState(today());
  const [manifestHistoryFilter, setManifestHistoryFilter] =
    useState<ManifestStatusFilter>(initialManifestHistoryFilter);
  const [initialManifestFocusApplied, setInitialManifestFocusApplied] = useState(false);
  const [bomDrafts, setBomDrafts] = useState<BomDraft[]>([]);
  const [message, setMessage] = useState('');
  const [loadingLabel, setLoadingLabel] = useState('');
  const [signedBomFiles, setSignedBomFiles] = useState<SignedBomFile[]>([]);
  const [signedBomModalOpen, setSignedBomModalOpen] = useState(false);
  const [signedBomModalTitle, setSignedBomModalTitle] = useState('Signed BOM Files');
  const [signedBomListLoading, setSignedBomListLoading] = useState(false);
  const [intakeDraftApplied, setIntakeDraftApplied] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [signedBomContext, setSignedBomContext] = useState<{
    manifestNumber: string;
    bomNumber?: string;
    stopId?: string;
  } | null>(null);
  const bomUploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function refreshData() {
    const [manifestRows, bomRows, shippingLocations] = await Promise.all([
      loadManifestRows(),
      loadBomRows(),
      loadShippingLocations(),
    ]);

    setRows(manifestRows);
    setBomDrafts(bomRows);
    setLocations(shippingLocations);
  }

  useEffect(() => {
    async function init() {
      try {
        setLoadingLabel('Loading shipping and delivery records...');
        await refreshData();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Shipping data failed to load.');
      } finally {
        setLoadingLabel('');
        setDataLoaded(true);
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;
    if (intakeDraftApplied) return;

    const rawDraft = window.localStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY);
    if (!rawDraft) {
      setIntakeDraftApplied(true);
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as Partial<DeliveryDraftPayload>;
      if (draft.direction !== 'pickup' && draft.direction !== 'delivery') {
        throw new Error('AI intake draft direction was not recognized.');
      }

      const requestedDate = clean(draft.requested_date) || selectedManifestDate || today();
      const direction: Direction = draft.direction === 'pickup' ? 'incoming' : 'outgoing';
      const manifestNumber = manifestNumberForDate(requestedDate, activeManifestRows(rows), rows);
      const baseRow = emptyStop(direction, manifestNumber, requestedDate, locations);

      const pickupLocation = clean(draft.pickup_location);
      const dropoffLocation = clean(draft.dropoff_location);

      const fromLocation =
        direction === 'incoming'
          ? pickupLocation
          : pickupLocation || baseRow.fromLocation || DEFAULT_SITE;
      const toLocation =
        direction === 'incoming'
          ? dropoffLocation || baseRow.toLocation || DEFAULT_SITE
          : dropoffLocation;

      const contactParts = [
        clean(draft.contact_name),
        clean(draft.contact_phone),
        clean(draft.contact_email),
      ].filter(Boolean);
      const intakeLineItems = Array.isArray(draft.line_items)
        ? draft.line_items
            .map((line, index) => ({
              id: newId(`ai-line-${index + 1}`),
              stopId: baseRow.id,
              partNumber: clean(line.part_number),
              itemId: clean(line.item_id),
              description: clean(line.description),
              quantity: String(Number(line.quantity) || 1),
              boxCount: String(Number(line.box_count) || 1),
              notes: clean(line.notes),
              createdAt: new Date().toISOString(),
            }))
            .filter((line) => parseQuantity(line.quantity) > 0 && (itemIdentifier(line) || line.description))
        : [];

      const draftRow: StopRow = {
        ...baseRow,
        date: requestedDate,
        manifestNumber,
        title: clean(draft.company_name) || baseRow.title,
        time: clean(draft.requested_time),
        shipmentTransferId: clean(draft.shipment_transfer_id),
        reference: clean(draft.project_or_work_order) || clean(draft.shipment_transfer_id),
        fromLocation,
        fromAddress: fromLocation ? addressForLocation(locations, fromLocation) : '',
        toLocation,
        toAddress: toLocation ? addressForLocation(locations, toLocation) : '',
        contact: contactParts.join(' | '),
        items: clean(draft.items),
        lineItems: intakeLineItems,
        notes: clean(draft.notes),
      };

      setSelectedManifestDate(requestedDate);
      setSelectedManifestNumber(manifestNumber);
      setSelectedRow(draftRow);
      setMessage('AI intake draft loaded. Review and click Save to add this stop to the manifest.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI intake draft could not be loaded.');
    } finally {
      window.localStorage.removeItem(DELIVERY_DRAFT_STORAGE_KEY);
      setIntakeDraftApplied(true);
    }
  }, [dataLoaded, intakeDraftApplied, locations, rows, selectedManifestDate]);

  useEffect(() => {
    if (initialManifestFocusApplied || !focusedManifestNumber || !rows.length) return;

    const matchedRow = rows.find(
      (row) =>
        row.manifestNumber === focusedManifestNumber &&
        (!focusedManifestDate || row.date === focusedManifestDate)
    );

    if (!matchedRow) return;

    setManifestHistoryFilter('ALL');
    setSelectedManifestDate(matchedRow.date);
    setSelectedManifestNumber(matchedRow.manifestNumber);
    setMessage(`Opened manifest ${matchedRow.manifestNumber} from transaction history.`);
    setInitialManifestFocusApplied(true);
  }, [
    focusedManifestDate,
    focusedManifestNumber,
    initialManifestFocusApplied,
    rows,
  ]);

  const activeRows = useMemo(() => activeManifestRows(rows), [rows]);
  const selectedDateManifestNumber = manifestNumberForDate(
    selectedManifestDate,
    activeRows,
    rows
  );
  const pickups = activeRows.filter(
    (row) => row.date === selectedManifestDate && row.direction === 'incoming'
  );
  const dropOffs = activeRows.filter(
    (row) => row.date === selectedManifestDate && row.direction === 'outgoing'
  );
  const selectedDateManifestRows = rowsForManifest(
    activeRows,
    selectedDateManifestNumber,
    selectedManifestDate
  );
  const selectedManifestRows = rowsForManifest(rows, selectedManifestNumber, selectedManifestDate);
  const selectedManifestIsComplete = manifestRowsAreComplete(selectedManifestRows);

  const groupedByDate = useMemo(() => {
    const dateGroups = new Map<string, Map<string, StopRow[]>>();

    for (const row of rows) {
      const date = row.date || 'Unassigned';
      const manifestNumber = row.manifestNumber || 'Unassigned';
      const manifests = dateGroups.get(date) || new Map<string, StopRow[]>();
      manifests.set(manifestNumber, [...(manifests.get(manifestNumber) || []), row]);
      dateGroups.set(date, manifests);
    }

    return Array.from(dateGroups.entries()).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }, [rows]);

  const manifestHistoryRows = useMemo(() => {
    return groupedByDate.flatMap(([date, manifestsMap]) =>
      Array.from(manifestsMap.entries())
        .sort((a, b) => parseManifestNumber(b[0]) - parseManifestNumber(a[0]))
        .filter(([, manifestRows]) => {
          const isComplete = manifestRowsAreComplete(manifestRows);
          if (manifestHistoryFilter === 'COMPLETE') return isComplete;
          if (manifestHistoryFilter === 'OPEN') return !isComplete;
          return true;
        })
        .map(([manifestNumber, manifestRows], index) => ({
          date,
          manifestNumber,
          manifestRows,
          index,
          isComplete: manifestRowsAreComplete(manifestRows),
        }))
    );
  }, [groupedByDate, manifestHistoryFilter]);

  function changeManifestDate(value: string) {
    setSelectedManifestDate(value);
    setSelectedManifestNumber('');
    setSelectedRow(null);
  }

  async function fetchSignedBomFiles(filters: {
    manifestNumber: string;
    bomNumber?: string;
    stopId?: string;
  }) {
    const params = new URLSearchParams({ manifest_number: filters.manifestNumber });
    if (filters.bomNumber) params.set('bom_number', filters.bomNumber);
    if (filters.stopId) params.set('stop_id', filters.stopId);

    const res = await fetch(`/api/shipping/signed-boms?${params.toString()}`, {
      cache: 'no-store',
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || 'Failed to load signed BOM files.');
    return (data.rows || []) as SignedBomFile[];
  }

  async function uploadSignedBomFile(file: File, context: {
    manifestNumber: string;
    bomNumber?: string;
    stopId?: string;
  }) {
    const form = new FormData();
    form.set('file', file);
    form.set('manifest_number', context.manifestNumber);
    if (context.bomNumber) form.set('bom_number', context.bomNumber);
    if (context.stopId) form.set('stop_id', context.stopId);

    const res = await fetch('/api/shipping/signed-boms', {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || 'Upload failed.');
  }

  async function openSignedBomList(context: {
    manifestNumber: string;
    bomNumber?: string;
    stopId?: string;
    title: string;
  }) {
    try {
      setSignedBomModalOpen(true);
      setSignedBomModalTitle(context.title);
      setSignedBomContext({
        manifestNumber: context.manifestNumber,
        bomNumber: context.bomNumber,
        stopId: context.stopId,
      });
      setSignedBomListLoading(true);
      const files = await fetchSignedBomFiles(context);
      setSignedBomFiles(files);
    } catch (error) {
      setSignedBomFiles([]);
      setMessage(error instanceof Error ? error.message : 'Could not load signed BOM files.');
    } finally {
      setSignedBomListLoading(false);
    }
  }

  async function addStop(direction: Direction) {
    if (!canManageDelivery) {
      setMessage('Warehouse or admin access is required to change delivery records.');
      return;
    }

    const manifestNumber = manifestNumberForDate(selectedManifestDate, activeRows, rows);
    if (manifestRowsAreComplete(rowsForManifest(rows, manifestNumber, selectedManifestDate))) {
      setMessage('Completed manifests are view-only from delivery history.');
      setSelectedRow(null);
      return;
    }

    try {
      const row = emptyStop(direction, manifestNumber, selectedManifestDate, locations);

      setLoadingLabel(`Creating ${formatType(direction)}...`);
      await saveManifestRow(row, 'POST');
      await refreshData();
      setSelectedRow(row);
      setMessage(`${formatType(direction)} added to manifest ${manifestNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${formatType(direction)} save failed.`);
    } finally {
      setLoadingLabel('');
    }
  }

  async function handleSaveRow(row: StopRow, exportLabelsAfterSave: boolean) {
    if (!canManageDelivery) {
      setMessage('Warehouse or admin access is required to change delivery records.');
      return;
    }

    if (manifestRowsAreComplete(rowsForManifest(rows, row.manifestNumber, row.date))) {
      setMessage('Completed manifests are view-only from delivery history.');
      setSelectedRow(null);
      return;
    }

    try {
      const validationErrors = validateStopLineItems(row.lineItems);
      if (validationErrors.length) {
        throw new Error(validationErrors.join(' '));
      }

      const rowDate = row.date || selectedManifestDate || today();
      const manifestNumber = manifestNumberForDate(
        rowDate,
        activeRows.filter((existing) => existing.id !== row.id),
        rows.filter((existing) => existing.id !== row.id)
      );
      const boxCount = parseBoxCount(row.boxCount);
      const structuredBoxCount = totalLineBoxCount(row.lineItems);
      const rowToSave = {
        ...row,
        date: rowDate,
        manifestNumber,
        boxCount: row.lineItems.length
          ? String(structuredBoxCount)
          : boxCount > 0
            ? String(boxCount)
            : clean(row.boxCount),
      };
      const labelPayloads = buildStopLabelPayloads(rowToSave);
      const shouldExportLabels = exportLabelsAfterSave && labelPayloads.length > 0;
      const exportedLabelCount = shouldExportLabels ? labelPayloads.length : 0;

      setLoadingLabel('Saving manifest stop...');
      await saveManifestRow(rowToSave, 'PATCH');
      if (shouldExportLabels) {
        downloadLabelPayloadsCsv(labelPayloads, `${manifestNumber}-${rowToSave.id}-labels`);
      }
      await refreshData();
      setSelectedRow(null);
      setSelectedManifestDate(rowDate);
      setSelectedManifestNumber(manifestNumber);
      setMessage(`Stop saved. ${exportedLabelCount} labels exported.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setLoadingLabel('');
    }
  }

  async function handleCreateBom(row: StopRow) {
    if (!canManageDelivery) {
      setMessage('Warehouse or admin access is required to create BOMs.');
      return;
    }

    if (manifestRowsAreComplete(rowsForManifest(rows, row.manifestNumber, row.date))) {
      setMessage('Completed manifests are view-only from delivery history.');
      return;
    }

    try {
      const bomNumber = createBomNumber(bomDrafts.map((bom) => bom.bomNumber).filter(Boolean));
      const bom: BomDraft = {
        bomNumber,
        manifestNumber: row.manifestNumber,
        sourceStopId: row.id,
        createdAt: new Date().toISOString(),
        reference: row.reference || row.shipmentTransferId,
        shipFrom: displayStopAddress(row.fromLocation, row.fromAddress),
        shipTo: displayStopAddress(row.toLocation, row.toAddress),
        contact: row.contact,
        items: formatStopLinesForBom(row),
        notes: row.notes,
      };

      setLoadingLabel('Creating BOM...');
      await saveBomRow(bom);
      await refreshData();
      setMessage(`BOM ${bomNumber} created.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'BOM creation failed.');
    } finally {
      setLoadingLabel('');
    }
  }

  async function handleUploadSignedBomForBom(bom: BomDraft, file: File) {
    try {
      setLoadingLabel('Uploading signed BOM...');
      await uploadSignedBomFile(file, {
        manifestNumber: bom.manifestNumber,
        bomNumber: bom.bomNumber,
        stopId: bom.sourceStopId || undefined,
      });
      setMessage(`Signed BOM uploaded for ${bom.bomNumber}.`);

      if (
        signedBomContext &&
        signedBomContext.manifestNumber === bom.manifestNumber &&
        signedBomContext.bomNumber === bom.bomNumber
      ) {
        const files = await fetchSignedBomFiles({
          manifestNumber: bom.manifestNumber,
          bomNumber: bom.bomNumber,
          stopId: bom.sourceStopId || undefined,
        });
        setSignedBomFiles(files);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Signed BOM upload failed.');
    } finally {
      setLoadingLabel('');
    }
  }

  async function handleUploadSignedBomForStop(row: StopRow, file: File) {
    try {
      setLoadingLabel('Uploading signed BOM...');
      await uploadSignedBomFile(file, {
        manifestNumber: row.manifestNumber,
        stopId: row.id,
      });
      setMessage(`Signed BOM uploaded for stop ${row.id}.`);
      if (
        signedBomContext &&
        signedBomContext.manifestNumber === row.manifestNumber &&
        signedBomContext.stopId === row.id
      ) {
        const files = await fetchSignedBomFiles({
          manifestNumber: row.manifestNumber,
          stopId: row.id,
        });
        setSignedBomFiles(files);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Signed BOM upload failed.');
    } finally {
      setLoadingLabel('');
    }
  }

  function handlePrintStopLabels(row: StopRow) {
    const labelPayloads = buildStopLabelPayloads(row);

    if (!labelPayloads.length) {
      setMessage('No labels were created. Add a box count or structured stop items first.');
      return;
    }

    downloadLabelPayloadsCsv(labelPayloads, `${row.manifestNumber || 'manifest'}-${row.id}-labels`);
    setMessage(`${labelPayloads.length} label record(s) exported for ${row.manifestNumber || row.id}.`);
  }

  function handlePrintManifestLabels(manifestNumber: string, manifestRows: StopRow[]) {
    const labelPayloads = manifestRows.flatMap(buildStopLabelPayloads);

    if (!labelPayloads.length) {
      setMessage(`No labels were created for manifest ${manifestNumber}.`);
      return;
    }

    downloadLabelPayloadsCsv(labelPayloads, `${manifestNumber}-labels`);
    setMessage(`${labelPayloads.length} label record(s) exported for manifest ${manifestNumber}.`);
  }

  function handleExportStopPtouchLabels(row: StopRow) {
    const rows = buildSimplePtouchRows(row);
    downloadSimplePtouchCsv(rows);
    setMessage(`${rows.length} P-touch CSV row(s) exported.`);
  }

  function handleExportManifestPtouchLabels(manifestRows: StopRow[]) {
    const rows = manifestRows.flatMap(buildSimplePtouchRows);
    downloadSimplePtouchCsv(rows);
    setMessage(`${rows.length} P-touch CSV row(s) exported for manifest.`);
  }

  async function handleDeleteStop(row: StopRow) {
    if (!canManageDelivery) {
      setMessage('Warehouse or admin access is required to update delivery records.');
      return;
    }

    if (
      !window.confirm(
        `Delete stop ${row.shipmentTransferId || row.reference || row.id}? This removes it from active manifests and history lists.`
      )
    ) {
      return;
    }

    try {
      setLoadingLabel('Deleting stop...');
      await deleteManifestStop(row.id);
      await refreshData();
      if (selectedRow?.id === row.id) {
        setSelectedRow(null);
      }
      setMessage('Stop deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete stop.');
    } finally {
      setLoadingLabel('');
    }
  }

  async function handleDeleteManifestReceipt(manifestNumber: string, manifestDate: string) {
    if (!canManageDelivery) {
      setMessage('Warehouse or admin access is required to update delivery records.');
      return;
    }

    if (
      !window.confirm(
        `Delete delivery receipt ${manifestNumber} for ${manifestDate}? This removes the manifest history records for that date.`
      )
    ) {
      return;
    }

    try {
      setLoadingLabel('Deleting delivery receipt...');
      await deleteManifestReceipt(manifestNumber, manifestDate);
      await refreshData();
      setMessage(`Delivery receipt ${manifestNumber} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete delivery receipt.');
    } finally {
      setLoadingLabel('');
    }
  }

  async function handleMarkStopComplete(row: StopRow) {
    if (!canManageDelivery) {
      setMessage('Warehouse or admin access is required to update delivery records.');
      return;
    }

    if (stopStatusIsComplete(row.status)) return;

    if (!window.confirm(`Mark ${formatType(row.direction)} ${row.shipmentTransferId || row.reference || row.id} complete?`)) {
      return;
    }

    try {
      setLoadingLabel('Marking stop complete...');
      await saveManifestRow({ ...row, status: 'Completed' }, 'PATCH');
      await refreshData();
      setMessage(`${formatType(row.direction)} marked complete.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not mark stop complete.');
    } finally {
      setLoadingLabel('');
    }
  }

  async function handleMarkManifestComplete(
    manifestNumber: string,
    manifestDate: string,
    manifestRows: StopRow[]
  ) {
    if (!canManageDelivery) {
      setMessage('Warehouse or admin access is required to update delivery records.');
      return;
    }

    if (manifestRowsAreComplete(manifestRows)) return;

    if (
      !window.confirm(
        `Mark manifest ${manifestNumber} complete? Completed manifests will move to transaction history.`
      )
    ) {
      return;
    }

    try {
      setLoadingLabel('Completing manifest...');
      const result = await completeManifest(manifestNumber, manifestDate);
      await refreshData();
      setSelectedRow(null);
      setSelectedManifestNumber('');
      setMessage(
        result.message ||
          `Manifest ${manifestNumber} completed with ${result.stopCount ?? manifestRows.length} stops.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete manifest.');
    } finally {
      setLoadingLabel('');
    }
  }

  function openManifest(manifestNumber: string, manifestDate: string) {
    setSelectedManifestDate(manifestDate);
    setSelectedManifestNumber(manifestNumber);
    setSelectedRow(null);
    setMessage(`Opened manifest ${manifestNumber}.`);
  }

  async function saveSelectedManifest() {
    if (!selectedManifestNumber) return;
    if (!canManageDelivery) {
      setMessage('Warehouse or admin access is required to save manifests.');
      return;
    }
    if (selectedManifestIsComplete) {
      setMessage('Completed manifests are view-only from delivery history.');
      return;
    }

    try {
      setLoadingLabel('Saving manifest...');
      await Promise.all(selectedManifestRows.map((row) => saveManifestRow(row, 'PATCH')));
      await refreshData();
      setMessage(`Manifest ${selectedManifestNumber} saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Manifest save failed.');
    } finally {
      setLoadingLabel('');
    }
  }

  return (
    <div className="space-y-4">
      {loadingLabel ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-800 shadow-2xl">
            {loadingLabel}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Shipping & Delivery Control</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manual pickups, drop offs, manifest history, and BOM release paperwork.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/address-book"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Address Book
            </Link>
            {canManageDelivery ? (
              <>
                <button
                  type="button"
                  onClick={() => addStop('incoming')}
                  className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800"
                >
                  Add Pickup
                </button>
                <button
                  type="button"
                  onClick={() => addStop('outgoing')}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Add Drop Off
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => printElementById('print-selected-manifest')}
              disabled={!selectedDateManifestRows.length}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Print Manifest
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            {message}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-5 print:hidden">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Manifest Date
          </label>
          <input
            type="date"
            value={selectedManifestDate}
            onChange={(event) => changeManifestDate(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
          />
        </div>

        <Stat label="Selected Manifest" value={selectedDateManifestNumber || 'DAI-M-'} />
        <Stat label="Pickups" value={String(pickups.length)} />
        <Stat label="Drop Offs" value={String(dropOffs.length)} />
        <Stat label="Saved BOMs" value={String(bomDrafts.length)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-950">Pickups for Selected Date</h3>
          <StopsTable
            rows={pickups}
            mode="pickup"
            emptyText={`No pickups for ${selectedManifestDate}.`}
            onOpen={setSelectedRow}
            onPrintLabels={handlePrintStopLabels}
            onExportPtouchLabels={handleExportStopPtouchLabels}
            onDeleteStop={handleDeleteStop}
            onMarkComplete={handleMarkStopComplete}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-950">Drop Offs for Selected Date</h3>
          <StopsTable
            rows={dropOffs}
            mode="dropoff"
            emptyText={`No drop offs for ${selectedManifestDate}.`}
            onOpen={setSelectedRow}
            onPrintLabels={handlePrintStopLabels}
            onExportPtouchLabels={handleExportStopPtouchLabels}
            onDeleteStop={handleDeleteStop}
            onCreateBom={handleCreateBom}
            onMarkComplete={handleMarkStopComplete}
          />
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-950">Manifest History</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Completed manifests move out of active delivery work and remain available here.
            </p>
          </div>
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Status
            <select
              value={manifestHistoryFilter}
              onChange={(event) =>
                setManifestHistoryFilter(event.target.value as ManifestStatusFilter)
              }
              className="mt-1 block h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-800"
            >
              <option value="OPEN">Open</option>
              <option value="COMPLETE">Completed</option>
              <option value="ALL">All</option>
            </select>
          </label>
        </div>
        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Date / Manifest</th>
                <th className="px-3 py-3">Stops</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {manifestHistoryRows.length ? (
                manifestHistoryRows.map(({ date, manifestNumber, manifestRows, index, isComplete }) => (
                  <tr key={`${date}-${manifestNumber}`} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-bold text-slate-950">
                      {index === 0 ? (
                        <div className="mb-2 text-xs font-bold text-slate-500">{date}</div>
                      ) : null}
                      {manifestNumber}
                    </td>
                    <td className="px-3 py-3">{manifestRows.length}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${
                          isComplete
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-cyan-200 bg-cyan-50 text-cyan-700'
                        }`}
                      >
                        {manifestStatusLabel(manifestRows)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openManifest(manifestNumber, date)}
                          className={isComplete ? 'erp-action-secondary' : 'erp-action-primary'}
                        >
                          {isComplete ? 'View' : 'Open'}
                        </button>
                        {!isComplete ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleMarkManifestComplete(manifestNumber, date, manifestRows)
                            }
                            className="erp-action-secondary"
                          >
                            Complete
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            printElementById(`print-manifest-history-${date}-${manifestNumber}`)
                          }
                          className="erp-action-secondary"
                        >
                          Print
                        </button>
                        {!isComplete ? (
                          <button
                            type="button"
                            onClick={() => handlePrintManifestLabels(manifestNumber, manifestRows)}
                            disabled={manifestRows.flatMap(buildStopLabelPayloads).length === 0}
                            className="erp-action-secondary"
                          >
                            Print Labels
                          </button>
                        ) : null}
                        {!isComplete ? (
                          <button
                            type="button"
                            onClick={() => handleExportManifestPtouchLabels(manifestRows)}
                            className="erp-action-secondary"
                          >
                            Export P-touch Labels
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleDeleteManifestReceipt(manifestNumber, date)}
                          className="erp-action-secondary text-rose-700"
                        >
                          Delete Receipt
                        </button>
                      </div>

                      <PrintableManifest
                        manifestNumber={manifestNumber}
                        manifestDate={date}
                        printId={`print-manifest-history-${date}-${manifestNumber}`}
                        rows={manifestRows.filter(
                          (row) => row.manifestNumber === manifestNumber && row.date === date
                        )}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                    No {manifestHistoryFilter === 'OPEN' ? 'open' : manifestHistoryFilter.toLowerCase()}{' '}
                    manifest history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <h3 className="text-base font-bold text-slate-950">BOM / Release History</h3>
        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-3">BOM #</th>
                <th className="px-3 py-3">Manifest</th>
                <th className="px-3 py-3">Reference</th>
                <th className="px-3 py-3">Ship To</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {bomDrafts.length ? (
                bomDrafts.map((bom) => (
                  <tr key={bom.bomNumber} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3 font-bold text-slate-950">{bom.bomNumber}</td>
                    <td className="px-3 py-3">{bom.manifestNumber || '-'}</td>
                    <td className="px-3 py-3">{bom.reference || '-'}</td>
                    <td className="whitespace-pre-line px-3 py-3">{bom.shipTo || '-'}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => printElementById(`print-bom-${bom.bomNumber}`)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Print
                        </button>
                        <button
                          type="button"
                          onClick={() => bomUploadInputRefs.current[bom.bomNumber]?.click()}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Upload Signed BOM
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openSignedBomList({
                              manifestNumber: bom.manifestNumber,
                              bomNumber: bom.bomNumber,
                              stopId: bom.sourceStopId || undefined,
                              title: `Signed BOMs · ${bom.bomNumber}`,
                            })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          View Signed BOMs
                        </button>
                        <input
                          ref={(node) => {
                            bomUploadInputRefs.current[bom.bomNumber] = node;
                          }}
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            await handleUploadSignedBomForBom(bom, file);
                            event.target.value = '';
                          }}
                        />
                      </div>
                      <PrintableBom bom={bom} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                    No BOMs created yet. Open a drop off and select Create BOM.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PrintableManifest
        manifestNumber={selectedDateManifestNumber}
        manifestDate={selectedManifestDate}
        printId="print-selected-manifest"
        rows={selectedDateManifestRows}
      />

      <ManifestModal
        manifestNumber={selectedManifestNumber}
        manifestDate={selectedManifestDate}
        rows={selectedManifestRows}
        viewOnly={selectedManifestIsComplete}
        onClose={() => setSelectedManifestNumber('')}
        onSave={saveSelectedManifest}
        onPrint={() =>
          printElementById(`print-manifest-modal-${selectedManifestDate}-${selectedManifestNumber}`)
        }
        onEditStop={setSelectedRow}
      />

      <StopModal
        row={selectedRow}
        locations={locations}
        onClose={() => setSelectedRow(null)}
        onSave={handleSaveRow}
        onCreateBom={handleCreateBom}
        onUploadSignedBom={handleUploadSignedBomForStop}
        onViewSignedBoms={(row) =>
          openSignedBomList({
            manifestNumber: row.manifestNumber,
            stopId: row.id,
            title: `Signed BOMs · Stop ${row.id}`,
          })
        }
      />

      {signedBomModalOpen ? (
        <SignedBomFilesModal
          title={signedBomModalTitle}
          files={signedBomFiles}
          loading={signedBomListLoading}
          onClose={() => {
            setSignedBomModalOpen(false);
            setSignedBomContext(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
    </div>
  );
}
