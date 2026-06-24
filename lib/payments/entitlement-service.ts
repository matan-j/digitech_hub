// ============================================================
// lib/payments/entitlement-service.ts
// Grant/read/revoke paid entitlements. Granting is service-role only and is
// driven ONLY by a verified, validated webhook (never the frontend redirect).
// ============================================================

import { createServiceClient } from '@/lib/supabase/server';
import type { ContentType } from './order-service';

export type ResourceType = ContentType;

/**
 * Idempotently grant an active entitlement for a user+resource. The unique
 * (user_id, resource_type, resource_id) constraint makes webhook replays safe.
 */
export async function grantEntitlement(params: {
  userId: string;
  resourceType: ResourceType;
  resourceId: string;
  /** Omit for free grants and manual admin grants (no order). */
  orderId?: string | null;
  source?: 'purchase' | 'admin' | 'gift';
  expiresAt?: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('entitlements')
    .upsert(
      {
        user_id: params.userId,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        order_id: params.orderId ?? null,
        source: params.source ?? 'purchase',
        status: 'active',
        granted_at: new Date().toISOString(),
        revoked_at: null,
        expires_at: params.expiresAt ?? null,
      },
      { onConflict: 'user_id,resource_type,resource_id' },
    );
  if (error) throw new Error(`grantEntitlement failed: ${error.message}`);

  // Mark the buyer as a purchaser for lead status (best-effort).
  await supabase.from('profiles').update({ lead_status: 'purchased' }).eq('id', params.userId);
}

/** Server-side check (uses the caller's RLS context). */
export async function hasActiveEntitlement(
  resourceType: ResourceType,
  resourceId: string,
): Promise<boolean> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('entitlements')
    .select('id')
    .eq('user_id', user.id)
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .eq('status', 'active')
    .maybeSingle();
  return !!data;
}

export async function revokeEntitlement(params: {
  userId: string;
  resourceType: ResourceType;
  resourceId: string;
}): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('entitlements')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('user_id', params.userId)
    .eq('resource_type', params.resourceType)
    .eq('resource_id', params.resourceId);
}
