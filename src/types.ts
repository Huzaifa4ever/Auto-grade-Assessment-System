export type Rubric = {
	id: string;
	text: string;
};

export type SubPart = {
	id: string;
	label: string;
	text: string;
	marks?: number | null;
	rubrics: Rubric[];
};

export type Part = {
	id: string;
	label: string; 
	text?: string;
	marks?: number | null;
	subParts: SubPart[];
	rubrics: Rubric[];
};

export type Question = {
	id: string;
	label: string; 
	text?: string; 
	marks?: number | null;
	parts: Part[];
	rubrics: Rubric[];
};

export type Paper = {
	rawText: string;
	questions: Question[];
	name?: string;
	totalMarks?: number; 
};
