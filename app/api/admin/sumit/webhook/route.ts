// ============================================================
// /api/admin/sumit/webhook — programmatic SUMIT trigger (webhook) registration.
//
// Instead of configuring the webhook by hand in the SUMIT dashboard, an admin
// subscribes our endpoint to the SUMIT trigger View via the Triggers API
// (/triggers/triggers/subscribe/). SUMIT then POSTs each new payment/document row
// to /api/webhooks/sumit/payment-success.
//
//   GET    → current config + readiness (does NOT call SUMIT).
//   POST   → subscribe our webhook URL to the configured View.
//   DELETE → unsubscribe our webhook URL.
//
// Requires env SUMIT_TRIGGER_VIEW_ID (the numeric id of the payments trigger
// View "נתונים לטריגר"). Optional: SUMIT_TRIGGER_FOLDER_ID, SUMIT_TRIGGER_TYPE.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  isSumitConfigured,
  sumitSubscribeTrigger,
  sumitUnsubscribeTrigger,
  sumitListFolders,
  sumitListViews,
  type SumitTriggerType,
} from '@/lib/payments/sumit';

export const runtime = 'nodejs';

const TRIGGER_TYPES: SumitTriggerType[] = ['CreateOrUpdate', 'Create', 'Update', 'Archive', 'Delete'];

/** The exact URL we register with SUMIT (includes the shared secret when set). */
function webhookUrl(request: Request): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const url = new URL('/api/webhooks/sumit/payment-success', base);
  if (process.env.SUMIT_WEBHOOK_SECRET) url.searchParams.set('secret', process.env.SUMIT_WEBHOOK_SECRET);
  return url.toString();
}

function triggerType(): SumitTriggerType {
  const t = process.env.SUMIT_TRIGGER_TYPE as SumitTriggerType | undefined;
  return t && TRIGGER_TYPES.includes(t) ? t : 'Create';
}

/**
 * GET                       → config/readiness (default).
 * GET ?action=folders       → SUMIT folders for the View picker.
 * GET ?action=views&folderId=N → Views inside a folder.
 */
export async function GET(request: Request) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'folders' || action === 'views') {
    if (!isSumitConfigured()) return NextResponse.json({ error: 'provider_unconfigured' }, { status: 502 });
    try {
      if (action === 'folders') return NextResponse.json({ folders: await sumitListFolders() });
      const folderId = Number(searchParams.get('folderId'));
      if (!Number.isFinite(folderId)) return NextResponse.json({ error: 'folder_required' }, { status: 400 });
      return NextResponse.json({ views: await sumitListViews(folderId) });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'list_failed';
      return NextResponse.json({ error: 'list_failed', message }, { status: 502 });
    }
  }

  const envViewId = Number(process.env.SUMIT_TRIGGER_VIEW_ID);
  return NextResponse.json({
    configured: isSumitConfigured(),
    viewId: Number.isFinite(envViewId) && envViewId > 0 ? envViewId : null,
    triggerType: triggerType(),
    hasSecret: !!process.env.SUMIT_WEBHOOK_SECRET,
    url: webhookUrl(request),
  });
}

/** Subscribe. Body may carry a chosen { viewId, folderId }; falls back to env. */
export async function POST(request: Request) {
  await requireAdmin();
  if (!isSumitConfigured()) {
    return NextResponse.json({ error: 'provider_unconfigured' }, { status: 502 });
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const viewId = Number(body.viewId ?? process.env.SUMIT_TRIGGER_VIEW_ID);
  const folderId = (body.folderId as number | string | undefined) ?? process.env.SUMIT_TRIGGER_FOLDER_ID;
  if (!Number.isFinite(viewId) || viewId <= 0) {
    return NextResponse.json(
      { error: 'view_id_missing', message: 'בחר את ה-View של "נתונים לטריגר" (או הגדר SUMIT_TRIGGER_VIEW_ID).' },
      { status: 400 },
    );
  }
  const url = webhookUrl(request);
  try {
    await sumitSubscribeTrigger({
      url,
      view: viewId,
      folder: folderId != null ? String(folderId) : undefined,
      triggerType: triggerType(),
    });
    return NextResponse.json({ ok: true, url, viewId });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'subscribe_failed';
    console.error('[admin:sumit:webhook] subscribe failed', message);
    return NextResponse.json({ error: 'subscribe_failed', message }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  await requireAdmin();
  if (!isSumitConfigured()) {
    return NextResponse.json({ error: 'provider_unconfigured' }, { status: 502 });
  }
  const url = webhookUrl(request);
  try {
    await sumitUnsubscribeTrigger(url);
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unsubscribe_failed';
    console.error('[admin:sumit:webhook] unsubscribe failed', message);
    return NextResponse.json({ error: 'unsubscribe_failed', message }, { status: 502 });
  }
}
