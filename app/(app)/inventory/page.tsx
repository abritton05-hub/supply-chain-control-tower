import { supabaseServer } from '@/lib/supabase/server';
import InventoryClientPage from './inventory-client';

export default async function InventoryPage() {
  const { data: organization, error: orgError } = await supabaseServer
    .from('organizations')
    .select('id, name')
    .eq('name', 'Default Organization')
    .single();

  if (orgError || !organization) {
    throw new Error(orgError?.message || 'Default organization not found.');
  }

  const [
    { data: inventoryRows, error: inventoryError },
    { data: vendors, error: vendorsError },
    { data: departments, error: departmentsError },
    { data: locations, error: locationsError },
  ] = await Promise.all([
    supabaseServer
      .from('v_inventory_overview')
      .select('*')
      .eq('organization_id', organization.id)
      .order('item_id', { ascending: true }),
    supabaseServer
      .from('vendors')
      .select('id, vendor_name')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .order('vendor_name', { ascending: true }),
    supabaseServer
      .from('departments')
      .select('id, department_name')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .order('department_name', { ascending: true }),
    supabaseServer
      .from('locations')
      .select('id, location_name')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .order('location_name', { ascending: true }),
  ]);

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  if (vendorsError) {
    throw new Error(vendorsError.message);
  }

  if (departmentsError) {
    throw new Error(departmentsError.message);
  }

  if (locationsError) {
    throw new Error(locationsError.message);
  }

  return (
    <InventoryClientPage
      organizationId={organization.id}
      initialRows={inventoryRows ?? []}
      vendors={vendors ?? []}
      departments={departments ?? []}
      locations={locations ?? []}
    />
  );
}