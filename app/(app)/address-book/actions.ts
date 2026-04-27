'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageDelivery } from '@/lib/auth/roles';
import { getCurrentUserEmail } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import type { AddressBookFormInput } from './types';

type ActionResult = {
  ok: boolean;
  message: string;
};

function clean(value: string | null | undefined) {
  return value?.trim() || '';
}

function nullable(value: string | null | undefined) {
  const cleaned = clean(value);
  return cleaned ? cleaned : null;
}

function normalizeLocationType(value: string | null | undefined) {
  if (value === 'pickup' || value === 'dropoff' || value === 'both') {
    return value;
  }

  return 'both';
}

function validateAddressInput(input: AddressBookFormInput): string | null {
  if (!clean(input.company_name)) return 'Company name is required.';
  if (!clean(input.address_line_1)) return 'Address line 1 is required.';

  const locationType = normalizeLocationType(input.location_type);
  if (!['pickup', 'dropoff', 'both'].includes(locationType)) {
    return 'Address type must be Pickup, Drop Off, or Both.';
  }

  return null;
}

async function requireAddressBookAccess() {
  const profile = await getCurrentUserProfile();

  if (!canManageDelivery(profile.role)) {
    throw new Error('Warehouse or admin access is required to manage shipping addresses.');
  }
}

export async function saveAddressBookEntry(input: AddressBookFormInput): Promise<ActionResult> {
  try {
    await requireAddressBookAccess();

    const validationError = validateAddressInput(input);

    if (validationError) {
      return {
        ok: false,
        message: validationError,
      };
    }

    const supabase = await supabaseServer();
    const currentUserEmail = await getCurrentUserEmail();

    const payload = {
      company_name: clean(input.company_name),
      location_name: nullable(input.location_name),
      address_line_1: clean(input.address_line_1),
      address_line_2: nullable(input.address_line_2),
      city: nullable(input.city),
      state: nullable(input.state),
      postal_code: nullable(input.postal_code),
      country: clean(input.country) || 'USA',
      contact_name: nullable(input.contact_name),
      contact_phone: nullable(input.contact_phone),
      contact_email: nullable(input.contact_email),
      location_type: normalizeLocationType(input.location_type),
      notes: nullable(input.notes),
      is_active: input.is_active ?? true,
    };

    const id = clean(input.id);

    if (id) {
      const { error } = await supabase
        .from('address_book')
        .update(payload)
        .eq('id', id);

      if (error) {
        return {
          ok: false,
          message: `Address update failed: ${error.message}`,
        };
      }

      revalidatePath('/address-book');
      revalidatePath('/delivery');

      return {
        ok: true,
        message: `Address updated by ${currentUserEmail || 'current user'}.`,
      };
    }

    const { error } = await supabase.from('address_book').insert(payload);

    if (error) {
      return {
        ok: false,
        message: `Address save failed: ${error.message}`,
      };
    }

    revalidatePath('/address-book');
    revalidatePath('/delivery');

    return {
      ok: true,
      message: `Address added by ${currentUserEmail || 'current user'}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unexpected address save error.',
    };
  }
}

export async function deactivateAddressBookEntry(id: string): Promise<ActionResult> {
  try {
    await requireAddressBookAccess();

    const cleanId = clean(id);

    if (!cleanId) {
      return {
        ok: false,
        message: 'Address ID is required.',
      };
    }

    const supabase = await supabaseServer();

    const { error } = await supabase
      .from('address_book')
      .update({ is_active: false })
      .eq('id', cleanId);

    if (error) {
      return {
        ok: false,
        message: `Address archive failed: ${error.message}`,
      };
    }

    revalidatePath('/address-book');
    revalidatePath('/delivery');

    return {
      ok: true,
      message: 'Address archived.',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unexpected archive error.',
    };
  }
}

export async function reactivateAddressBookEntry(id: string): Promise<ActionResult> {
  try {
    await requireAddressBookAccess();

    const cleanId = clean(id);

    if (!cleanId) {
      return {
        ok: false,
        message: 'Address ID is required.',
      };
    }

    const supabase = await supabaseServer();

    const { error } = await supabase
      .from('address_book')
      .update({ is_active: true })
      .eq('id', cleanId);

    if (error) {
      return {
        ok: false,
        message: `Address restore failed: ${error.message}`,
      };
    }

    revalidatePath('/address-book');
    revalidatePath('/delivery');

    return {
      ok: true,
      message: 'Address restored.',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unexpected restore error.',
    };
  }
}
