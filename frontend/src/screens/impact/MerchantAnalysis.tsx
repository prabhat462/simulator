import { useState, useEffect } from 'react';
import { AnalysisResults } from '../../api/impactClient';

function useResults(): AnalysisResults | null {
    const [r, setR] = useState<AnalysisResults | null>(null);
    useEffect(() => { const s = sessionStorage.getItem('impact_results'); if (s) setR(JSON.parse(s)); }, []);
    return r;
}

export default function MerchantAnalysis() {
    const data = useResults();
    const [sortField, setSortField] = useState<'sr_delta_pp' | 'after_txns' | 'gmv_impact'>('sr_delta_pp');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [filter, setFilter] = useState<'all' | 'improved' | 'regression' | 'no_change'>('all');

    if (!data?.results?.merchants) return <NoData />;

    const { leaderboard, regressions, categories, total_merchants, regression_count } = data.results.merchants;

    let filtered = [...leaderboard];
    if (filter !== 'all') filtered = filtered.filter(m => m.status === filter);
    filtered.sort((a, b) => {
        const va = (a as any)[sortField] || 0;
        const vb = (b as any)[sortField] || 0;
        return sortDir === 'desc' ? vb - va : va - vb;
    });

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'improved': return <span style={{ color: '#22c55e', fontWeight: 600 }}>✅ Improved</span>;
            case 'regression': return <span style={{ color: '#ef4444', fontWeight: 600 }}>❌ Regression</span>;
            case 'no_change': return <span style={{ color: '#eab308' }}>➖ No Change</span>;
            default: return <span style={{ color: '#94a3b8' }}>⚠️ Insufficient</span>;
        }
    };

    return (
        <div className="page-body fade-in">
            <div className="page-header" style={{ padding: '24px 0 16px', border: 'none', background: 'transparent' }}>
                <h1 className="page-title">🏪 Merchant Analysis</h1>
                <p className="page-subtitle">{total_merchants} merchants analyzed · {regression_count} regressions flagged</p>
            </div>

            {/* Summary Stats */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
                <div className="metric-card" onClick={() => setFilter('all')} style={{ cursor: 'pointer', outline: filter === 'all' ? '2px solid var(--accent-primary)' : 'none' }}>
                    <span className="metric-label">Total Merchants</span>
                    <span className="metric-value">{total_merchants}</span>
                </div>
                <div className="metric-card" onClick={() => setFilter('improved')} style={{ cursor: 'pointer', outline: filter === 'improved' ? '2px solid #22c55e' : 'none' }}>
                    <span className="metric-label">Improved</span>
                    <span className="metric-value" style={{ color: '#22c55e' }}>{leaderboard.filter(m => m.status === 'improved').length}</span>
                </div>
                <div className="metric-card" onClick={() => setFilter('regression')} style={{ cursor: 'pointer', outline: filter === 'regression' ? '2px solid #ef4444' : 'none' }}>
                    <span className="metric-label">Regressions</span>
                    <span className="metric-value" style={{ color: '#ef4444' }}>{regression_count}</span>
                </div>
                <div className="metric-card" onClick={() => setFilter('no_change')} style={{ cursor: 'pointer', outline: filter === 'no_change' ? '2px solid #eab308' : 'none' }}>
                    <span className="metric-label">No Change</span>
                    <span className="metric-value" style={{ color: '#eab308' }}>{leaderboard.filter(m => m.status === 'no_change').length}</span>
                </div>
            </div>

            {/* Merchant Leaderboard */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                    <span className="card-title">Merchant Leaderboard</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Showing {filtered.length} merchants</span>
                </div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Merchant</th>
                                <th>Category</th>
                                <th>Before SR</th>
                                <th>After SR</th>
                                <th onClick={() => toggleSort('sr_delta_pp')} style={{ cursor: 'pointer' }}>SR Δ (pp) {sortField === 'sr_delta_pp' ? (sortDir === 'desc' ? '↓' : '↑') : ''}</th>
                                <th onClick={() => toggleSort('after_txns')} style={{ cursor: 'pointer' }}>Volume {sortField === 'after_txns' ? (sortDir === 'desc' ? '↓' : '↑') : ''}</th>
                                <th onClick={() => toggleSort('gmv_impact')} style={{ cursor: 'pointer' }}>GMV Impact {sortField === 'gmv_impact' ? (sortDir === 'desc' ? '↓' : '↑') : ''}</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 50).map(m => (
                                <tr key={m.merchant_id}>
                                    <td style={{ fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {m.merchant_name}
                                    </td>
                                    <td style={{ fontSize: 12 }}>{m.merchant_category}</td>
                                    <td>{(m.before_sr * 100).toFixed(2)}%</td>
                                    <td>{(m.after_sr * 100).toFixed(2)}%</td>
                                    <td style={{ color: m.sr_delta_pp >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                                        {m.sr_delta_pp >= 0 ? '+' : ''}{m.sr_delta_pp.toFixed(2)}
                                    </td>
                                    <td>{m.after_txns.toLocaleString()}</td>
                                    <td>₹{Math.abs(m.gmv_impact).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    <td>{statusBadge(m.status)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Category Summary */}
            {categories && categories.length > 0 && (
                <div className="card">
                    <div className="card-header"><span className="card-title">Category Summary</span></div>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr><th>Category</th><th>Merchants</th><th>Before SR</th><th>After SR</th><th>SR Δ (pp)</th><th>GMV Impact</th></tr>
                            </thead>
                            <tbody>
                                {categories.map((c: any) => (
                                    <tr key={c.category}>
                                        <td style={{ fontWeight: 600 }}>{c.category}</td>
                                        <td>{c.merchant_count}</td>
                                        <td>{(c.before_sr * 100).toFixed(2)}%</td>
                                        <td>{(c.after_sr * 100).toFixed(2)}%</td>
                                        <td style={{ color: c.sr_delta_pp >= 0 ? '#22c55e' : '#ef4444' }}>
                                            {c.sr_delta_pp >= 0 ? '+' : ''}{c.sr_delta_pp.toFixed(2)}
                                        </td>
                                        <td>₹{Math.abs(c.gmv_impact).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
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
    return <div className="page-body fade-in" style={{ textAlign: 'center', padding: '80px 0' }}><div style={{ fontSize: 48 }}>🏪</div><h2>No Analysis Results</h2><p style={{ color: 'var(--text-muted)' }}>Run an analysis first</p></div>;
}
