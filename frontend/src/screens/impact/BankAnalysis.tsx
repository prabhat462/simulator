import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AnalysisResults } from '../../api/impactClient';

function useResults(): AnalysisResults | null {
    const [r, setR] = useState<AnalysisResults | null>(null);
    useEffect(() => { const s = sessionStorage.getItem('impact_results'); if (s) setR(JSON.parse(s)); }, []);
    return r;
}

export default function BankAnalysis() {
    const data = useResults();
    if (!data?.results?.banks) return <NoData />;

    const { bank_comparison = [], bank_mode_heatmap } = data.results.banks;
    const topBanks = (bank_comparison || []).slice(0, 15);

    const chartData = topBanks.map(b => ({
        bank: b.bank.length > 15 ? b.bank.slice(0, 15) + '…' : b.bank,
        before_sr: +(b.before_sr * 100).toFixed(2),
        after_sr: +(b.after_sr * 100).toFixed(2),
    }));

    // Build heatmap data
    const heatmapBanks = [...new Set((bank_mode_heatmap || []).filter((h: any) => h.period === 'after').map((h: any) => h.bank))].slice(0, 15);
    const heatmapModes = [...new Set((bank_mode_heatmap || []).filter((h: any) => h.period === 'after').map((h: any) => h.mode))];

    const getHeatmapSR = (bank: string, mode: string, period: string) => {
        const entry = (bank_mode_heatmap || []).find((h: any) => h.bank === bank && h.mode === mode && h.period === period);
        return entry ? entry.sr : null;
    };

    const srColor = (sr: number | null) => {
        if (sr === null) return 'transparent';
        if (sr >= 0.9) return 'rgba(34,197,94,0.5)';
        if (sr >= 0.8) return 'rgba(34,197,94,0.3)';
        if (sr >= 0.7) return 'rgba(234,179,8,0.3)';
        if (sr >= 0.6) return 'rgba(234,179,8,0.5)';
        return 'rgba(239,68,68,0.4)';
    };

    return (
        <div className="page-body fade-in">
            <div className="page-header" style={{ padding: '24px 0 16px', border: 'none', background: 'transparent' }}>
                <h1 className="page-title">🏛️ Bank & Issuer Analysis</h1>
                <p className="page-subtitle">SR comparison by issuing bank and bank×mode cohort heatmap</p>
            </div>

            {/* Bank SR Chart */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header"><span className="card-title">Top 15 Banks by SR (Before vs After)</span></div>
                <div style={{ height: 380 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => v + '%'} />
                            <YAxis type="category" dataKey="bank" tick={{ fill: '#94a3b8', fontSize: 10 }} width={100} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                            <Legend />
                            <Bar dataKey="before_sr" name="Before SR" fill="#64748b" radius={[0, 4, 4, 0]} barSize={8} />
                            <Bar dataKey="after_sr" name="After SR" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Bank Detail Table */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header"><span className="card-title">Bank Detail</span></div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr><th>Bank</th><th>Before SR</th><th>After SR</th><th>SR Δ (pp)</th><th>GMV Impact</th><th>p-value</th><th>Significant</th></tr>
                        </thead>
                        <tbody>
                            {bank_comparison.slice(0, 30).map(b => (
                                <tr key={b.bank}>
                                    <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.bank}</td>
                                    <td>{(b.before_sr * 100).toFixed(2)}%</td>
                                    <td>{(b.after_sr * 100).toFixed(2)}%</td>
                                    <td style={{ color: b.sr_delta_pp >= 0 ? '#22c55e' : '#ef4444' }}>
                                        {b.sr_delta_pp >= 0 ? '+' : ''}{b.sr_delta_pp.toFixed(2)}
                                    </td>
                                    <td>₹{Math.abs(b.gmv_impact).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{b.p_value < 0.0001 ? '<0.0001' : b.p_value.toFixed(4)}</td>
                                    <td>{b.badge.emoji} {b.badge.label}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bank × Mode Heatmap */}
            {heatmapBanks.length > 0 && heatmapModes.length > 0 && (
                <div className="card">
                    <div className="card-header"><span className="card-title">Bank × Mode SR Heatmap (After Period)</span></div>
                    <div className="table-container">
                        <table className="heatmap-table">
                            <thead>
                                <tr>
                                    <th>Bank</th>
                                    {(heatmapModes as string[]).map(m => <th key={m} style={{ fontSize: 10 }}>{m}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {(heatmapBanks as string[]).map(bank => (
                                    <tr key={bank}>
                                        <td style={{ fontWeight: 600, fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bank}</td>
                                        {(heatmapModes as string[]).map(mode => {
                                            const sr = getHeatmapSR(bank, mode, 'after');
                                            return (
                                                <td key={mode} style={{ background: srColor(sr), textAlign: 'center', fontSize: 11 }}>
                                                    {sr !== null ? (sr * 100).toFixed(1) + '%' : '–'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function NoData() {
    return <div className="page-body fade-in" style={{ textAlign: 'center', padding: '80px 0' }}><div style={{ fontSize: 48 }}>🏛️</div><h2>No Analysis Results</h2><p style={{ color: 'var(--text-muted)' }}>Run an analysis first</p></div>;
}
