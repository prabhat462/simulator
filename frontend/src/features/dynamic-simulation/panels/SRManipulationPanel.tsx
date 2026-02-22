/**
 * SRManipulationPanel — the centrepiece UI: interactive SR sliders during PAUSED state.
 */

import React, { useState, useEffect } from 'react';
import { PGConfig, SimulationStatus } from '../types';

interface Props {
    pgs: PGConfig[];
    currentSRs: Record<string, number>;  // pgId → current true SR (0–1)
    status: SimulationStatus;
    onApplyAndResume: (stagedChanges: Record<string, number>) => void;
}

export default function SRManipulationPanel({ pgs, currentSRs, status, onApplyAndResume }: Props) {
    const [stagedValues, setStagedValues] = useState<Record<string, number>>({});

    // Initialize staged values from current SRs when paused
    useEffect(() => {
        if (status === 'paused') {
            setStagedValues({ ...currentSRs });
        }
    }, [status, currentSRs]);

    const isPaused = status === 'paused';
    const isRunning = status === 'running';

    const handleSliderChange = (pgId: string, value: number) => {
        setStagedValues(prev => ({ ...prev, [pgId]: value }));
    };

    const handleResetToCurrent = () => {
        setStagedValues({ ...currentSRs });
    };

    const handleApplyAndResume = () => {
        onApplyAndResume(stagedValues);
    };

    const changedPgs = pgs.filter(pg => {
        const current = currentSRs[pg.pgId] ?? pg.initialSR;
        const staged = stagedValues[pg.pgId] ?? current;
        return Math.abs(current - staged) > 0.005;
    });

    const hasChanges = changedPgs.length > 0;

    const getSRColor = (sr: number): string => {
        if (sr >= 0.80) return '#10b981';
        if (sr >= 0.50) return '#f59e0b';
        return '#ef4444';
    };

    const getDeltaInfo = (pgId: string): { delta: number; label: string; className: string } => {
        const current = currentSRs[pgId] ?? 0;
        const staged = stagedValues[pgId] ?? current;
        const delta = Math.round((staged - current) * 100);
        if (Math.abs(delta) < 1) return { delta: 0, label: '(no change)', className: 'delta-none' };
        const sign = delta > 0 ? '+' : '';
        const severity = Math.abs(delta) > 30 ? ' ⚠️ Major' : '';
        return {
            delta,
            label: `${sign}${delta}pp change staged${severity}`,
            className: delta > 0 ? 'delta-positive' : (Math.abs(delta) > 30 ? 'delta-major-drop' : 'delta-negative'),
        };
    };

    // Find new optimal PG after staged changes
    const newOptimalPG = (() => {
        if (!hasChanges) return null;
        let bestPg = pgs[0];
        let bestSR = stagedValues[pgs[0]?.pgId] ?? 0;
        for (const pg of pgs) {
            const sr = stagedValues[pg.pgId] ?? currentSRs[pg.pgId] ?? 0;
            if (sr > bestSR) { bestSR = sr; bestPg = pg; }
        }
        return bestPg;
    })();

    return (
        <div className={`sandbox-panel sr-manipulation-panel ${isPaused ? 'paused-mode' : ''}`}>
            <div className="panel-header">
                {isPaused ? (
                    <>
                        <h3>⏸ Simulation Paused</h3>
                        <p className="panel-hint">Adjust gateway success rates. Changes apply on Resume.</p>
                    </>
                ) : isRunning ? (
                    <>
                        <h3>🔒 SR Values (Live)</h3>
                        <p className="panel-hint">Pause simulation to adjust SR values</p>
                    </>
                ) : (
                    <>
                        <h3>SR Manipulation</h3>
                        <p className="panel-hint">Start simulation to see live SR values</p>
                    </>
                )}
            </div>

            <div className="sr-slider-list">
                {pgs.map(pg => {
                    const currentSR = currentSRs[pg.pgId] ?? pg.initialSR;
                    const stagedSR = stagedValues[pg.pgId] ?? currentSR;
                    const deltaInfo = isPaused ? getDeltaInfo(pg.pgId) : null;

                    return (
                        <div key={pg.pgId} className="sr-slider-card">
                            <div className="sr-slider-header">
                                <span className="pg-colour-dot" style={{ backgroundColor: pg.colour }} />
                                <span className="sr-pg-name">{pg.name}</span>
                                <span className="sr-current" style={{ color: getSRColor(currentSR) }}>
                                    {isRunning || isPaused ? `${Math.round(currentSR * 100)}%` : `${Math.round(pg.initialSR * 100)}%`}
                                </span>
                            </div>

                            {(isPaused || isRunning) && (
                                <div className="sr-slider-body">
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={Math.round((isPaused ? stagedSR : currentSR) * 100)}
                                        onChange={e => handleSliderChange(pg.pgId, Number(e.target.value) / 100)}
                                        disabled={!isPaused}
                                        className="sr-slider-live"
                                        style={{ accentColor: pg.colour }}
                                    />
                                    {isPaused && (
                                        <div className="sr-staged-info">
                                            <span className="sr-new-value" style={{ color: getSRColor(stagedSR) }}>
                                                → {Math.round(stagedSR * 100)}%
                                            </span>
                                            {deltaInfo && (
                                                <span className={`sr-delta ${deltaInfo.className}`}>
                                                    {deltaInfo.label}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {isPaused && (
                <div className="sr-staged-summary">
                    {hasChanges ? (
                        <>
                            <div className="staged-summary-header">Staged Changes</div>
                            <ul className="staged-changes-list">
                                {changedPgs.map(pg => {
                                    const current = currentSRs[pg.pgId] ?? 0;
                                    const staged = stagedValues[pg.pgId] ?? current;
                                    const delta = Math.round((staged - current) * 100);
                                    return (
                                        <li key={pg.pgId}>
                                            <span style={{ color: pg.colour }}>{pg.name}</span>:{' '}
                                            {Math.round(current * 100)}% → {Math.round(staged * 100)}%{' '}
                                            ({delta > 0 ? '+' : ''}{delta}pp)
                                        </li>
                                    );
                                })}
                            </ul>
                            {newOptimalPG && (
                                <div className="new-optimal">
                                    New optimal: <strong>{newOptimalPG.name}</strong> at {Math.round((stagedValues[newOptimalPG.pgId] ?? 0) * 100)}%
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="no-changes">No changes staged</div>
                    )}

                    <div className="sr-actions">
                        <button className="btn-reset-staged" onClick={handleResetToCurrent}>
                            Reset to Current
                        </button>
                        <button className="btn-apply-resume" onClick={handleApplyAndResume}>
                            ▶ Apply & Resume
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
