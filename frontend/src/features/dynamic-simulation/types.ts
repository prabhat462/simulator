/**
 * Dynamic SR Simulation Sandbox — Shared Types
 * All types used across Web Worker, UI, and hooks.
 */

// ─── Simulation Status ───────────────────────────────────────

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed';

// ─── PG Configuration ────────────────────────────────────────

export interface PGConfig {
    pgId: string;
    name: string;
    initialSR: number;        // 0.0–1.0
    colour: string;           // hex colour
    noiseStd: number;         // SR noise std dev (default 0.02)
}

// ─── Algorithm Configuration ─────────────────────────────────

export interface AlgorithmConfig {
    algorithmId: string;       // e.g. 'sw_ucb', 'thompson', 'd_ucb', 'epsilon_greedy', 'round_robin'
    instanceId: string;        // unique per instance (allows same algo twice)
    displayName: string;       // user-editable
    hyperparameters: Record<string, number>;
    lineStyle: 'solid' | 'dashed' | 'dotted';
}

// ─── Simulation Config ───────────────────────────────────────

export interface SimConfig {
    pgs: PGConfig[];
    algorithms: AlgorithmConfig[];
    speedTPS: number;          // ticks per second (10–10,000)
    warmUpTicks: number;       // default 100
    randomSeed: number;        // for reproducibility
    noiseMode: 'none' | 'low' | 'medium' | 'high';
    convergenceThreshold: number;  // default 0.10 (10pp)
    stabilityWindow: number;       // default 20 ticks
    trafficProfile: TrafficProfile;
}

export interface TrafficProfile {
    modeDistribution: 'random' | 'fixed';
    fixedMode?: string;
    merchantDistribution: 'random' | 'fixed';
    fixedMerchant?: string;
}

// ─── SR Change Event ─────────────────────────────────────────

export interface SRChangeEvent {
    eventId: string;
    tick: number;
    pgId: string;
    oldSR: number;
    newSR: number;
    deltaPP: number;           // (newSR - oldSR) * 100
    triggeredBy: 'user' | 'auto_scenario';
}

// ─── Convergence Result ──────────────────────────────────────

export type ConvergencePhase = 'blindness' | 'detecting' | 'converged' | 'not_started';

export interface ConvergenceResult {
    eventId: string;
    algorithmId: string;
    phase: ConvergencePhase;
    convergenceTick: number | null;
    convergenceLatencyTxns: number | null;
    detectionTick: number | null;
    phase1Duration: number | null;
    phase2Duration: number | null;
    damageTxns: number;
    estimatedExtraFailures: number;
}

// ─── Tick Metrics ────────────────────────────────────────────

export interface TickMetrics {
    tick: number;
    routingShares: Record<string, Record<string, number>>;   // algoId → {pgId → share}
    estimatedSRs: Record<string, Record<string, number>>;    // algoId → {pgId → estSR}
    cumulativeRegret: Record<string, number>;                 // algoId → regret
    rollingAchievedSR: Record<string, number>;                // algoId → rolling SR
    trueSRs: Record<string, number>;                          // pgId → true SR
    optimalSR: number;
}

// ─── Simulation Event (timeline) ─────────────────────────────

export interface SimulationEvent {
    type: 'start' | 'pause' | 'resume' | 'sr_change' | 'convergence' | 'reset' | 'auto_event';
    tick: number;
    wallTime: number;          // ms since sim start
    details?: string;
    srChangeEvent?: SRChangeEvent;
    convergenceResult?: ConvergenceResult;
}

// ─── Worker Message Protocol ─────────────────────────────────

export type WorkerCommand =
    | { type: 'START'; config: SimConfig }
    | { type: 'PAUSE' }
    | { type: 'RESUME'; stagedChanges: Record<string, number> }
    | { type: 'RESET' }
    | { type: 'SET_SPEED'; tps: number }
    | { type: 'STEP_ONE'; stagedChanges: Record<string, number> };

export type WorkerUpdate =
    | { type: 'TICK_BATCH'; metrics: TickMetrics[] }
    | { type: 'SR_CHANGE_EVENT'; event: SRChangeEvent }
    | { type: 'CONVERGENCE_UPDATE'; result: ConvergenceResult }
    | { type: 'STATUS_CHANGE'; status: SimulationStatus; tick: number }
    | { type: 'EVENT'; event: SimulationEvent }
    | { type: 'STEP_DETAIL'; detail: TransactionDetail };

// ─── Transaction Detail (step mode) ──────────────────────────

export interface TransactionDetail {
    tick: number;
    transaction: TransactionContext;
    decisions: Record<string, {                // algoId → decision info
        chosenPg: string;
        outcome: number;                        // 0 or 1
        trueSR: number;
        estimatedSRs: Record<string, number>;   // pgId → estimated SR
        routingShares: Record<string, number>;  // pgId → share %
        regretIncurred: number;
    }>;
    trueSRs: Record<string, number>;            // pgId → true SR
    optimalSR: number;
}

// ─── Algorithm Interface (browser-side) ──────────────────────

export interface TransactionContext {
    paymentMode: string;
    amountBand: string;
    issuingBank: string;
}

export interface ArmState {
    estimatedSR: number | null;
    selectionScore: number | null;
    totalSelections: number;
    [key: string]: unknown;
}

export interface AlgorithmMetadata {
    name: string;
    shortName: string;
    description: string;
    paper: string;
    paperUrl: string;
    category: string;
}

export interface HyperparameterSchema {
    [key: string]: {
        type: 'integer' | 'number';
        default: number;
        min: number;
        max: number;
        step?: number;
        description: string;
    };
}

// ─── Scenario ────────────────────────────────────────────────

export interface ScenarioAutoEvent {
    triggerTick: number;
    type: 'sr_change';
    changes: Record<string, number>;
    description: string;
}

export interface Scenario {
    scenarioId: string;
    name: string;
    description: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedDurationTicks: number;
    pgs: PGConfig[];
    recommendedAlgorithms: string[];
    defaultSpeed: number;
    warmUpTicks: number;
    autoEvents: ScenarioAutoEvent[];
    learningObjectives: string[];
}

// ─── PG Colour Palette ───────────────────────────────────────

export const PG_COLOURS = [
    '#6366f1', // indigo
    '#f43f5e', // rose
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#14b8a6', // teal
    '#ef4444', // red
    '#3b82f6', // blue
];

export const ALGORITHM_LINE_STYLES: ('solid' | 'dashed' | 'dotted')[] = [
    'solid', 'dashed', 'dotted'
];

export const NOISE_STD_MAP: Record<string, number> = {
    none: 0,
    low: 0.02,
    medium: 0.05,
    high: 0.10,
};
