const API_BASE = '/api';

export interface DatasetStats {
    total_transactions: number;
    date_range_start: string;
    date_range_end: string;
    gateways: string[];
    overall_sr: number;
    sr_by_gateway: Record<string, number>;
    sr_by_mode: Record<string, number>;
    volume_by_mode: Record<string, number>;
    volume_by_gateway: Record<string, number>;
    missing_values: Record<string, number>;
    data_quality_score: number;
}

export interface AlgorithmInfo {
    id: string;
    name: string;
    short_name: string;
    description: string;
    paper: string;
    paper_url: string;
    category: string;
    non_stationary: string;
    hyperparameter_schema: Record<string, any>;
}

export interface ScenarioTemplate {
    id: string;
    name: string;
    description: string;
    n_transactions: number;
}

export interface ExperimentStatus {
    run_id: string;
    status: string;
    total_transactions: number;
    processed: number;
    percent: number;
    elapsed_seconds: number;
    estimated_remaining: number;
    throughput: number;
    current_metrics: Record<string, any>;
    error?: string;
}

export interface AlgorithmResult {
    algorithm_id: string;
    algorithm_name: string;
    total_transactions: number;
    total_successes: number;
    overall_sr: number;
    sr_confidence_interval: [number, number];
    cumulative_regret: number;
    exploration_ratio: number;
    sr_by_gateway: Record<string, number>;
    sr_by_mode: Record<string, Record<string, any>>;
    sr_by_bank: Record<string, Record<string, any>>;
    regret_over_time: number[];
    sr_over_time: number[];
    decisions_sample: any[];
    arm_state_snapshots: any[];
}

export interface SimulationResults {
    run_id: string;
    run_name: string;
    dataset_id: string;
    dataset_stats: DatasetStats;
    config: any;
    results: Record<string, AlgorithmResult>;
}

// ── Dataset APIs ──

export async function uploadDataset(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/datasets/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getTemplates(): Promise<Record<string, ScenarioTemplate>> {
    const res = await fetch(`${API_BASE}/datasets/synthetic/templates`);
    return res.json();
}

export async function generateSynthetic(templateId: string, n: number = 20000, seed: number = 42): Promise<any> {
    const res = await fetch(`${API_BASE}/datasets/synthetic/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, n_transactions: n, seed }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// ── Algorithm APIs ──

export async function getAlgorithms(): Promise<AlgorithmInfo[]> {
    const res = await fetch(`${API_BASE}/algorithms`);
    return res.json();
}

// ── Experiment APIs ──

export async function createExperiment(params: {
    run_name: string;
    dataset_id: string;
    algorithms: { id: string; hyperparameters: Record<string, any> }[];
    counterfactual_mode: string;
    warm_up_transactions: number;
    random_seed: number;
}): Promise<any> {
    const res = await fetch(`${API_BASE}/experiments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getExperimentStatus(runId: string): Promise<ExperimentStatus> {
    const res = await fetch(`${API_BASE}/experiments/${runId}/status`);
    return res.json();
}

export async function listExperiments(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/experiments`);
    return res.json();
}

export async function cancelExperiment(runId: string): Promise<void> {
    await fetch(`${API_BASE}/experiments/${runId}/cancel`, { method: 'POST' });
}

// ── Results APIs ──

export async function getResults(runId: string): Promise<SimulationResults> {
    const res = await fetch(`${API_BASE}/results/${runId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getDecisions(runId: string, page: number = 1): Promise<any> {
    const res = await fetch(`${API_BASE}/results/${runId}/decisions?page=${page}`);
    return res.json();
}

export async function getArmState(runId: string, idx: number): Promise<any> {
    const res = await fetch(`${API_BASE}/results/${runId}/arm-state/${idx}`);
    return res.json();
}

// ── Report APIs ──

export async function getJsonReport(runId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/reports/${runId}/json`);
    return res.json();
}

export async function getReportSummary(runId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/reports/${runId}/summary`);
    return res.json();
}
