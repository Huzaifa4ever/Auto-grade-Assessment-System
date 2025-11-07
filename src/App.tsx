import React, { useState, useMemo } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadQuestionPapers from './pages/UploadQuestionPapers';
import UploadAnswerSheets from './pages/UploadAnswerSheets';
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
	const [activePage, setActivePage] = useState('dashboard');
	const [paper, setPaper] = useState<Paper | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const totalMarks = useMemo(() => calculateTotalMarks(paper), [paper]);

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
					/>
				);
			case 'upload-answer-sheets':
				return <UploadAnswerSheets />;
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
