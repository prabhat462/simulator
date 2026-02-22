import { useState, useCallback } from 'react';
import { uploadImpactData, getImpactDataStatus, DataStatus } from '../../api/impactClient';
import { useEffect } from 'react';

export default function ImpactDataUpload() {
    const [status, setStatus] = useState<DataStatus | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [period, setPeriod] = useState<'before' | 'after'>('before');
    const [dragOver, setDragOver] = useState(false);

    const loadStatus = useCallback(async () => {
        try {
            const s = await getImpactDataStatus();
            setStatus(s);
        } catch { }
    }, []);

    useEffect(() => { loadStatus(); }, [loadStatus]);

    const handleUpload = async (file: File) => {
        setUploading(true);
        setUploadResult(null);
        try {
            const result = await uploadImpactData(file, period);
            setUploadResult(result);
            await loadStatus();
        } catch (e: any) {
            setUploadResult({ success: false, errors: [e.message] });
        }
        setUploading(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    };

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
    };

    return (
        <div className="page-body fade-in">
            <div className="page-header" style={{ padding: '24px 0 16px', border: 'none', background: 'transparent' }}>
                <h1 className="page-title">📤 Data Upload</h1>
                <p className="page-subtitle">Upload baseline (before) and algo (after) transaction data</p>
            </div>

            {/* DB Status */}
            {status && status.has_data && (
                <div className="grid-4" style={{ marginBottom: 24 }}>
                    <div className="metric-card">
                        <span className="metric-label">Total Transactions</span>
                        <span className="metric-value">{(status.total_rows || 0).toLocaleString()}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">Before Period</span>
                        <span className="metric-value" style={{ fontSize: 18 }}>{(status.before_count || 0).toLocaleString()}</span>
                        <span className="metric-delta">{status.before_start} → {status.before_end}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">After Period</span>
                        <span className="metric-value" style={{ fontSize: 18 }}>{(status.after_count || 0).toLocaleString()}</span>
                        <span className="metric-delta">{status.after_start} → {status.after_end}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">Dimensions</span>
                        <span className="metric-value" style={{ fontSize: 16 }}>
                            {status.gateway_count} PGs · {status.bank_count} Banks
                        </span>
                        <span className="metric-delta">{status.merchant_count} Merchants</span>
                    </div>
                </div>
            )}

            {/* Period Selector */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                    <span className="card-title">Select Period for Upload</span>
                </div>
                <div className="tabs" style={{ marginBottom: 16 }}>
                    <button className={`tab ${period === 'before' ? 'active' : ''}`} onClick={() => setPeriod('before')}>
                        📅 Baseline (Before)
                    </button>
                    <button className={`tab ${period === 'after' ? 'active' : ''}`} onClick={() => setPeriod('after')}>
                        🚀 Algo Period (After)
                    </button>
                </div>

                {/* Upload Zone */}
                <div
                    className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => document.getElementById('impact-file-input')?.click()}
                >
                    <div className="upload-zone-icon">📁</div>
                    <div className="upload-zone-text">
                        {uploading ? 'Uploading & Processing...' : `Drop ${period === 'before' ? 'Baseline' : 'Algo Period'} file here`}
                    </div>
                    <div className="upload-zone-subtext">CSV or Parquet • Required: transaction_id, date, payment_gateway, payment_mode, issuing_bank, amount, merchant_id, outcome</div>
                    <input id="impact-file-input" type="file" accept=".csv,.parquet,.pq" style={{ display: 'none' }} onChange={onFileSelect} />
                </div>
            </div>

            {/* Upload Result */}
            {uploadResult && (
                <div className={`card ${uploadResult.success ? '' : 'card-error'}`} style={{ marginBottom: 24 }}>
                    <div className="card-header">
                        <span className="card-title">
                            {uploadResult.success ? '✅ Upload Successful' : '❌ Upload Failed'}
                        </span>
                    </div>
                    {uploadResult.success ? (
                        <div style={{ display: 'flex', gap: 32, fontSize: 14 }}>
                            <div><span style={{ color: 'var(--text-muted)' }}>Rows Inserted:</span> <strong>{uploadResult.rows_inserted?.toLocaleString()}</strong></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Duplicates Removed:</span> <strong>{uploadResult.duplicates_removed}</strong></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Period:</span> <strong>{uploadResult.period}</strong></div>
                        </div>
                    ) : (
                        <div style={{ color: 'var(--accent-danger)', fontSize: 13 }}>
                            {(uploadResult.errors || []).map((e: string, i: number) => <div key={i}>• {e}</div>)}
                        </div>
                    )}
                </div>
            )}

            {/* Instructions */}
            {!status?.has_data && (
                <div className="card" style={{ opacity: 0.7 }}>
                    <div className="card-title" style={{ marginBottom: 12 }}>Getting Started</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                        <p>1. Upload your <strong>baseline</strong> transaction data (before the algorithm was enabled)</p>
                        <p>2. Upload your <strong>algo period</strong> transaction data (after the algorithm went live)</p>
                        <p>3. Go to <strong>Analysis Config</strong> to select date ranges and run the analysis</p>
                    </div>
                </div>
            )}
        </div>
    );
}
