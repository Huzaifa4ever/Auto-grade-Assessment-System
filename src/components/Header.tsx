import React from 'react';
import styles from './Header.module.css';

type Props = {
	onToggleSidebar: () => void;
	onPageChange?: (page: string) => void;
};

export default function Header({ onToggleSidebar, onPageChange }: Props) {
	return (
		<header className={styles.header}>
			<div className={styles.headerLeft}>
				<button
					className={styles.menuToggle}
					onClick={onToggleSidebar}
					aria-label="Toggle sidebar"
				>
					☰
				</button>
				<h1 className={styles.appTitle}>Automated Answer Sheet Assessment System</h1>
			</div>
			<div className={styles.headerRight}>
				<button
					className={styles.settingsButton}
					onClick={() => onPageChange?.('settings')}
					aria-label="Settings"
					title="Settings"
				>
					⚙️
				</button>
				<div className={styles.userInfo}>
					<span className={styles.userName}>Teacher Profile</span>
					<div className={styles.userAvatar}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
							<circle cx="12" cy="7" r="4"></circle>
						</svg>
					</div>
				</div>
			</div>
		</header>
	);
}
