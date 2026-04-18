import React, { useState } from 'react';
import styles from './Auth.module.css';
import { forgotPassword as forgotPasswordApi, resetPassword as resetPasswordApi } from '../services/api';

type Props = {
	onNavigate: (page: 'login') => void;
};

export default function ForgotPassword({ onNavigate }: Props) {
	const [step, setStep] = useState<1 | 2>(1);
	const [email, setEmail] = useState('');
	const [code, setCode] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [devCode, setDevCode] = useState<string | null>(null);

	const handleSendCode = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!email.trim()) {
			setError('Please enter your email');
			return;
		}

		setLoading(true);
		const res = await forgotPasswordApi(email.trim());
		setLoading(false);

		if (res.success && res.data) {
			setSuccess(res.data.message);
			if (res.data.devCode) {
				setDevCode(res.data.devCode);
			}
			setStep(2);
		} else {
			setError(res.error || 'Failed to send reset code');
		}
	};

	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccess(null);

		if (!code.trim()) {
			setError('Please enter the reset code');
			return;
		}

		if (newPassword.length < 5) {
			setError('Password must be at least 5 characters');
			return;
		}

		setLoading(true);
		const res = await resetPasswordApi(email.trim(), code.trim(), newPassword);
		setLoading(false);

		if (res.success) {
			setSuccess('Password reset successfully! You can now login.');
			setDevCode(null);
			setTimeout(() => onNavigate('login'), 2000);
		} else {
			setError(res.error || 'Failed to reset password');
		}
	};

	return (
		<div className={styles.authPage}>
			<div className={styles.authCard}>
				<button className={styles.backBtn} onClick={() => onNavigate('login')}>
					← Back to Login
				</button>

				<div className={styles.authHeader}>
					<div className={styles.authLogo}>🔑</div>
					<h1 className={styles.authTitle}>Reset Password</h1>
					<p className={styles.authSubtitle}>
						{step === 1
							? 'Enter your email to receive a reset code'
							: 'Enter the code and your new password'
						}
					</p>
				</div>

				{/* Step indicator */}
				<div className={styles.stepIndicator}>
					<div className={`${styles.stepDot} ${step >= 1 ? styles.active : ''}`} />
					<div className={`${styles.stepDot} ${step >= 2 ? styles.active : ''}`} />
				</div>

				{error && <div className={styles.errorMsg}>⚠️ {error}</div>}
				{success && <div className={styles.successMsg}>✅ {success}</div>}

				{step === 1 && (
					<form onSubmit={handleSendCode}>
						<div className={styles.formGroup}>
							<label className={styles.formLabel} htmlFor="forgot-email">Email Address</label>
							<input
								id="forgot-email"
								className={styles.formInput}
								type="email"
								placeholder="Enter your registered email"
								value={email}
								onChange={e => setEmail(e.target.value)}
								autoFocus
							/>
						</div>

						<button
							type="submit"
							className={styles.submitBtn}
							disabled={loading}
						>
							{loading ? 'Sending...' : 'Send Reset Code'}
						</button>
					</form>
				)}

				{step === 2 && (
					<form onSubmit={handleResetPassword}>
						{devCode && (
							<div className={styles.devCode}>
								📧 Email not configured — your code: <strong>{devCode}</strong>
							</div>
						)}

						<div className={styles.formGroup}>
							<label className={styles.formLabel} htmlFor="reset-code">Reset Code</label>
							<input
								id="reset-code"
								className={styles.codeInput}
								type="text"
								placeholder="000000"
								maxLength={6}
								value={code}
								onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
								autoFocus
							/>
						</div>

						<div className={styles.formGroup}>
							<label className={styles.formLabel} htmlFor="new-password">New Password</label>
							<input
								id="new-password"
								className={styles.formInput}
								type="password"
								placeholder="Minimum 5 characters"
								value={newPassword}
								onChange={e => setNewPassword(e.target.value)}
							/>
							<div className={styles.formHint}>Must be at least 5 characters</div>
						</div>

						<button
							type="submit"
							className={styles.submitBtn}
							disabled={loading}
						>
							{loading ? 'Resetting...' : 'Reset Password'}
						</button>
					</form>
				)}

				<div className={styles.authFooter}>
					Remember your password?{' '}
					<button className={styles.authLink} onClick={() => onNavigate('login')}>
						Sign In
					</button>
				</div>
			</div>
		</div>
	);
}
