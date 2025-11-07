import React from 'react';
import { Paper, Question, Part, SubPart, Rubric } from '../types';
import { EditableInput, EditableTextArea } from './EditableFields';
import RubricEditor from './RubricEditor';

type Props = {
	paper: Paper | null;
	setPaper: (paper: Paper) => void;
};

export default function QuestionEditor({ paper, setPaper }: Props) {
	if (!paper) return null;
	const update = (fn: (p: Paper) => void) => {
		const clone = structuredClone(paper);
		fn(clone);
		setPaper(clone);
	};

	return (
		<div className="grid">
			<div className="card">
				<div className="label">Raw text extracted from PDF (read-only)</div>
				<pre className="box" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{paper.rawText}</pre>
			</div>

			{paper.questions.map((q, qi) => (
				<div key={q.id} className="card box q-box">
					<div className="row" style={{ justifyContent: 'space-between' }}>
						<strong>{q.label}</strong>
						<div className="actions">
							<button className="button ghost" onClick={() => update((p) => p.questions.splice(qi, 1))}>Delete Question</button>
							<button className="button secondary" onClick={() => update((p) => p.questions.splice(qi + 1, 0, emptyQuestion(p.questions)))}>Add Question Below</button>
						</div>
					</div>
					<div className="grid">
						<div className="row" style={{ gap: 12 }}>
							<EditableInput
								label="Question Label"
								value={q.label}
								onChange={(val) => update((p) => (p.questions[qi].label = val))}
							/>
							<EditableInput
								label="Marks"
								type="number"
								value={q.marks ?? ''}
								onChange={(val) => update((p) => (p.questions[qi].marks = val ? Number(val) : null))}
							/>
						</div>
						<EditableTextArea
							label="Question Text"
							value={q.text ?? ''}
							onChange={(val) => update((p) => (p.questions[qi].text = val))}
						/>

						<RubricEditor
							rubrics={q.rubrics}
							onAddRubric={(text) => update((p) => {
								const newRubric: Rubric = { id: randomId(), text };
								p.questions[qi].rubrics.push(newRubric);
							})}
							onDeleteRubric={(id) => update((p) => {
								p.questions[qi].rubrics = p.questions[qi].rubrics.filter(r => r.id !== id);
							})}
							placeholder="Enter question rubric..."
						/>

						{q.parts.map((pt, pi) => (
							<div key={pt.id} className="box part-box">
								<div className="row" style={{ justifyContent: 'space-between' }}>
									<strong>Part {pt.label}</strong>
									<div className="actions">
										<button className="button ghost" onClick={() => update((p) => p.questions[qi].parts.splice(pi, 1))}>Delete Part</button>
										<button className="button secondary" onClick={() => update((p) => p.questions[qi].parts.splice(pi + 1, 0, emptyPart(p.questions[qi].parts)))}>Add Part Below</button>
									</div>
								</div>
								<div className="row" style={{ gap: 12 }}>
									<EditableInput
										label="Part Label"
										value={pt.label}
										onChange={(val) => update((p) => (p.questions[qi].parts[pi].label = val))}
									/>
									<EditableInput
										label="Marks"
										type="number"
										value={pt.marks ?? ''}
										onChange={(val) => update((p) => (p.questions[qi].parts[pi].marks = val ? Number(val) : null))}
									/>
								</div>
								<EditableTextArea
									label="Part Text"
									value={pt.text ?? ''}
									onChange={(val) => update((p) => (p.questions[qi].parts[pi].text = val))}
								/>

								<RubricEditor
									rubrics={pt.rubrics}
									onAddRubric={(text) => update((p) => {
										const newRubric: Rubric = { id: randomId(), text };
										p.questions[qi].parts[pi].rubrics.push(newRubric);
									})}
									onDeleteRubric={(id) => update((p) => {
										p.questions[qi].parts[pi].rubrics = p.questions[qi].parts[pi].rubrics.filter(r => r.id !== id);
									})}
									placeholder="Enter part rubric..."
								/>

								{pt.subParts.map((sp, si) => (
									<div key={sp.id} className="box subpart-box">
										<div className="row" style={{ justifyContent: 'space-between' }}>
											<strong>Sub-part {sp.label}</strong>
											<div className="actions">
												<button className="button ghost" onClick={() => update((p) => p.questions[qi].parts[pi].subParts.splice(si, 1))}>Delete</button>
												<button className="button secondary" onClick={() => update((p) => p.questions[qi].parts[pi].subParts.splice(si + 1, 0, emptySubPart(p.questions[qi].parts[pi].subParts)))}>Add Below</button>
											</div>
										</div>
										<div className="row" style={{ gap: 12 }}>
											<EditableInput
												label="Label"
												value={sp.label}
												onChange={(val) => update((p) => (p.questions[qi].parts[pi].subParts[si].label = val))}
											/>
											<EditableInput
												label="Marks"
												type="number"
												value={sp.marks ?? ''}
												onChange={(val) => update((p) => (p.questions[qi].parts[pi].subParts[si].marks = val ? Number(val) : null))}
											/>
										</div>
										<EditableTextArea
											label="Text"
											value={sp.text}
											onChange={(val) => update((p) => (p.questions[qi].parts[pi].subParts[si].text = val))}
										/>

										<RubricEditor
											rubrics={sp.rubrics}
											onAddRubric={(text) => update((p) => {
												const newRubric: Rubric = { id: randomId(), text };
												p.questions[qi].parts[pi].subParts[si].rubrics.push(newRubric);
											})}
											onDeleteRubric={(id) => update((p) => {
												p.questions[qi].parts[pi].subParts[si].rubrics = p.questions[qi].parts[pi].subParts[si].rubrics.filter(r => r.id !== id);
											})}
											placeholder="Enter sub-part rubric..."
										/>
									</div>
								))}

								<div className="row" style={{ marginTop: 8 }}>
									<button className="button" onClick={() => update((p) => p.questions[qi].parts[pi].subParts.push(emptySubPart(p.questions[qi].parts[pi].subParts)))}>Add Sub-part</button>
								</div>
							</div>
						))}

						<div className="row" style={{ marginTop: 8 }}>
							<button className="button" onClick={() => update((p) => p.questions[qi].parts.push(emptyPart(p.questions[qi].parts)))}>Add Part</button>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

function getNextSubPartLabel(existingSubParts: SubPart[]): string {
	const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
	const existingLabels = existingSubParts.map(sp => sp.label.toLowerCase().replace(/[()]/g, ''));
	
	for (let i = 0; i < romanNumerals.length; i++) {
		if (!existingLabels.includes(romanNumerals[i])) {
			return `(${romanNumerals[i]})`;
		}
	}
	const nextNum = existingSubParts.length + 1;
	return `(${nextNum})`;
}

function getNextPartLabel(existingParts: Part[]): string {
	const letters = 'abcdefghijklmnopqrstuvwxyz';
	const existingLabels = existingParts.map(p => p.label.toLowerCase().replace(')', ''));
	
	for (let i = 0; i < letters.length; i++) {
		if (!existingLabels.includes(letters[i])) {
			return `${letters[i]})`;
		}
	}
	
	const nextNum = existingParts.length + 1;
	return `${letters[nextNum % 26]})`;
}

function getNextQuestionLabel(existingQuestions: Question[]): string {
	const existingNumbers = existingQuestions.map(q => {
		const match = q.label.match(/\d+/);
		return match ? parseInt(match[0]) : 0;
	});
	
	const nextNum = Math.max(0, ...existingNumbers) + 1;
	return `Q${nextNum}`;
}

function emptySubPart(existingSubParts: SubPart[] = []): SubPart {
	return { id: randomId(), label: getNextSubPartLabel(existingSubParts), text: '', marks: null, rubrics: [] };
}
function emptyPart(existingParts: Part[] = []): Part {
	return { id: randomId(), label: getNextPartLabel(existingParts), text: '', marks: null, subParts: [], rubrics: [] };
}
function emptyQuestion(existingQuestions: Question[] = []): Question {
	return { id: randomId(), label: getNextQuestionLabel(existingQuestions), text: '', marks: null, parts: [], rubrics: [] };
}
function randomId() {
	return Math.random().toString(36).slice(2, 10);
}
