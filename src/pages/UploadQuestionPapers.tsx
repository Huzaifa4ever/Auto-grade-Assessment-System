import React, { useState, JSX } from 'react';
import { extractPdfText } from '../utils/pdfText';
import { parsePaper } from '../utils/parser';
import { Paper } from '../types';
import QuestionEditor from '../components/QuestionEditor';
import { savePaper } from '../services/api';
import styles from './UploadQuestionPapers.module.css';

type Props = {
	paper: Paper | null;
	setPaper: (paper: Paper) => void;
	loading: boolean;
	setLoading: (loading: boolean) => void;
	error: string | null;
	setError: (error: string | null) => void;
	totalMarks: number;
};

export default function UploadQuestionPapers({ 
	paper, 
	setPaper, 
	loading, 
	setLoading, 
	error, 
	setError, 
	totalMarks 
}: Props) {
	const [saving, setSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);

	async function onFileSelected(file: File) {
		setError(null);
		setLoading(true);
		try {
			const text = await extractPdfText(file);
			const parsed = parsePaper(text);
			setPaper(parsed);
		} catch (e: any) {
			console.error(e);
			setError(e?.message ?? 'Failed to read PDF');
		} finally {
			setLoading(false);
		}
	}

	async function onSave() {
		if (!paper) return;
		const defaultName = paper.name || '';
		const entered = window.prompt('Enter a name for this question paper (e.g., IR-sec-D):', defaultName)?.trim();
		if (entered === undefined || entered === null) {
			return;
		}
		if (!entered) {
			setError('Please enter a valid paper name.');
			return;
		}
		setPaper({ ...paper, name: entered });

		setSaving(true);
		setSaveMessage(null);
		setError(null);
		
		try {
			const paperData = {
				...paper,
				name: entered,
				totalMarks: totalMarks
			};
			
			const result = await savePaper(paperData);
			
			if (result.success) {
				setSaveMessage('Paper saved successfully to database!');
				setTimeout(() => setSaveMessage(null), 3000);
			} else {
				setError(result.error || 'Failed to save paper');
			}
		} catch (err: any) {
			console.error('Save error:', err);
			setError(err?.message || 'Failed to save paper');
		} finally {
			setSaving(false);
		}
	}

	function onExport() {
		if (!paper) return;
		const exportData = {
			...paper,
			totalMarks: totalMarks
		};
		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'paper.json';
		a.click();
		URL.revokeObjectURL(url);
	}


	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h2>Upload Question Papers</h2>
				<p>Upload and edit question papers for automated grading</p>
			</div>

			<div className={styles.pageActions}>
				{paper && totalMarks > 0 && (
					<div className={styles.totalMarksDisplay}>
						<span className={styles.totalMarksLabel}>Total Marks:</span>
						<span className={styles.totalMarksValue}>{totalMarks}</span>
					</div>
				)}
				<label className="button secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
					<input
						type="file"
						accept="application/pdf"
						style={{ display: 'none' }}
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f) onFileSelected(f);
						}}
					/>
					Upload PDF
				</label>
				<button 
					className="button" 
					disabled={!paper || saving} 
					onClick={onSave}
				>
					{saving ? 'Saving...' : 'Save to Database'}
				</button>
				<button 
					className="button secondary" 
					disabled={!paper} 
					onClick={onExport}
				>
					Export JSON
				</button>
			</div>

			{loading ? <div className="card">Reading PDF...</div> : null}
			{error ? <div className={`card ${styles.errorCard}`}>{error}</div> : null}
			{saveMessage ? <div className={`card ${styles.successCard}`}>{saveMessage}</div> : null}

			{!paper && !loading && (
				<div className="card">
					<p className="small">Upload a question paper PDF to begin. The system will extract text, parse questions/parts/sub-parts and marks, and render an editable layout.</p>
					<ul className="flat small">
						<li>Supports labels like <code>Q1</code>, <code>a)</code>, <code>(i)</code>, and marks like <code>(2 Marks)</code>.</li>
						<li>Handles mixed structures.</li>
						<li>Everything is editable.</li>
					</ul>
				</div>
			)}

			{paper ? <QuestionEditor paper={paper} setPaper={setPaper} /> : null}
		</div>
	);
}
