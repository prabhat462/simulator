import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { AnalysisResults } from '../../api/impactClient';

function useResults(): AnalysisResults | null {
    const [r, setR] = useState<AnalysisResults | null>(null);
    useEffect(() => { const s = sessionStorage.getItem('impact_results'); if (s) setR(JSON.parse(s)); }, []);
    return r;
}

export default function TemporalAnalysis() {
    const data = useResults();
    if (!data?.results?.temporal) return <NoData />;

    const { heatmap = [], intraday = [], day_of_week = [], volatility } = data.results.temporal;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Intraday chart
    const intradayData = hours.map(h => {
        const before = intraday.find((d: any) => d.hour === h && d.period === 'before');
        const after = intraday.find((d: any) => d.hour === h && d.period === 'after');
        return {
            hour: `${h}:00`,
            before_sr: before ? +(before.sr * 100).toFixed(2) : null,
            after_sr: after ? +(after.sr * 100).toFixed(2) : null,
        };
    });

    // Day of week chart
    const dowData = dayNames.map((name, i) => {
        const before = day_of_week.find((d: any) => d.day_of_week === i && d.period === 'before');
        const after = day_of_week.find((d: any) => d.day_of_week === i && d.period === 'after');
        return {
            day: name,
            before_sr: before ? +(before.sr * 100).toFixed(2) : 0,
            after_sr: after ? +(after.sr * 100).toFixed(2) : 0,
        };
    });

    // Heatmap (after period only)
    const getHeatmapSR = (dow: number, hour: number) => {
        const entry = heatmap.find((h: any) => h.day_of_week === dow && h.hour === hour && h.period === 'after');
        return entry ? entry.sr : null;
    };

    const srColor = (sr: number | null) => {
        if (sr === null) return 'transparent';
        if (sr >= 0.95) return 'rgba(34,197,94,0.6)';
        if (sr >= 0.9) return 'rgba(34,197,94,0.4)';
        if (sr >= 0.85) return 'rgba(34,197,94,0.2)';
        if (sr >= 0.8) return 'rgba(234,179,8,0.3)';
        if (sr >= 0.7) return 'rgba(234,179,8,0.5)';
        return 'rgba(239,68,68,0.4)';
    };

    return (
        <div className="page-body fade-in">
            <div className="page-header" style={{ padding: '24px 0 16px', border: 'none', background: 'transparent' }}>
                <h1 className="page-title">⏰ Temporal Analysis</h1>
                <p className="page-subtitle">Hour-of-day and day-of-week patterns in success rate</p>
            </div>

            {/* Volatility Stats */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
                <div className="metric-card">
                    <span className="metric-label">Baseline Mean SR</span>
                    <span className="metric-value">{volatility?.before ? (volatility.before.mean_sr * 100).toFixed(2) + '%' : 'N/A'}</span>
                    <span className="metric-delta">{volatility?.before?.days || 0} days</span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">Baseline SR Std Dev</span>
                    <span className="metric-value">{volatility?.before ? (volatility.before.std_sr * 100).toFixed(3) + 'pp' : 'N/A'}</span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">Algo Mean SR</span>
                    <span className="metric-value">{volatility?.after ? (volatility.after.mean_sr * 100).toFixed(2) + '%' : 'N/A'}</span>
                    <span className="metric-delta">{volatility?.after?.days || 0} days</span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">Algo SR Std Dev</span>
                    <span className="metric-value">{volatility?.after ? (volatility.after.std_sr * 100).toFixed(3) + 'pp' : 'N/A'}</span>
                </div>
            </div>

            {/* Intraday Trend */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header"><span className="card-title">Intraday SR Pattern</span></div>
                <div style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={intradayData} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => v + '%'} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                            <Legend />
                            <Line type="monotone" dataKey="before_sr" name="Baseline" stroke="#94a3b8" strokeWidth={2} dot={false} connectNulls />
                            <Line type="monotone" dataKey="after_sr" name="Algo" stroke="#818cf8" strokeWidth={2} dot={false} connectNulls />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid-2" style={{ marginBottom: 24 }}>
                {/* Day of Week */}
                <div className="card">
                    <div className="card-header"><span className="card-title">Day-of-Week SR</span></div>
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dowData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => v + '%'} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                <Legend />
                                <Bar dataKey="before_sr" name="Before" fill="#64748b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="after_sr" name="After" fill="#818cf8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Hour × Day Heatmap */}
                <div className="card">
                    <div className="card-header"><span className="card-title">Hour × Day Heatmap (After)</span></div>
                    <div className="table-container" style={{ maxHeight: 280, overflow: 'auto' }}>
                        <table className="heatmap-table" style={{ fontSize: 10 }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}></th>
                                    {hours.filter(h => h % 2 === 0).map(h => <th key={h} style={{ padding: '2px 4px' }}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {dayNames.map((day, di) => (
                                    <tr key={day}>
                                        <td style={{ fontWeight: 600, fontSize: 10 }}>{day}</td>
                                        {hours.filter(h => h % 2 === 0).map(h => {
                                            const sr = getHeatmapSR(di, h);
                                            return (
                                                <td key={h} style={{ background: srColor(sr), textAlign: 'center', padding: '4px 2px', minWidth: 30 }}>
                                                    {sr !== null ? (sr * 100).toFixed(0) : '–'}
                                                </td>
                                            );
                                        })}
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

function NoData() {
    return <div className="page-body fade-in" style={{ textAlign: 'center', padding: '80px 0' }}><div style={{ fontSize: 48 }}>⏰</div><h2>No Analysis Results</h2><p style={{ color: 'var(--text-muted)' }}>Run an analysis first</p></div>;
}
