/**
 * StatisticianDashboard — dedicated analysis environment for simulation data.
 * Provides performance summaries, edge case analysis, routing stability,
 * error margins, and CSV export for each saved simulation run.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { SimulationRunSnapshot } from '../hooks/useMetricsStore';
import '../SimulationSandbox.css';

const STORAGE_KEY = 'sim_analysis_runs';

function loadRuns(): SimulationRunSnapshot[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
}

export default function StatisticianDashboard() {
    const [runs] = useState<SimulationRunSnapshot[]>(loadRuns);
    const [selectedRunId, setSelectedRunId] = useState<string>(runs[0]?.runId || '');

    const selectedRun = useMemo(() => runs.find(r => r.runId === selectedRunId), [runs, selectedRunId]);

    // ─── Performance Summary ─────────────────────────────────
    const performanceSummary = useMemo(() => {
        if (!selectedRun || selectedRun.metricSnapshots.length === 0) return null;

        const snapshots = selectedRun.metricSnapshots;
        const algos = selectedRun.algorithms;
        const lastSnap = snapshots[snapshots.length - 1];

        return algos.map(algo => {
            const regret = lastSnap.cumulativeRegret[algo.instanceId] || 0;
            const achievedSR = lastSnap.rollingAchievedSR[algo.instanceId] || 0;
            const optimalSR = lastSnap.optimalSR || 0;
            const gap = optimalSR - achievedSR;

            // Calculate average share per PG
            const finalShares = lastSnap.routingShares[algo.instanceId] || {};

            return {
                name: algo.displayName,
                instanceId: algo.instanceId,
                cumulativeRegret: regret,
                achievedSR,
                optimalSR,
                gap,
                finalShares,
            };
        });
    }, [selectedRun]);

    // ─── Edge Case Analysis ──────────────────────────────────
    const edgeCaseAnalysis = useMemo(() => {
        if (!selectedRun) return null;

        const { srChangeEvents, convergenceResults, algorithms } = selectedRun;

        // Find worst convergence latency per algorithm
        const worstConvergence: Record<string, { latency: number; eventId: string }> = {};
        for (const result of convergenceResults) {
            if (result.phase === 'converged' && result.convergenceLatencyTxns != null) {
                const current = worstConvergence[result.algorithmId];
                if (!current || result.convergenceLatencyTxns > current.latency) {
                    worstConvergence[result.algorithmId] = {
                        latency: result.convergenceLatencyTxns,
                        eventId: result.eventId,
                    };
                }
            }
        }

        // Count blindness events (convergence failed)
        const blindnessCount: Record<string, number> = {};
        for (const result of convergenceResults) {
            if (result.phase === 'blindness' || result.phase === 'detecting') {
                blindnessCount[result.algorithmId] = (blindnessCount[result.algorithmId] || 0) + 1;
            }
        }

        return {
            totalSRChanges: srChangeEvents.length,
            totalConvergenceTests: convergenceResults.length,
            worstConvergence,
            blindnessCount,
            algorithms,
        };
    }, [selectedRun]);

    // ─── Error Margins ───────────────────────────────────────
    const errorMargins = useMemo(() => {
        if (!selectedRun || selectedRun.metricSnapshots.length < 5) return null;

        const snapshots = selectedRun.metricSnapshots;
        const algos = selectedRun.algorithms;
        const pgs = selectedRun.pgs;

        return algos.map(algo => {
            const errors: Record<string, { mean: number; std: number; max: number }> = {};

            for (const pg of pgs) {
                const diffs = snapshots.map(s => {
                    const est = s.estimatedSRs?.[algo.instanceId]?.[pg.pgId] ?? 0;
                    const trueSR = s.trueSRs?.[pg.pgId] ?? 0;
                    return est - trueSR;
                });

                const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
                const variance = diffs.reduce((a, d) => a + (d - mean) ** 2, 0) / diffs.length;
                const std = Math.sqrt(variance);
                const maxErr = Math.max(...diffs.map(Math.abs));

                errors[pg.pgId] = { mean, std, max: maxErr };
            }

            return { algoName: algo.displayName, instanceId: algo.instanceId, pgErrors: errors };
        });
    }, [selectedRun]);

    // ─── CSV Export ──────────────────────────────────────────
    const exportCSV = useCallback(() => {
        if (!selectedRun) return;

        const header = ['tick', 'optimalSR'];
        const algos = selectedRun.algorithms;
        const pgs = selectedRun.pgs;

        for (const algo of algos) {
            header.push(`regret_${algo.displayName}`);
            header.push(`achievedSR_${algo.displayName}`);
            for (const pg of pgs) {
                header.push(`share_${algo.displayName}_${pg.name}`);
                header.push(`estSR_${algo.displayName}_${pg.name}`);
            }
        }
        for (const pg of pgs) {
            header.push(`trueSR_${pg.name}`);
        }

        const rows = selectedRun.metricSnapshots.map(s => {
            const row: (string | number)[] = [s.tick, s.optimalSR];
            for (const algo of algos) {
                row.push(s.cumulativeRegret[algo.instanceId] ?? 0);
                row.push(s.rollingAchievedSR[algo.instanceId] ?? 0);
                for (const pg of pgs) {
                    row.push(s.routingShares[algo.instanceId]?.[pg.pgId] ?? 0);
                    row.push(s.estimatedSRs[algo.instanceId]?.[pg.pgId] ?? 0);
                }
            }
            for (const pg of pgs) {
                row.push(s.trueSRs[pg.pgId] ?? 0);
            }
            return row.join(',');
        });

        const csv = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simulation_${selectedRun.runId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [selectedRun]);

    if (runs.length === 0) {
        return (
            <div className="stat-dashboard">
                <h1>📊 Statistician's Analysis Dashboard</h1>
                <div className="stat-no-data">
                    <h2>No Simulation Data Available</h2>
                    <p>Run a simulation in the Sandbox and save the run to see analysis here.</p>
                    <p>Saved runs will automatically appear for detailed statistical analysis.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="stat-dashboard">
            <h1>📊 Statistician's Analysis Dashboard</h1>
            <p>In-depth analysis of simulation runs for algorithm evaluation and improvement.</p>

            {/* Run Selector */}
            <div className="stat-run-selector">
                <label>Select Run:</label>
                <select value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}>
                    {runs.map(r => (
                        <option key={r.runId} value={r.runId}>
                            {new Date(r.timestamp).toLocaleString()} — {r.durationTicks.toLocaleString()} ticks — {r.algorithms.map(a => a.displayName).join(', ')}
                        </option>
                    ))}
                </select>
            </div>

            {selectedRun && (
                <div className="stat-sections">

                    {/* ═══ 1. Performance Summary ═══ */}
                    <div className="stat-section">
                        <h2>🏆 Performance Summary</h2>
                        {performanceSummary && (
                            <>
                                <div className="stat-kpi-grid">
                                    {performanceSummary.map(p => (
                                        <div key={p.instanceId} className="stat-kpi">
                                            <div className="stat-kpi-value">{p.achievedSR.toFixed(1)}%</div>
                                            <div className="stat-kpi-label">{p.name} Achieved SR</div>
                                        </div>
                                    ))}
                                    <div className="stat-kpi">
                                        <div className="stat-kpi-value">{selectedRun.durationTicks.toLocaleString()}</div>
                                        <div className="stat-kpi-label">Total Transactions</div>
                                    </div>
                                </div>
                                <table className="stat-table">
                                    <thead>
                                        <tr>
                                            <th>Algorithm</th>
                                            <th>Achieved SR</th>
                                            <th>Optimal SR</th>
                                            <th>Gap</th>
                                            <th>Cumulative Regret</th>
                                            <th>Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {performanceSummary.map(p => (
                                            <tr key={p.instanceId}>
                                                <td><strong>{p.name}</strong></td>
                                                <td>{p.achievedSR.toFixed(2)}%</td>
                                                <td>{p.optimalSR.toFixed(2)}%</td>
                                                <td>{p.gap.toFixed(2)}pp</td>
                                                <td>{p.cumulativeRegret.toFixed(2)}</td>
                                                <td>
                                                    <span className={`stat-badge ${p.gap < 2 ? 'good' : p.gap < 5 ? 'warn' : 'bad'}`}>
                                                        {p.gap < 2 ? 'Excellent' : p.gap < 5 ? 'Good' : 'Needs Work'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>

                    {/* ═══ 2. Edge Case Analysis ═══ */}
                    <div className="stat-section">
                        <h2>🔍 Edge Case Analysis</h2>
                        {edgeCaseAnalysis && (
                            <>
                                <div className="stat-kpi-grid">
                                    <div className="stat-kpi">
                                        <div className="stat-kpi-value">{edgeCaseAnalysis.totalSRChanges}</div>
                                        <div className="stat-kpi-label">SR Change Events</div>
                                    </div>
                                    <div className="stat-kpi">
                                        <div className="stat-kpi-value">{edgeCaseAnalysis.totalConvergenceTests}</div>
                                        <div className="stat-kpi-label">Convergence Tests</div>
                                    </div>
                                </div>

                                <h3>Worst Convergence Latency</h3>
                                <table className="stat-table">
                                    <thead>
                                        <tr><th>Algorithm</th><th>Worst Latency (txns)</th><th>Event</th><th>Blindness Count</th></tr>
                                    </thead>
                                    <tbody>
                                        {edgeCaseAnalysis.algorithms.map(algo => {
                                            const worst = edgeCaseAnalysis.worstConvergence[algo.instanceId];
                                            const blind = edgeCaseAnalysis.blindnessCount[algo.instanceId] || 0;
                                            return (
                                                <tr key={algo.instanceId}>
                                                    <td><strong>{algo.displayName}</strong></td>
                                                    <td>{worst ? worst.latency.toLocaleString() : 'N/A'}</td>
                                                    <td>{worst?.eventId || '—'}</td>
                                                    <td>
                                                        <span className={`stat-badge ${blind === 0 ? 'good' : 'bad'}`}>
                                                            {blind}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>

                    {/* ═══ 3. Error Margins ═══ */}
                    <div className="stat-section">
                        <h2>📏 Estimation Error Margins</h2>
                        {errorMargins && errorMargins.map(algo => (
                            <div key={algo.instanceId}>
                                <h3>{algo.algoName}</h3>
                                <table className="stat-table">
                                    <thead>
                                        <tr><th>PG</th><th>Mean Error</th><th>Std Dev</th><th>Max Error</th><th>Quality</th></tr>
                                    </thead>
                                    <tbody>
                                        {selectedRun.pgs.map(pg => {
                                            const e = algo.pgErrors[pg.pgId];
                                            if (!e) return null;
                                            return (
                                                <tr key={pg.pgId}>
                                                    <td>
                                                        <span className="pg-dot" style={{ background: pg.colour, width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                                                        {pg.name}
                                                    </td>
                                                    <td>{e.mean > 0 ? '+' : ''}{e.mean.toFixed(2)}pp</td>
                                                    <td>{e.std.toFixed(2)}pp</td>
                                                    <td>{e.max.toFixed(2)}pp</td>
                                                    <td>
                                                        <span className={`stat-badge ${e.max < 5 ? 'good' : e.max < 15 ? 'warn' : 'bad'}`}>
                                                            {e.max < 5 ? 'Tight' : e.max < 15 ? 'Moderate' : 'Wide'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>

                    {/* ═══ 4. Routing Stability ═══ */}
                    <div className="stat-section">
                        <h2>🔄 Routing Stability</h2>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Final traffic distribution across PGs per algorithm.
                        </p>
                        {performanceSummary && (
                            <table className="stat-table">
                                <thead>
                                    <tr>
                                        <th>Algorithm</th>
                                        {selectedRun.pgs.map(pg => <th key={pg.pgId}>{pg.name}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {performanceSummary.map(p => (
                                        <tr key={p.instanceId}>
                                            <td><strong>{p.name}</strong></td>
                                            {selectedRun.pgs.map(pg => (
                                                <td key={pg.pgId}>{(p.finalShares[pg.pgId] || 0).toFixed(1)}%</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* ═══ 5. Data Export ═══ */}
                    <div className="stat-section">
                        <h2>💾 Data Export</h2>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                            Export the full simulation metrics as CSV for offline analysis in Excel, R, Python, etc.
                        </p>
                        <button className="stat-export-btn" onClick={exportCSV}>
                            ⬇ Export CSV ({selectedRun.metricSnapshots.length} data points)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
