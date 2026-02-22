/**
 * FullscreenSROverlay — shows manipulated SR and calculated SR per PG in top-right
 * When a chart is in fullscreen mode.
 */

import React from 'react';
import { AlgorithmConfig, PGConfig, TickMetrics } from '../types';

interface Props {
    latestMetrics: TickMetrics | null;
    algorithms: AlgorithmConfig[];
    pgs: PGConfig[];
}

export default function FullscreenSROverlay({ latestMetrics, algorithms, pgs }: Props) {
    if (!latestMetrics) return null;

    return (
        <div className="fullscreen-sr-overlay">
            <h5>SR Status</h5>
            {pgs.map(pg => {
                const trueSR = latestMetrics.trueSRs[pg.pgId] ?? 0;
                return (
                    <div key={pg.pgId}>
                        <div className="sr-overlay-row">
                            <span className="pg-dot" style={{ background: pg.colour }} />
                            <strong style={{ minWidth: 45, fontSize: '0.75rem', color: '#f1f5f9' }}>{pg.name}</strong>
                            <span className="sr-true">{trueSR.toFixed(1)}%</span>
                        </div>
                        {algorithms.map(algo => {
                            const est = latestMetrics.estimatedSRs?.[algo.instanceId]?.[pg.pgId] ?? 0;
                            return (
                                <div key={algo.instanceId} className="sr-overlay-row" style={{ paddingLeft: '1.25rem' }}>
                                    <span className="sr-est">
                                        {algo.displayName}: {est.toFixed(1)}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}
