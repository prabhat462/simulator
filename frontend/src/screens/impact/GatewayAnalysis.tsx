import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AnalysisResults } from '../../api/impactClient';

function useResults(): AnalysisResults | null {
    const [r, setR] = useState<AnalysisResults | null>(null);
    useEffect(() => { const s = sessionStorage.getItem('impact_results'); if (s) setR(JSON.parse(s)); }, []);
    return r;
}

export default function GatewayAnalysis() {
    const data = useResults();
    if (!data?.results?.gateways) return <NoData />;

    const { gateway_comparison = [] } = data.results.gateways;

    const shareData = gateway_comparison.map(g => ({
        gateway: g.gateway,
        before_share: +(g.before_share * 100).toFixed(1),
        after_share: +(g.after_share * 100).toFixed(1),
    }));

    const srData = gateway_comparison.map(g => ({
        gateway: g.gateway,
        before_sr: +(g.before_sr * 100).toFixed(2),
        after_sr: +(g.after_sr * 100).toFixed(2),
    }));

    return (
        <div className="page-body fade-in">
            <div className="page-header" style={{ padding: '24px 0 16px', border: 'none', background: 'transparent' }}>
                <h1 className="page-title">🏦 Gateway Analysis</h1>
                <p className="page-subtitle">Routing share shift and per-gateway success rate comparison</p>
            </div>

            <div className="grid-2" style={{ marginBottom: 24 }}>
                {/* Routing Share */}
                <div className="card">
                    <div className="card-header"><span className="card-title">Routing Share Shift (%)</span></div>
                    <div style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={shareData} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="gateway" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => v + '%'} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                <Legend />
                                <Bar dataKey="before_share" name="Before" fill="#64748b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="after_share" name="After" fill="#818cf8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* SR Comparison */}
                <div className="card">
                    <div className="card-header"><span className="card-title">SR by Gateway (%)</span></div>
                    <div style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={srData} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="gateway" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => v + '%'} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                <Legend />
                                <Bar dataKey="before_sr" name="Before" fill="#64748b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="after_sr" name="After" fill="#818cf8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="card">
                <div className="card-header"><span className="card-title">Gateway Detail</span></div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Gateway</th>
                                <th>Before Share</th>
                                <th>After Share</th>
                                <th>Share Δ</th>
                                <th>Before SR</th>
                                <th>After SR</th>
                                <th>SR Δ (pp)</th>
                                <th>p-value</th>
                                <th>Significant</th>
                            </tr>
                        </thead>
                        <tbody>
                            {gateway_comparison.map(g => (
                                <tr key={g.gateway}>
                                    <td style={{ fontWeight: 600 }}>{g.gateway}</td>
                                    <td>{(g.before_share * 100).toFixed(1)}%</td>
                                    <td>{(g.after_share * 100).toFixed(1)}%</td>
                                    <td className={g.share_delta > 0 ? 'positive' : g.share_delta < 0 ? 'negative' : ''}>
                                        {g.share_delta > 0 ? '+' : ''}{(g.share_delta * 100).toFixed(1)}pp
                                    </td>
                                    <td>{(g.before_sr * 100).toFixed(2)}%</td>
                                    <td>{(g.after_sr * 100).toFixed(2)}%</td>
                                    <td style={{ color: g.sr_delta_pp >= 0 ? '#22c55e' : '#ef4444' }}>
                                        {g.sr_delta_pp >= 0 ? '+' : ''}{g.sr_delta_pp.toFixed(2)}
                                    </td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{g.p_value < 0.0001 ? '<0.0001' : g.p_value.toFixed(4)}</td>
                                    <td>{g.badge.emoji} {g.badge.label}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function NoData() {
    return <div className="page-body fade-in" style={{ textAlign: 'center', padding: '80px 0' }}><div style={{ fontSize: 48 }}>🏦</div><h2>No Analysis Results</h2><p style={{ color: 'var(--text-muted)' }}>Run an analysis first</p></div>;
}
