import { redirect } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canSubmitPullRequests } from '@/lib/auth/roles';
import AiDocumentIntakeClient from './ai-document-intake-client';

export const dynamic = 'force-dynamic';

export default async function AiDocumentIntakePage() {
  const profile = await getCurrentUserProfile();

  if (!canSubmitPullRequests(profile.role)) {
    redirect('/inventory');
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="AI Document Intake"
        subtitle="Classify source documents, extract workflow fields, and review drafts before applying them"
      />

      <AiDocumentIntakeClient />
    </div>
  );
}