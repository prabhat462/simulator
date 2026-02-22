import { useState, useEffect } from 'react';
import { AnalysisResults } from '../../api/impactClient';

function useResults(): AnalysisResults | null {
    const [results, setResults] = useState<AnalysisResults | null>(null);
    useEffect(() => {
        const stored = sessionStorage.getItem('impact_results');
        if (stored) setResults(JSON.parse(stored));
    }, []);
    return results;
}

export default function ExecutiveSummary() {
    const data = useResults();
    if (!data?.results?.global) return <NoData />;

    const { headline } = data.results.global;
    const before = headline.before;
    const after = headline.after;

    const verdictConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
        working: { label: 'Algorithm is Working', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '✅' },
        not_working: { label: 'Algorithm Not Working', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '❌' },
        not_significant: { label: 'No Significant Change', color: '#eab308', bg: 'rgba(234,179,8,0.1)', icon: '⚠️' },
        insufficient_data: { label: 'Insufficient Data', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: '📊' },
    };
    const v = verdictConfig[headline.verdict] || verdictConfig.not_significant;

    const merchants = data.results.merchants;
    const topGateways = data.results.gateways?.gateway_comparison?.slice(0, 3) || [];

    return (
        <div className="page-body fade-in">
            <div className="page-header" style={{ padding: '24px 0 16px', border: 'none', background: 'transparent' }}>
                <h1 className="page-title">📊 Executive Summary</h1>
                <p className="page-subtitle">
                    {data.config?.baseline_start} → {data.config?.baseline_end} vs {data.config?.algo_start} → {data.config?.algo_end}
                </p>
            </div>

            {/* Verdict Card */}
            <div className="impact-verdict-card" style={{ background: v.bg, borderLeft: `4px solid ${v.color}` }}>
                <div className="verdict-icon">{v.icon}</div>
                <div className="verdict-content">
                    <div className="verdict-label" style={{ color: v.color }}>{v.label}</div>
                    <div className="verdict-detail">
                        SR uplift of <strong>{headline.sr_uplift_pp >= 0 ? '+' : ''}{headline.sr_uplift_pp.toFixed(2)}pp</strong>
                        {' '}({headline.badge.label}, p={headline.test.p_value.toFixed(4)})
                        {' · '}Effect size: {headline.effect_size} (h={headline.cohens_h})
                    </div>
                </div>
            </div>

            {/* Headline Metrics */}
            <div className="grid-3" style={{ marginBottom: 24 }}>
                <div className="metric-card">
                    <span className="metric-label">Overall SR Uplift</span>
                    <span className="metric-value" style={{ color: headline.sr_uplift_pp >= 0 ? '#22c55e' : '#ef4444' }}>
                        {headline.sr_uplift_pp >= 0 ? '+' : ''}{headline.sr_uplift_pp.toFixed(2)}pp
                    </span>
                    <span className="metric-delta">
                        {(before.sr * 100).toFixed(2)}% → {(after.sr * 100).toFixed(2)}%
                    </span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">GMV Impact</span>
                    <span className="metric-value" style={{ color: headline.gmv_saved >= 0 ? '#22c55e' : '#ef4444' }}>
                        ₹{Math.abs(headline.gmv_saved).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="metric-delta">{headline.gmv_saved >= 0 ? 'Additional' : 'Lost'} GMV from SR change</span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">Transaction Volume</span>
                    <span className="metric-value">{((before.total_txns + after.total_txns) / 1000000).toFixed(1)}M</span>
                    <span className="metric-delta">
                        {before.total_txns.toLocaleString()} baseline + {after.total_txns.toLocaleString()} algo
                    </span>
                </div>
            </div>

            {/* Confidence Intervals */}
            <div className="grid-2" style={{ marginBottom: 24 }}>
                <div className="card">
                    <div className="card-header"><span className="card-title">Statistical Confidence</span></div>
                    <div style={{ fontSize: 13 }}>
                        <div style={{ marginBottom: 8 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Baseline SR: </span>
                            {(before.sr * 100).toFixed(3)}% (95% CI: {(headline.before_ci[0] * 100).toFixed(3)}% – {(headline.before_ci[1] * 100).toFixed(3)}%)
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Algo SR: </span>
                            {(after.sr * 100).toFixed(3)}% (95% CI: {(headline.after_ci[0] * 100).toFixed(3)}% – {(headline.after_ci[1] * 100).toFixed(3)}%)
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Z-statistic: </span> {headline.test.z_stat}
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>P-value: </span>
                            <strong style={{ color: headline.test.significant ? '#22c55e' : '#eab308' }}>
                                {headline.test.p_value < 0.0001 ? '< 0.0001' : headline.test.p_value.toFixed(4)}
                            </strong>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header"><span className="card-title">Key Insights</span></div>
                    <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                        {topGateways.length > 0 && (
                            <div>🏦 Top gateway: <strong>{topGateways[0].gateway}</strong> ({(topGateways[0].after_share * 100).toFixed(1)}% share, SR {topGateways[0].sr_delta_pp >= 0 ? '+' : ''}{topGateways[0].sr_delta_pp.toFixed(2)}pp)</div>
                        )}
                        {merchants && (
                            <>
                                <div>🏪 {merchants.total_merchants} merchants analyzed, {merchants.regression_count} regressions</div>
                            </>
                        )}
                        {data.results.global.mix_adjusted_sr && (
                            <div>📊 Mix-adjusted SR: {(data.results.global.mix_adjusted_sr * 100).toFixed(3)}%</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function NoData() {
    return (
        <div className="page-body fade-in" style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <h2>No Analysis Results</h2>
            <p style={{ color: 'var(--text-muted)' }}>Run an analysis from the Config screen first</p>
        </div>
    );
}
