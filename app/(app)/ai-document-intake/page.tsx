import { SectionHeader } from '@/components/section-header';
import { AiDocumentIntakeClient } from './ai-document-intake-client';

export const dynamic = 'force-dynamic';

export default function AiDocumentIntakePage() {
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
