import React, { useState } from 'react';
import styles from './Auth.module.css';
import { signup as signupApi } from '../services/api';

type Props = {
	onSignup: (token: string, teacherName: string) => void;
	onNavigate: (page: 'login') => void;
};

export default function Signup({ onSignup, onNavigate }: Props) {
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [userId, setUserId] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!name.trim() || !email.trim() || !userId.trim() || !password) {
			setError('Please fill in all fields');
			return;
		}

		if (password.length < 5) {
			setError('Password must be at least 5 characters');
			return;
		}

		setLoading(true);
		const res = await signupApi(name.trim(), email.trim(), userId.trim(), password);
		setLoading(false);

		if (res.success && res.data) {
			onSignup(res.data.token, res.data.teacher.name);
		} else {
			setError(res.error || 'Signup failed');
		}
	};

	return (
		<div className={styles.authPage}>
			<div className={styles.authCard}>
				<div className={styles.authHeader}>
					<div className={styles.authLogo}>✨</div>
					<h1 className={styles.authTitle}>Create Account</h1>
					<p className={styles.authSubtitle}>Join the Auto-Grade Assessment System</p>
				</div>

				{error && <div className={styles.errorMsg}>⚠️ {error}</div>}

				<form onSubmit={handleSubmit}>
					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="signup-name">Full Name</label>
						<input
							id="signup-name"
							className={styles.formInput}
							type="text"
							placeholder="Enter your full name"
							value={name}
							onChange={e => setName(e.target.value)}
							autoFocus
						/>
					</div>

					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="signup-email">Email</label>
						<input
							id="signup-email"
							className={styles.formInput}
							type="email"
							placeholder="Enter your email"
							value={email}
							onChange={e => setEmail(e.target.value)}
						/>
						<div className={styles.formHint}>Used for password recovery</div>
					</div>

					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="signup-userId">User ID</label>
						<input
							id="signup-userId"
							className={styles.formInput}
							type="text"
							placeholder="Choose a unique User ID"
							value={userId}
							onChange={e => setUserId(e.target.value)}
						/>
					</div>

					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="signup-password">Password</label>
						<input
							id="signup-password"
							className={styles.formInput}
							type="password"
							placeholder="Minimum 5 characters"
							value={password}
							onChange={e => setPassword(e.target.value)}
						/>
						<div className={styles.formHint}>Must be at least 5 characters</div>
					</div>

					<button
						type="submit"
						className={styles.submitBtn}
						disabled={loading}
					>
						{loading ? 'Creating Account...' : 'Create Account'}
					</button>
				</form>

				<div className={styles.authFooter}>
					Already have an account?{' '}
					<button className={styles.authLink} onClick={() => onNavigate('login')}>
						Sign In
					</button>
				</div>
			</div>
		</div>
	);
}
