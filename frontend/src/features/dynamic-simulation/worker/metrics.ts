/**
 * MetricsAccumulator — tracks per-algorithm routing metrics in real time.
 */

import { TickMetrics } from '../types';

interface AlgoMetrics {
    routingHistory: Map<string, number[]>; // pgId → recent choices (1=chose, 0=not)
    outcomeHistory: number[];             // recent outcomes (0 of 1) for rolling SR
    cumulativeRegret: number;
    totalTicks: number;
}

export class MetricsAccumulator {
    private pgIds: string[] = [];
    private algoMetrics: Map<string, AlgoMetrics> = new Map();
    private rollingWindow = 50;

    initialize(pgIds: string[], algoIds: string[], rollingWindow = 50): void {
        this.pgIds = pgIds;
        this.rollingWindow = rollingWindow;
        this.algoMetrics = new Map();
        for (const algoId of algoIds) {
            const routingHistory = new Map<string, number[]>();
            for (const pgId of pgIds) {
                routingHistory.set(pgId, []);
            }
            this.algoMetrics.set(algoId, {
                routingHistory,
                outcomeHistory: [],
                cumulativeRegret: 0,
                totalTicks: 0,
            });
        }
    }

    record(algoId: string, chosenPg: string, outcome: number, trueSROfChosen: number, optimalSR: number): void {
        const m = this.algoMetrics.get(algoId);
        if (!m) return;

        m.totalTicks++;

        // Record routing choice per PG
        for (const pgId of this.pgIds) {
            const hist = m.routingHistory.get(pgId)!;
            hist.push(pgId === chosenPg ? 1 : 0);
            if (hist.length > this.rollingWindow) hist.shift();
        }

        // Record outcome for rolling SR
        m.outcomeHistory.push(outcome);
        if (m.outcomeHistory.length > this.rollingWindow) m.outcomeHistory.shift();

        // Accumulate regret (use true SR, not outcome, to smooth noise)
        m.cumulativeRegret += (optimalSR - trueSROfChosen);
    }

    getTickMetrics(tick: number, trueSRs: Record<string, number>, estimatedSRs: Record<string, Record<string, number>>): TickMetrics {
        const routingShares: Record<string, Record<string, number>> = {};
        const cumulativeRegret: Record<string, number> = {};
        const rollingAchievedSR: Record<string, number> = {};
        const optimalSR = Math.max(...Object.values(trueSRs));

        for (const [algoId, m] of this.algoMetrics.entries()) {
            // Routing shares
            const shares: Record<string, number> = {};
            for (const pgId of this.pgIds) {
                const hist = m.routingHistory.get(pgId)!;
                shares[pgId] = hist.length > 0
                    ? (hist.reduce((s, v) => s + v, 0) / hist.length) * 100
                    : 0;
            }
            routingShares[algoId] = shares;

            // Cumulative regret
            cumulativeRegret[algoId] = Math.round(m.cumulativeRegret * 1000) / 1000;

            // Rolling achieved SR
            const outcomes = m.outcomeHistory;
            rollingAchievedSR[algoId] = outcomes.length > 0
                ? (outcomes.reduce((s, v) => s + v, 0) / outcomes.length) * 100
                : 0;
        }

        return {
            tick,
            routingShares,
            estimatedSRs,
            cumulativeRegret,
            rollingAchievedSR,
            trueSRs,
            optimalSR,
        };
    }
}
