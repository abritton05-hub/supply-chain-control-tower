'use client';

import { useState } from 'react';
import {
  buildInventoryItemLabelPayload,
  buildLocationLabelPayload,
  downloadPtouchLabelsCsv,
} from '@/lib/labels/p-touch';

type InventoryLabelItem = {
  item_id: string;
  part_number: string | null;
  description: string | null;
  location: string | null;
  site: string | null;
  bin_location: string | null;
  qty_on_hand: number | null;
};

type PrintButtonProps = {
  className?: string;
  showMessage?: boolean;
};

type PrintInventoryTagButtonProps = PrintButtonProps & {
  item: InventoryLabelItem;
};

type PrintLocationLabelButtonProps = PrintButtonProps & {
  location: string | null | undefined;
  binLocation?: string | null;
};


function Message({
  message,
  isError,
}: {
  message: string;
  isError: boolean;
}) {
  if (!message) return null;

  return (
    <p
      aria-live="polite"
      className={`max-w-56 text-xs font-semibold ${isError ? 'text-rose-700' : 'text-emerald-700'}`}
    >
      {message}
    </p>
  );
}

export function PrintInventoryTagButton({
  item,
  className = 'erp-button',
  showMessage = true,
}: PrintInventoryTagButtonProps) {
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

      downloadPtouchLabelsCsv([payload]);
      setIsError(false);
      setMessage('P-touch label CSV exported.');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Inventory tag export failed.');
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button type="button" onClick={printInventoryTag} className={className}>
        Export P-touch Labels
      </button>
      {showMessage ? <Message message={message} isError={isError} /> : null}
    </div>
  );
}

export function PrintLocationLabelButton({
  location,
  binLocation,
  className = 'erp-button-secondary',
  showMessage = true,
}: PrintLocationLabelButtonProps) {
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  function printLocationLabel() {
    try {
      const payload = buildLocationLabelPayload({
        location,
        binLocation,
      });

      downloadPtouchLabelsCsv([payload]);
      setIsError(false);
      setMessage('P-touch label CSV exported.');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Location label export failed.');
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button type="button" onClick={printLocationLabel} className={className}>
        Export P-touch Labels
      </button>
      {showMessage ? <Message message={message} isError={isError} /> : null}
    </div>
  );
}
