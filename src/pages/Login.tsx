import React, { useState } from 'react';
import styles from './Auth.module.css';
import { login as loginApi } from '../services/api';

type Props = {
	onLogin: (token: string, teacherName: string) => void;
	onNavigate: (page: 'signup' | 'forgot-password') => void;
};

export default function Login({ onLogin, onNavigate }: Props) {
	const [userId, setUserId] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!userId.trim() || !password) {
			setError('Please fill in all fields');
			return;
		}

		setLoading(true);
		const res = await loginApi(userId.trim(), password);
		setLoading(false);

		if (res.success && res.data) {
			onLogin(res.data.token, res.data.teacher.name);
		} else {
			setError(res.error || 'Login failed');
		}
	};

	return (
		<div className={styles.authPage}>
			<div className={styles.authCard}>
				<div className={styles.authHeader}>
					<div className={styles.authLogo}>📝</div>
					<h1 className={styles.authTitle}>Welcome Back</h1>
					<p className={styles.authSubtitle}>Sign in to Auto-Grade Assessment System</p>
				</div>

				{error && <div className={styles.errorMsg}>⚠️ {error}</div>}

				<form onSubmit={handleSubmit}>
					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="login-userId">User ID</label>
						<input
							id="login-userId"
							className={styles.formInput}
							type="text"
							placeholder="Enter your User ID"
							value={userId}
							onChange={e => setUserId(e.target.value)}
							autoFocus
						/>
					</div>

					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="login-password">Password</label>
						<input
							id="login-password"
							className={styles.formInput}
							type="password"
							placeholder="Enter your password"
							value={password}
							onChange={e => setPassword(e.target.value)}
						/>
					</div>

					<div className={styles.forgotLink}>
						<button
							type="button"
							className={styles.authLink}
							onClick={() => onNavigate('forgot-password')}
						>
							Forgot Password?
						</button>
					</div>

					<button
						type="submit"
						className={styles.submitBtn}
						disabled={loading}
					>
						{loading ? 'Signing in...' : 'Sign In'}
					</button>
				</form>

				<div className={styles.authFooter}>
					Don't have an account?{' '}
					<button className={styles.authLink} onClick={() => onNavigate('signup')}>
						Sign Up
					</button>
				</div>
			</div>
		</div>
	);
}
