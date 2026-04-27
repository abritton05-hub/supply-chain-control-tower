import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canViewInventory } from '@/lib/auth/roles';
import { AlertsClient } from './alerts-client';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  noStore();

  const profile = await getCurrentUserProfile();

  if (!canViewInventory(profile.role)) {
    redirect('/login');
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Alerts"
        subtitle="Active ERP exceptions from inventory, pull requests, deliveries, and pinned notes"
      />

      <AlertsClient />
    </div>
  );
}
