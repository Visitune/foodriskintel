export interface Report {
  id: string;
  year: number;
  month: string;
  month_num: number;
  publication_date: string;
  source_url: string;
  recalls: Record<string, number>;
  food_fraud_count: number;
  /** "not_published": IFS announced no fraud table that month (never read as 0) */
  food_fraud_status?: "published" | "not_published" | "not_found";
  /** Month the data refers to, read from the PDF text (often publication month − 1) */
  data_period?: string | null;
  /** Countries shown with "-" on the map (not reported) */
  recalls_not_reported?: string[];
  period_type: "monthly" | "two_month_cumulative" | "point_in_time" | "unknown";
  period_note?: string;
}

export interface RecallEntry {
  report_id: string;
  year: number;
  month: string;
  month_num: number;
  publication_date: string;
  country_raw: string;
  country_normalized: string;
  value: number;
  source_url: string;
}

export interface FoodFraudEntry {
  report_id: string;
  year: number;
  month: string;
  month_num: number;
  publication_date: string;
  product_raw: string;
  product_normalized: string;
  reason_raw: string;
  reason_normalized: string;
  country_raw: string;
  country_normalized: string;
  detected_in: string;
  source_url: string;
  material_family?: string;
  reasons?: string[];
  countries?: string[];
  press_url?: string;
  needs_review?: boolean;
}

export interface Dataset {
  generated_at: string;
  date_range: {
    start: string;
    end: string;
    start_year: number;
    end_year: number;
  };
  summary: {
    total_reports: number;
    total_recall_values: number;
    total_food_fraud_cases: number;
    countries_with_data: number;
  };
  reports: Report[];
  countries: string[];
  recalls: RecallEntry[];
  food_fraud: FoodFraudEntry[];
}

export interface FfnReport {
  id: string;
  year: number;
  month: string;
  month_num: number;
  publication_date: string;
  filename: string;
  source_url: string;
  uuid: string;
  in_cross_window: boolean;
  total_suspicions: number;
  by_product_category: Record<string, number>;
  by_fraud_category: Record<string, number>;
  by_detection_source: Record<string, number>;
  cases_count: number;
}

export interface FfnCase {
  report_id: string;
  year: number;
  month: string;
  month_num: number;
  publication_date: string;
  classification: string;
  classification_group?: string;
  material_family?: string;
  substances?: string[];
  product_category: string;
  commodity: string;
  issue: string;
  origin_raw: string;
  origin_normalized: string;
  origins_list?: string[];
  notified_by_raw: string;
  notified_by_normalized: string;
  source_url: string;
}

export interface FfnDataset {
  generated_at: string;
  date_range: { start: string; end: string };
  summary: {
    total_reports: number;
    total_suspicions: number;
    total_cases: number;
    countries_origin: number;
    countries_notified: number;
    coverage_note: string;
  };
  reports: FfnReport[];
  cases: FfnCase[];
  by_product_all: Record<string, number>;
  countries_origin: string[];
  countries_notified: string[];
}

export interface CrossEntry {
  month: string;
  year: number;
  month_num: number;
  ffn_total_suspicions: number;
  ffn_cases: number;
  ffn_top_product: string | null;
  ifs_present: boolean;
  ifs_recalls_total: number | null;
  ifs_food_fraud_count: number | null;
  ifs_url: string | null;
  ffn_url: string;
  in_cross_window: boolean;
}

export interface CrossDataset {
  generated_at: string;
  window: { start: string; end: string; months: number };
  summary: {
    months_in_window: number;
    months_with_both_sources: number;
    months_ffn_only: number;
    ffn_total_in_window: number;
    ifs_recalls_total_in_window: number;
  };
  cross: CrossEntry[];
}

// ─── Material / origin index (data/index.json) ─────────────────────────────────
export type Label = { fr: string; en: string };
export type Trend = { last6: number; prev6: number; ratio?: number; direction: "up" | "down" | "stable" | "new" | "insufficient" };

export interface FamilyIndex {
  label: Label;
  ffn_cases: number;
  ffn_by_month: Record<string, number>;
  ffn_trend: Trend;
  ffn_top_origins: Record<string, number>;
  ffn_by_group: Record<string, number>;
  ffn_top_substances: Record<string, number>;
  ffn_top_commodities: Record<string, number>;
  fraud_cases: number;
  fraud_by_month: Record<string, number>;
  fraud_trend: Trend;
  fraud_top_countries: Record<string, number>;
  fraud_by_reason: Record<string, number>;
  fraud_top_products: Record<string, number>;
}

export interface OriginIndex {
  ffn_cases: number;
  ffn_by_month: Record<string, number>;
  ffn_trend: Trend;
  ffn_by_family: Record<string, number>;
  ffn_by_group: Record<string, number>;
  ffn_top_substances: Record<string, number>;
  ffn_top_notifiers: Record<string, number>;
  fraud_cases: number;
  fraud_by_family: Record<string, number>;
  fraud_by_reason: Record<string, number>;
}

export interface SearchTerm { t: "family" | "origin" | "substance" | "commodity"; id: string; n: number; f?: string; fr?: string; en?: string }

export interface RiskIndex {
  generated_at: string;
  sources: {
    ifs: { first: string; latest: string; reports: number; fraud_latest: string; fraud_not_published: string[]; fraud_cases: number };
    ffn: { first: string; latest: string; reports: number; cases: number };
  };
  labels: { families: Record<string, Label>; groups: Record<string, Label>; reasons: Record<string, Label>; substances: string[] };
  highlights: {
    ffn_month: string;
    ffn_rising_families: { family: string; count: number; avg12: number }[];
    ffn_month_total: number;
    fraud_month: string;
    fraud_month_cases: { product_normalized: string; material_family: string; reasons: string[]; countries: string[]; press_url: string }[];
  };
  families: Record<string, FamilyIndex>;
  origins: Record<string, OriginIndex>;
  search: SearchTerm[];
}
