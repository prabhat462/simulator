import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell } from 'recharts';
import { AnalysisResults } from '../../api/impactClient';

function useResults(): AnalysisResults | null {
    const [r, setR] = useState<AnalysisResults | null>(null);
    useEffect(() => { const s = sessionStorage.getItem('impact_results'); if (s) setR(JSON.parse(s)); }, []);
    return r;
}

export default function GlobalAnalysis() {
    const data = useResults();
    if (!data?.results?.global) return <NoData />;

    const { daily_trend = [], traffic_mix = [], gmv_waterfall = [], mix_adjusted_sr, headline } = data.results.global;

    // Pivot daily trend for chart
    const dates = [...new Set(daily_trend.map(d => d.date))].sort();
    const trendData = dates.map(date => {
        const before = daily_trend.find(d => d.date === date && d.period === 'before');
        const after = daily_trend.find(d => d.date === date && d.period === 'after');
        return {
            date: date.slice(5),
            before_sr: before ? +(before.sr * 100).toFixed(2) : null,
            after_sr: after ? +(after.sr * 100).toFixed(2) : null,
        };
    });

    // Traffic mix pivot
    const modes = [...new Set(traffic_mix.map(d => d.payment_mode))];
    const mixData = modes.map(mode => {
        const before = traffic_mix.find(d => d.payment_mode === mode && d.period === 'before');
        const after = traffic_mix.find(d => d.payment_mode === mode && d.period === 'after');
        return {
            mode,
            before_share: before ? +(before.share * 100).toFixed(1) : 0,
            after_share: after ? +(after.share * 100).toFixed(1) : 0,
        };
    });

    // GMV by mode pivot
    const gmvModes = [...new Set(gmv_waterfall.map(d => d.payment_mode))];
    const gmvData = gmvModes.map(mode => {
        const before = gmv_waterfall.find(d => d.payment_mode === mode && d.period === 'before');
        const after = gmv_waterfall.find(d => d.payment_mode === mode && d.period === 'after');
        return {
            mode,
            before_gmv: before ? Math.round(before.gmv / 100000) : 0,
            after_gmv: after ? Math.round(after.gmv / 100000) : 0,
        };
    });

    return (
        <div className="page-body fade-in">
            <div className="page-header" style={{ padding: '24px 0 16px', border: 'none', background: 'transparent' }}>
                <h1 className="page-title">🌐 Global Analysis</h1>
                <p className="page-subtitle">Overall success rate trends, traffic mix, and GMV impact</p>
            </div>

            {/* Quick Stats */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
                <div className="metric-card"><span className="metric-label">Baseline SR</span><span className="metric-value">{(headline.before.sr * 100).toFixed(2)}%</span></div>
                <div className="metric-card"><span className="metric-label">Algo SR</span><span className="metric-value">{(headline.after.sr * 100).toFixed(2)}%</span></div>
                <div className="metric-card"><span className="metric-label">SR Uplift</span><span className="metric-value" style={{ color: headline.sr_uplift_pp >= 0 ? '#22c55e' : '#ef4444' }}>{headline.sr_uplift_pp >= 0 ? '+' : ''}{headline.sr_uplift_pp.toFixed(2)}pp</span></div>
                <div className="metric-card"><span className="metric-label">Mix-Adjusted SR</span><span className="metric-value">{mix_adjusted_sr ? (mix_adjusted_sr * 100).toFixed(2) + '%' : 'N/A'}</span></div>
            </div>

            {/* Daily SR Trend */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header"><span className="card-title">Daily SR Trend</span></div>
                <div style={{ height: 360 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-45} textAnchor="end" height={50} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => v + '%'} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                            <Legend />
                            <Line type="monotone" dataKey="before_sr" name="Baseline SR" stroke="#94a3b8" strokeWidth={2} dot={false} connectNulls />
                            <Line type="monotone" dataKey="after_sr" name="Algo SR" stroke="#818cf8" strokeWidth={2} dot={false} connectNulls />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid-2">
                {/* Traffic Mix */}
                <div className="card">
                    <div className="card-header"><span className="card-title">Traffic Mix Shift</span></div>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mixData} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="mode" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => v + '%'} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                <Legend />
                                <Bar dataKey="before_share" name="Before" fill="#64748b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="after_share" name="After" fill="#818cf8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* GMV Waterfall */}
                <div className="card">
                    <div className="card-header"><span className="card-title">GMV by Payment Mode (₹ Lakhs)</span></div>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={gmvData} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="mode" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                <Legend />
                                <Bar dataKey="before_gmv" name="Before" fill="#64748b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="after_gmv" name="After" fill="#818cf8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function NoData() {
    return <div className="page-body fade-in" style={{ textAlign: 'center', padding: '80px 0' }}><div style={{ fontSize: 48 }}>🌐</div><h2>No Analysis Results</h2><p style={{ color: 'var(--text-muted)' }}>Run an analysis first</p></div>;
}
