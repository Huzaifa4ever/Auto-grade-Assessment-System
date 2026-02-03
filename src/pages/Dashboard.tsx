import React from 'react';
import styles from './Dashboard.module.css';

type Props = {
	onNavigate?: (page: string) => void;
};

export default function Dashboard({ onNavigate }: Props) {
	const handleCardClick = (page: string) => {
		onNavigate?.(page);
	};

	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h2>Dashboard</h2>
				<p>Welcome to the Auto Grade System - Manage your exams and grading workflow</p>
			</div>

			<div className={styles.dashboardGrid}>
				<button
					className={`${styles.dashboardCard} ${styles.clickable}`}
					onClick={() => handleCardClick('upload-question-papers')}
				>
					<div className={styles.cardIcon}>📄</div>
					<div className={styles.cardContent}>
						<h3>Upload Question Papers</h3>
						<p>Upload PDF or create question papers manually with questions, parts, and sub-parts</p>
					</div>
					<div className={styles.cardArrow}>→</div>
				</button>

				<button
					className={`${styles.dashboardCard} ${styles.clickable}`}
					onClick={() => handleCardClick('upload-answer-sheets')}
				>
					<div className={styles.cardIcon}>📝</div>
					<div className={styles.cardContent}>
						<h3>Upload Answer Sheets</h3>
						<p>Upload student answer sheets in PDF format for automated grading</p>
					</div>
					<div className={styles.cardArrow}>→</div>
				</button>

				<button
					className={`${styles.dashboardCard} ${styles.clickable}`}
					onClick={() => handleCardClick('download-answer-sheets')}
				>
					<div className={styles.cardIcon}>📥</div>
					<div className={styles.cardContent}>
						<h3>Download Answer Sheets</h3>
						<p>Generate and download blank answer sheets for students based on question papers</p>
					</div>
					<div className={styles.cardArrow}>→</div>
				</button>

				<button
					className={`${styles.dashboardCard} ${styles.clickable}`}
					onClick={() => handleCardClick('student-reports')}
				>
					<div className={styles.cardIcon}>📈</div>
					<div className={styles.cardContent}>
						<h3>Student Reports</h3>
						<p>View detailed performance reports and analytics for students</p>
					</div>
					<div className={styles.cardArrow}>→</div>
				</button>

			</div>
		</div>
	);
}
