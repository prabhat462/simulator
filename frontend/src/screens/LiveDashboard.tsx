import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getExperimentStatus, ExperimentStatus } from '../api/client';

const ALGO_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#38bdf8', '#a78bfa', '#f472b6', '#fb923c'];

export default function LiveDashboard() {
    const { runId } = useParams<{ runId: string }>();
    const navigate = useNavigate();
    const [status, setStatus] = useState<ExperimentStatus | null>(null);
    const [srHistory, setSrHistory] = useState<any[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!runId) return;

        const poll = async () => {
            try {
                const s = await getExperimentStatus(runId);
                setStatus(s);

                // Build SR history entry
                if (s.current_metrics && Object.keys(s.current_metrics).length > 0) {
                    const entry: any = { txn: s.processed };
                    for (const [algoId, m] of Object.entries(s.current_metrics)) {
                        entry[algoId] = ((m as any).sr * 100);
                    }
                    setSrHistory(prev => {
                        const next = [...prev, entry];
                        return next.length > 200 ? next.slice(-200) : next;
                    });
                }

                if (s.status === 'completed' || s.status === 'error' || s.status === 'cancelled') {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                }
            } catch (e) {
                console.error(e);
            }
        };

        poll();
        intervalRef.current = setInterval(poll, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [runId]);

    if (!runId) {
        return (
            <div className="fade-in">
                <div className="page-header">
                    <h1 className="page-title">📡 Live Dashboard</h1>
                    <p className="page-subtitle">No active simulation. Launch one from Experiment Setup.</p>
                </div>
                <div className="page-body" style={{ textAlign: 'center', padding: 60 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>No simulation running</p>
                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/setup')}>
                        Go to Setup →
                    </button>
                </div>
            </div>
        );
    }

    const algoIds = status?.current_metrics ? Object.keys(status.current_metrics) : [];

    return (
        <div className="fade-in">
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="page-title">📡 Live Dashboard</h1>
                        <p className="page-subtitle">Run: {runId}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {status?.status === 'completed' && (
                            <button className="btn btn-success" onClick={() => navigate(`/results/${runId}`)}>
                                View Results →
                            </button>
                        )}
                        <span className={`badge ${status?.status === 'running' ? 'badge-warning' : status?.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                            {status?.status?.toUpperCase()}
                        </span>
                    </div>
                </div>
            </div>

            <div className="page-body">
                {/* Progress Bar */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {status?.processed?.toLocaleString()} / {status?.total_transactions?.toLocaleString()} transactions
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            {status?.percent?.toFixed(1)}%
                        </span>
                    </div>
                    <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${status?.percent || 0}%` }}></div>
                    </div>
                    <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            ⏱ Elapsed: <strong style={{ color: 'var(--text-primary)' }}>{status?.elapsed_seconds?.toFixed(1)}s</strong>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            ⏳ Remaining: <strong style={{ color: 'var(--text-primary)' }}>{status?.estimated_remaining?.toFixed(1)}s</strong>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            🚀 Throughput: <strong style={{ color: 'var(--text-primary)' }}>{status?.throughput?.toLocaleString()} txn/s</strong>
                        </div>
                    </div>
                </div>

                {/* Metrics Cards */}
                {algoIds.length > 0 && (
                    <div className="grid-4" style={{ marginBottom: 20 }}>
                        {algoIds.map((algoId, i) => {
                            const m = status?.current_metrics?.[algoId] as any;
                            return (
                                <div className="metric-card" key={algoId}>
                                    <span className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ALGO_COLORS[i % ALGO_COLORS.length], display: 'inline-block' }}></span>
                                        {algoId}
                                    </span>
                                    <span className="metric-value">{((m?.sr || 0) * 100).toFixed(2)}%</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {m?.successes?.toLocaleString()} / {m?.total?.toLocaleString()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* SR Chart */}
                {srHistory.length > 1 && (
                    <div className="card" style={{ marginBottom: 20 }}>
                        <h3 className="card-title" style={{ marginBottom: 16 }}>Cumulative Success Rate (%)</h3>
                        <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={srHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="txn" tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                                <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                    tickFormatter={(v) => `${v.toFixed(1)}%`} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }}
                                    labelFormatter={(v) => `Transaction ${v?.toLocaleString()}`}
                                    formatter={(val: any) => [`${val?.toFixed(2)}%`]}
                                />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                {algoIds.map((id, i) => (
                                    <Line key={id} type="monotone" dataKey={id} stroke={ALGO_COLORS[i % ALGO_COLORS.length]}
                                        strokeWidth={2} dot={false} name={id} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Current Arm States */}
                {algoIds.length > 0 && status?.current_metrics && (
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 16 }}>Current Metrics</h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Algorithm</th>
                                        <th>SR</th>
                                        <th>Successes</th>
                                        <th>Total</th>
                                        <th>Regret</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {algoIds.map((id, i) => {
                                        const m = status.current_metrics[id] as any;
                                        return (
                                            <tr key={id}>
                                                <td style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ALGO_COLORS[i % ALGO_COLORS.length] }}></span>
                                                    {id}
                                                </td>
                                                <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{((m?.sr || 0) * 100).toFixed(2)}%</td>
                                                <td>{m?.successes?.toLocaleString()}</td>
                                                <td>{m?.total?.toLocaleString()}</td>
                                                <td>{m?.regret?.toFixed(2)}</td>
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
