/**
 * useSimulation — main hook for Web Worker simulation communication.
 * Creates the worker, sends commands, receives updates, manages simulation state.
 * Bounded arrays to prevent memory leaks during long-running simulations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    SimConfig, SimulationStatus, TickMetrics, SRChangeEvent,
    ConvergenceResult, SimulationEvent, WorkerCommand, WorkerUpdate,
    TransactionDetail
} from '../types';

const MAX_EVENTS = 500;
const MAX_SR_CHANGES = 200;
const MAX_CONVERGENCE = 200;
const MAX_METRICS_BUFFER = 2000;

export interface SimulationState {
    status: SimulationStatus;
    tick: number;
    events: SimulationEvent[];
    srChangeEvents: SRChangeEvent[];
    convergenceResults: ConvergenceResult[];
    latestMetrics: TickMetrics | null;
    latestStepDetail: TransactionDetail | null;
}

export function useSimulation() {
    const workerRef = useRef<Worker | null>(null);
    const [state, setState] = useState<SimulationState>({
        status: 'idle',
        tick: 0,
        events: [],
        srChangeEvents: [],
        convergenceResults: [],
        latestMetrics: null,
        latestStepDetail: null,
    });

    // Chart data buffer (ref to avoid re-renders on every tick)
    const metricsBufferRef = useRef<TickMetrics[]>([]);
    const metricsListenersRef = useRef<Set<(metrics: TickMetrics[]) => void>>(new Set());

    // Subscribe to metrics updates (for charts)
    const subscribeToMetrics = useCallback((listener: (metrics: TickMetrics[]) => void) => {
        metricsListenersRef.current.add(listener);
        return () => { metricsListenersRef.current.delete(listener); };
    }, []);

    // Create worker on mount
    useEffect(() => {
        const worker = new Worker(
            new URL('../worker/simulation.worker.ts', import.meta.url),
            { type: 'module' }
        );

        worker.onmessage = (e: MessageEvent<WorkerUpdate>) => {
            const update = e.data;

            switch (update.type) {
                case 'TICK_BATCH':
                    // Accumulate in buffer and notify chart listeners
                    metricsBufferRef.current.push(...update.metrics);
                    if (metricsBufferRef.current.length > MAX_METRICS_BUFFER) {
                        metricsBufferRef.current = metricsBufferRef.current.slice(-MAX_METRICS_BUFFER);
                    }
                    // Notify listeners
                    for (const listener of metricsListenersRef.current) {
                        listener(update.metrics);
                    }
                    // Update latest metrics in state (just the last one)
                    if (update.metrics.length > 0) {
                        const last = update.metrics[update.metrics.length - 1];
                        setState(prev => ({ ...prev, latestMetrics: last, tick: last.tick }));
                    }
                    break;

                case 'STATUS_CHANGE':
                    setState(prev => ({ ...prev, status: update.status, tick: update.tick }));
                    break;

                case 'SR_CHANGE_EVENT':
                    setState(prev => ({
                        ...prev,
                        srChangeEvents: [...prev.srChangeEvents.slice(-MAX_SR_CHANGES), update.event],
                    }));
                    break;

                case 'CONVERGENCE_UPDATE':
                    setState(prev => ({
                        ...prev,
                        convergenceResults: [...prev.convergenceResults.slice(-MAX_CONVERGENCE), update.result],
                    }));
                    break;

                case 'EVENT':
                    setState(prev => ({
                        ...prev,
                        events: [...prev.events.slice(-MAX_EVENTS), update.event],
                    }));
                    break;

                case 'STEP_DETAIL':
                    setState(prev => ({
                        ...prev,
                        latestStepDetail: update.detail,
                    }));
                    break;
            }
        };

        workerRef.current = worker;
        return () => { worker.terminate(); };
    }, []);

    const sendCommand = useCallback((cmd: WorkerCommand) => {
        workerRef.current?.postMessage(cmd);
    }, []);

    const startSimulation = useCallback((config: SimConfig) => {
        metricsBufferRef.current = [];
        setState({
            status: 'idle',
            tick: 0,
            events: [],
            srChangeEvents: [],
            convergenceResults: [],
            latestMetrics: null,
            latestStepDetail: null,
        });
        sendCommand({ type: 'START', config });
    }, [sendCommand]);

    const pauseSimulation = useCallback(() => {
        sendCommand({ type: 'PAUSE' });
    }, [sendCommand]);

    const resumeSimulation = useCallback((stagedChanges: Record<string, number>) => {
        sendCommand({ type: 'RESUME', stagedChanges });
    }, [sendCommand]);

    const stepOne = useCallback((stagedChanges: Record<string, number>) => {
        sendCommand({ type: 'STEP_ONE', stagedChanges });
    }, [sendCommand]);

    const resetSimulation = useCallback(() => {
        metricsBufferRef.current = [];
        sendCommand({ type: 'RESET' });
        setState({
            status: 'idle',
            tick: 0,
            events: [],
            srChangeEvents: [],
            convergenceResults: [],
            latestMetrics: null,
            latestStepDetail: null,
        });
    }, [sendCommand]);

    const setSpeed = useCallback((tps: number) => {
        sendCommand({ type: 'SET_SPEED', tps });
    }, [sendCommand]);

    return {
        state,
        metricsBuffer: metricsBufferRef,
        subscribeToMetrics,
        startSimulation,
        pauseSimulation,
        resumeSimulation,
        stepOne,
        resetSimulation,
        setSpeed,
    };
}
