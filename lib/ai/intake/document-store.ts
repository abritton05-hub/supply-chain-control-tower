import 'server-only';

import { Buffer } from 'node:buffer';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AI_INTAKE_STORAGE_BUCKET } from './constants';
import type { IntakeDocumentRecord, StoredIntakeSource } from './types';

export async function loadIntakeDocument(documentId: string) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('ai_intake_documents')
    .select(
      'id,organization_id,uploaded_by,source_type,original_filename,mime_type,storage_path,raw_text,status,created_at,updated_at'
    )
    .eq('id', documentId)
    .single();

  if (error) {
    throw new Error(`Could not load intake document: ${error.message}`);
  }

  if (!data) {
    throw new Error('Intake document was not found.');
  }

  return data as IntakeDocumentRecord;
}

export async function loadStoredIntakeSource(documentId: string): Promise<StoredIntakeSource> {
  const document = await loadIntakeDocument(documentId);

  if (document.source_type === 'text') {
    if (!document.raw_text?.trim()) {
      throw new Error('Text intake document has no raw text.');
    }

    return {
      source_type: 'text',
      raw_text: document.raw_text,
      original_filename: document.original_filename,
      mime_type: document.mime_type,
    };
  }

  if (!document.storage_path) {
    throw new Error('File intake document has no storage path.');
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.storage
    .from(AI_INTAKE_STORAGE_BUCKET)
    .download(document.storage_path);

  if (error) {
    throw new Error(`Could not download intake source file: ${error.message}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());

  return {
    source_type: document.source_type,
    file_base64: buffer.toString('base64'),
    original_filename: document.original_filename,
    mime_type:
      document.mime_type ??
      (document.source_type === 'pdf' ? 'application/pdf' : 'image/png'),
  };
}

export async function markIntakeDocumentStatus(
  documentId: string,
  status: IntakeDocumentRecord['status']
) {
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('ai_intake_documents')
    .update({ status })
    .eq('id', documentId);

  if (error) {
    throw new Error(`Could not update intake document status: ${error.message}`);
  }
}
