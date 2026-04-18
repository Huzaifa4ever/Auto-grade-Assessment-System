import React, { useEffect, useState, useCallback } from 'react';
import styles from './StudentReports.module.css';
import * as XLSX from 'xlsx';
import {
	getEvaluationSessions,
	getEvaluationResults,
	updateEvaluationResult,
	triggerEvaluation,
	EvaluationSession,
	EvaluationResultData,
	QuestionResult
} from '../services/api';

type EditMap = Record<string, { obtainedMarks: number; feedback: string }>;

export default function StudentReports() {
	const [sessions, setSessions] = useState<EvaluationSession[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState<string>('');
	const [results, setResults] = useState<EvaluationResultData[]>([]);
	const [expandedCmsId, setExpandedCmsId] = useState<string | null>(null);
	const [editMap, setEditMap] = useState<EditMap>({});
	const [saving, setSaving] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	// Load sessions
	useEffect(() => {
		loadSessions();
	}, []);

	const loadSessions = async () => {
		const res = await getEvaluationSessions();
		if (res.success && res.data) {
			setSessions(res.data);
		}
	};

	// Load results when session changes
	useEffect(() => {
		if (!selectedSessionId) {
			setResults([]);
			return;
		}
		loadResults(selectedSessionId);
	}, [selectedSessionId]);

	const loadResults = async (sessionId: string) => {
		setLoading(true);
		setError(null);
		const res = await getEvaluationResults(sessionId);
		if (res.success && res.data) {
			setResults(res.data);
		} else {
			setError(res.error || 'Failed to load results');
		}
		setLoading(false);
	};

	//  for evaluating students
	useEffect(() => {
		const hasEvaluating = results.some(r => r.status === 'evaluating');
		if (!hasEvaluating || !selectedSessionId) return;

		const interval = setInterval(() => {
			loadResults(selectedSessionId);
		}, 5000);

		return () => clearInterval(interval);
	}, [results, selectedSessionId]);

	const toggleExpand = (cmsId: string) => {
		if (expandedCmsId === cmsId) {
			setExpandedCmsId(null);
			setEditMap({});
		} else {
			setExpandedCmsId(cmsId);

			const student = results.find(r => r.cmsId === cmsId);
			if (student) {
				const map: EditMap = {};
				student.questions.forEach(q => {
					map[q.questionKey] = {
						obtainedMarks: q.obtainedMarks,
						feedback: q.feedback
					};
				});
				setEditMap(map);
			}
		}
	};

	const handleEditChange = (questionKey: string, field: 'obtainedMarks' | 'feedback', value: string | number) => {
		setEditMap(prev => ({
			...prev,
			[questionKey]: {
				...prev[questionKey],
				[field]: field === 'obtainedMarks' ? Number(value) : value
			}
		}));
	};

	const handleSave = async () => {
		if (!expandedCmsId || !selectedSessionId) return;
		setSaving(true);
		setError(null);

		const updates = Object.entries(editMap).map(([questionKey, vals]) => ({
			questionKey,
			obtainedMarks: vals.obtainedMarks,
			feedback: vals.feedback
		}));

		const res = await updateEvaluationResult(selectedSessionId, expandedCmsId, updates);
		if (res.success) {
			setSuccessMsg('Results saved successfully!');
			setTimeout(() => setSuccessMsg(null), 3000);
			await loadResults(selectedSessionId);
		} else {
			setError(res.error || 'Failed to save');
		}
		setSaving(false);
	};

	const handleRetrigger = async (cmsId: string) => {
		const res = await triggerEvaluation(selectedSessionId, cmsId);
		if (res.success) {
			setSuccessMsg(`Re-evaluation started for ${cmsId}`);
			setTimeout(() => setSuccessMsg(null), 3000);
			setTimeout(() => loadResults(selectedSessionId), 2000);
		}
	};

	const handleExportExcel = () => {
		const completedResults = results.filter(r => r.status === 'completed');
		if (completedResults.length === 0) return;

		// Collect all unique question keys across all students
		const allQuestionKeys = new Set<string>();
		completedResults.forEach(r => {
			r.questions.forEach(q => allQuestionKeys.add(q.questionKey));
		});
		const sortedKeys = Array.from(allQuestionKeys).sort((a, b) => {
			const partsA = a.split('_');
			const partsB = b.split('_');
			const numA = parseInt(partsA[0].replace('Q', ''));
			const numB = parseInt(partsB[0].replace('Q', ''));
			if (numA !== numB) return numA - numB;
			return a.localeCompare(b);
		});

		const rows = completedResults.map(student => {
			const row: Record<string, any> = {
				'Student Name': student.studentName || student.cmsId,
				'CMS ID': student.cmsId,
				'Section': student.section,
				'Course Code': student.courseCode,
			};

			// Add per-question marks
			for (const key of sortedKeys) {
				const q = student.questions.find(q => q.questionKey === key);
				const label = formatQuestionKey(key);
				row[label] = q ? q.obtainedMarks : '-';
			}

			row['Total Marks'] = student.totalMarks;
			row['Obtained Marks'] = student.obtainedMarks;
			row['Percentage'] = student.totalMarks > 0
				? `${((student.obtainedMarks / student.totalMarks) * 100).toFixed(1)}%`
				: '0%';
			row['OCR Accuracy %'] = student.ocrAccuracy || 0;
			row['LLM Confidence %'] = student.llmAccuracy || 0;

			return row;
		});

		const ws = XLSX.utils.json_to_sheet(rows);

		const colWidths = Object.keys(rows[0] || {}).map(key => ({
			wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2
		}));
		ws['!cols'] = colWidths;

		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Results');

		const session = sessions.find(s => s.sessionId === selectedSessionId);
		const fileName = `${session?.courseCode || 'results'}_sec${session?.section || ''}_evaluation.xlsx`;

		XLSX.writeFile(wb, fileName);
		setSuccessMsg(`Exported ${completedResults.length} students to ${fileName}`);
		setTimeout(() => setSuccessMsg(null), 4000);
	};

	const handleDownloadPdf = (student: EvaluationResultData) => {
		const html = generateReportHtml(student);
		const blob = new Blob([html], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const win = window.open(url, '_blank');
		if (win) {
			win.onload = () => {
				win.print();
			};
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'completed': return <span className={styles.badgeCompleted}>✅ Completed</span>;
			case 'evaluating': return <span className={styles.badgeEvaluating}>⏳ Evaluating...</span>;
			case 'error': return <span className={styles.badgeError}>❌ Error</span>;
			default: return <span className={styles.badgePending}>⏳ Pending</span>;
		}
	};

	const getScoreColor = (obtained: number, total: number) => {
		if (total === 0) return '#888';
		const pct = (obtained / total) * 100;
		if (pct >= 80) return '#22c55e';
		if (pct >= 60) return '#f59e0b';
		if (pct >= 40) return '#f97316';
		return '#ef4444';
	};

	const getAccuracyColor = (value: number) => {
		if (value >= 80) return '#22c55e';
		if (value >= 60) return '#f59e0b';
		if (value >= 40) return '#f97316';
		return '#ef4444';
	};

	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h2>Student Reports</h2>
				<p>View, edit, and download student evaluation results</p>
			</div>

			{/* Session Selector */}
			<div className={styles.selectorCard}>
				<label className={styles.selectLabel} htmlFor="session-select">Select Evaluation Session</label>
				<select
					id="session-select"
					className={styles.selectControl}
					value={selectedSessionId}
					onChange={(e) => setSelectedSessionId(e.target.value)}
				>
					<option value="">Choose a session...</option>
					{sessions.map((s) => (
						<option key={s.sessionId} value={s.sessionId}>
							{s.courseCode || 'N/A'} — Section {s.section || '?'} — {s.totalStudents} students — Avg: {s.avgScore}/{s.totalMarks}
						</option>
					))}
				</select>
				<button className={styles.refreshBtn} onClick={loadSessions} title="Refresh sessions">🔄</button>
			</div>

			{/* Messages */}
			{error && (
				<div className={styles.errorBanner}>⚠️ {error}</div>
			)}
			{successMsg && (
				<div className={styles.successBanner}>✅ {successMsg}</div>
			)}

			{loading && (
				<div className={styles.loadingCard}>
					<div className={styles.spinner}></div>
					<span>Loading results...</span>
				</div>
			)}

			{/* Results */}
			{!loading && selectedSessionId && results.length === 0 && (
				<div className={styles.emptyCard}>
					<p>No evaluation results found for this session.</p>
					<p className={styles.emptyHint}>Results appear automatically after OCR processing completes.</p>
				</div>
			)}

			{results.length > 0 && (
				<div className={styles.resultsContainer}>
					{/* Summary bar */}
					{/* Export button */}
					<div className={styles.exportRow}>
						<button
							className={styles.exportBtn}
							onClick={handleExportExcel}
							disabled={results.filter(r => r.status === 'completed').length === 0}
						>
							📊 Export All to Excel
						</button>
					</div>

					<div className={styles.summaryBar}>
						<div className={styles.summaryItem}>
							<span className={styles.summaryLabel}>Students</span>
							<span className={styles.summaryValue}>{results.length}</span>
						</div>
						<div className={styles.summaryItem}>
							<span className={styles.summaryLabel}>Evaluated</span>
							<span className={styles.summaryValue}>
								{results.filter(r => r.status === 'completed').length}/{results.length}
							</span>
						</div>
						<div className={styles.summaryItem}>
							<span className={styles.summaryLabel}>Average</span>
							<span className={styles.summaryValue}>
								{results.filter(r => r.status === 'completed').length > 0
									? (results.filter(r => r.status === 'completed')
										.reduce((s, r) => s + r.obtainedMarks, 0) /
										results.filter(r => r.status === 'completed').length).toFixed(1)
									: '—'
								}
								/{results[0]?.totalMarks || 0}
							</span>
						</div>
						<div className={styles.summaryItem}>
							<span className={styles.summaryLabel}>OCR Accuracy</span>
							<span className={styles.summaryValue} style={{
								color: getAccuracyColor(
									results.filter(r => r.status === 'completed').length > 0
										? results.filter(r => r.status === 'completed')
											.reduce((s, r) => s + (r.ocrAccuracy || 0), 0) /
										results.filter(r => r.status === 'completed').length
										: 0
								)
							}}>
								{results.filter(r => r.status === 'completed').length > 0
									? (results.filter(r => r.status === 'completed')
										.reduce((s, r) => s + (r.ocrAccuracy || 0), 0) /
										results.filter(r => r.status === 'completed').length).toFixed(1)
									: '—'
								}%
							</span>
						</div>
						<div className={styles.summaryItem}>
							<span className={styles.summaryLabel}>LLM Confidence</span>
							<span className={styles.summaryValue} style={{
								color: getAccuracyColor(
									results.filter(r => r.status === 'completed').length > 0
										? results.filter(r => r.status === 'completed')
											.reduce((s, r) => s + (r.llmAccuracy || 0), 0) /
										results.filter(r => r.status === 'completed').length
										: 0
								)
							}}>
								{results.filter(r => r.status === 'completed').length > 0
									? (results.filter(r => r.status === 'completed')
										.reduce((s, r) => s + (r.llmAccuracy || 0), 0) /
										results.filter(r => r.status === 'completed').length).toFixed(1)
									: '—'
								}%
							</span>
						</div>
					</div>

					{/* Student cards */}
					{results.map((student) => (
						<div
							key={student.cmsId}
							className={`${styles.studentCard} ${expandedCmsId === student.cmsId ? styles.expanded : ''}`}
						>
							{/* Header row */}
							<div className={styles.studentHeader} onClick={() => toggleExpand(student.cmsId)}>
								<div className={styles.studentInfo}>
									<span className={styles.studentName}>
										{student.studentName || student.cmsId}
									</span>
									<span className={styles.studentMeta}>
										{student.cmsId} · Section {student.section} · {student.courseCode}
									</span>
								</div>
								<div className={styles.studentScore}>
									{getStatusBadge(student.status)}
									{student.status === 'completed' && (
										<>
											<span
												className={styles.scoreTag}
												style={{ color: getScoreColor(student.obtainedMarks, student.totalMarks) }}
											>
												{student.obtainedMarks}/{student.totalMarks}
											</span>
											<span className={styles.accuracyTag} style={{ color: getAccuracyColor(student.ocrAccuracy || 0) }}>
												🔍 {student.ocrAccuracy || 0}%
											</span>
											<span className={styles.accuracyTag} style={{ color: getAccuracyColor(student.llmAccuracy || 0) }}>
												🤖 {student.llmAccuracy || 0}%
											</span>
										</>
									)}
									<span className={styles.expandIcon}>
										{expandedCmsId === student.cmsId ? '▾' : '▸'}
									</span>
								</div>
							</div>

							{/* Expanded detail */}
							{expandedCmsId === student.cmsId && student.status === 'completed' && (
								<div className={styles.studentDetail}>
									{/* Action bar */}
									<div className={styles.actionBar}>
										<button
											className={styles.saveBtn}
											onClick={handleSave}
											disabled={saving}
										>
											{saving ? 'Saving...' : '💾 Save Changes'}
										</button>
										<button
											className={styles.downloadBtn}
											onClick={() => handleDownloadPdf(student)}
										>
											📥 Download Report
										</button>
										<button
											className={styles.retriggerBtn}
											onClick={() => handleRetrigger(student.cmsId)}
										>
											🔄 Re-evaluate
										</button>
									</div>

									{/* Questions */}
									{student.questions.map((q, idx) => (
										<div key={q.questionKey} className={styles.questionCard}>
											<div className={styles.questionHeader}>
												<span className={styles.questionLabel}>
													{formatQuestionKey(q.questionKey)}
												</span>
												<div className={styles.marksInput}>
													<input
														type="number"
														min={0}
														max={q.maxMarks}
														step={0.5}
														value={editMap[q.questionKey]?.obtainedMarks ?? q.obtainedMarks}
														onChange={(e) => handleEditChange(q.questionKey, 'obtainedMarks', e.target.value)}
														className={styles.marksField}
													/>
													<span className={styles.maxMarks}>/ {q.maxMarks}</span>
												</div>
												{q.edited && <span className={styles.editedTag}>edited</span>}
											</div>

											{/* Accuracy indicators */}
											<div className={styles.accuracyRow}>
												<span className={styles.accuracyIndicator} style={{ color: getAccuracyColor(q.ocrConfidence || 0) }}>
													🔍 OCR: {q.ocrConfidence || 0}%
												</span>
												<span className={styles.accuracyIndicator} style={{ color: getAccuracyColor(q.llmConfidence || 0) }}>
													🤖 LLM: {q.llmConfidence || 0}%
												</span>
											</div>

											{/* Question text */}
											{q.questionText && (
												<div className={styles.questionText}>
													<strong>Question:</strong> {q.questionText}
												</div>
											)}

											{/* Rubrics */}
											{q.rubrics && q.rubrics.length > 0 && (
												<div className={styles.rubricsSection}>
													<strong>Rubrics:</strong>
													<ul>
														{q.rubrics.map((r, i) => (
															<li key={i}>{r}</li>
														))}
													</ul>
												</div>
											)}

											{/* Student answer */}
											<div className={styles.answerSection}>
												<strong>Student's Answer:</strong>
												<div className={styles.answerText}>
													{q.studentAnswer || <em>No answer</em>}
												</div>
											</div>

											{/* Feedback */}
											<div className={styles.feedbackSection}>
												<strong>Feedback:</strong>
												<textarea
													className={styles.feedbackTextarea}
													value={editMap[q.questionKey]?.feedback ?? q.feedback}
													onChange={(e) => handleEditChange(q.questionKey, 'feedback', e.target.value)}
													rows={3}
												/>
											</div>
										</div>
									))}

									{/* Total */}
									<div className={styles.totalRow}>
										<span className={styles.totalLabel}>Total Score</span>
										<span
											className={styles.totalValue}
											style={{
												color: getScoreColor(
													Object.values(editMap).reduce((s, v) => s + v.obtainedMarks, 0),
													student.totalMarks
												)
											}}
										>
											{Object.values(editMap).reduce((s, v) => s + v.obtainedMarks, 0)}/{student.totalMarks}
										</span>
									</div>
								</div>
							)}

							{/* Error state */}
							{expandedCmsId === student.cmsId && student.status === 'error' && (
								<div className={styles.studentDetail}>
									<div className={styles.errorBanner}>
										Error: {student.errorMessage || 'Unknown error'}
									</div>
									<button
										className={styles.retriggerBtn}
										onClick={() => handleRetrigger(student.cmsId)}
									>
										🔄 Retry Evaluation
									</button>
								</div>
							)}

							{/* Evaluating state */}
							{expandedCmsId === student.cmsId && student.status === 'evaluating' && (
								<div className={styles.studentDetail}>
									<div className={styles.loadingCard}>
										<div className={styles.spinner}></div>
										<span>LLM evaluation in progress... This page auto-refreshes.</span>
									</div>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function formatQuestionKey(key: string): string {
	const parts = key.split('_');
	const qNum = parts[0].replace('Q', 'Question ');
	if (parts.length === 1) return qNum;
	if (parts.length === 2) return `${qNum} (${parts[1]})`;
	return `${qNum} (${parts[1]})(${parts[2]})`;
}

function generateReportHtml(student: EvaluationResultData): string {
	const totalObtained = student.questions.reduce((s, q) => s + q.obtainedMarks, 0);
	const pct = student.totalMarks > 0 ? ((totalObtained / student.totalMarks) * 100).toFixed(1) : '0';

	const questionsHtml = student.questions.map(q => `
		<div style="border:1px solid #ddd; border-radius:8px; padding:16px; margin-bottom:12px;">
			<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
				<strong style="font-size:15px;">${formatQuestionKey(q.questionKey)}</strong>
				<span style="font-size:16px; font-weight:bold; color:${q.obtainedMarks >= q.maxMarks * 0.8 ? '#22c55e' : q.obtainedMarks >= q.maxMarks * 0.5 ? '#f59e0b' : '#ef4444'}">
					${q.obtainedMarks} / ${q.maxMarks}
				</span>
			</div>
			${q.questionText ? `<p style="color:#555; font-size:13px; margin:4px 0;"><strong>Q:</strong> ${q.questionText}</p>` : ''}
			<p style="margin:4px 0; font-size:13px;"><strong>Answer:</strong> ${q.studentAnswer || 'No answer'}</p>
			<p style="margin:4px 0; font-size:13px; color:#2563eb;"><strong>Feedback:</strong> ${q.feedback}</p>
		</div>
	`).join('');

	return `<!DOCTYPE html>
<html>
<head>
	<title>Evaluation Report - ${student.cmsId}</title>
	<style>
		body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #333; }
		@media print { body { padding: 0; } }
	</style>
</head>
<body>
	<div style="text-align:center; margin-bottom:24px; border-bottom:2px solid #2563eb; padding-bottom:16px;">
		<h1 style="margin:0; font-size:22px; color:#1e40af;">Evaluation Report</h1>
		<p style="margin:4px 0; color:#666;">Auto-Grade Assessment System</p>
	</div>

	<div style="display:flex; justify-content:space-between; margin-bottom:20px; padding:12px; background:#f8fafc; border-radius:8px;">
		<div>
			<p style="margin:2px 0;"><strong>Student:</strong> ${student.studentName || student.cmsId}</p>
			<p style="margin:2px 0;"><strong>CMS ID:</strong> ${student.cmsId}</p>
			<p style="margin:2px 0;"><strong>Section:</strong> ${student.section}</p>
		</div>
		<div style="text-align:right;">
			<p style="margin:2px 0;"><strong>Course:</strong> ${student.courseCode}</p>
			<p style="margin:2px 0;"><strong>Total Score:</strong>
				<span style="font-size:20px; font-weight:bold; color:${Number(pct) >= 50 ? '#22c55e' : '#ef4444'}">
					${totalObtained} / ${student.totalMarks} (${pct}%)
				</span>
			</p>
		</div>
	</div>

	<h2 style="font-size:16px; margin-bottom:12px;">Question-wise Results</h2>
	${questionsHtml}

	<div style="margin-top:20px; text-align:center; color:#999; font-size:12px;">
		Generated on ${new Date().toLocaleDateString()} · Auto-Grade Assessment System
	</div>
</body>
</html>`;
}
