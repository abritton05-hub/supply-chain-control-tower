import { SectionHeader } from '@/components/section-header';
import { ProfileClient } from './profile-client';

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Profile"
        subtitle="Profile settings and account details"
      />
      <ProfileClient />
    </div>
  );
}