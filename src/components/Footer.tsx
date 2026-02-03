import React from 'react';
import styles from './Footer.module.css';

export default function Footer() {
	return (
		<footer className={styles.footer}>
			<div className={styles.footerContent}>
				<p>&copy; 2026 Automated Answer Sheet Assessment System. All rights reserved.</p>
			</div>
		</footer>
	);
}
