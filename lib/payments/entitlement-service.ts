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

/**
 * Grant access for ONE purchased line, expanding a bundle into its courses.
 *
 * For a plain course/guide this is just grantEntitlement(). For a 'bundle' it
 * ALSO grants a 'course' entitlement for every course in the bundle (migration
 * 036 bundle_items) — so the buyer immediately passes has_content_access() on
 * each contained course. The bundle entitlement itself is kept too (for "my
 * products" / audit). All grants are idempotent, so webhook replays are safe.
 *
 * Service-role only — call from verified webhooks / the server purchase flow.
 */
export async function grantPurchaseAccess(params: {
  userId: string;
  resourceType: ResourceType;
  resourceId: string;
  orderId?: string | null;
  source?: 'purchase' | 'admin' | 'gift';
}): Promise<void> {
  await grantEntitlement(params);
  if (params.resourceType !== 'bundle') return;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('bundle_items')
    .select('course_id')
    .eq('bundle_id', params.resourceId);
  if (error) throw new Error(`grantPurchaseAccess: bundle expand failed: ${error.message}`);

  for (const row of data ?? []) {
    await grantEntitlement({
      userId: params.userId,
      resourceType: 'course',
      resourceId: (row as { course_id: string }).course_id,
      orderId: params.orderId ?? null,
      source: params.source ?? 'purchase',
    });
  }
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
    // Mirror the DB's has_entitlement(): an entitlement with a past expires_at is
    // NOT active. Without this the app could render an unlocked lesson link that
    // the RLS read then rejects → 404.
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();
  return !!data;
}

/**
 * All resource ids the current user owns for a given type via an ACTIVE
 * entitlement — purchased OR assigned (source: purchase/admin/gift). Used to
 * surface owned courses first in the catalog and to unlock their cards.
 * Returns an empty set for anonymous visitors.
 */
export async function listOwnedResourceIds(resourceType: ResourceType): Promise<Set<string>> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase
    .from('entitlements')
    .select('resource_id')
    .eq('user_id', user.id)
    .eq('resource_type', resourceType)
    .eq('status', 'active')
    // Mirror the DB's has_entitlement() expiry check (see hasActiveEntitlement).
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  return new Set((data ?? []).map((r) => (r as { resource_id: string }).resource_id));
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
