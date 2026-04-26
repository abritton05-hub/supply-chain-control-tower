export type AddressType = 'pickup' | 'dropoff' | 'both';

export type AddressBookEntry = {
  id: string;
  company_name: string;
  location_name: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  location_type: AddressType | string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AddressBookFormInput = {
  id?: string;
  company_name: string;
  location_name?: string;
  address_line_1: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  location_type?: AddressType;
  notes?: string;
  is_active?: boolean;
};