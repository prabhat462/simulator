/**
 * Impact Analysis API client — separate from the simulator API client.
 */

const API_BASE = '/api/impact';

// ── Types ──

export interface DataStatus {
    total_rows: number;
    has_data: boolean;
    periods: string[];
    min_date: string | null;
    max_date: string | null;
    before_count: number;
    after_count: number;
    before_start: string | null;
    before_end: string | null;
    after_start: string | null;
    after_end: string | null;
    gateway_count: number;
    merchant_count: number;
    bank_count: number;
}

export interface SignificanceBadge {
    level: string;
    label: string;
    emoji: string;
}

export interface HeadlineMetrics {
    before: { total_txns: number; successful_txns: number; sr: number; total_gmv: number; successful_gmv: number; avg_latency: number | null };
    after: { total_txns: number; successful_txns: number; sr: number; total_gmv: number; successful_gmv: number; avg_latency: number | null };
    sr_uplift_pp: number;
    before_ci: [number, number];
    after_ci: [number, number];
    test: { z_stat: number; p_value: number; significant: boolean };
    cohens_h: number;
    effect_size: string;
    badge: SignificanceBadge;
    gmv_saved: number;
    verdict: string;
}

export interface GlobalResults {
    headline: HeadlineMetrics;
    daily_trend: { date: string; period: string; txns: number; successes: number; sr: number }[];
    traffic_mix: { period: string; payment_mode: string; txns: number; share: number }[];
    mix_adjusted_sr: number | null;
    gmv_waterfall: { period: string; payment_mode: string; gmv: number; successful_gmv: number; sr: number }[];
}

export interface GatewayComparison {
    gateway: string;
    before_share: number; after_share: number; share_delta: number;
    before_sr: number; after_sr: number; sr_delta_pp: number;
    before_txns: number; after_txns: number;
    before_gmv: number; after_gmv: number;
    p_value: number; significant: boolean;
    badge: SignificanceBadge;
}

export interface ModeComparison {
    payment_mode: string;
    before_sr: number; after_sr: number; sr_delta_pp: number;
    before_txns: number; after_txns: number;
    before_gmv: number; after_gmv: number;
    p_value: number; significant: boolean;
    badge: SignificanceBadge;
}

export interface BankComparison {
    bank: string;
    before_sr: number; after_sr: number; sr_delta_pp: number;
    before_txns: number; after_txns: number;
    gmv_impact: number;
    p_value: number; significant: boolean;
    badge: SignificanceBadge;
}

export interface MerchantEntry {
    merchant_id: string; merchant_name: string; merchant_category: string;
    before_sr: number; after_sr: number; sr_delta_pp: number;
    before_txns: number; after_txns: number;
    gmv_impact: number;
    p_value: number; significant: boolean;
    badge: SignificanceBadge;
    status: string;
}

export interface AnalysisResults {
    success: boolean;
    run_id: string;
    config: { baseline_start: string; baseline_end: string; algo_start: string; algo_end: string };
    results: {
        global: GlobalResults;
        gateways: { gateway_comparison: GatewayComparison[]; preference_matrix: any[] };
        modes: { mode_comparison: ModeComparison[]; card_network_comparison: any[] };
        banks: { bank_comparison: BankComparison[]; bank_mode_heatmap: any[] };
        merchants: { leaderboard: MerchantEntry[]; regressions: MerchantEntry[]; regression_count: number; categories: any[]; total_merchants: number };
        temporal: { heatmap: any[]; intraday: any[]; day_of_week: any[]; volatility: any };
        amounts: { amount_comparison: any[]; gmv_weighted_sr: any };
        failures: { failure_comparison: any[]; waterfall: any; gateway_failures: any[]; failure_by_mode: any[] };
    };
    errors: any;
}

export interface AnalysisRun {
    run_id: string; created_at: string;
    baseline_start: string; baseline_end: string;
    algo_start: string; algo_end: string;
    baseline_txn_count: number; algo_txn_count: number;
    baseline_sr: number; algo_sr: number;
    sr_uplift: number; p_value: number;
    is_significant: boolean; status: string;
}

// ── API Functions ──

export async function uploadImpactData(file: File, period: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('period', period);
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getImpactDataStatus(): Promise<DataStatus> {
    const res = await fetch(`${API_BASE}/data/status`);
    return res.json();
}

export async function runImpactAnalysis(params: {
    baseline_start: string; baseline_end: string;
    algo_start: string; algo_end: string;
    min_merchant_volume?: number;
}): Promise<AnalysisResults> {
    const res = await fetch(`${API_BASE}/analysis/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getImpactAnalysisResults(runId: string): Promise<AnalysisResults> {
    const res = await fetch(`${API_BASE}/analysis/${runId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getImpactAnalysisHistory(): Promise<AnalysisRun[]> {
    const res = await fetch(`${API_BASE}/analysis/history/list`);
    return res.json();
}
