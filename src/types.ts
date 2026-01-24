export type Rubric = {
	id: string;
	text: string;
};

export type SubPart = {
	id: string;
	label: string;
	text: string;
	marks?: number | null;
	pages?: number | null;
	rubrics: Rubric[];
};

export type Part = {
	id: string;
	label: string;
	text?: string;
	marks?: number | null;
	pages?: number | null;
	subParts: SubPart[];
	rubrics: Rubric[];
};

export type Question = {
	id: string;
	label: string;
	text?: string;
	marks?: number | null;
	pages?: number | null;
	parts: Part[];
	rubrics: Rubric[];
};

export type Paper = {
	rawText: string;
	questions: Question[];
	name?: string;
	totalMarks?: number;
	examDate?: string;
	allocatedTime?: string;
	className?: string;
	courseName?: string;
	courseCode?: string;
	instructor?: string;
	section?: string;
	studentTableId?: string;
};

export interface Course {
	_id?: string;
	courseCode: string;
	courseName: string;
	department: string;
	prefix?: string;
	level?: number;
	createdAt?: string;
	updatedAt?: string;
}
