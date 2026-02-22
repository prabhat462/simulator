/**
 * useMetricsStore — persists simulation run snapshots for statistician analysis.
 * Stores metric snapshots in localStorage for cross-page access.
 * Each run is identified by a timestamp-based ID.
 */

import { useCallback, useRef, useState } from 'react';
import { TickMetrics, AlgorithmConfig, PGConfig, SRChangeEvent, ConvergenceResult } from '../types';

const STORAGE_KEY = 'sim_analysis_runs';
const MAX_RUNS = 10;
const MAX_SNAPSHOT_POINTS = 200;

export interface SimulationRunSnapshot {
    runId: string;
    timestamp: number;
    durationTicks: number;
    pgs: PGConfig[];
    algorithms: AlgorithmConfig[];
    srChangeEvents: SRChangeEvent[];
    convergenceResults: ConvergenceResult[];
    metricSnapshots: TickMetrics[];
}

export function useMetricsStore() {
    const metricsAccumRef = useRef<TickMetrics[]>([]);
    const [savedRuns, setSavedRuns] = useState<SimulationRunSnapshot[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });

    // Accumulate metrics as simulation runs
    const recordMetrics = useCallback((metrics: TickMetrics[]) => {
        metricsAccumRef.current.push(...metrics);
        // Downsample if too many points
        if (metricsAccumRef.current.length > MAX_SNAPSHOT_POINTS * 2) {
            const step = Math.ceil(metricsAccumRef.current.length / MAX_SNAPSHOT_POINTS);
            metricsAccumRef.current = metricsAccumRef.current.filter((_, i) => i % step === 0);
        }
    }, []);

    // Save a completed run
    const saveRun = useCallback((
        pgs: PGConfig[],
        algorithms: AlgorithmConfig[],
        srChangeEvents: SRChangeEvent[],
        convergenceResults: ConvergenceResult[],
        durationTicks: number,
    ) => {
        const snapshot: SimulationRunSnapshot = {
            runId: `run_${Date.now()}`,
            timestamp: Date.now(),
            durationTicks,
            pgs,
            algorithms,
            srChangeEvents,
            convergenceResults,
            metricSnapshots: [...metricsAccumRef.current],
        };

        const updatedRuns = [snapshot, ...savedRuns].slice(0, MAX_RUNS);
        setSavedRuns(updatedRuns);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRuns));
        } catch (e) {
            console.warn('Failed to save run to localStorage:', e);
        }

        metricsAccumRef.current = [];
        return snapshot.runId;
    }, [savedRuns]);

    const deleteRun = useCallback((runId: string) => {
        const updatedRuns = savedRuns.filter(r => r.runId !== runId);
        setSavedRuns(updatedRuns);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRuns));
        } catch (e) {
            console.warn('Failed to update localStorage:', e);
        }
    }, [savedRuns]);

    const clearAll = useCallback(() => {
        setSavedRuns([]);
        metricsAccumRef.current = [];
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch { /* ignore */ }
    }, []);

    const resetAccumulator = useCallback(() => {
        metricsAccumRef.current = [];
    }, []);

    return {
        savedRuns,
        recordMetrics,
        saveRun,
        deleteRun,
        clearAll,
        resetAccumulator,
    };
}
