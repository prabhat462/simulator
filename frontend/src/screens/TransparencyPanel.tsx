import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getResults, getDecisions, getArmState, listExperiments, SimulationResults } from '../api/client';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#38bdf8'];

export default function TransparencyPanel() {
    const { runId: paramRunId } = useParams<{ runId: string }>();
    const navigate = useNavigate();
    const [results, setResults] = useState<SimulationResults | null>(null);
    const [experiments, setExperiments] = useState<any[]>([]);
    const [decisions, setDecisions] = useState<any[]>([]);
    const [selectedAlgo, setSelectedAlgo] = useState('');
    const [page, setPage] = useState(1);
    const [totalDecisions, setTotalDecisions] = useState(0);
    const [armState, setArmState] = useState<any>(null);
    const [scrubIdx, setScrubIdx] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => { listExperiments().then(setExperiments).catch(() => { }); }, []);

    useEffect(() => {
        if (!paramRunId) return;
        setLoading(true);
        getResults(paramRunId).then(res => {
            setResults(res);
            const first = Object.keys(res.results)[0];
            setSelectedAlgo(first);
            setScrubIdx(res.dataset_stats?.total_transactions || 0);
            setLoading(false);
        }).catch(() => setLoading(false));
        getDecisions(paramRunId, 1).then(d => {
            setDecisions(d.decisions || []);
            setTotalDecisions(d.total || 0);
        }).catch(() => { });
    }, [paramRunId]);

    useEffect(() => {
        if (paramRunId && scrubIdx > 0)
            getArmState(paramRunId, scrubIdx).then(setArmState).catch(() => { });
    }, [paramRunId, scrubIdx]);

    const loadPage = async (p: number) => {
        if (!paramRunId) return;
        const d = await getDecisions(paramRunId, p);
        setDecisions(d.decisions || []);
        setPage(p);
    };

    // ── No run selected ──
    if (!paramRunId) {
        const completed = experiments.filter(e => e.status === 'completed');
        return (
            <div className="fade-in">
                <div className="page-header">
                    <h1 className="page-title">🔍 Transparency Panel</h1>
                    <p className="page-subtitle">Inspect every routing decision and algorithm state</p>
                </div>
                <div className="page-body">
                    {completed.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                            <p>No completed simulations yet</p>
                            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/setup')}>Run Experiment →</button>
                        </div>
                    ) : (
                        <div className="grid-3">
                            {completed.map(exp => (
                                <div key={exp.run_id} className="card" style={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/transparency/${exp.run_id}`)}>
                                    <div className="card-title">{exp.run_name || exp.run_id}</div>
                                    <div className="card-subtitle">{exp.run_id}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (loading) return <div className="loader"><div className="spinner"></div></div>;
    if (!results) return null;

    const algos = Object.entries(results.results);
    const algoIds = algos.map(([id]) => id);
    const sel = results.results[selectedAlgo];

    const armChartData = armState?.arm_states?.[selectedAlgo]?.state
        ? Object.entries(armState.arm_states[selectedAlgo].state).map(([gw, s]: [string, any]) => ({
            gateway: gw,
            estimated_sr: s?.estimated_sr != null ? +(s.estimated_sr * 100).toFixed(2) : 0,
        }))
        : [];

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">🔍 Transparency Panel</h1>
                <p className="page-subtitle">Run: {paramRunId} — Every decision explained</p>
            </div>

            <div className="page-body">
                {/* Algorithm selector chips */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    {algoIds.map((id, i) => (
                        <button key={id} className={`chip ${selectedAlgo === id ? 'active' : ''}`}
                            onClick={() => setSelectedAlgo(id)}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }}></span>
                            {results.results[id]?.algorithm_name || id}
                        </button>
                    ))}
                </div>

                {/* Summary metrics */}
                {sel && (
                    <div className="card" style={{ marginBottom: 20 }}>
                        <h3 className="card-title" style={{ marginBottom: 12 }}>{sel.algorithm_name} — Summary</h3>
                        <div className="grid-4">
                            <div className="metric-card">
                                <span className="metric-label">Overall SR</span>
                                <span className="metric-value">{(sel.overall_sr * 100).toFixed(2)}%</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-label">Cumulative Regret</span>
                                <span className="metric-value" style={{ fontSize: 22 }}>{sel.cumulative_regret.toFixed(2)}</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-label">Exploration Ratio</span>
                                <span className="metric-value" style={{ fontSize: 22 }}>{(sel.exploration_ratio * 100).toFixed(1)}%</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-label">Transactions</span>
                                <span className="metric-value" style={{ fontSize: 22 }}>{sel.total_transactions.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Arm State Scrubber */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                        <h3 className="card-title">Arm State at Transaction T</h3>
                        <span className="badge badge-info">T = {scrubIdx.toLocaleString()}</span>
                    </div>
                    <input type="range" min={500} max={results.dataset_stats?.total_transactions || 10000}
                        step={500} value={scrubIdx}
                        onChange={e => setScrubIdx(Number(e.target.value))}
                        style={{ width: '100%', marginBottom: 16 }} />
                    {armChartData.length > 0 && (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={armChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="gateway" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                                <Bar dataKey="estimated_sr" radius={[4, 4, 0, 0]} name="Estimated SR (%)">
                                    {armChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Decision Log */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Decision Log ({totalDecisions} total)</h3>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => loadPage(page - 1)}>← Prev</button>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 8px' }}>Page {page}</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => loadPage(page + 1)}>Next →</button>
                        </div>
                    </div>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th><th>Algorithm</th><th>Chosen PG</th><th>Mode</th><th>Bank</th><th>Amount</th><th>Outcome</th>
                                </tr>
                            </thead>
                            <tbody>
                                {decisions.map((d, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{d.transaction_idx}</td>
                                        <td>{d.algorithm_id}</td>
                                        <td style={{ fontWeight: 600 }}>{d.chosen_gw}</td>
                                        <td><span className="badge badge-info">{d.payment_mode}</span></td>
                                        <td>{d.issuing_bank}</td>
                                        <td>₹{d.amount?.toFixed(0)}</td>
                                        <td>
                                            <span className={`badge ${d.outcome === 1 ? 'badge-success' : 'badge-danger'}`}>
                                                {d.outcome === 1 ? '✓ Success' : '✗ Failed'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
