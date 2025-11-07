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
				<p>Welcome to the Auto Grade System</p>
			</div>
			
			<div className={styles.dashboardGrid}>
				<button 
					className={`${styles.dashboardCard} ${styles.clickable}`}
					onClick={() => handleCardClick('upload-question-papers')}
				>
					<div className={styles.cardIcon}>📄</div>
					<div className={styles.cardContent}>
						<h3>Question Papers</h3>
						<p>Upload and manage question papers</p>
					</div>
				</button>
				
				<button 
					className={`${styles.dashboardCard} ${styles.clickable}`}
					onClick={() => handleCardClick('upload-answer-sheets')}
				>
					<div className={styles.cardIcon}>📝</div>
					<div className={styles.cardContent}>
						<h3>Answer Sheets</h3>
						<p>Upload and process student answer sheets</p>
					</div>
				</button>
				
				<button 
					className={`${styles.dashboardCard} ${styles.clickable}`}
					onClick={() => handleCardClick('student-reports')}
				>
					<div className={styles.cardIcon}>📈</div>
					<div className={styles.cardContent}>
						<h3>Reports</h3>
						<p>View student performance reports</p>
					</div>
				</button>
				
				<button 
					className={`${styles.dashboardCard} ${styles.clickable}`}
					onClick={() => handleCardClick('settings')}
				>
					<div className={styles.cardIcon}>⚙️</div>
					<div className={styles.cardContent}>
						<h3>Settings</h3>
						<p>Configure system settings</p>
					</div>
				</button>
			</div>
		</div>
	);
}
