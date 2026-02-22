import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AnalysisResults } from '../../api/impactClient';

function useResults(): AnalysisResults | null {
    const [r, setR] = useState<AnalysisResults | null>(null);
    useEffect(() => { const s = sessionStorage.getItem('impact_results'); if (s) setR(JSON.parse(s)); }, []);
    return r;
}

export default function ModeAnalysis() {
    const data = useResults();
    if (!data?.results?.modes) return <NoData />;

    const { mode_comparison = [], card_network_comparison } = data.results.modes;

    const modeData = mode_comparison.map(m => ({
        mode: m.payment_mode,
        before_sr: +(m.before_sr * 100).toFixed(2),
        after_sr: +(m.after_sr * 100).toFixed(2),
    }));

    const networkData = (card_network_comparison || []).map((n: any) => ({
        network: n.card_network,
        before_sr: +(n.before_sr * 100).toFixed(2),
        after_sr: +(n.after_sr * 100).toFixed(2),
    }));

    return (
        <div className="page-body fade-in">
            <div className="page-header" style={{ padding: '24px 0 16px', border: 'none', background: 'transparent' }}>
                <h1 className="page-title">💳 Payment Mode Analysis</h1>
                <p className="page-subtitle">SR comparison by payment mode and card network</p>
            </div>

            {/* Mode SR Chart */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header"><span className="card-title">SR by Payment Mode (%)</span></div>
                <div style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={modeData} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="mode" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => v + '%'} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                            <Legend />
                            <Bar dataKey="before_sr" name="Before" fill="#64748b" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="after_sr" name="After" fill="#818cf8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Detailed Mode Table */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header"><span className="card-title">Mode Detail</span></div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr><th>Mode</th><th>Before SR</th><th>After SR</th><th>SR Δ (pp)</th><th>Before Txns</th><th>After Txns</th><th>p-value</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {mode_comparison.map(m => (
                                <tr key={m.payment_mode}>
                                    <td style={{ fontWeight: 600 }}>{m.payment_mode}</td>
                                    <td>{(m.before_sr * 100).toFixed(2)}%</td>
                                    <td>{(m.after_sr * 100).toFixed(2)}%</td>
                                    <td style={{ color: m.sr_delta_pp >= 0 ? '#22c55e' : '#ef4444' }}>
                                        {m.sr_delta_pp >= 0 ? '+' : ''}{m.sr_delta_pp.toFixed(2)}
                                    </td>
                                    <td>{m.before_txns.toLocaleString()}</td>
                                    <td>{m.after_txns.toLocaleString()}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{m.p_value < 0.0001 ? '<0.0001' : m.p_value.toFixed(4)}</td>
                                    <td>{m.badge.emoji} {m.badge.label}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Card Network */}
            {networkData.length > 0 && (
                <div className="card">
                    <div className="card-header"><span className="card-title">Card Network SR Comparison</span></div>
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={networkData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="network" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => v + '%'} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                <Legend />
                                <Bar dataKey="before_sr" name="Before" fill="#64748b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="after_sr" name="After" fill="#f472b6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}

function NoData() {
    return <div className="page-body fade-in" style={{ textAlign: 'center', padding: '80px 0' }}><div style={{ fontSize: 48 }}>💳</div><h2>No Analysis Results</h2><p style={{ color: 'var(--text-muted)' }}>Run an analysis first</p></div>;
}
