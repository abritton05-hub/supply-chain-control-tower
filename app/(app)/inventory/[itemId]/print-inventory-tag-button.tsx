'use client';

import { useState } from 'react';
import {
  buildInventoryItemLabelPayload,
  downloadLabelPayloadsCsv,
} from '@/lib/labels/p-touch';
import type { InventoryRecord } from '../types';

type Props = {
  item: Pick<
    InventoryRecord,
    'item_id' | 'part_number' | 'description' | 'location' | 'site' | 'bin_location' | 'qty_on_hand'
  >;
};

function labelFileSeed(item: Props['item']) {
  return `inventory-tag-${item.part_number || item.item_id}`;
}

export function PrintInventoryTagButton({ item }: Props) {
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  function printInventoryTag() {
    try {
      const payload = buildInventoryItemLabelPayload({
        itemId: item.item_id,
        partNumber: item.part_number,
        description: item.description,
        quantity: item.qty_on_hand,
        location: item.site || item.location,
        binLocation: item.bin_location,
      });

      downloadLabelPayloadsCsv([payload], labelFileSeed(item));
      setIsError(false);
      setMessage('Inventory tag CSV exported for P-touch Editor.');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Inventory tag export failed.');
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button type="button" onClick={printInventoryTag} className="erp-button">
        Print Inventory Tag
      </button>
      {message ? (
        <p
          aria-live="polite"
          className={`max-w-56 text-xs font-semibold ${isError ? 'text-rose-700' : 'text-emerald-700'}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
