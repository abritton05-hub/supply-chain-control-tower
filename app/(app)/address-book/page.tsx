import { redirect } from 'next/navigation';
import { ModulePageShell } from '@/components/module-page-shell';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageDelivery } from '@/lib/auth/roles';
import { supabaseServer } from '@/lib/supabase/server';
import { AddressBookClient } from './address-book-client';
import type { AddressBookEntry } from './types';

export const dynamic = 'force-dynamic';

export default async function AddressBookPage() {
  const profile = await getCurrentUserProfile();

  if (!canManageDelivery(profile.role)) {
    redirect('/inventory');
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('address_book')
    .select(
      'id,company_name,location_name,address_line_1,address_line_2,city,state,postal_code,country,contact_name,contact_phone,contact_email,location_type,notes,is_active,created_at,updated_at'
    )
    .order('company_name', { ascending: true })
    .order('location_name', { ascending: true });

  const entries = (data ?? []) as AddressBookEntry[];

  return (
    <ModulePageShell
      title="Address Book"
      subtitle="Master pickup and drop-off locations for shipping, delivery, BOMs, and manifests"
    >
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="text-base font-semibold text-rose-800">Address Book is not ready</h2>
          <p className="mt-2 text-sm leading-6 text-rose-700">
            Supabase returned: {error.message}. Run{' '}
            <span className="font-mono">docs/supabase-address-book.sql</span> in Supabase SQL
            Editor, then reload this page.
          </p>
        </div>
      ) : (
        <AddressBookClient entries={entries} />
      )}
    </ModulePageShell>
  );
}
