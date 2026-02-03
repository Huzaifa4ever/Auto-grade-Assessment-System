import React, { useEffect, useState } from 'react';
import styles from './UploadAnswerSheets.module.css';
import { getAllPapers, processAnswerSheets, checkAnswerSheetServiceHealth } from '../services/api';

type PaperItem = {
    _id: string;
    name?: string;
};

type ProcessingStatus = 'idle' | 'checking' | 'processing' | 'success' | 'error';

interface Props {
    onNavigate?: (page: string) => void;
}

export default function UploadAnswerSheets({ onNavigate }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [papers, setPapers] = useState<PaperItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedPaperId, setSelectedPaperId] = useState<string>('');

    const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
    const [processingMessage, setProcessingMessage] = useState<string>('');
    const [studentsProcessed, setStudentsProcessed] = useState<number>(0);
    const [sessionId, setSessionId] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            setError(null);
            const res = await getAllPapers();
            if (!mounted) return;
            if (res.success && Array.isArray(res.data)) {
                setPapers(res.data as any);
            } else {
                setError(res.error || 'Failed to load papers');
            }
            setLoading(false);
        }
        load();
        return () => { mounted = false; };
    }, []);

    const canEvaluate = !!file && !!selectedPaperId && processingStatus !== 'processing';

    const handleEvaluate = async () => {
        if (!file || !selectedPaperId) return;

        setProcessingStatus('checking');
        setProcessingMessage('Checking PDF processor service...');
        setError(null);

        const healthCheck = await checkAnswerSheetServiceHealth();
        if (!healthCheck.success || healthCheck.data?.pythonService !== 'ok') {
            setProcessingStatus('error');
            setError('PDF processor service is not running. Please start the Python service first.');
            return;
        }

        setProcessingStatus('processing');
        setProcessingMessage('Processing answer sheets... This may take a few minutes.');

        try {
            const result = await processAnswerSheets(file, selectedPaperId);

            if (result.success && result.data) {
                setProcessingStatus('success');
                setStudentsProcessed(result.data.students?.length || 0);
                setSessionId(result.data.session_id);
                setProcessingMessage(`Successfully processed ${result.data.students?.length || 0} students!`);
            } else {
                setProcessingStatus('error');
                setError(result.error || 'Failed to process answer sheets');
            }
        } catch (err) {
            setProcessingStatus('error');
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        }
    };

    const handleViewSheets = () => {
        onNavigate?.('individual-sheets');
    };

    const handleReset = () => {
        setFile(null);
        setSelectedPaperId('');
        setProcessingStatus('idle');
        setProcessingMessage('');
        setStudentsProcessed(0);
        setSessionId(null);
        setError(null);
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h2>Upload Answer Sheets</h2>
                <p>Upload and process student answer sheets for automated grading</p>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div className={styles.actionsRow}>
                    <label className="button secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="file"
                            accept="application/pdf"
                            style={{ display: 'none' }}
                            disabled={processingStatus === 'processing'}
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                    setFile(f);
                                    setProcessingStatus('idle');
                                    setError(null);
                                }
                            }}
                        />
                        📄 Upload PDF
                    </label>
                    {file ? <span className="small">{file.name}</span> : null}
                </div>
                <div className={styles.instruction}>
                    Upload a single PDF containing all answer sheets. Ensure pages are in the correct order.
                </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div className={styles.selectGroup}>
                    <label className={styles.selectLabel} htmlFor="paper-select">Select Question Paper</label>
                    <select
                        id="paper-select"
                        className={styles.selectControl}
                        value={selectedPaperId}
                        disabled={processingStatus === 'processing'}
                        onChange={(e) => setSelectedPaperId(e.target.value)}
                    >
                        <option value="">Choose a paper</option>
                        {papers.map((p) => (
                            <option key={p._id} value={p._id}>{p.name || 'Untitled Paper'}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? <div className="card">Loading papers...</div> : null}

            {error ? (
                <div className="card" style={{
                    color: '#dc3545',
                    background: '#f8d7da',
                    borderColor: '#f5c6cb',
                    marginBottom: 16
                }}>
                    ⚠️ {error}
                </div>
            ) : null}

            {processingStatus === 'checking' || processingStatus === 'processing' ? (
                <div className="card" style={{
                    background: '#e7f3ff',
                    borderColor: '#b6d7ff',
                    marginBottom: 16
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className={styles.spinner}></div>
                        <span>{processingMessage}</span>
                    </div>
                </div>
            ) : null}

            {processingStatus === 'success' ? (
                <div className="card" style={{
                    background: '#d4edda',
                    borderColor: '#c3e6cb',
                    marginBottom: 16
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            ✅ <strong>{processingMessage}</strong>
                            <br />
                            <small>Session ID: {sessionId}</small>
                        </div>
                        <button className="button" onClick={handleViewSheets}>
                            View Processed Sheets →
                        </button>
                    </div>
                </div>
            ) : null}

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button
                    className="button"
                    disabled={!canEvaluate}
                    onClick={handleEvaluate}
                >
                    {processingStatus === 'processing' ? 'Processing...' : '🔍 Evaluate'}
                </button>

                {processingStatus !== 'idle' && (
                    <button className="button secondary" onClick={handleReset}>
                        Reset
                    </button>
                )}

                <button
                    className="button secondary"
                    onClick={() => onNavigate?.('individual-sheets')}
                >
                    View All Sessions
                </button>
            </div>
        </div>
    );
}
