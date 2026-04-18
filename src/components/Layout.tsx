import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import styles from './Layout.module.css';

type Props = {
	children: React.ReactNode;
	activePage?: string;
	onPageChange?: (page: string) => void;
	teacherName?: string;
	onLogout?: () => void;
};

export default function Layout({ children, activePage, onPageChange, teacherName, onLogout }: Props) {
	const [sidebarOpen, setSidebarOpen] = useState(true);

	return (
		<div className={styles.layout}>
			<Header
				onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
				onPageChange={onPageChange}
				teacherName={teacherName}
				onLogout={onLogout}
			/>
			<div className={styles.layoutContent}>
				<Sidebar
					isOpen={sidebarOpen}
					activePage={activePage}
					onPageChange={onPageChange}
				/>
				<main className={`${styles.mainContent} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
					{children}
				</main>
			</div>
			<Footer />
		</div>
	);
}
