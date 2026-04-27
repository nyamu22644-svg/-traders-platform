import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Database Types
export type SiteType = 'bot_platform' | 'smart_trader' | 'signal_site';
export type SiteStatus = 'draft' | 'active' | 'suspended' | 'maintenance' | 'offline';
export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  deriv_loginid: string | null;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  user_id: string;
  name: string;
  type: SiteType;
  status: SiteStatus;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface SiteDeployment {
  id: string;
  site_id: string;
  user_id: string;
  deployment_slug: string;
  deployment_url: string;
  status: 'draft' | 'building' | 'active' | 'failed';
  provider: 'vercel' | string;
  environment: 'production' | 'preview' | 'development' | string;
  last_deployed_at: string;
  last_error: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: string;
  site_id: string;
  domain: string;
  verified: boolean;
  provider: 'manual' | 'namecheap' | 'namecheap_affiliate' | 'porkbun' | 'platform_subdomain';
  status: 'draft' | 'pending_verification' | 'active' | 'purchase_pending' | 'failed';
  verification_token: string | null;
  verification_record_type: 'TXT' | 'CNAME' | 'A' | null;
  verification_record_name: string | null;
  verification_record_value: string | null;
  dns_record_type: 'A' | 'CNAME' | null;
  dns_record_name: string | null;
  dns_record_value: string | null;
  last_verified_at: string | null;
  auto_renew: boolean;
  purchase_price: number | null;
  expires_at: string | null;
  provisioning_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainPurchaseRequest {
  id: string;
  site_id: string;
  domain_name: string;
  provider: 'namecheap' | 'namecheap_affiliate' | 'porkbun';
  years: number;
  registrant_email: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  payment_provider: 'mpesa' | 'paystack' | 'flutterwave' | 'manual' | null;
  payment_reference: string | null;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  order_status:
    | 'pending_payment'
    | 'payment_confirmed'
    | 'registering'
    | 'dns_configuring'
    | 'vercel_linking'
    | 'verifying'
    | 'completed'
    | 'failed'
    | 'refunded';
  currency: string;
  payment_amount: number | null;
  base_cost: number | null;
  sell_price: number | null;
  platform_margin: number | null;
  domain_id: string | null;
  namecheap_order_id: string | null;
  vercel_domain_verified: boolean;
  processed_at: string | null;
  availability_snapshot: any;
  invoices: any[];
  metadata: any;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainPricingRule {
  id: string;
  tld: string;
  currency: string;
  base_price: number | null;
  markup_type: 'flat' | 'percent';
  markup_value: number;
  service_fee: number;
  final_price_override: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteConfig {
  id: string;
  site_id: string;
  theme_color: string;
  primary_color: string;
  secondary_color: string;
  site_title: string | null;
  description: string | null;
  logo_url: string | null;
  enabled_modules: string[];
  enabled_tools: string[];
  layout_style: string;
  navigation_items: any[];
  hero_content: any;
  cta_content: any;
  support_social_links: any;
  total_commission_pct: number;
  platform_commission_pct: number;
  client_commission_pct: number;
  deriv_referral_code: string | null;
  deriv_utm_source: string | null;
  deriv_utm_medium: string | null;
  deriv_utm_campaign: string | null;
  payout_model: 'platform_collects_and_pays_clients' | 'deriv_direct_split_if_supported';
  payout_cycle: 'weekly' | 'monthly';
  payout_minimum: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface TradingProvider {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SiteTradingSettings {
  id: string;
  site_id: string;
  default_leverage: number;
  allowed_pairs: string[];
  max_bots_per_user: number;
  created_at: string;
  updated_at: string;
}

export interface ApiCredentialsMetadata {
  id: string;
  user_id: string;
  site_id: string;
  provider_id: string;
  key_name: string;
  is_valid: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BotTemplate {
  id: string;
  site_id: string;
  name: string;
  description: string | null;
  strategy_type: string;
  parameters: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommissionRule {
  id: string;
  site_id: string;
  tier_name: string;
  maker_fee_pct: number;
  taker_fee_pct: number;
  min_volume: number;
  created_at: string;
  updated_at: string;
}
