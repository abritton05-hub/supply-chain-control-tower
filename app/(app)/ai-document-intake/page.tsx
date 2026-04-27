import { redirect } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageDelivery } from '@/lib/auth/roles';
import AiDocumentIntakeClient from './ai-document-intake-client';

export const dynamic = 'force-dynamic';

export default async function AIDocumentIntakePage() {
  const profile = await getCurrentUserProfile();

  if (!canManageDelivery(profile.role)) {
    redirect('/inventory');
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="AI Document Intake"
        subtitle="Process source documents into approved receiving, pull request, or delivery drafts"
      />
      <AiDocumentIntakeClient />
    </div>
  );
}
