import { redirect } from 'next/navigation';

export default async function BomListPage() {
  redirect('/delivery?view=bom');
}
