import React from 'react';
import styles from './Sidebar.module.css';

type Props = {
	isOpen: boolean;
	activePage?: string;
	onPageChange?: (page: string) => void;
};

export default function Sidebar({ isOpen, activePage = 'dashboard', onPageChange }: Props) {
	const menuItems = [
		{ id: 'dashboard', label: 'Dashboard', icon: '📊' },
		{ id: 'upload-question-papers', label: 'Upload Question Papers', icon: '📄' },
		{ id: 'upload-answer-sheets', label: 'Upload Answer Sheets', icon: '📝' },
		{ id: 'student-reports', label: 'Student Reports', icon: '📈' },
		{ id: 'settings', label: 'Settings', icon: '⚙️' }
	];

	return (
		<aside className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}>
			<nav className={styles.sidebarNav}>
				<ul className={styles.navList}>
					{menuItems.map(item => (
						<li key={item.id} className={styles.navItem}>
							<button
								className={`${styles.navLink} ${activePage === item.id ? styles.active : ''}`}
								onClick={() => onPageChange?.(item.id)}
							>
								<span className={styles.navIcon}>{item.icon}</span>
								<span className={styles.navLabel}>{item.label}</span>
							</button>
						</li>
					))}
				</ul>
			</nav>
		</aside>
	);
}
