export interface Variant {
  id: string;
  item_id: string;
  model_id: string;
  name: string;
  stock: number;
  is_tracked: number;
  last_notified_stock: number;
  updated_at: string;
}

export interface Item {
  id: string;
  shop_id: string;
  item_id: string;
  name: string;
  image: string | null;
  url: string;
  is_active: number;
  last_checked_at: string | null;
  created_at: string;
  variants: Variant[];
}

export interface ScrapedVariantPreview {
  model_id: string;
  name: string;
  stock: number;
}

export interface ScrapedPreview {
  shop_id: string;
  item_id: string;
  name: string;
  image: string | null;
  url: string;
  variants: ScrapedVariantPreview[];
}

export interface AlertLog {
  id: number;
  item_id: string | null;
  item_name: string | null;
  variant_name: string | null;
  alert_type: string;
  message: string;
  sent_at: string;
}

export interface AppSettings {
  telegram_bot_token: string;
  telegram_chat_id: string;
  check_cron: string;
}

export interface User {
  id: string;
  username: string;
  telegram_chat_id: string | null;
}
