import React, { useState, useMemo, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadQuestionPapers from './pages/UploadQuestionPapers';
import UploadAnswerSheets from './pages/UploadAnswerSheets';
import IndividualAnswerSheets from './pages/IndividualAnswerSheets';
import DownloadAnswerSheets from './pages/DownloadAnswerSheets';
import StudentCopies from './pages/StudentCopies';
import StudentReports from './pages/StudentReports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import { Paper, Question, Part, SubPart } from './types';
import { getMe } from './services/api';

function calculateTotalMarks(paper: Paper | null): number {
	if (!paper) return 0;

	let total = 0;

	for (const question of paper.questions) {

		if (question.marks !== null && question.marks !== undefined) {
			total += question.marks;
		}



		for (const part of question.parts) {
			if (part.marks !== null && part.marks !== undefined) {
				total += part.marks;
			}

			for (const subPart of part.subParts) {
				if (subPart.marks !== null && subPart.marks !== undefined) {
					total += subPart.marks;
				}
			}
		}
	}

	return total;
}

export default function App() {
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [teacherName, setTeacherName] = useState('');
	const [authPage, setAuthPage] = useState<'login' | 'signup' | 'forgot-password'>('login');
	const [authChecking, setAuthChecking] = useState(true);

	const [activePage, setActivePage] = useState(() => {
		const saved = localStorage.getItem('activePage');
		return saved || 'dashboard';
	});
	const [paper, setPaper] = useState<Paper | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [downloadPaperId, setDownloadPaperId] = useState('');
	const [downloadStudentTableId, setDownloadStudentTableId] = useState('');

	const totalMarks = useMemo(() => calculateTotalMarks(paper), [paper]);
	useEffect(() => {
		localStorage.setItem('activePage', activePage);
	}, [activePage]);

	useEffect(() => {
		const token = localStorage.getItem('authToken');
		if (token) {
			getMe(token).then(res => {
				if (res.success && res.data) {
					setIsLoggedIn(true);
					setTeacherName(res.data.name);
				} else {
					localStorage.removeItem('authToken');
					localStorage.removeItem('teacherName');
				}
				setAuthChecking(false);
			});
		} else {
			setAuthChecking(false);
		}
	}, []);

	const handleLogin = (token: string, name: string) => {
		localStorage.setItem('authToken', token);
		localStorage.setItem('teacherName', name);
		setIsLoggedIn(true);
		setTeacherName(name);
	};

	const handleLogout = () => {
		localStorage.removeItem('authToken');
		localStorage.removeItem('teacherName');
		setIsLoggedIn(false);
		setTeacherName('');
		setAuthPage('login');
	};

	if (authChecking) {
		return (
			<div style={{
				minHeight: '100vh',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0fdf4 100%)',
				fontSize: '1.2rem',
				color: '#64748b'
			}}>
				Loading...
			</div>
		);
	}

	if (!isLoggedIn) {
		switch (authPage) {
			case 'signup':
				return <Signup onSignup={handleLogin} onNavigate={setAuthPage} />;
			case 'forgot-password':
				return <ForgotPassword onNavigate={setAuthPage} />;
			default:
				return <Login onLogin={handleLogin} onNavigate={setAuthPage} />;
		}
	}

	const renderPage = () => {
		switch (activePage) {
			case 'dashboard':
				return <Dashboard onNavigate={setActivePage} />;
			case 'upload-question-papers':
				return (
					<UploadQuestionPapers
						paper={paper}
						setPaper={setPaper}
						loading={loading}
						setLoading={setLoading}
						error={error}
						setError={setError}
						totalMarks={totalMarks}
						onPageChange={setActivePage}
					/>
				);
			case 'upload-answer-sheets':
				return <UploadAnswerSheets onNavigate={setActivePage} />;
			case 'individual-sheets':
				return <IndividualAnswerSheets onNavigate={setActivePage} />;
			case 'download-answer-sheets':
				return (
					<DownloadAnswerSheets
						selectedPaperId={downloadPaperId}
						setSelectedPaperId={setDownloadPaperId}
						selectedStudentTableId={downloadStudentTableId}
						setSelectedStudentTableId={setDownloadStudentTableId}
					/>
				);
			case 'student-copies':
				return <StudentCopies onNavigate={setActivePage} />;
			case 'student-reports':
				return <StudentReports />;
			case 'settings':
				return <Settings onProfileUpdate={(name) => setTeacherName(name)} />;
			default:
				return <Dashboard onNavigate={setActivePage} />;
		}
	};

	return (
		<Layout
			activePage={activePage}
			onPageChange={setActivePage}
			teacherName={teacherName}
			onLogout={handleLogout}
		>
			{renderPage()}
		</Layout>
	);
}
