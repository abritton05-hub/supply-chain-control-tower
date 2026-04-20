import { redirect } from 'next/navigation';

export default async function DriverManifestPage() {
  redirect('/delivery?view=manifest');
}
