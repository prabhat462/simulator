/**
 * ConvergenceTracker — monitors algorithm routing behaviour after SR changes.
 * Detects Phase 1 (Blindness) → Phase 2 (Detecting) → Phase 3 (Converged).
 */

import { SRChangeEvent, ConvergenceResult, ConvergencePhase } from '../types';

interface MonitorState {
    eventId: string;
    pgId: string;
    startTick: number;
    oldSR: number;
    newSR: number;
    preEventShares: Record<string, number>; // algoId → routing share at event time
    algoStates: Map<string, {
        phase: ConvergencePhase;
        detectionTick: number | null;
        convergenceTick: number | null;
        consecutiveShifted: number;
        damageTxns: number;  // txns routed to changed PG since event
    }>;
}

export class ConvergenceTracker {
    private monitors: Map<string, MonitorState> = new Map();
    private algoIds: string[] = [];
    private convergenceThreshold = 0.10;
    private stabilityWindow = 20;
    private routingTracker: Map<string, Map<string, number[]>> = new Map(); // algoId → pgId → recent choices

    initialize(algoIds: string[], pgIds: string[], threshold: number, stabilityWindow: number): void {
        this.algoIds = algoIds;
        this.convergenceThreshold = threshold;
        this.stabilityWindow = stabilityWindow;
        this.monitors = new Map();
        this.routingTracker = new Map();
        for (const algoId of algoIds) {
            const pgMap = new Map<string, number[]>();
            for (const pgId of pgIds) {
                pgMap.set(pgId, []);
            }
            this.routingTracker.set(algoId, pgMap);
        }
    }

    recordRouting(algoId: string, chosenPg: string, allPgIds: string[]): void {
        const algoTracker = this.routingTracker.get(algoId);
        if (!algoTracker) return;
        for (const pgId of allPgIds) {
            const hist = algoTracker.get(pgId);
            if (hist) {
                hist.push(pgId === chosenPg ? 1 : 0);
                if (hist.length > 100) hist.shift(); // keep last 100 for share calc
            }
        }
    }

    private getRoutingShare(algoId: string, pgId: string): number {
        const hist = this.routingTracker.get(algoId)?.get(pgId);
        if (!hist || hist.length === 0) return 0;
        const window = hist.slice(-50); // last 50 txns
        return window.reduce((s, v) => s + v, 0) / window.length;
    }

    registerEvent(event: SRChangeEvent): void {
        const preEventShares: Record<string, number> = {};
        for (const algoId of this.algoIds) {
            preEventShares[algoId] = this.getRoutingShare(algoId, event.pgId);
        }

        const algoStates = new Map<string, {
            phase: ConvergencePhase;
            detectionTick: number | null;
            convergenceTick: number | null;
            consecutiveShifted: number;
            damageTxns: number;
        }>();

        for (const algoId of this.algoIds) {
            algoStates.set(algoId, {
                phase: 'blindness',
                detectionTick: null,
                convergenceTick: null,
                consecutiveShifted: 0,
                damageTxns: 0,
            });
        }

        this.monitors.set(event.eventId, {
            eventId: event.eventId,
            pgId: event.pgId,
            startTick: event.tick,
            oldSR: event.oldSR,
            newSR: event.newSR,
            preEventShares,
            algoStates,
        });
    }

    /** Called every tick after routing decisions. Returns any new convergence results. */
    tick(tick: number, routingDecisions: Record<string, string>): ConvergenceResult[] {
        const results: ConvergenceResult[] = [];

        for (const [, monitor] of this.monitors) {
            for (const algoId of this.algoIds) {
                const state = monitor.algoStates.get(algoId)!;
                if (state.phase === 'converged') continue;

                // Count damage: did this algorithm route to the changed PG?
                if (routingDecisions[algoId] === monitor.pgId) {
                    state.damageTxns++;
                }

                const currentShare = this.getRoutingShare(algoId, monitor.pgId);
                const preShare = monitor.preEventShares[algoId];
                const shareDelta = currentShare - preShare;

                // Determine correct direction
                const srDropped = monitor.newSR < monitor.oldSR;
                const directionCorrect = srDropped
                    ? shareDelta < -this.convergenceThreshold
                    : shareDelta > this.convergenceThreshold;

                if (directionCorrect) {
                    if (state.phase === 'blindness') {
                        state.phase = 'detecting';
                        state.detectionTick = tick;
                    }
                    state.consecutiveShifted++;

                    if (state.consecutiveShifted >= this.stabilityWindow) {
                        state.phase = 'converged';
                        state.convergenceTick = tick;

                        const latency = tick - monitor.startTick;
                        const damageRate = srDropped ? (monitor.oldSR - monitor.newSR) : 0;

                        const result: ConvergenceResult = {
                            eventId: monitor.eventId,
                            algorithmId: algoId,
                            phase: 'converged',
                            convergenceTick: tick,
                            convergenceLatencyTxns: latency,
                            detectionTick: state.detectionTick,
                            phase1Duration: state.detectionTick ? state.detectionTick - monitor.startTick : null,
                            phase2Duration: state.detectionTick ? tick - state.detectionTick : null,
                            damageTxns: state.damageTxns,
                            estimatedExtraFailures: Math.round(state.damageTxns * damageRate),
                        };
                        results.push(result);
                    }
                } else {
                    state.consecutiveShifted = 0;
                    // Still in blindness if never shifted
                }
            }
        }

        return results;
    }

    /** Get current state for all active monitors */
    getActiveResults(): ConvergenceResult[] {
        const results: ConvergenceResult[] = [];
        for (const [, monitor] of this.monitors) {
            for (const algoId of this.algoIds) {
                const state = monitor.algoStates.get(algoId)!;
                const srDropped = monitor.newSR < monitor.oldSR;
                const damageRate = srDropped ? (monitor.oldSR - monitor.newSR) : 0;

                results.push({
                    eventId: monitor.eventId,
                    algorithmId: algoId,
                    phase: state.phase,
                    convergenceTick: state.convergenceTick,
                    convergenceLatencyTxns: state.convergenceTick ? state.convergenceTick - monitor.startTick : null,
                    detectionTick: state.detectionTick,
                    phase1Duration: state.detectionTick ? state.detectionTick - monitor.startTick : null,
                    phase2Duration: state.convergenceTick && state.detectionTick ? state.convergenceTick - state.detectionTick : null,
                    damageTxns: state.damageTxns,
                    estimatedExtraFailures: Math.round(state.damageTxns * damageRate),
                });
            }
        }
        return results;
    }
}
