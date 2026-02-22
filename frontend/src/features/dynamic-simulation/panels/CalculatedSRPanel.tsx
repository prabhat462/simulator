/**
 * CalculatedSRPanel — shows each algorithm's estimated SR for every PG.
 * Color-coded comparison against true SR.
 */

import React from 'react';
import { AlgorithmConfig, PGConfig, TickMetrics } from '../types';

interface Props {
    latestMetrics: TickMetrics | null;
    algorithms: AlgorithmConfig[];
    pgs: PGConfig[];
}

export default function CalculatedSRPanel({ latestMetrics, algorithms, pgs }: Props) {
    if (!latestMetrics || algorithms.length === 0) {
        return (
            <div className="calculated-sr-panel">
                <p className="panel-empty">Start simulation to see algorithm estimates</p>
            </div>
        );
    }

    return (
        <div className="calculated-sr-panel">
            <table className="calc-sr-table">
                <thead>
                    <tr>
                        <th>PG</th>
                        <th>True SR</th>
                        {algorithms.map(a => (
                            <th key={a.instanceId} title={a.displayName}>
                                {a.displayName.length > 10 ? a.displayName.slice(0, 9) + '…' : a.displayName}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {pgs.map(pg => {
                        const trueSR = latestMetrics.trueSRs[pg.pgId] ?? 0;
                        return (
                            <tr key={pg.pgId}>
                                <td>
                                    <span className="pg-dot" style={{ background: pg.colour }} />
                                    {pg.name}
                                </td>
                                <td className="sr-value">{trueSR.toFixed(1)}%</td>
                                {algorithms.map(a => {
                                    const est = latestMetrics.estimatedSRs?.[a.instanceId]?.[pg.pgId] ?? 0;
                                    const diff = est - trueSR;
                                    const diffClass = Math.abs(diff) < 3 ? 'sr-accurate' : diff > 0 ? 'sr-over' : 'sr-under';
                                    return (
                                        <td key={a.instanceId} className={`sr-value ${diffClass}`}>
                                            {est.toFixed(1)}%
                                            <span className="sr-diff">
                                                ({diff >= 0 ? '+' : ''}{diff.toFixed(1)})
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
