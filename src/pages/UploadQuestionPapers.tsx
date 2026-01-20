import React, { useEffect, useState, JSX } from 'react';
import * as XLSX from 'xlsx';
import { extractPdfText } from '../utils/pdfText';
import { parsePaper } from '../utils/parser';
import { convertGeminiStructureToPaper } from '../utils/aiQuestionParser';
import { Paper, Question, Course } from '../types';
import QuestionEditor from '../components/QuestionEditor';
import CourseAutocomplete from '../components/CourseAutocomplete';
import { savePaper, getStudentTables, uploadStudentTable, StudentTable, parsePdfTextWithGemini } from '../services/api';
import { convertToInputDate, convertFromInputDate } from '../utils/dateFormatter';
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
	const [studentTables, setStudentTables] = useState<StudentTable[]>([]);
	const [studentTablesLoading, setStudentTablesLoading] = useState(false);
	const [selectedStudentTableId, setSelectedStudentTableId] = useState<string>('');
	const [csvModalOpen, setCsvModalOpen] = useState(false);
	const [csvModalName, setCsvModalName] = useState('');
	const [pendingCsvFile, setPendingCsvFile] = useState<File | null>(null);
	const [csvSaving, setCsvSaving] = useState(false);
	const [examDate, setExamDate] = useState('');
	const [allocatedTime, setAllocatedTime] = useState('');
	const [className, setClassName] = useState('');
	const [courseName, setCourseName] = useState('');
	const [courseCode, setCourseCode] = useState('');
	const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
	const [instructor, setInstructor] = useState('');
	const [section, setSection] = useState('');
	const [viewTableOpen, setViewTableOpen] = useState(false);
	const [paperNameDialogOpen, setPaperNameDialogOpen] = useState(false);
	const [paperNameInput, setPaperNameInput] = useState('');
	const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
	const [isManualCreation, setIsManualCreation] = useState(false);

	const allocatedTimeOptions = ['1 hour', '1:30', '2 hours', '2:30', '3 hours'];
	const sectionOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

	const canUploadPdf = true;
	const studentInfoComplete = !!selectedStudentTableId;
	const examDetailsComplete = !!examDate && !!allocatedTime && !!className && !!courseName && !!instructor && !!section;
	const uploadSectionComplete = !!paper && paper.questions.length > 0;
	const hasPdfUploaded = pdfPageCount !== null;

	useEffect(() => {
		if (!paper) return;

		let needsUpdate = false;
		const updatedPaper = structuredClone(paper);

		for (const question of updatedPaper.questions) {
			if (question.text && question.text.trim().length > 5) {
				if (question.pages === null || question.pages === undefined || question.pages === 0) {
					question.pages = 1;
					needsUpdate = true;
				}
			}

			for (const part of question.parts) {
				if (part.text && part.text.trim().length > 5) {
					if (part.pages === null || part.pages === undefined || part.pages === 0) {
						part.pages = 1;
						needsUpdate = true;
					}
				}

				for (const subPart of part.subParts) {
					if (subPart.text && subPart.text.trim().length > 5) {
						if (subPart.pages === null || subPart.pages === undefined || subPart.pages === 0) {
							subPart.pages = 1;
							needsUpdate = true;
						}
					}
				}
			}
		}

		if (needsUpdate) {
			setPaper(updatedPaper);
		}
	}, [paper?.questions]);

	function calculateTotalPages(paper: Paper | null): number {
		if (!paper) return 0;

		let totalPages = 0;

		for (const question of paper.questions) {
			if (question.pages !== null && question.pages !== undefined) {
				totalPages += question.pages;
			}

			for (const part of question.parts) {
				if (part.pages !== null && part.pages !== undefined) {
					totalPages += part.pages;
				}

				for (const subPart of part.subParts) {
					if (subPart.pages !== null && subPart.pages !== undefined) {
						totalPages += subPart.pages;
					}
				}
			}
		}

		return totalPages;
	}

	const calculatedTotalPages = paper ? calculateTotalPages(paper) : 0;

	useEffect(() => {
		let mounted = true;
		async function load() {
			setStudentTablesLoading(true);
			setError(null);
			const res = await getStudentTables();
			if (!mounted) return;
			if (res.success && Array.isArray(res.data)) {
				setStudentTables(res.data);
			} else if (!res.success) {
				setError(res.error || 'Failed to load student tables');
			}
			setStudentTablesLoading(false);
		}
		load();
		return () => {
			mounted = false;
		};
	}, [setError]);

	useEffect(() => {
		if (!paper) return;
		setExamDate(paper.examDate ?? '');
		setAllocatedTime(paper.allocatedTime ?? '');
		setClassName(paper.className ?? '');
		setCourseName(paper.courseName ?? '');
		setInstructor(paper.instructor ?? '');
		setSection(paper.section ?? '');
		if (paper.studentTableId) {
			setSelectedStudentTableId(paper.studentTableId);
		}
	}, [paper]);

	async function onFileSelected(file: File) {
		setError(null);
		setLoading(true);
		setIsManualCreation(false);
		try {
			const arrayBuffer = await file.arrayBuffer();
			const pdfjs = await import('pdfjs-dist');
			const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
			const pdf = await loadingTask.promise;
			const pageCount = pdf.numPages;
			setPdfPageCount(pageCount);

			// Extract text from PDF
			const text = await extractPdfText(file);

			// Try to parse with Gemini first
			let parsed: Paper;
			try {
				const geminiResult = await parsePdfTextWithGemini(text);
				if (geminiResult.success && geminiResult.data) {
					// Convert Gemini structure to Paper format
					parsed = convertGeminiStructureToPaper(geminiResult.data, text);
				} else {
					// Fallback to regular parser if Gemini fails
					console.warn('Gemini parsing failed, falling back to regular parser:', geminiResult.error);
					parsed = parsePaper(text);
				}
			} catch (geminiError: any) {
				// Fallback to regular parser if Gemini throws an error
				console.warn('Gemini parsing error, falling back to regular parser:', geminiError);
				parsed = parsePaper(text);
			}

			const parsedWithMeta: Paper = {
				...parsed,
				examDate,
				allocatedTime,
				className,
				courseName,
				instructor,
				section,
				studentTableId: selectedStudentTableId || parsed.studentTableId,
			};
			setPaper(parsedWithMeta);
		} catch (e: any) {
			console.error(e);
			setError(e?.message ?? 'Failed to read PDF');
		} finally {
			setLoading(false);
		}
	}

	function onCreateManual() {
		setIsManualCreation(true);
		setPdfPageCount(null);
		setError(null);
		const emptyPaper: Paper = {
			rawText: '',
			questions: [],
			examDate,
			allocatedTime,
			className,
			courseName,
			courseCode,
			instructor,
			section,
			studentTableId: selectedStudentTableId,
		};
		setPaper(emptyPaper);
	}

	function onStudentCsvFileChosen(file: File) {
		setPendingCsvFile(file);
		setCsvModalName('');
		setCsvModalOpen(true);
	}

	async function onConfirmUploadStudentCsv() {
		if (!pendingCsvFile) return;
		const trimmedName = csvModalName.trim();
		if (!trimmedName) {
			setError('Please enter a valid name for the student table.');
			return;
		}
		setCsvSaving(true);
		setError(null);

		try {
			const data = await pendingCsvFile.arrayBuffer();
			const workbook = XLSX.read(data, { type: 'array' });
			const firstSheetName = workbook.SheetNames[0];
			if (!firstSheetName) {
				throw new Error('No sheet found in the uploaded file');
			}
			const sheet = workbook.Sheets[firstSheetName];
			const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
			const students = rows
				.map((row: any) => {
					if (!Array.isArray(row)) return null;
					const rawCms = row[0];
					const rawName = row[1];
					const cmsId = (rawCms ?? '').toString().trim();
					const name = (rawName ?? '').toString().trim();
					if (!cmsId && !name) return null;
					if (cmsId.toLowerCase() === 'cms-id' && name.toLowerCase() === 'name') return null;
					return { cmsId, name };
				})
				.filter(
					(s): s is { cmsId: string; name: string } =>
						!!s && typeof s.name === 'string' && s.name.trim().length > 0
				);

			if (!students.length) {
				throw new Error('No valid students found in the uploaded sheet');
			}

			const res = await uploadStudentTable({
				name: trimmedName,
				originalFileName: pendingCsvFile.name,
				students,
			});
			if (res.success && res.data) {
				setStudentTables((prev: StudentTable[]) => [res.data as StudentTable, ...prev]);
				setSelectedStudentTableId(res.data._id);
				if (paper) {
					setPaper({ ...paper, studentTableId: res.data._id });
				}
				setCsvModalOpen(false);
				setPendingCsvFile(null);
				setCsvModalName('');
			} else if (!res.success) {
				setError(res.error || 'Failed to upload student table');
			}
		} catch (e: any) {
			console.error(e);
			setError(e?.message ?? 'Failed to read Excel (.xlsx) file');
		} finally {
			setCsvSaving(false);
		}
	}

	function onSaveClick() {
		if (!paper) return;
		const defaultName = paper.name || '';
		setPaperNameInput(defaultName);
		setPaperNameDialogOpen(true);
	}

	async function onConfirmSave() {
		if (!paper) return;
		const entered = paperNameInput.trim();
		if (!entered) {
			setError('Please enter a valid paper name.');
			return;
		}
		setPaperNameDialogOpen(false);
		setPaper({ ...paper, name: entered });

		setSaving(true);
		setSaveMessage(null);
		setError(null);

		try {
			const paperData = {
				...paper,
				name: entered,
				totalMarks: totalMarks,
				examDate,
				allocatedTime,
				className,
				courseName,
				instructor,
				section,
				studentTableId: selectedStudentTableId || paper.studentTableId,
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


	const allSectionsComplete = studentInfoComplete && examDetailsComplete && uploadSectionComplete;

	return (
		<div className={styles.page}>
			<div className={styles.topSaveSection}>
				<div className={styles.checklistContainer}>
					<div className={styles.checklistItem}>
						<div className={styles.checklistCircle}>
							<span className={studentInfoComplete ? styles.checklistComplete : styles.checklistPending}>✓</span>
						</div>
						<span className={styles.checklistLabel}>Student Info</span>
					</div>
					<div className={styles.checklistLine}></div>
					<div className={styles.checklistItem}>
						<div className={styles.checklistCircle}>
							<span className={examDetailsComplete ? styles.checklistComplete : styles.checklistPending}>✓</span>
						</div>
						<span className={styles.checklistLabel}>Exam Details</span>
					</div>
					<div className={styles.checklistLine}></div>
					<div className={styles.checklistItem}>
						<div className={styles.checklistCircle}>
							<span className={uploadSectionComplete ? styles.checklistComplete : styles.checklistPending}>✓</span>
						</div>
						<span className={styles.checklistLabel}>Upload Question Paper</span>
					</div>
				</div>
				<button
					className={`button ${styles.topSaveButton}`}
					disabled={!allSectionsComplete || saving}
					onClick={onSaveClick}
				>
					{saving ? 'Saving...' : 'Save to Database'}
				</button>
			</div>

			{saveMessage && <div className={`card ${styles.successCard}`}>{saveMessage}</div>}

			<div className="card" style={{ marginBottom: 16 }}>
				<div className={styles.sectionHeaderRow}>
					<div className={styles.studentInfoHeader}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<h3>Student Information</h3>
							<button
								type="button"
								className="button"
								disabled={!selectedStudentTableId}
								onClick={() => setViewTableOpen(true)}
								style={{
									opacity: selectedStudentTableId ? 1 : 0.5,
									cursor: selectedStudentTableId ? 'pointer' : 'not-allowed'
								}}
							>
								View
							</button>
						</div>
						<p className="small">Before uploading a question paper PDF, select or upload a student information Excel (.xlsx) file (first sheet, CMS-ID in column A, Name in column B).</p>
					</div>
					<div className={styles.sectionHeaderRight}>
						<div className={styles.sectionStatus}>
							<span className={studentInfoComplete ? styles.sectionTickComplete : styles.sectionTickPending}>✓</span>
						</div>
					</div>
				</div>
				<div className={styles.studentInfoControls}>
					<label className="button secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
						<input
							type="file"
							accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
							style={{ display: 'none' }}
							onChange={(e) => {
								const f = e.target.files?.[0];
								if (f) onStudentCsvFileChosen(f);
							}}
						/>
						Upload Student Excel (.xlsx)
					</label>
					{pendingCsvFile ? <span className="small">{pendingCsvFile.name}</span> : null}
				</div>
				<div className={styles.studentInfoSelectRow}>
					<label className={styles.studentInfoSelectLabel} htmlFor="student-csv-select">Select existing student table</label>
					<select
						id="student-csv-select"
						className={styles.studentInfoSelectControl}
						value={selectedStudentTableId}
						onChange={(e) => {
							const value = e.target.value;
							setSelectedStudentTableId(value);
							if (paper) {
								setPaper({ ...paper, studentTableId: value });
							}
						}}
						disabled={studentTablesLoading}
					>
						<option value="">Choose a student table</option>
						{studentTables.map((table: StudentTable) => (
							<option key={table._id} value={table._id}>
								{table.name}
							</option>
						))}
					</select>
				</div>
				{studentTablesLoading ? <div className="small">Loading student tables...</div> : null}
			</div>

			<div className="card" style={{ marginBottom: 16 }}>
				<div className={styles.sectionHeaderRow}>
					<div className={styles.studentInfoHeader}>
						<h3>Exam Details</h3>
						<p className="small">Provide key exam information used later for auto-grading and reporting.</p>
					</div>
					<div className={styles.sectionHeaderRight}>
						<div className={styles.sectionStatus}>
							<span className={examDetailsComplete ? styles.sectionTickComplete : styles.sectionTickPending}>✓</span>
						</div>
					</div>
				</div>
				<div className={styles.examDetailsGrid}>
					<div className={styles.examField}>
						<label className={styles.examLabel}>Exam Date</label>
						<input
							className={styles.examInput}
							type="date"
							value={convertToInputDate(examDate)}
							onChange={(e) => {
								const inputValue = e.target.value; // YYYY-MM-DD from picker  
								const ddmmyyyy = convertFromInputDate(inputValue);
								setExamDate(ddmmyyyy);
								if (paper) {
									setPaper({ ...paper, examDate: ddmmyyyy });
								}
							}}
						/>
						{examDate && (
							<div style={{ marginTop: '4px', fontSize: '13px', color: '#666' }}>
								Selected: <strong>{examDate}</strong>
							</div>
						)}
					</div>
					<div className={styles.examField}>
						<label className={styles.examLabel}>Allocated Time</label>
						<select
							className={styles.examInput}
							value={allocatedTime}
							onChange={(e) => {
								const value = e.target.value;
								setAllocatedTime(value);
								if (paper) {
									setPaper({ ...paper, allocatedTime: value });
								}
							}}
						>
							<option value="">Select allocated time</option>
							{allocatedTimeOptions.map((opt) => (
								<option key={opt} value={opt}>
									{opt}
								</option>
							))}
						</select>
					</div>
					<div className={styles.examField}>
						<label className={styles.examLabel}>Class Name</label>
						<input
							className={styles.examInput}
							type="text"
							placeholder="e.g. BSCS-VII"
							value={className}
							onChange={(e) => {
								const value = e.target.value;
								setClassName(value);
								if (paper) {
									setPaper({ ...paper, className: value });
								}
							}}
						/>
					</div>
					<div className={styles.examField}>
						<label className={styles.examLabel}>Section</label>
						<select
							className={styles.examInput}
							value={section}
							onChange={(e) => {
								const value = e.target.value;
								setSection(value);
								if (paper) {
									setPaper({ ...paper, section: value });
								}
							}}
						>
							<option value="">Select section</option>
							{sectionOptions.map((opt) => (
								<option key={opt} value={opt}>
									{opt}
								</option>
							))}
						</select>
					</div>
					<div className={styles.examField}>
						<label className={styles.examLabel}>Course</label>
						<CourseAutocomplete
							value={selectedCourse}
							onChange={(course) => {
								setSelectedCourse(course);
								if (course) {
									setCourseName(course.courseName);
									setCourseCode(course.courseCode);
									if (paper) {
										setPaper({
											...paper,
											courseName: course.courseName,
											courseCode: course.courseCode
										});
									}
								} else {
									setCourseName('');
									setCourseCode('');
								}
							}}
							onAddNew={(searchTerm) => {
								// Navigate to Settings page (will implement Settings later)
								alert(`Add new course: "${searchTerm}"\nRedirecting to Settings page...`);
								// TODO: Navigate to Settings page with pre-filled course name
							}}
							placeholder="Search for a course..."
						/>
					</div>
					<div className={styles.examField}>
						<label className={styles.examLabel}>Instructor</label>
						<input
							className={styles.examInput}
							type="text"
							placeholder="e.g. Dr. Ahmed Khan"
							value={instructor}
							onChange={(e) => {
								const value = e.target.value;
								setInstructor(value);
								if (paper) {
									setPaper({ ...paper, instructor: value });
								}
							}}
						/>
					</div>
				</div>
			</div>

			<div className="card" style={{ marginBottom: 16 }}>
				<div className={styles.sectionHeaderRow}>
					<div className={styles.studentInfoHeader}>
						<h3>Question Paper</h3>
						<p className="small">Upload a PDF or create the question paper structure manually.</p>
					</div>
					<div className={styles.sectionHeaderRight}>
						<div className={styles.sectionStatus}>
							<span className={uploadSectionComplete ? styles.sectionTickComplete : styles.sectionTickPending}>✓</span>
						</div>
					</div>
				</div>
				<div className={styles.questionPaperActions}>
					<div className={styles.actionButtons}>
						<label
							className="button"
							style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
						>
							<input
								type="file"
								accept="application/pdf"
								style={{ display: 'none' }}
								onChange={(e) => {
									const f = e.target.files?.[0];
									if (f) onFileSelected(f);
								}}
							/>
							📄 Upload PDF
						</label>
						<button
							className="button secondary"
							onClick={onCreateManual}
						>
							✏️ Create Manually
						</button>
					</div>
					{paper && (
						<div className={styles.statsContainer}>
							{calculatedTotalPages > 0 && (
								<div className={styles.pageCountDisplay}>
									<span className={styles.pageCountLabel}>Total Pages:</span>
									<span className={styles.pageCountValue}>{calculatedTotalPages}</span>
								</div>
							)}
							{totalMarks > 0 && (
								<div className={styles.totalMarksDisplay}>
									<span className={styles.totalMarksLabel}>Total Marks:</span>
									<span className={styles.totalMarksValue}>{totalMarks}</span>
								</div>
							)}
						</div>
					)}
				</div>
			</div>

			{loading ? <div className="card">Reading PDF...</div> : null}
			{error ? <div className={`card ${styles.errorCard}`}>{error}</div> : null}


			{!paper && !loading && (
				<div className="card">
					<div className={styles.infoCard}>
						<h4 style={{ marginTop: 0 }}>Get Started</h4>
						<p className="small">Choose one of the following options:</p>
						<div className={styles.infoOptions}>
							<div className={styles.infoOption}>
								<strong>📄 Upload PDF</strong>
								<p className="small">Upload a question paper PDF. The system will extract text, parse questions/parts/sub-parts and marks, and render an editable layout.</p>
								<ul className="flat small">
									<li>Supports labels like <code>Q1</code>, <code>a)</code>, <code>(i)</code>, and marks like <code>(2 Marks)</code>.</li>
									<li>Handles mixed structures.</li>
									<li>Everything is editable.</li>
								</ul>
							</div>
							<div className={styles.infoOption}>
								<strong>✏️ Create Manually</strong>
								<p className="small">Create the question paper structure from scratch. Add questions, parts, and sub-parts manually with their marks and page numbers.</p>
								<ul className="flat small">
									<li>Add questions with labels and marks</li>
									<li>Add parts to questions</li>
									<li>Add sub-parts to parts</li>
									<li>Set page numbers for each element</li>
								</ul>
							</div>
						</div>
					</div>
				</div>
			)}

			{paper ? (
				<div>
					{paper.questions.length === 0 && (
						<div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: '32px' }}>
							<p className="small" style={{ marginBottom: 16, color: 'var(--muted)' }}>
								{isManualCreation
									? 'Start by adding your first question. You can then add parts and sub-parts to each question.'
									: 'No questions found in the uploaded PDF. You can add questions manually.'}
							</p>
							<button
								className="button"
								onClick={() => {
									if (!paper) return;
									const existingNumbers = paper.questions.map(q => {
										const match = q.label.match(/\d+/);
										return match ? parseInt(match[0]) : 0;
									});
									const nextNum = Math.max(0, ...existingNumbers) + 1;
									const newQuestion: Question = {
										id: Math.random().toString(36).slice(2, 10),
										label: `Q${nextNum}`,
										text: '',
										marks: null,
										parts: [],
										rubrics: [],
									};
									setPaper({ ...paper, questions: [...paper.questions, newQuestion] });
								}}
							>
								➕ Add First Question
							</button>
						</div>
					)}
					<QuestionEditor paper={paper} setPaper={setPaper} />
				</div>
			) : null}

			{csvModalOpen ? (
				<div className={styles.dialogOverlay}>
					<div className={styles.dialogBox}>
						<div className={styles.dialogHeader}>
							<h3>Name Student Table</h3>
							<button
								type="button"
								className={styles.dialogCloseButton}
								onClick={() => {
									setCsvModalOpen(false);
									setPendingCsvFile(null);
									setCsvModalName('');
								}}
							>
								✕
							</button>
						</div>
						<p className={styles.dialogDescription}>Enter a name to store this student information table in the database.</p>
						<input
							className={styles.dialogInput}
							type="text"
							value={csvModalName}
							onChange={(e) => setCsvModalName(e.target.value)}
							placeholder="e.g. CS101-Sem1-Students"
							autoFocus
						/>
						<div className={styles.dialogActions}>
							<button
								type="button"
								className="button secondary"
								onClick={() => {
									setCsvModalOpen(false);
									setPendingCsvFile(null);
									setCsvModalName('');
								}}
							>
								Cancel
							</button>
							<button
								type="button"
								className="button"
								disabled={csvSaving}
								onClick={onConfirmUploadStudentCsv}
							>
								{csvSaving ? 'Saving...' : 'Save'}
							</button>
						</div>
					</div>
				</div>
			) : null}

			{viewTableOpen && selectedStudentTableId ? (
				<div className={styles.dialogOverlay}>
					<div className={styles.dialogBoxLarge}>
						<div className={styles.dialogHeader}>
							<h3>Student Table Preview</h3>
							<button
								type="button"
								className={styles.dialogCloseButton}
								onClick={() => setViewTableOpen(false)}
							>
								✕
							</button>
						</div>
						<p className={styles.dialogDescription}>Showing students in the selected table.</p>
						<div className={styles.studentTableScroll}>
							<table className={styles.studentTable}>
								<thead>
									<tr>
										<th>#</th>
										<th>CMS-ID</th>
										<th>Name</th>
									</tr>
								</thead>
								<tbody>
									{studentTables
										.filter((t) => t._id === selectedStudentTableId)[0]?.students.map((s, idx) => (
											<tr key={idx}>
												<td>{idx + 1}</td>
												<td>{s.cmsId}</td>
												<td>{s.name}</td>
											</tr>
										))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			) : null}

			{paperNameDialogOpen ? (
				<div className={styles.dialogOverlay}>
					<div className={styles.dialogBox}>
						<div className={styles.dialogHeader}>
							<h3>Enter Question Paper Name</h3>
							<button
								type="button"
								className={styles.dialogCloseButton}
								onClick={() => {
									setPaperNameDialogOpen(false);
									setPaperNameInput('');
								}}
							>
								✕
							</button>
						</div>
						<p className={styles.dialogDescription}>Enter a name for this question paper (e.g., IR-sec-D):</p>
						<input
							className={styles.dialogInput}
							type="text"
							value={paperNameInput}
							onChange={(e) => setPaperNameInput(e.target.value)}
							placeholder="e.g. IR-sec-D"
							autoFocus
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									onConfirmSave();
								}
							}}
						/>
						<div className={styles.dialogActions}>
							<button
								type="button"
								className="button secondary"
								onClick={() => {
									setPaperNameDialogOpen(false);
									setPaperNameInput('');
								}}
							>
								Cancel
							</button>
							<button
								type="button"
								className="button"
								disabled={saving}
								onClick={onConfirmSave}
							>
								{saving ? 'Saving...' : 'Save'}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}