import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageDelivery } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logTransaction } from '@/lib/transactions/log-transaction';

export const runtime = 'nodejs';

type JsonObject = Record<string, unknown>;

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isCompleteStatus(value: unknown) {
  const status = clean(value).toLowerCase();
  return status === 'complete' || status === 'completed' || status === 'closed';
}

function missingCompletionColumn(message: string) {
  return (
    message.includes('completed_at') ||
    message.includes('completed_by') ||
    (message.includes('Could not find') && message.includes('completed'))
  );
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!canManageDelivery(profile.role)) {
      return NextResponse.json(
        { ok: false, message: 'Warehouse or admin access is required for shipping records.' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as JsonObject;
    const manifestNumber = clean(body.manifest_number);
    const manifestDate = clean(body.manifest_date);

    if (!manifestNumber || !manifestDate) {
      return NextResponse.json(
        { ok: false, message: 'manifest_number and manifest_date are required.' },
        { status: 400 }
      );
    }

    const supabase = await supabaseAdmin();
    const { data: existingRows, error: existingError } = await supabase
      .from('shipping_manifest_history')
      .select('id,status,manifest_number,stop_date')
      .eq('manifest_number', manifestNumber)
      .eq('stop_date', manifestDate);

    if (existingError) {
      return NextResponse.json({ ok: false, message: existingError.message }, { status: 500 });
    }

    const stopCount = existingRows?.length ?? 0;

    if (!stopCount) {
      return NextResponse.json(
        { ok: false, message: `Manifest ${manifestNumber} was not found for ${manifestDate}.` },
        { status: 404 }
      );
    }

    if (existingRows.every((row) => isCompleteStatus(row.status))) {
      return NextResponse.json({
        ok: true,
        message: `Manifest ${manifestNumber} is already complete.`,
        manifestNumber,
        manifestDate,
        stopCount,
      });
    }

    const completedAt = new Date().toISOString();
    const performedBy = profile.full_name || profile.email || 'unknown';
    const updatePayload = {
      status: 'COMPLETE',
      completed_at: completedAt,
      completed_by: performedBy,
      updated_at: completedAt,
    };

    let updateResult = await supabase
      .from('shipping_manifest_history')
      .update(updatePayload)
      .eq('manifest_number', manifestNumber)
      .eq('stop_date', manifestDate)
      .select('id,status,completed_at,completed_by');

    if (updateResult.error && missingCompletionColumn(updateResult.error.message)) {
      updateResult = await supabase
        .from('shipping_manifest_history')
        .update({
          status: 'COMPLETE',
          updated_at: completedAt,
        })
        .eq('manifest_number', manifestNumber)
        .eq('stop_date', manifestDate)
        .select('id,status');
    }

    if (updateResult.error) {
      return NextResponse.json({ ok: false, message: updateResult.error.message }, { status: 500 });
    }

    const notes = `Completed ${manifestDate}; ${stopCount} stop${stopCount === 1 ? '' : 's'}.`;
    const transaction = await logTransaction({
      transaction_type: 'MANIFEST_COMPLETED',
      transaction_date: manifestDate,
      description: `Manifest ${manifestNumber} completed`,
      quantity: null,
      reference: manifestNumber,
      notes,
      performed_by: performedBy,
      entity_type: 'shipping_manifest_history',
      entity_id: manifestNumber,
      details: {
        manifest_number: manifestNumber,
        manifest_date: manifestDate,
        stop_count: stopCount,
        completed_at: completedAt,
        completed_by: performedBy,
        href: `/delivery?view=history&manifestStatus=ALL&manifest=${encodeURIComponent(
          manifestNumber
        )}&date=${encodeURIComponent(manifestDate)}`,
      },
      supabase,
      write_inventory_transaction: true,
      write_activity_log: true,
    });

    if (transaction.ok === false) {
      console.error('Manifest completion transaction logging failed.', {
        manifestNumber,
        manifestDate,
        message: transaction.message,
      });
    }

    revalidatePath('/delivery');
    revalidatePath('/transactions');

    return NextResponse.json({
      ok: true,
      message: `Manifest ${manifestNumber} marked complete.`,
      manifestNumber,
      manifestDate,
      stopCount,
      transactionId: transaction.transactionId ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Completion failed.' },
      { status: 500 }
    );
  }
}
