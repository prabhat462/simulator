/**
 * ConvergencePanel — displays convergence analysis for SR change events.
 */

import React from 'react';
import { AlgorithmConfig } from '../types';
import { ConvergenceEventInfo } from '../hooks/useConvergence';

interface Props {
    eventInfos: ConvergenceEventInfo[];
    activeEvent: ConvergenceEventInfo | null;
    algorithms: AlgorithmConfig[];
    generateNarrative: (info: ConvergenceEventInfo, names: Record<string, string>) => string;
    tick: number;
}

export default function ConvergencePanel({ eventInfos, activeEvent, algorithms, generateNarrative, tick }: Props) {
    const algoNames: Record<string, string> = {};
    for (const a of algorithms) {
        algoNames[a.instanceId] = a.displayName;
    }

    if (eventInfos.length === 0) {
        return (
            <div className="sandbox-panel convergence-panel convergence-empty">
                <h3>Convergence Analysis</h3>
                <p>Pause the simulation and adjust gateway SR values to begin measuring convergence latency.</p>
            </div>
        );
    }

    const phaseEmoji: Record<string, string> = {
        blindness: '🔴',
        detecting: '🟡',
        converged: '✅',
        not_started: '⬜',
    };

    const phaseLabel: Record<string, string> = {
        blindness: 'Blindness',
        detecting: 'Detecting',
        converged: 'Converged',
        not_started: 'Not Started',
    };

    return (
        <div className="sandbox-panel convergence-panel">
            <h3>Convergence Analysis</h3>

            {/* Multi-event summary */}
            {eventInfos.length > 1 && (
                <div className="convergence-summary-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Algorithm</th>
                                {eventInfos.map((info, i) => (
                                    <th key={info.event.eventId}>
                                        Event #{i + 1}<br />
                                        <small>{info.event.pgId} {Math.round(info.event.oldSR * 100)}%→{Math.round(info.event.newSR * 100)}%</small>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {algorithms.map(algo => (
                                <tr key={algo.instanceId}>
                                    <td>{algo.displayName}</td>
                                    {eventInfos.map(info => {
                                        const result = info.results[algo.instanceId];
                                        return (
                                            <td key={info.event.eventId} className={result?.phase === 'converged' ? 'converged-cell' : ''}>
                                                {result ? (
                                                    result.phase === 'converged'
                                                        ? `${result.convergenceLatencyTxns} txns`
                                                        : `${phaseEmoji[result.phase]} ${phaseLabel[result.phase]}`
                                                ) : '—'}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Active event detail */}
            {activeEvent && (
                <div className={`convergence-detail ${activeEvent.allConverged ? 'complete' : 'active'}`}>
                    <div className="convergence-detail-header">
                        <span className="event-label">
                            {activeEvent.allConverged ? '✅' : '🔄'} Event: {activeEvent.event.pgId}{' '}
                            {Math.round(activeEvent.event.oldSR * 100)}% → {Math.round(activeEvent.event.newSR * 100)}%
                            {' '}at T={activeEvent.event.tick.toLocaleString()}
                        </span>
                    </div>

                    <table className="convergence-detail-table">
                        <thead>
                            <tr>
                                <th>Algorithm</th>
                                <th>Phase</th>
                                <th>Latency</th>
                                <th>Txns on Bad PG</th>
                                <th>Est. Extra Failures</th>
                            </tr>
                        </thead>
                        <tbody>
                            {algorithms.map(algo => {
                                const result = activeEvent.results[algo.instanceId];
                                const elapsed = result ? tick - activeEvent.event.tick : 0;
                                return (
                                    <tr key={algo.instanceId}>
                                        <td>{algo.displayName}</td>
                                        <td>
                                            {result ? `${phaseEmoji[result.phase]} ${phaseLabel[result.phase]}` : '⬜ Waiting'}
                                            {result && result.phase !== 'converged' && (
                                                <small className="elapsed"> ({elapsed} txns)</small>
                                            )}
                                        </td>
                                        <td>{result?.convergenceLatencyTxns != null ? `${result.convergenceLatencyTxns} txns` : '—'}</td>
                                        <td>{result ? result.damageTxns : '—'}</td>
                                        <td>{result ? `~${result.estimatedExtraFailures}` : '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {activeEvent.allConverged && (
                        <div className="convergence-narrative">
                            <strong>Analysis:</strong> {generateNarrative(activeEvent, algoNames)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
