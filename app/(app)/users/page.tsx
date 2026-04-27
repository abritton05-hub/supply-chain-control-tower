import { redirect } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageUsers } from '@/lib/auth/roles';
import { UsersClient } from './users-client';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const profile = await getCurrentUserProfile();

  if (!canManageUsers(profile.role)) {
    redirect('/inventory');
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Users / Access"
        subtitle="Invite users and manage Supply Chain Control Tower access roles"
      />
      <UsersClient />
    </div>
  );
}
