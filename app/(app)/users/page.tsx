import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { SectionHeader } from '@/components/section-header';
import { UsersClient } from './users-client';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const profile = await getCurrentUserProfile();

  if (profile.role !== 'admin') {
    redirect('/inventory');
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Users / Access"
        subtitle="Admin-only user and access management area"
      />
      <UsersClient />
    </div>
  );
}