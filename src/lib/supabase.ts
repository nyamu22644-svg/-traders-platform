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

export interface Domain {
  id: string;
  site_id: string;
  domain: string;
  verified: boolean;
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
