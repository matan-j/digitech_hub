// Shared lead types/constants. Kept out of the route file because Next.js
// route modules may only export request handlers + a few config exports.

export const LEAD_STATUSES = ['new', 'registered', 'active_learner', 'purchased', 'inactive'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type LeadProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  subscription_status: string | null;
  created_at: string;
  auth_provider: string | null;
  lead_status: LeadStatus;
  marketing_consent: boolean | null;
  terms_accepted_at: string | null;
  registration_source: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  first_guide_touchpoint: string | null;
  first_creator_touchpoint: string | null;
  first_course_touchpoint: string | null;
  intended_action: string | null;
  last_activity_at: string | null;
};

export type LeadListRow = LeadProfile & {
  email: string | null;
  enrolled_count: number;
  purchased_count: number;
  progress_count: number;
};

export type EnrolledCourse = {
  content_item_id: string;
  title: string | null;
  slug: string | null;
  type: string | null;
  source: string;
  status: string;
  enrolled_at: string;
  last_activity_at: string | null;
};

export type LeadEntitlement = {
  id: string;
  resource_type: string;
  resource_id: string;
  source: string;
  status: string;
  granted_at: string;
};

export type LeadOrder = {
  id: string;
  public_order_id: string;
  content_type: string;
  content_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
};

export type LeadDetail = LeadProfile & {
  email: string | null;
  enrolled_courses: EnrolledCourse[];
  entitlements: LeadEntitlement[];
  orders: LeadOrder[];
  progress_count: number;
};
