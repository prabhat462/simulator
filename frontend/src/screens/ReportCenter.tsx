import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJsonReport, listExperiments, getReportSummary } from '../api/client';

export default function ReportCenter() {
    const { runId: paramRunId } = useParams<{ runId: string }>();
    const navigate = useNavigate();
    const [experiments, setExperiments] = useState<any[]>([]);
    const [report, setReport] = useState<any>(null);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        listExperiments().then(setExperiments).catch(() => { });
    }, []);

    useEffect(() => {
        if (paramRunId) {
            setLoading(true);
            Promise.all([
                getJsonReport(paramRunId).then(setReport),
                getReportSummary(paramRunId).then(setSummary),
            ]).finally(() => setLoading(false));
        }
    }, [paramRunId]);

    const downloadJson = () => {
        if (!report) return;
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simulation_report_${paramRunId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!paramRunId) {
        return (
            <div className="fade-in">
                <div className="page-header">
                    <h1 className="page-title">📄 Report Center</h1>
                    <p className="page-subtitle">Generate and export simulation reports</p>
                </div>
                <div className="page-body">
                    {experiments.filter(e => e.status === 'completed').length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                            <p>No completed simulations yet</p>
                            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/setup')}>Run Experiment →</button>
                        </div>
                    ) : (
                        <div>
                            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Run History</h3>
                            <div className="grid-3">
                                {experiments.filter(e => e.status === 'completed').map(exp => (
                                    <div key={exp.run_id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/report/${exp.run_id}`)}>
                                        <div className="card-title">{exp.run_name || exp.run_id}</div>
                                        <div className="card-subtitle">{exp.run_id}</div>
                                        <span className="badge badge-success" style={{ marginTop: 8 }}>COMPLETED</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (loading) return <div className="loader"><div className="spinner"></div></div>;

    const sections = report?.sections || {};
    const execSummary = sections['1_executive_summary'] || summary || {};
    const config = sections['2_configuration'] || {};
    const resultsSummary = sections['4_results_summary'] || [];
    const sigTests = sections['10_statistical_significance'] || [];
    const gmv = sections['11_gmv_impact'] || {};

    return (
        <div className="fade-in">
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="page-title">📄 Report Center</h1>
                        <p className="page-subtitle">Run: {paramRunId}</p>
                    </div>
                    <button className="btn btn-primary" onClick={downloadJson}>⬇ Download JSON</button>
                </div>
            </div>

            <div className="page-body">
                {/* Executive Summary */}
                <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
                    <h3 className="card-title" style={{ marginBottom: 12 }}>📋 Executive Summary</h3>
                    <div className="grid-3" style={{ marginBottom: 16 }}>
                        <div className="metric-card">
                            <span className="metric-label">Recommended</span>
                            <span className="metric-value" style={{ fontSize: 18 }}>{execSummary.recommended_algorithm}</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Overall SR</span>
                            <span className="metric-value">{((execSummary.overall_sr || 0) * 100).toFixed(2)}%</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">SR Uplift</span>
                            <span className="metric-value" style={{ color: 'var(--accent-success)' }}>
                                {((execSummary.sr_uplift_vs_baseline || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{execSummary.rationale}</p>
                </div>

                {/* Results Table */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <h3 className="card-title" style={{ marginBottom: 12 }}>📊 Algorithm Results</h3>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Algorithm</th><th>SR</th><th>95% CI</th><th>Regret</th><th>Exploration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultsSummary.map((r: any) => (
                                    <tr key={r.algorithm_id}>
                                        <td style={{ fontWeight: 600 }}>{r.algorithm_name}</td>
                                        <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{(r.overall_sr * 100).toFixed(2)}%</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            [{(r.sr_confidence_interval?.[0] * 100)?.toFixed(2)}%, {(r.sr_confidence_interval?.[1] * 100)?.toFixed(2)}%]
                                        </td>
                                        <td>{r.cumulative_regret?.toFixed(2)}</td>
                                        <td>{(r.exploration_ratio * 100).toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Stat Significance */}
                {sigTests.length > 0 && (
                    <div className="card" style={{ marginBottom: 20 }}>
                        <h3 className="card-title" style={{ marginBottom: 12 }}>📐 Statistical Significance</h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Comparison</th><th>Δ SR</th><th>p-value</th><th>95% CI</th><th>Significant?</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sigTests.map((t: any, i: number) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 500 }}>{t.algorithm_a} vs {t.algorithm_b}</td>
                                            <td style={{ fontWeight: 600 }}>{(t.difference * 100).toFixed(2)}%</td>
                                            <td>{t.p_value?.toFixed(4)}</td>
                                            <td style={{ fontSize: 12 }}>
                                                [{(t.confidence_interval?.[0] * 100)?.toFixed(2)}%, {(t.confidence_interval?.[1] * 100)?.toFixed(2)}%]
                                            </td>
                                            <td>
                                                <span className={`badge ${t.is_significant ? 'badge-success' : 'badge-warning'}`}>
                                                    {t.is_significant ? '✓ Significant' : '⚠ Not Significant'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* GMV Impact */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <h3 className="card-title" style={{ marginBottom: 12 }}>💰 GMV Impact Projection</h3>
                    <div className="grid-4">
                        <div className="metric-card">
                            <span className="metric-label">SR Uplift</span>
                            <span className="metric-value" style={{ fontSize: 20 }}>{gmv.sr_uplift_pct?.toFixed(2)}%</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Monthly Saved Txns</span>
                            <span className="metric-value" style={{ fontSize: 20 }}>{gmv.monthly_saved_transactions?.toLocaleString()}</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Monthly GMV</span>
                            <span className="metric-value" style={{ fontSize: 18 }}>₹{gmv.monthly_gmv_saved_crore} Cr</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Annual GMV</span>
                            <span className="metric-value" style={{ fontSize: 18 }}>₹{gmv.annual_gmv_saved_crore} Cr</span>
                        </div>
                    </div>
                </div>

                {/* Config / Reproducibility */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 12 }}>🔧 Simulation Configuration</h3>
                    <pre style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-secondary)', overflow: 'auto', maxHeight: 300 }}>
                        {JSON.stringify(config, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}
