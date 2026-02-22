import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { getResults, listExperiments, SimulationResults, AlgorithmResult } from '../api/client';

const ALGO_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#38bdf8', '#a78bfa', '#f472b6', '#fb923c'];

export default function ResultsExplorer() {
    const { runId: paramRunId } = useParams<{ runId: string }>();
    const navigate = useNavigate();
    const [results, setResults] = useState<SimulationResults | null>(null);
    const [experiments, setExperiments] = useState<any[]>([]);
    const [runId, setRunId] = useState(paramRunId || '');
    const [loading, setLoading] = useState(false);
    const [chartMode, setChartMode] = useState<'sr' | 'regret'>('sr');
    const [segmentFilter, setSegmentFilter] = useState<string | null>(null);

    useEffect(() => {
        listExperiments().then(setExperiments).catch(() => { });
    }, []);

    useEffect(() => {
        if (paramRunId) {
            setRunId(paramRunId);
            loadResults(paramRunId);
        }
    }, [paramRunId]);

    const loadResults = async (id: string) => {
        setLoading(true);
        try {
            const res = await getResults(id);
            setResults(res);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleSelectRun = (id: string) => {
        navigate(`/results/${id}`);
    };

    if (!results && !paramRunId) {
        return (
            <div className="fade-in">
                <div className="page-header">
                    <h1 className="page-title">📊 Results Explorer</h1>
                    <p className="page-subtitle">Select a completed simulation to explore results</p>
                </div>
                <div className="page-body">
                    {experiments.filter(e => e.status === 'completed').length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                            <p>No completed simulations yet</p>
                            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/setup')}>
                                Run Experiment →
                            </button>
                        </div>
                    ) : (
                        <div className="grid-3">
                            {experiments.filter(e => e.status === 'completed').map(exp => (
                                <div key={exp.run_id} className="card" style={{ cursor: 'pointer' }}
                                    onClick={() => handleSelectRun(exp.run_id)}>
                                    <div className="card-title">{exp.run_name || exp.run_id}</div>
                                    <div className="card-subtitle">{exp.run_id}</div>
                                    <span className="badge badge-success" style={{ marginTop: 8 }}>COMPLETED</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (loading) {
        return <div className="loader"><div className="spinner"></div></div>;
    }

    if (!results) return null;

    const algos = Object.entries(results.results);
    const algoIds = algos.map(([id]) => id);

    // Build chart data from sr_over_time
    const maxLen = Math.max(...algos.map(([, r]) => r.sr_over_time?.length || 0));
    const chartData = Array.from({ length: maxLen }, (_, i) => {
        const entry: any = { idx: (i + 1) * 100 };
        algos.forEach(([id, r]) => {
            if (chartMode === 'sr') {
                entry[id] = r.sr_over_time?.[i] != null ? +(r.sr_over_time[i] * 100).toFixed(2) : null;
            } else {
                entry[id] = r.regret_over_time?.[i] ?? null;
            }
        });
        return entry;
    });

    // Build SR by gateway chart
    const gateways = results.dataset_stats?.gateways || [];
    const gwChartData = gateways.map(gw => {
        const entry: any = { gateway: gw };
        algos.forEach(([id, r]) => {
            entry[id] = r.sr_by_gateway?.[gw] != null ? +(r.sr_by_gateway[gw] * 100).toFixed(2) : 0;
        });
        return entry;
    });

    // Find winner
    const sortedAlgos = [...algos].sort((a, b) => b[1].overall_sr - a[1].overall_sr);
    const winner = sortedAlgos[0];
    const baseline = algos.find(([id]) => id.includes('round_robin'));
    const uplift = baseline ? winner[1].overall_sr - baseline[1].overall_sr : 0;

    return (
        <div className="fade-in">
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="page-title">📊 Results Explorer</h1>
                        <p className="page-subtitle">{results.run_name} — {results.dataset_stats?.total_transactions?.toLocaleString()} transactions</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/transparency/${runId}`)}>🔍 Transparency</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/report/${runId}`)}>📄 Report</button>
                    </div>
                </div>
            </div>

            <div className="page-body">
                {/* Key Metrics */}
                <div className="grid-4" style={{ marginBottom: 20 }}>
                    <div className="metric-card">
                        <span className="metric-label">🏆 Best Algorithm</span>
                        <span className="metric-value" style={{ fontSize: 20 }}>{winner[1].algorithm_name}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">Best SR</span>
                        <span className="metric-value">{(winner[1].overall_sr * 100).toFixed(2)}%</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">SR Uplift vs Baseline</span>
                        <span className="metric-value" style={{ color: uplift > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                            {(uplift * 100).toFixed(2)}%
                        </span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">Lowest Regret</span>
                        <span className="metric-value" style={{ fontSize: 20 }}>
                            {sortedAlgos.sort((a, b) => a[1].cumulative_regret - b[1].cumulative_regret)[0][1].cumulative_regret.toFixed(1)}
                        </span>
                    </div>
                </div>

                {/* SR / Regret Chart */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                        <h3 className="card-title">{chartMode === 'sr' ? 'Cumulative Success Rate' : 'Cumulative Regret'}</h3>
                        <div className="tabs">
                            <button className={`tab ${chartMode === 'sr' ? 'active' : ''}`} onClick={() => setChartMode('sr')}>SR</button>
                            <button className={`tab ${chartMode === 'regret' ? 'active' : ''}`} onClick={() => setChartMode('regret')}>Regret</button>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={380}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="idx" tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                tickFormatter={(v) => chartMode === 'sr' ? `${v.toFixed(0)}%` : v.toFixed(0)} />
                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {algoIds.map((id, i) => (
                                <Line key={id} type="monotone" dataKey={id} stroke={ALGO_COLORS[i % ALGO_COLORS.length]}
                                    strokeWidth={2} dot={false} name={id} connectNulls />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* SR by Gateway */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <h3 className="card-title" style={{ marginBottom: 16 }}>SR by Gateway (%)</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={gwChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="gateway" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {algoIds.map((id, i) => (
                                <Bar key={id} dataKey={id} fill={ALGO_COLORS[i % ALGO_COLORS.length]} name={id} radius={[4, 4, 0, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Head-to-Head Comparison Table */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 16 }}>Head-to-Head Comparison</h3>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Algorithm</th>
                                    <th>Overall SR</th>
                                    <th>95% CI</th>
                                    <th>Regret</th>
                                    <th>Exploration</th>
                                    <th>Transactions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAlgos.map(([id, r], i) => {
                                    const isWinner = i === 0;
                                    return (
                                        <tr key={id} style={isWinner ? { background: 'rgba(99,102,241,0.06)' } : {}}>
                                            <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ALGO_COLORS[algoIds.indexOf(id) % ALGO_COLORS.length] }}></span>
                                                {r.algorithm_name}
                                                {isWinner && <span className="badge badge-success">BEST</span>}
                                            </td>
                                            <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{(r.overall_sr * 100).toFixed(2)}%</td>
                                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                [{(r.sr_confidence_interval[0] * 100).toFixed(2)}%, {(r.sr_confidence_interval[1] * 100).toFixed(2)}%]
                                            </td>
                                            <td>{r.cumulative_regret.toFixed(2)}</td>
                                            <td>{(r.exploration_ratio * 100).toFixed(1)}%</td>
                                            <td>{r.total_transactions.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Segment Drill-Down */}
                {algos.length > 0 && (
                    <div className="card" style={{ marginTop: 20 }}>
                        <div className="card-header">
                            <h3 className="card-title">Segment Performance — SR by Payment Mode</h3>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Mode</th>
                                        {algoIds.map(id => <th key={id}>{id}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {['upi', 'card', 'netbanking', 'wallet', 'bnpl'].map(mode => {
                                        const hasModeData = algos.some(([, r]) => r.sr_by_mode?.[mode]);
                                        if (!hasModeData) return null;
                                        return (
                                            <tr key={mode}>
                                                <td style={{ fontWeight: 600, textTransform: 'uppercase' }}>{mode}</td>
                                                {algos.map(([id, r]) => {
                                                    const modeData = r.sr_by_mode?.[mode];
                                                    const sr = modeData ? (typeof modeData === 'object' ? modeData.sr : modeData) : null;
                                                    return (
                                                        <td key={id} style={{ fontWeight: 600, color: sr != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                            {sr != null ? `${(sr * 100).toFixed(2)}%` : '—'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
