import React, { useState } from 'react';
import { Rubric } from '../types';

type Props = {
	rubrics: Rubric[];
	onAddRubric: (text: string) => void;
	onDeleteRubric: (id: string) => void;
	placeholder?: string;
};

export default function RubricEditor({ rubrics, onAddRubric, onDeleteRubric, placeholder = "Enter rubric text..." }: Props) {
	const [newRubricText, setNewRubricText] = useState('');

	const handleAddRubric = () => {
		if (newRubricText.trim()) {
			onAddRubric(newRubricText.trim());
			setNewRubricText('');
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleAddRubric();
		}
	};

	return (
		<div className="rubric-editor">
			<div className="row" style={{ gap: 8, marginBottom: 8 }}>
				<input
					className="input"
					type="text"
					value={newRubricText}
					onChange={(e) => setNewRubricText(e.target.value)}
					onKeyPress={handleKeyPress}
					placeholder={placeholder}
					style={{ flex: 1 }}
				/>
				<button 
					className="button" 
					onClick={handleAddRubric}
					disabled={!newRubricText.trim()}
				>
					Add Rubric
				</button>
			</div>
			
			{rubrics.length > 0 && (
				<div className="rubrics-list">
					{rubrics.map((rubric) => (
						<div key={rubric.id} className="rubric-item">
							<span className="rubric-text">{rubric.text}</span>
							<button 
								className="button ghost small"
								onClick={() => onDeleteRubric(rubric.id)}
								style={{ padding: '4px 8px', fontSize: '12px' }}
							>
								✕
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
