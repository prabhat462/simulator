import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { AnalysisResults } from '../../api/impactClient';

function useResults(): AnalysisResults | null {
    const [r, setR] = useState<AnalysisResults | null>(null);
    useEffect(() => { const s = sessionStorage.getItem('impact_results'); if (s) setR(JSON.parse(s)); }, []);
    return r;
}

export default function FailureAnalysis() {
    const data = useResults();
    if (!data?.results?.failures) return <NoData />;

    const { failure_comparison = [], waterfall, failure_by_mode } = data.results.failures;

    // Chart data
    const failureChartData = failure_comparison.slice(0, 10).map((f: any) => ({
        category: f.failure_category.length > 20 ? f.failure_category.slice(0, 20) + '…' : f.failure_category,
        before: f.before_count,
        after: f.after_count,
    }));

    const modeFailureData = (failure_by_mode || []).filter((f: any) => f.period === 'after').map((f: any) => ({
        mode: f.payment_mode,
        failure_rate: +(f.failure_rate * 100).toFixed(2),
    }));

    return (
        <div className="page-body fade-in">
            <div className="page-header" style={{ padding: '24px 0 16px', border: 'none', background: 'transparent' }}>
                <h1 className="page-title">❌ Failure Analysis</h1>
                <p className="page-subtitle">Failure pattern comparison and attribution</p>
            </div>

            {/* Waterfall Summary */}
            <div className="grid-3" style={{ marginBottom: 24 }}>
                <div className="metric-card">
                    <span className="metric-label">Baseline Failures</span>
                    <span className="metric-value">{waterfall?.total_before_failures?.toLocaleString() || 0}</span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">Algo Failures</span>
                    <span className="metric-value">{waterfall?.total_after_failures?.toLocaleString() || 0}</span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">Net Change</span>
                    <span className="metric-value" style={{ color: (waterfall?.net_change || 0) <= 0 ? '#22c55e' : '#ef4444' }}>
                        {(waterfall?.net_change || 0) <= 0 ? '' : '+'}{waterfall?.net_change?.toLocaleString() || 0}
                        <span style={{ fontSize: 14, marginLeft: 4 }}>({waterfall?.net_pct_change || 0}%)</span>
                    </span>
                </div>
            </div>

            {/* Failure Category Chart */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header"><span className="card-title">Top Failure Categories</span></div>
                <div style={{ height: 360 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={failureChartData} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 120 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis type="category" dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={120} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                            <Legend />
                            <Bar dataKey="before" name="Before" fill="#64748b" radius={[0, 4, 4, 0]} barSize={10} />
                            <Bar dataKey="after" name="After" fill="#f87171" radius={[0, 4, 4, 0]} barSize={10} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid-2">
                {/* Failure Detail Table */}
                <div className="card">
                    <div className="card-header"><span className="card-title">Failure Category Detail</span></div>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr><th>Category</th><th>Before</th><th>After</th><th>Change</th><th>% Change</th></tr>
                            </thead>
                            <tbody>
                                {failure_comparison.map((f: any) => (
                                    <tr key={f.failure_category}>
                                        <td style={{ fontWeight: 600, fontSize: 12 }}>{f.failure_category}</td>
                                        <td>{f.before_count.toLocaleString()}</td>
                                        <td>{f.after_count.toLocaleString()}</td>
                                        <td style={{ color: f.change <= 0 ? '#22c55e' : '#ef4444' }}>
                                            {f.change <= 0 ? '' : '+'}{f.change.toLocaleString()}
                                        </td>
                                        <td style={{ color: f.pct_change <= 0 ? '#22c55e' : '#ef4444' }}>
                                            {f.pct_change <= 0 ? '' : '+'}{f.pct_change}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Failure Rate by Mode */}
                <div className="card">
                    <div className="card-header"><span className="card-title">Failure Rate by Mode (After Period)</span></div>
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={modeFailureData} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="mode" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => v + '%'} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                <Bar dataKey="failure_rate" name="Failure Rate" fill="#f87171" radius={[4, 4, 0, 0]}>
                                    {modeFailureData.map((_: any, i: number) => (
                                        <Cell key={i} fill={`hsl(${10 + i * 15}, 70%, 55%)`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function NoData() {
    return <div className="page-body fade-in" style={{ textAlign: 'center', padding: '80px 0' }}><div style={{ fontSize: 48 }}>❌</div><h2>No Analysis Results</h2><p style={{ color: 'var(--text-muted)' }}>Run an analysis first</p></div>;
}
