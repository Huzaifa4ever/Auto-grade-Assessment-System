import React from 'react';
import styles from './Footer.module.css';

export default function Footer() {
	return (
		<footer className={styles.footer}>
			<div className={styles.footerContent}>
				<p>&copy; 2025 Automated Answer Sheet Assessment System. All rights reserved.</p>
				<p>Version 1.0</p>
			</div>
		</footer>
	);
}
