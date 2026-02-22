/**
 * useConvergence — tracks convergence state across all SR change events.
 */

import { useMemo } from 'react';
import { SRChangeEvent, ConvergenceResult, ConvergencePhase } from '../types';

export interface ConvergenceEventInfo {
    event: SRChangeEvent;
    results: Record<string, ConvergenceResult>; // algoId → result
    allConverged: boolean;
}

export function useConvergence(
    srChangeEvents: SRChangeEvent[],
    convergenceResults: ConvergenceResult[]
) {
    const eventInfos = useMemo((): ConvergenceEventInfo[] => {
        return srChangeEvents.map(event => {
            const results: Record<string, ConvergenceResult> = {};
            for (const result of convergenceResults) {
                if (result.eventId === event.eventId) {
                    results[result.algorithmId] = result;
                }
            }
            const allConverged = Object.values(results).every(r => r.phase === 'converged');
            return { event, results, allConverged };
        });
    }, [srChangeEvents, convergenceResults]);

    const activeEvent = useMemo((): ConvergenceEventInfo | null => {
        // Return the latest non-converged event, or the latest event
        for (let i = eventInfos.length - 1; i >= 0; i--) {
            if (!eventInfos[i].allConverged) return eventInfos[i];
        }
        return eventInfos.length > 0 ? eventInfos[eventInfos.length - 1] : null;
    }, [eventInfos]);

    const generateNarrative = (info: ConvergenceEventInfo, algoNames: Record<string, string>): string => {
        const results = Object.values(info.results).filter(r => r.phase === 'converged');
        if (results.length < 2) {
            if (results.length === 1) {
                const r = results[0];
                const name = algoNames[r.algorithmId] || r.algorithmId;
                return `${name} converged in ${r.convergenceLatencyTxns} transactions after the SR change.`;
            }
            return '';
        }

        // Sort by convergence latency
        results.sort((a, b) => (a.convergenceLatencyTxns ?? Infinity) - (b.convergenceLatencyTxns ?? Infinity));
        const winner = results[0];
        const loser = results[results.length - 1];
        const winnerName = algoNames[winner.algorithmId] || winner.algorithmId;
        const loserName = algoNames[loser.algorithmId] || loser.algorithmId;
        const ratio = loser.convergenceLatencyTxns! / winner.convergenceLatencyTxns!;

        return `${winnerName} converged ${ratio.toFixed(1)}x faster than ${loserName} on this event. ` +
            `${winnerName} adapted within ${winner.convergenceLatencyTxns} transactions, ` +
            `while ${loserName} took ${loser.convergenceLatencyTxns} transactions. ` +
            `${winnerName} caused ~${winner.estimatedExtraFailures} extra failures vs ` +
            `${loserName}'s ~${loser.estimatedExtraFailures} extra failures during the convergence window.`;
    };

    return {
        eventInfos,
        activeEvent,
        generateNarrative,
    };
}
