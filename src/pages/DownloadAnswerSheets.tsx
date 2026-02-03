import React, { useEffect, useState } from 'react';
import { getAllPapers, getStudentTables, StudentTable, Student } from '../services/api';
import { Paper } from '../types';
import { generateAllAnswerSheets } from '../utils/answerSheetGenerator';
import AnswerSheetViewer from '../components/AnswerSheetViewer';
import styles from './DownloadAnswerSheets.module.css';

type PaperItem = {
	_id: string;
	name?: string;
	examDate?: string;
	allocatedTime?: string;
	className?: string;
	courseName?: string;
	instructor?: string;
	section?: string;
	questions?: any[];
};

type Props = {
	selectedPaperId: string;
	setSelectedPaperId: (id: string) => void;
	selectedStudentTableId: string;
	setSelectedStudentTableId: (id: string) => void;
};

export default function DownloadAnswerSheets({
	selectedPaperId,
	setSelectedPaperId,
	selectedStudentTableId,
	setSelectedStudentTableId
}: Props) {
	const [papers, setPapers] = useState<PaperItem[]>([]);
	const [studentTables, setStudentTables] = useState<StudentTable[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [downloading, setDownloading] = useState(false);
	const [viewDialogOpen, setViewDialogOpen] = useState(false);
	const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
	const [selectedStudentTable, setSelectedStudentTable] = useState<StudentTable | null>(null);
	const [resolvedCourseCode, setResolvedCourseCode] = useState<string>('');

	useEffect(() => {
		let mounted = true;
		async function load() {
			setLoading(true);
			setError(null);

			const [papersRes, tablesRes] = await Promise.all([
				getAllPapers(),
				getStudentTables()
			]);

			if (!mounted) return;

			if (papersRes.success && Array.isArray(papersRes.data)) {
				setPapers(papersRes.data as any);
			} else {
				setError(papersRes.error || 'Failed to load papers');
			}

			if (tablesRes.success && Array.isArray(tablesRes.data)) {
				setStudentTables(tablesRes.data);
			}

			setLoading(false);
		}
		load();
		return () => { mounted = false; };
	}, []);

	const canDownload = !!selectedPaperId && !!selectedStudentTableId && selectedPaper && selectedStudentTable;

	useEffect(() => {
		if (selectedPaperId) {
			const paper = papers.find(p => p._id === selectedPaperId);
			if (paper && (paper as any).questions) {
				setSelectedPaper(paper as any as Paper);
			} else if (paper) {
				async function fetchFullPaper() {
					try {
						const response = await fetch(`http://localhost:5000/api/papers/${selectedPaperId}`);
						if (response.ok) {
							const fullPaper = await response.json();
							setSelectedPaper(fullPaper as Paper);
						}
					} catch (err) {
						console.error('Error fetching full paper:', err);
					}
				}
				fetchFullPaper();
			}
		} else {
			setSelectedPaper(null);
		}
	}, [selectedPaperId, papers]);

	useEffect(() => {
		if (selectedStudentTableId) {
			const table = studentTables.find(t => t._id === selectedStudentTableId);
			if (table) {
				setSelectedStudentTable(table);
			}
		} else {
			setSelectedStudentTable(null);
		}
	}, [selectedStudentTableId, studentTables]);

	useEffect(() => {
		async function resolveCourseCode() {
			if (!selectedPaper) {
				setResolvedCourseCode('');
				return;
			}

			let courseCode = selectedPaper.courseCode || '';

			if (!courseCode && selectedPaper.courseName) {
				try {
					const { searchCourses } = await import('../services/api');
					const searchResult = await searchCourses(selectedPaper.courseName);
					if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
						courseCode = searchResult.data[0].courseCode;
					}
				} catch (err) {
					console.warn('Could not find course code for paper');
				}
			}

			setResolvedCourseCode(courseCode);
		}

		resolveCourseCode();
	}, [selectedPaper]);

	async function handleDownload() {
		if (!canDownload || !selectedPaper || !selectedStudentTable) return;

		setDownloading(true);
		setError(null);

		try {
			let courseCode = selectedPaper.courseCode || '';

			if (!courseCode && selectedPaper.courseName) {
				try {
					const { searchCourses } = await import('../services/api');
					const searchResult = await searchCourses(selectedPaper.courseName);
					if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
						courseCode = searchResult.data[0].courseCode;
					}
				} catch (err) {
					console.warn('Could not find course code for existing paper');
				}
			}

			const pdfBytes = await generateAllAnswerSheets(
				selectedPaper,
				selectedStudentTable.students,
				selectedPaper.examDate || '',
				selectedPaper.allocatedTime || '',
				selectedPaper.className || '',
				selectedPaper.courseName || '',
				courseCode,
				selectedPaper.instructor || '',
				selectedPaper.section || ''
			);

			const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `Answer_Sheets_${selectedPaper.name || 'Paper'}_${selectedStudentTable.name || 'Students'}.pdf`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err: any) {
			console.error('Download error:', err);
			setError(err?.message || 'Failed to download answer sheets');
		} finally {
			setDownloading(false);
		}
	}

	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h2>Download Answer Sheets</h2>
				<p>Generate and download answer sheets for students based on question paper</p>
			</div>

			<div className="card" style={{ marginBottom: 16 }}>
				<div className={styles.sectionHeader}>
					<h3>Select Question Paper</h3>
					<p className="small">Choose the question paper for which you want to generate answer sheets.</p>
				</div>
				<div className={styles.selectGroup}>
					<label className={styles.selectLabel} htmlFor="paper-select">Question Paper</label>
					<select
						id="paper-select"
						className={styles.selectControl}
						value={selectedPaperId}
						onChange={(e) => setSelectedPaperId(e.target.value)}
						disabled={loading}
					>
						<option value="">Choose a question paper</option>
						{papers.map((p) => (
							<option key={p._id} value={p._id}>
								{p.name || 'Untitled Paper'}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="card" style={{ marginBottom: 16 }}>
				<div className={styles.sectionHeader}>
					<h3>Select Student Table</h3>
					<p className="small">Choose the student table containing the list of students.</p>
				</div>
				<div className={styles.selectGroup}>
					<label className={styles.selectLabel} htmlFor="student-table-select">Student Table</label>
					<select
						id="student-table-select"
						className={styles.selectControl}
						value={selectedStudentTableId}
						onChange={(e) => setSelectedStudentTableId(e.target.value)}
						disabled={loading}
					>
						<option value="">Choose a student table</option>
						{studentTables.map((table) => (
							<option key={table._id} value={table._id}>
								{table.name}
							</option>
						))}
					</select>
				</div>
			</div>

			{loading ? <div className="card">Loading...</div> : null}
			{error ? <div className={`card ${styles.errorCard}`}>{error}</div> : null}

			<div className={styles.actionsRow}>
				<button
					className="button"
					disabled={!canDownload || downloading}
					onClick={handleDownload}
				>
					{downloading ? 'Generating...' : '📥 Download Answer Sheets'}
				</button>
				<button
					className="button secondary"
					disabled={!canDownload}
					onClick={() => setViewDialogOpen(true)}
				>
					👁️ View
				</button>
			</div>

			{viewDialogOpen && selectedPaper && selectedStudentTable && (
				<div className={styles.dialogOverlay} onClick={() => setViewDialogOpen(false)}>
					<div className={styles.dialogBoxLarge} onClick={(e) => e.stopPropagation()}>
						<div className={styles.viewerWrapper}>
							<AnswerSheetViewer
								paper={selectedPaper}
								students={selectedStudentTable.students}
								examDate={selectedPaper.examDate || ''}
								allocatedTime={selectedPaper.allocatedTime || ''}
								className={selectedPaper.className || ''}
								courseName={selectedPaper.courseName || ''}
								courseCode={resolvedCourseCode}
								instructor={selectedPaper.instructor || ''}
								section={selectedPaper.section || ''}
								onClose={() => setViewDialogOpen(false)}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

