import { Paper, Question, Part, SubPart } from '../types';

const questionLabelRe = /^\s*((?:Q(?:uestion)?)\s*[\.-–—]?\s*\d+)\s*\.?\s*(.*)$/i;
const partLabelRe = /^\s*([a-z])\)\s*(.*)$/i; 
const subpartLabelRe = /^\s*\(\s*(i{1,3}|iv|v|vi{0,3}|x)\s*\)\s*(.*)$/i; 
const subpartLabelReLoose = /^\s*\(\s*([ivxlcdm]+)\s*\)\s*(.*)$/i; 
const subpartLabelNoParensRe = /^\s*(i{1,3}|iv|v|vi{0,3}|x)\)\s*(.*)$/i; 
const marksInlineRe = /\(\s*(\d+(?:\.\d+)?)\s*Marks?\s*\)/i; 
const marksEndRe = /\(\s*(\d+(?:\.\d+)?)\s*Marks?\s*\)\s*$/i; 
const marksAnywhereRe = /\(\s*(\d+(?:\.\d+)?)\s*Marks?\s*\)/gi; 
const questionNumericRe = /^\s*(?:Q(?:uestion)?\s*No\.?\s*)?(\d+)\s*[\.)]?\s*(.*)$/i;

export function parsePaper(rawText: string): Paper {
	const lines = splitIntoLogicalLines(rawText);
	const questions: Question[] = [];

	let currentQuestion: Question | null = null;
	let currentPart: Part | null = null;

	function flushPart() {

	}
	function flushQuestion() {
		
	}

	for (const line of lines) {
		if (!line.trim()) continue;

		const qMatch = line.match(questionLabelRe) || undefined;
		if (qMatch) {
			flushPart();
			flushQuestion();
			const [, qLabelRaw, rest] = qMatch;
			const label = normalizeQuestionLabel(qLabelRaw);
			const { text, marks } = extractMarks(rest);
			currentQuestion = {
				id: cryptoRandomId(),
				label,
				text: text || undefined,
				marks,
				parts: [],
				rubrics: [],
			};
			questions.push(currentQuestion);
			currentPart = null;
			continue;
		}

		const qNum = line.match(questionNumericRe);
		if (qNum) {
			flushPart();
			flushQuestion();
			const [, num, rest] = qNum;
			const label = normalizeQuestionLabel(num);
			const { text, marks } = extractMarks(rest);
			currentQuestion = {
				id: cryptoRandomId(),
				label,
				text: text || undefined,
				marks,
				parts: [],
				rubrics: [],
			};
			questions.push(currentQuestion);
			currentPart = null;
			continue;
		}

		const sMatchNoParens = line.match(subpartLabelNoParensRe);
		if (sMatchNoParens && currentQuestion) {
			const [, roman, rest] = sMatchNoParens;
			const { text, marks } = extractMarks(rest);
			
			if (!currentPart) {


				currentPart = {
					id: cryptoRandomId(),
					label: 'a)',
					subParts: [],
					rubrics: [],
				};
				currentQuestion.parts.push(currentPart);
			}
			
			// increment like i++
			const nextLabel = getNextSubPartLabel(currentPart.subParts);
			const sub: SubPart = {
				id: cryptoRandomId(),
				label: nextLabel,
				text: text.trim(),
				marks,
				rubrics: [],
			};
			currentPart.subParts.push(sub);
			continue;
		}

		const pMatch = line.match(partLabelRe);
		if (pMatch && currentQuestion) {
			const segments = splitSubPartsOnSameLine(line);
			for (const seg of segments) {
				const m = seg.match(partLabelRe);
				if (m) {
					const [, letter, rest] = m;
					if (letter.length === 1 && /^[a-z]$/i.test(letter) && !/^[ivxlcdm]+$/i.test(letter)) {
						const { text, marks } = extractMarks(rest);
						currentPart = {
							id: cryptoRandomId(),
							label: `${letter.toLowerCase()})`,
							text: text || undefined,
							marks,
							subParts: [],
							rubrics: [],
						};
						currentQuestion.parts.push(currentPart);
						continue;
					}
				}
				if (currentPart) {
					currentPart.text = (currentPart.text ? `${currentPart.text} ` : '') + seg.trim();
				}
			}
			continue;
		}

		const sMatch = line.match(subpartLabelRe) || line.match(subpartLabelReLoose);
		if (sMatch && currentQuestion) {
			const [, roman, rest] = sMatch;
			const { text, marks } = extractMarks(rest);
			
			if (!currentPart) {
	
				currentPart = {
					id: cryptoRandomId(),
					label: 'a)',
					subParts: [],
					rubrics: [],
				};
				currentQuestion.parts.push(currentPart);
			}
			

			const nextLabel = getNextSubPartLabel(currentPart.subParts);
			const sub: SubPart = {
				id: cryptoRandomId(),
				label: nextLabel,
				text: text.trim(),
				marks,
				rubrics: [],
			};
			currentPart.subParts.push(sub);
			continue;
		}

		// for marks like (1.5 Marks)
		const onlyMarks = line.match(/^\s*\((\d+(?:\.\d+)?)\s*Marks?\)\s*$/i);
		if (onlyMarks) {
			const marks = Number(onlyMarks[1]);
			if (currentPart && currentPart.subParts.length > 0) {
				const last = currentPart.subParts[currentPart.subParts.length - 1];
				if (last && (last.marks === null || last.marks === undefined)) {
					last.marks = marks;
					continue;
				}
			}
			if (currentPart && (currentPart.marks === null || currentPart.marks === undefined)) {
				currentPart.marks = marks;
				continue;
			}
			if (currentQuestion && (currentQuestion.marks === null || currentQuestion.marks === undefined)) {
				currentQuestion.marks = marks;
				continue;
			}
		}

		// Handle inline part markers even when there are no sub-parts
		if (/[a-z]\)/i.test(line) && currentQuestion) {
			const segments = splitSubPartsOnSameLine(line);
			for (const seg of segments) {
				const pSeg = seg.match(partLabelRe);
				if (pSeg) {
					const [, letter, rest] = pSeg;
					if (letter.length === 1 && /^[a-z]$/i.test(letter) && !/^[ivxlcdm]+$/i.test(letter)) {
						const { text, marks } = extractMarks(rest);
						currentPart = {
							id: cryptoRandomId(),
							label: `${letter.toLowerCase()})`,
							text: text || undefined,
							marks,
							subParts: [],
							rubrics: [],
						};
						currentQuestion.parts.push(currentPart);
						continue;
					}
				}
				// Non-part segment: append to current part text if exists
				if (currentPart) {
					currentPart.text = (currentPart.text ? `${currentPart.text} ` : '') + seg.trim();
				}
			}
			continue;
		}


		// Check if line contains subparts
		    const hasSubParts = /\(\s*[ivxlcdm]+\s*\)/gi.test(line);
		if (hasSubParts && currentQuestion) {
			// Split the line into subparts
			const subPartLines = splitSubPartsOnSameLine(line);
			for (const subLine of subPartLines) {
				const pMatchSeg = subLine.match(partLabelRe);
				if (pMatchSeg && currentQuestion) {
					const [, letter, rest] = pMatchSeg;
					if (letter.length === 1 && /^[a-z]$/i.test(letter) && !/^[ivxlcdm]+$/i.test(letter)) {
						const { text, marks } = extractMarks(rest);
						currentPart = {
							id: cryptoRandomId(),
							label: `${letter.toLowerCase()})`,
							text: text || undefined,
							marks,
							subParts: [],
							rubrics: [],
						};
						currentQuestion.parts.push(currentPart);
						continue;
					}
				}
				const sMatch = subLine.match(subpartLabelRe) || subLine.match(subpartLabelReLoose);
				if (sMatch) {
					const [, roman, rest] = sMatch;
					const { text, marks } = extractMarks(rest);
					if (!currentPart) {
						currentPart = {
							id: cryptoRandomId(),
							label: 'a)',
							subParts: [],
							rubrics: [],
						};
						currentQuestion.parts.push(currentPart);
					}
					const nextLabel = getNextSubPartLabel(currentPart.subParts);
					const sub: SubPart = {
						id: cryptoRandomId(),
						label: nextLabel,
						text: text.trim(),
						marks,
						rubrics: [],
					};
					currentPart.subParts.push(sub);
				}
			}
			continue;
		}

		    const looksLikeSubParts = /\(\s*[ivxlcdm]+\s*\)/gi.test(line);
		if (looksLikeSubParts && currentQuestion) {
			// Split the line into sub-parts
			const subPartLines = splitSubPartsOnSameLine(line);
			for (const subLine of subPartLines) {
				const sMatch = subLine.match(subpartLabelRe) || subLine.match(subpartLabelReLoose);
				if (sMatch) {
					const [, roman, rest] = sMatch;
					const { text, marks } = extractMarks(rest);
					
					if (!currentPart) {
						currentPart = {
							id: cryptoRandomId(),
							label: 'a)',
							subParts: [],
							rubrics: [],
						};
						currentQuestion.parts.push(currentPart);
					}
					
					const nextLabel = getNextSubPartLabel(currentPart.subParts);
					const sub: SubPart = {
						id: cryptoRandomId(),
						label: nextLabel,
						text: text.trim(),
						marks,
						rubrics: [],
					};
					currentPart.subParts.push(sub);
				}
			}
			continue;
		}

		if (currentPart && currentPart.subParts.length > 0) {
			const last = currentPart.subParts[currentPart.subParts.length - 1] as SubPart | undefined;
			if (last) {
				last.text = (last.text ? `${last.text} ` : '') + line.trim();
			}
			continue;
		}
		if (currentPart) {
			currentPart.text = (currentPart.text ? `${currentPart.text} ` : '') + line.trim();
			continue;
		}
		if (currentQuestion) {
			currentQuestion.text = (currentQuestion.text ? `${currentQuestion.text} ` : '') + line.trim();
			continue;
		}
	}

	return { rawText, questions };
}

