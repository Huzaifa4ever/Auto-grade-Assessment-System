import * as pdfjs from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.mjs';

export async function extractPdfText(file: File): Promise<string> {
	const arrayBuffer = await file.arrayBuffer();
	const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
	const pdf = await loadingTask.promise;
	let text = '';
	for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
		const page = await pdf.getPage(pageNum);
		const content = await page.getTextContent();
		const strings = content.items
			.map((it: any) => ('str' in it ? (it as any).str : ''))
			.filter(Boolean);
		text += strings.join(' ') + '\n';
	}
	return normalizeWhitespace(text);
}

function normalizeWhitespace(input: string): string {
	return input
		.replace(/\u00a0/g, ' ')
		.replace(/[\t ]+/g, ' ')
		.replace(/\s*\n\s*/g, '\n')
		.trim();
}
