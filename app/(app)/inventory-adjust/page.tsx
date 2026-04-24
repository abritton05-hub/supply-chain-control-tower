import { redirect } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canEditInventory } from '@/lib/auth/roles';
import { InventoryAdjustClient } from './inventory-adjust-client';

export const dynamic = 'force-dynamic';

export default async function InventoryAdjustPage({
  searchParams,
}: {
  searchParams?: {
    mode?: string | string[];
    returnTo?: string | string[];
    part_number?: string | string[];
    description?: string | string[];
  };
}) {
  const profile = await getCurrentUserProfile();

  if (!canEditInventory(profile.role)) {
    redirect('/inventory');
  }

  const mode = Array.isArray(searchParams?.mode)
    ? searchParams?.mode[0]
    : searchParams?.mode;
  const returnTo = Array.isArray(searchParams?.returnTo)
    ? searchParams?.returnTo[0]
    : searchParams?.returnTo;
  const partNumber = Array.isArray(searchParams?.part_number)
    ? searchParams?.part_number[0]
    : searchParams?.part_number;
  const description = Array.isArray(searchParams?.description)
    ? searchParams?.description[0]
    : searchParams?.description;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Inventory Adjust"
        subtitle="Add new items and manage controlled inventory adjustments"
      />
      <InventoryAdjustClient
        initialMode={mode === 'adjust' ? 'adjust' : 'add'}
        returnTo={returnTo ?? ''}
        initialPartNumber={partNumber ?? ''}
        initialDescription={description ?? ''}
      />
    </div>
  );
}