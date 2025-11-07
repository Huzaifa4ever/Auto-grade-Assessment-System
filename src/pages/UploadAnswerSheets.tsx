import React, { useEffect, useState } from 'react';
import styles from './UploadAnswerSheets.module.css';
import { getAllPapers } from '../services/api';

type PaperItem = {
    _id: string;
    name?: string;
};

export default function UploadAnswerSheets() {
    const [file, setFile] = useState<File | null>(null);
    const [papers, setPapers] = useState<PaperItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedPaperId, setSelectedPaperId] = useState<string>('');

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

    const canEvaluate = !!file && !!selectedPaperId;

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
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setFile(f);
                            }}
                        />
                        Upload PDF
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
            {error ? <div className="card" style={{ color: '#dc3545', background: '#f8d7da', borderColor: '#f5c6cb' }}>{error}</div> : null}

            <div style={{ display: 'flex', gap: 12 }}>
                <button className="button" disabled={!canEvaluate}>Evaluate</button>
            </div>
        </div>
    );
}
