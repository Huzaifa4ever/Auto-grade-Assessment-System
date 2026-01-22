import React, { useEffect, useState, useRef } from 'react';
import { Paper, Question } from '../types';
import { Student } from '../services/api';
import { generateAnswerSheet } from '../utils/answerSheetGenerator';
import styles from './AnswerSheetViewer.module.css';

interface Props {
	paper: Paper;
	students: Student[];
	examDate: string;
	allocatedTime: string;
	className: string;
	courseName: string;
	courseCode: string;
	instructor: string;
	section: string;
	onClose?: () => void;
}

export default function AnswerSheetViewer({
	paper,
	students,
	examDate,
	allocatedTime,
	className,
	courseName,
	courseCode,
	instructor,
	section,
	onClose,
}: Props) {
	const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	const currentStudent = students[currentStudentIndex];

	useEffect(() => {
		return () => {
			if (pdfUrl) {
				URL.revokeObjectURL(pdfUrl);
			}
		};
	}, [pdfUrl]);

	useEffect(() => {
		if (!currentStudent) return;

		let currentUrl: string | null = null;

		async function loadPdf() {
			setLoading(true);
			if (pdfUrl) {
				URL.revokeObjectURL(pdfUrl);
				setPdfUrl(null);
			}

			try {

				const pdf = await generateAnswerSheet({
					paper,
					student: currentStudent,
					examDate,
					allocatedTime,
					className,
					courseName,
					courseCode,
					instructor,
					section,
				});

				const pdfBlob = pdf.output('blob');
				const url = URL.createObjectURL(pdfBlob);
				currentUrl = url;
				setPdfUrl(url);
			} catch (error) {
				console.error('Error generating PDF:', error);
			} finally {
				setLoading(false);
			}
		}

		loadPdf();

		return () => {
			if (currentUrl) {
				URL.revokeObjectURL(currentUrl);
			}
		};
	}, [currentStudentIndex, paper, currentStudent, examDate, allocatedTime, className, courseName, courseCode, instructor, section]);

	const handlePrevious = () => {
		if (currentStudentIndex > 0) {
			setCurrentStudentIndex(currentStudentIndex - 1);
		}
	};

	const handleNext = () => {
		if (currentStudentIndex < students.length - 1) {
			setCurrentStudentIndex(currentStudentIndex + 1);
		}
	};

	return (
		<div className={styles.viewerContainer}>
			<div className={styles.viewerHeader}>
				<div className={styles.studentInfo}>
					<h3>Answer Sheet Viewer</h3>
					<p className={styles.studentName}>
						Student {currentStudentIndex + 1} of {students.length}: {currentStudent?.name} ({currentStudent?.cmsId})
					</p>
				</div>
				<div className={styles.navigation}>
					<button
						className="button secondary"
						onClick={handlePrevious}
						disabled={currentStudentIndex === 0}
					>
						← Previous
					</button>
					<span className={styles.pageIndicator}>
						{currentStudentIndex + 1} / {students.length}
					</span>
					<button
						className="button secondary"
						onClick={handleNext}
						disabled={currentStudentIndex === students.length - 1}
					>
						Next →
					</button>
					{onClose && (
						<button
							className="button secondary"
							onClick={onClose}
							style={{ marginLeft: '8px' }}
						>
							✕
						</button>
					)}
				</div>
			</div>

			<div className={styles.viewerContent}>
				{loading ? (
					<div className={styles.loading}>
						<div className={styles.spinner}></div>
						<p>Generating answer sheet...</p>
					</div>
				) : pdfUrl ? (
					<iframe
						ref={iframeRef}
						src={pdfUrl}
						className={styles.pdfFrame}
						title="Answer Sheet Preview"
					/>
				) : (
					<div className={styles.error}>Failed to load PDF</div>
				)}
			</div>
		</div>
	);
}

