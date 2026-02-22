import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { runImpactAnalysis, getImpactDataStatus, getImpactAnalysisHistory, DataStatus, AnalysisRun } from '../../api/impactClient';

export default function ImpactAnalysisConfig() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<DataStatus | null>(null);
    const [history, setHistory] = useState<AnalysisRun[]>([]);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState('');

    const [baselineStart, setBaselineStart] = useState('');
    const [baselineEnd, setBaselineEnd] = useState('');
    const [algoStart, setAlgoStart] = useState('');
    const [algoEnd, setAlgoEnd] = useState('');

    useEffect(() => {
        getImpactDataStatus().then(setStatus).catch(() => { });
        getImpactAnalysisHistory().then(setHistory).catch(() => { });
    }, []);

    // Auto-fill dates from data status
    useEffect(() => {
        if (status?.has_data) {
            if (status.before_start && !baselineStart) setBaselineStart(status.before_start);
            if (status.before_end && !baselineEnd) setBaselineEnd(status.before_end);
            if (status.after_start && !algoStart) setAlgoStart(status.after_start);
            if (status.after_end && !algoEnd) setAlgoEnd(status.after_end);
        }
    }, [status]);

    const handleRun = async () => {
        setError('');
        if (!baselineStart || !baselineEnd || !algoStart || !algoEnd) {
            setError('All date fields are required');
            return;
        }
        if (baselineEnd >= algoStart) {
            setError('Baseline must end before algo period starts');
            return;
        }

        setRunning(true);
        try {
            const result = await runImpactAnalysis({
                baseline_start: baselineStart,
                baseline_end: baselineEnd,
                algo_start: algoStart,
                algo_end: algoEnd,
            });
            // Store results in sessionStorage for other screens to access
            sessionStorage.setItem('impact_results', JSON.stringify(result));
            sessionStorage.setItem('impact_run_id', result.run_id);
            navigate('/impact/summary');
        } catch (e: any) {
            setError(e.message || 'Analysis failed');
        }
        setRunning(false);
    };

    const loadPreviousRun = async (run: AnalysisRun) => {
        try {
            const res = await fetch(`/api/impact/analysis/${run.run_id}`);
            const data = await res.json();
            sessionStorage.setItem('impact_results', JSON.stringify(data));
            sessionStorage.setItem('impact_run_id', run.run_id);
            navigate('/impact/summary');
        } catch { }
    };

    return (
        <div className="page-body fade-in">
            <div className="page-header" style={{ padding: '24px 0 16px', border: 'none', background: 'transparent' }}>
                <h1 className="page-title">⚙️ Analysis Configuration</h1>
                <p className="page-subtitle">Select date ranges for baseline and algo periods, then run the analysis</p>
            </div>

            {/* Date Range Config */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                    <span className="card-title">Date Range Selection</span>
                </div>
                <div className="grid-2" style={{ gap: 32 }}>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>📅 Baseline Period (Pre-Algorithm)</h3>
                        <div className="form-group">
                            <label className="form-label">From</label>
                            <input type="date" className="form-input" value={baselineStart} onChange={e => setBaselineStart(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">To</label>
                            <input type="date" className="form-input" value={baselineEnd} onChange={e => setBaselineEnd(e.target.value)} />
                        </div>
                        {status && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {status.before_count?.toLocaleString()} transactions available
                        </div>}
                    </div>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>🚀 Algo Period (Post-Algorithm)</h3>
                        <div className="form-group">
                            <label className="form-label">From</label>
                            <input type="date" className="form-input" value={algoStart} onChange={e => setAlgoStart(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">To</label>
                            <input type="date" className="form-input" value={algoEnd} onChange={e => setAlgoEnd(e.target.value)} />
                        </div>
                        {status && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {status.after_count?.toLocaleString()} transactions available
                        </div>}
                    </div>
                </div>

                {error && <div style={{ color: 'var(--accent-danger)', fontSize: 13, marginTop: 16 }}>⚠️ {error}</div>}

                <div style={{ marginTop: 24 }}>
                    <button className="btn btn-primary btn-lg" onClick={handleRun} disabled={running}>
                        {running ? '🔄 Running Analysis...' : '🚀 Run Analysis'}
                    </button>
                </div>
            </div>

            {/* Past Runs */}
            {history.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">📜 Previous Analysis Runs</span>
                    </div>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Run ID</th>
                                    <th>Date</th>
                                    <th>Baseline</th>
                                    <th>Algo Period</th>
                                    <th>SR Uplift</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(run => (
                                    <tr key={run.run_id}>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{run.run_id}</td>
                                        <td>{new Date(run.created_at).toLocaleDateString()}</td>
                                        <td>{run.baseline_start} → {run.baseline_end}</td>
                                        <td>{run.algo_start} → {run.algo_end}</td>
                                        <td>
                                            <span className={`metric-delta ${(run.sr_uplift || 0) >= 0 ? 'positive' : 'negative'}`}>
                                                {(run.sr_uplift || 0) >= 0 ? '+' : ''}{run.sr_uplift?.toFixed(2)}pp
                                            </span>
                                        </td>
                                        <td><span className={`badge badge-${run.status === 'completed' ? 'success' : 'warning'}`}>{run.status}</span></td>
                                        <td>
                                            <button className="btn btn-secondary btn-sm" onClick={() => loadPreviousRun(run)}>View</button>
                                        </td>
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
