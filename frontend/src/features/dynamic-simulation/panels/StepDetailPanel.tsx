/**
 * StepDetailPanel — shows detailed per-transaction breakdown when in step mode.
 * Only visible when a step detail is available (after user clicks Step button).
 */

import React from 'react';
import { TransactionDetail, AlgorithmConfig, PGConfig } from '../types';

interface Props {
    detail: TransactionDetail | null;
    algorithms: AlgorithmConfig[];
    pgs: PGConfig[];
}

export default function StepDetailPanel({ detail, algorithms, pgs }: Props) {
    if (!detail) return null;

    const pgNameMap: Record<string, string> = {};
    const pgColorMap: Record<string, string> = {};
    for (const pg of pgs) {
        pgNameMap[pg.pgId] = pg.name;
        pgColorMap[pg.pgId] = pg.colour;
    }

    return (
        <div className="step-detail-panel">
            <div className="step-header">
                <span className="step-tick">Tick #{detail.tick}</span>
                <span className="step-txn">
                    {detail.transaction.paymentMode} · {detail.transaction.amountBand} · {detail.transaction.issuingBank}
                </span>
            </div>

            <div className="step-optimal">
                Optimal SR: <strong>{detail.optimalSR.toFixed(1)}%</strong>
            </div>

            <table className="step-table">
                <thead>
                    <tr>
                        <th>Algorithm</th>
                        <th>Chose</th>
                        <th>Outcome</th>
                        <th>True SR</th>
                        <th>Regret</th>
                    </tr>
                </thead>
                <tbody>
                    {algorithms.map(algo => {
                        const d = detail.decisions[algo.instanceId];
                        if (!d) return null;
                        return (
                            <tr key={algo.instanceId}>
                                <td>{algo.displayName}</td>
                                <td>
                                    <span className="pg-dot" style={{ background: pgColorMap[d.chosenPg] }} />
                                    {pgNameMap[d.chosenPg] || d.chosenPg}
                                </td>
                                <td className={d.outcome === 1 ? 'outcome-success' : 'outcome-fail'}>
                                    {d.outcome === 1 ? '✅ Success' : '❌ Failed'}
                                </td>
                                <td>{d.trueSR.toFixed(1)}%</td>
                                <td className={d.regretIncurred > 0.01 ? 'regret-nonzero' : 'regret-zero'}>
                                    {(d.regretIncurred * 100).toFixed(2)}%
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="step-estimates">
                <h5>Algorithm Estimates at this Tick</h5>
                <table className="step-est-table">
                    <thead>
                        <tr>
                            <th>PG</th>
                            <th>True</th>
                            {algorithms.map(a => (
                                <th key={a.instanceId}>{a.displayName}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pgs.map(pg => (
                            <tr key={pg.pgId}>
                                <td>
                                    <span className="pg-dot" style={{ background: pg.colour }} />
                                    {pg.name}
                                </td>
                                <td>{(detail.trueSRs[pg.pgId] ?? 0).toFixed(1)}%</td>
                                {algorithms.map(a => {
                                    const est = detail.decisions[a.instanceId]?.estimatedSRs?.[pg.pgId] ?? 0;
                                    return <td key={a.instanceId}>{est.toFixed(1)}%</td>;
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
