import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getAlgorithms, getTemplates, generateSynthetic, uploadDataset, createExperiment,
    AlgorithmInfo, ScenarioTemplate
} from '../api/client';

type DataSource = 'upload' | 'synthetic';

export default function ExperimentSetup() {
    const navigate = useNavigate();
    const [dataSource, setDataSource] = useState<DataSource>('synthetic');
    const [algorithms, setAlgorithms] = useState<AlgorithmInfo[]>([]);
    const [templates, setTemplates] = useState<Record<string, ScenarioTemplate>>({});
    const [selectedTemplate, setSelectedTemplate] = useState('gateway_outage');
    const [selectedAlgos, setSelectedAlgos] = useState<Set<string>>(new Set(['sw_ucb', 'epsilon_greedy', 'round_robin']));
    const [hyperparams, setHyperparams] = useState<Record<string, Record<string, any>>>({});
    const [datasetId, setDatasetId] = useState('');
    const [datasetStats, setDatasetStats] = useState<any>(null);
    const [runName, setRunName] = useState('My Experiment');
    const [cfMode, setCfMode] = useState('sr_interpolation');
    const [warmUp, setWarmUp] = useState(0);
    const [seed, setSeed] = useState(42);
    const [nTxns, setNTxns] = useState(20000);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);

    useEffect(() => {
        getAlgorithms().then(setAlgorithms).catch(() => { });
        getTemplates().then(setTemplates).catch(() => { });
    }, []);

    const toggleAlgo = (id: string) => {
        const next = new Set(selectedAlgos);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedAlgos(next);
    };

    const updateHyperparam = (algoId: string, key: string, val: any) => {
        setHyperparams(prev => ({
            ...prev,
            [algoId]: { ...(prev[algoId] || {}), [key]: val }
        }));
    };

    const handleUpload = async (file: File) => {
        setUploadFile(file);
        setLoading(true);
        setError('');
        try {
            const res = await uploadDataset(file);
            setDatasetId(res.dataset_id);
            setDatasetStats(res.stats);
        } catch (e: any) {
            setError(e.message || 'Upload failed');
        }
        setLoading(false);
    };

    const handleGenerateSynthetic = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await generateSynthetic(selectedTemplate, nTxns, seed);
            setDatasetId(res.dataset_id);
            setDatasetStats(res.stats);
        } catch (e: any) {
            setError(e.message || 'Generation failed');
        }
        setLoading(false);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    }, []);

    const handleLaunch = async () => {
        if (!datasetId) { setError('Please generate or upload a dataset first'); return; }
        if (selectedAlgos.size === 0) { setError('Select at least one algorithm'); return; }

        setLoading(true);
        setError('');
        try {
            const algos = Array.from(selectedAlgos).map(id => ({
                id,
                hyperparameters: hyperparams[id] || {},
            }));

            const res = await createExperiment({
                run_name: runName,
                dataset_id: datasetId,
                algorithms: algos,
                counterfactual_mode: cfMode,
                warm_up_transactions: warmUp,
                random_seed: seed,
            });

            navigate(`/live/${res.run_id}`);
        } catch (e: any) {
            setError(e.message || 'Failed to launch experiment');
        }
        setLoading(false);
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">⚡ Experiment Setup</h1>
                <p className="page-subtitle">Configure dataset, algorithms, and launch simulation</p>
            </div>

            <div className="page-body">
                {error && (
                    <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '13px', marginBottom: 16 }}>
                        {error}
                    </div>
                )}

                {/* ── Dataset Section ── */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                        <h3 className="card-title">📁 Dataset</h3>
                        <div className="tabs">
                            <button className={`tab ${dataSource === 'synthetic' ? 'active' : ''}`} onClick={() => setDataSource('synthetic')}>Synthetic</button>
                            <button className={`tab ${dataSource === 'upload' ? 'active' : ''}`} onClick={() => setDataSource('upload')}>Upload CSV</button>
                        </div>
                    </div>

                    {dataSource === 'synthetic' ? (
                        <div>
                            <div className="grid-3" style={{ marginBottom: 16 }}>
                                {Object.entries(templates).map(([id, t]) => (
                                    <div
                                        key={id}
                                        className={`scenario-card ${selectedTemplate === id ? 'selected' : ''}`}
                                        onClick={() => setSelectedTemplate(id)}
                                    >
                                        <div className="scenario-card-name">{t.name}</div>
                                        <div className="scenario-card-desc">{t.description}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                    <label className="form-label">Transactions</label>
                                    <input type="number" className="form-input" value={nTxns}
                                        onChange={e => setNTxns(Number(e.target.value))} min={1000} max={1000000} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                    <label className="form-label">Random Seed</label>
                                    <input type="number" className="form-input" value={seed}
                                        onChange={e => setSeed(Number(e.target.value))} />
                                </div>
                                <button className="btn btn-primary" onClick={handleGenerateSynthetic} disabled={loading}>
                                    {loading ? '⏳ Generating...' : '🎲 Generate Dataset'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div
                            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('file-input')?.click()}
                        >
                            <div className="upload-zone-icon">📤</div>
                            <div className="upload-zone-text">
                                {uploadFile ? uploadFile.name : 'Drop CSV or Parquet file here'}
                            </div>
                            <div className="upload-zone-subtext">or click to browse</div>
                            <input id="file-input" type="file" accept=".csv,.parquet,.pq" hidden
                                onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                        </div>
                    )}

                    {/* Dataset Stats */}
                    {datasetStats && (
                        <div style={{ marginTop: 16 }}>
                            <div className="grid-4">
                                <div className="metric-card">
                                    <span className="metric-label">Transactions</span>
                                    <span className="metric-value">{datasetStats.total_transactions?.toLocaleString()}</span>
                                </div>
                                <div className="metric-card">
                                    <span className="metric-label">Overall SR</span>
                                    <span className="metric-value">{(datasetStats.overall_sr * 100).toFixed(1)}%</span>
                                </div>
                                <div className="metric-card">
                                    <span className="metric-label">Gateways</span>
                                    <span className="metric-value">{datasetStats.gateways?.length || 0}</span>
                                </div>
                                <div className="metric-card">
                                    <span className="metric-label">Data Quality</span>
                                    <span className="metric-value">{datasetStats.data_quality_score?.toFixed(0)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Algorithm Selection ── */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                        <h3 className="card-title">🧠 Algorithms</h3>
                        <span className="badge badge-primary">{selectedAlgos.size} selected</span>
                    </div>

                    <div className="grid-3">
                        {algorithms.map(algo => (
                            <div
                                key={algo.id}
                                className={`algo-card ${selectedAlgos.has(algo.id) ? 'selected' : ''}`}
                                onClick={() => toggleAlgo(algo.id)}
                            >
                                <div className="algo-card-header">
                                    <span className="algo-card-name">{algo.name}</span>
                                    <label className="toggle" onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={selectedAlgos.has(algo.id)} onChange={() => toggleAlgo(algo.id)} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                                <div className="algo-card-desc">{algo.description}</div>
                                <div className="algo-card-meta">
                                    <span className="badge badge-info">{algo.category}</span>
                                    {algo.non_stationary === 'true' && <span className="badge badge-success">non-stationary</span>}
                                </div>

                                {/* Hyperparameter form */}
                                {selectedAlgos.has(algo.id) && Object.keys(algo.hyperparameter_schema || {}).length > 0 && (
                                    <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}
                                        onClick={e => e.stopPropagation()}>
                                        {Object.entries(algo.hyperparameter_schema).map(([key, schema]: [string, any]) => (
                                            <div key={key} className="hyperparam-row">
                                                <span className="hyperparam-label">{key}</span>
                                                <input
                                                    type="range"
                                                    min={schema.min || 0}
                                                    max={schema.max || 100}
                                                    step={schema.step || (schema.type === 'integer' ? 1 : 0.01)}
                                                    value={hyperparams[algo.id]?.[key] ?? schema.default}
                                                    onChange={e => updateHyperparam(algo.id, key, Number(e.target.value))}
                                                    style={{ flex: 1 }}
                                                />
                                                <span className="hyperparam-value">
                                                    {hyperparams[algo.id]?.[key] ?? schema.default}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Experiment Settings ── */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                        <h3 className="card-title">⚙️ Settings</h3>
                    </div>

                    <div className="grid-3">
                        <div className="form-group">
                            <label className="form-label">Run Name</label>
                            <input className="form-input" value={runName} onChange={e => setRunName(e.target.value)}
                                placeholder="My Experiment" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Counterfactual Mode</label>
                            <select className="form-select" value={cfMode} onChange={e => setCfMode(e.target.value)}>
                                <option value="sr_interpolation">SR Interpolation</option>
                                <option value="direct_replay">Direct Replay</option>
                                <option value="ips">IPS Reweighting</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Warm-up Transactions</label>
                            <input type="number" className="form-input" value={warmUp}
                                onChange={e => setWarmUp(Number(e.target.value))} min={0} />
                        </div>
                    </div>
                </div>

                {/* ── Launch ── */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button className="btn btn-primary btn-lg" onClick={handleLaunch} disabled={loading || !datasetId}>
                        {loading ? '⏳ Launching...' : '🚀 Launch Simulation'}
                    </button>
                </div>
            </div>
        </div>
    );
}
