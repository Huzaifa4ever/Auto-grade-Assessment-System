import React, { useState, useMemo, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadQuestionPapers from './pages/UploadQuestionPapers';
import UploadAnswerSheets from './pages/UploadAnswerSheets';
import DownloadAnswerSheets from './pages/DownloadAnswerSheets';
import StudentReports from './pages/StudentReports';
import Settings from './pages/Settings';
import { Paper, Question, Part, SubPart } from './types';

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
				return <UploadAnswerSheets />;
			case 'download-answer-sheets':
				return (
					<DownloadAnswerSheets
						selectedPaperId={downloadPaperId}
						setSelectedPaperId={setDownloadPaperId}
						selectedStudentTableId={downloadStudentTableId}
						setSelectedStudentTableId={setDownloadStudentTableId}
					/>
				);
			case 'student-reports':
				return <StudentReports />;
			case 'settings':
				return <Settings />;
			default:
				return <Dashboard onNavigate={setActivePage} />;
		}
	};

	return (
		<Layout activePage={activePage} onPageChange={setActivePage}>
			{renderPage()}
		</Layout>
	);
}
