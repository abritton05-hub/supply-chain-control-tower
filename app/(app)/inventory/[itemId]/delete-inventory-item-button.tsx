'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { archiveInventoryItem } from '../actions';

type Props = {
  itemId: string;
  label: string;
};

export function ArchiveInventoryItemButton({ itemId, label }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  function handleArchive() {
    setMessage('');

    const confirmed = window.confirm(
      'Archive this inventory item? It will disappear from active inventory but history will remain.'
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await archiveInventoryItem(itemId);
      const detail = result.skipReasons?.length ? ` ${result.skipReasons.join(' ')}` : '';
      const nextMessage = `${result.message}${detail}`;

      if (!result.ok) {
        setMessage(nextMessage);
        return;
      }

      setMessage(nextMessage);
      window.setTimeout(() => {
        router.push('/inventory');
        router.refresh();
      }, 700);
    });
  }

  return (
    <div className="flex max-w-full flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleArchive}
        disabled={isPending}
        aria-label={`Archive ${label}`}
        className="erp-action-danger min-h-11 px-4 text-sm"
      >
        {isPending ? 'Archiving...' : 'Archive Item'}
      </button>
      {message ? (
        <p className="max-w-80 text-xs font-medium text-rose-700" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