function extractMarks(input: string): { text: string; marks: number | null } {
	if (!input) return { text: '', marks: null };
	
	// Find all marks in the text
	const marksMatches = [...input.matchAll(marksAnywhereRe)];
	if (marksMatches.length === 0) {
		return { text: input.trim(), marks: null };
	}
	
	// rightmost marks value
	const lastMatch = marksMatches[marksMatches.length - 1];
	const marks = Number(lastMatch[1]);
	
	// Remove all marks from the text
	const text = input.replace(marksAnywhereRe, '').trim();
	
	return { text, marks };
}

function normalizeQuestionLabel(raw: string): string {
	const numMatch = raw.match(/\d+/);
	const num = numMatch ? numMatch[0] : raw;
	return `Q${num}`;
}

function splitIntoLogicalLines(text: string): string[] {
	const primary = text.split(/\n+/);
	const out: string[] = [];
	for (const line of primary) {
		const subPartSplit = splitSubPartsOnSameLine(line);
		for (const subLine of subPartSplit) {
			const parts = subLine
				.replace(/(?=\bQ\s*[\.-–—]?\s*\d+)/gi, '\n')
				.replace(/\s+([a-z]\))/gi, '\n$1')
				.replace(/(?=\b[a-z]\))/gi, '\n')
				.replace(/((?:Q(?:uestion)?)\s*[\.-–—]?\s*\d+)\s*\.?\s*/gi, '\n$1 ')
				.replace(/(\(\s*[ivxlcdm]+\s*\)\s+)/gi, '\n$1') 
				.replace(/([ivxlcdm]+\)\s+)/gi, '\n$1') 
				.replace(/([a-z]\)\s+)/gi, '\n$1') 
				.split(/\n/)
				.map((s) => s.trim())
				.filter(Boolean);
			out.push(...parts);
		}
	}
	return out;
}

function splitSubPartsOnSameLine(line: string): string[] {
	const subPartMatchesWithParens = [...line.matchAll(/\(\s*[ivxlcdm]+\s*\)/gi)].map(m => ({ index: m.index!, type: 'sub' as const }));
	const subPartMatchesNoParens = [...line.matchAll(/[ivxlcdm]+\)/gi)].map(m => ({ index: m.index!, type: 'sub' as const }));
	const partMatches = [...line.matchAll(/[a-z]\)/gi)].map(m => ({ index: m.index!, type: 'part' as const }));

	const allMatches = [...subPartMatchesWithParens, ...subPartMatchesNoParens, ...partMatches]
		.sort((a, b) => a.index - b.index);

	if (allMatches.length <= 1) {
		return [line];
	}

	const result: string[] = [];

	for (let i = 0; i < allMatches.length; i++) {
		const start = allMatches[i].index;
		const next = allMatches[i + 1]?.index ?? line.length;
		const segment = line.substring(start, next).trim();
		result.push(segment);
	}

	const firstMatch = allMatches[0];
	if (firstMatch && firstMatch.index > 0) {
		const beforeText = line.substring(0, firstMatch.index).trim();
		if (beforeText) {
			result.unshift(beforeText);
		}
	}

	return result;
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

function cryptoRandomId(): string {
	return Math.random().toString(36).slice(2, 10);
}
