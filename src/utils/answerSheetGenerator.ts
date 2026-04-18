import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Paper, Question, Part, SubPart } from '../types';
import { Student } from '../services/api';
import { formatDateToDDMMYYYY } from './dateFormatter';

interface AnswerSheetData {
	paper: Paper;
	student: Student;
	examDate: string;
	allocatedTime: string;
	className: string;
	courseName: string;
	courseCode: string;
	instructor: string;
	section: string;
}

interface QRCodeData {
	studentCmsId: string;
	studentName: string;
	section: string;
	courseCode: string;
	questionLabel?: string;
	partLabel?: string;
	subPartLabel?: string;
	pageNumber: number;
	totalPages: number;
}

function abbreviateCourseName(courseName: string): string {
	if (courseName.length <= 4) {
		return courseName.toUpperCase();
	}

	const words = courseName.trim().split(/\s+/);
	const abbreviation = words.map(word => word[0]).join('').toUpperCase();
	return abbreviation;
}

function generateQRData(data: QRCodeData): string {
	return JSON.stringify({
		cmsId: data.studentCmsId,
		n: data.studentName,
		s: data.section,
		c: data.courseCode,
		q: data.questionLabel || '',
		p: data.partLabel || '',
		sp: data.subPartLabel || '',
		pg: data.pageNumber,
		tp: data.totalPages,
	});
}

async function generateQRCodeImage(data: QRCodeData): Promise<string> {
	const qrData = generateQRData(data);
	return await QRCode.toDataURL(qrData, {
		width: 100,
		margin: 1,
		errorCorrectionLevel: 'M',
		color: {
			dark: '#000000',
			light: '#FFFFFF',
		},
	});
}

function addWatermark(doc: jsPDF) {
	try {
		const pageWidth = doc.internal.pageSize.getWidth();
		const pageHeight = doc.internal.pageSize.getHeight();

		doc.setGState(doc.GState({ opacity: 0.08 }));

		const logoWidth = 100;
		const logoHeight = 100;
		const logoX = (pageWidth - logoWidth) / 2;
		const logoY = (pageHeight - logoHeight) / 2;

		const logoPath = '/watermark-logo.png';
		doc.addImage(logoPath, 'PNG', logoX, logoY, logoWidth, logoHeight);

		doc.setGState(doc.GState({ opacity: 1 }));
	} catch (error) {
		doc.setGState(doc.GState({ opacity: 0.06 }));
		doc.setTextColor(200, 200, 200);
		doc.setFontSize(50);
		doc.text('UNIVERSITY', doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() / 2, {
			angle: 45,
			align: 'center',
		});
		doc.setGState(doc.GState({ opacity: 1 }));
		doc.setTextColor(0, 0, 0);
	}
}

function addRuledLines(doc: jsPDF, x: number, y: number, width: number, height: number, lineSpacing: number = 8) {
	doc.setDrawColor(0, 0, 0);
	doc.setLineWidth(0.2);

	const numLines = Math.floor(height / lineSpacing);
	for (let i = 0; i <= numLines; i++) {
		const lineY = y + (i * lineSpacing);
		if (lineY <= y + height) {
			doc.line(x, lineY, x + width, lineY);
		}
	}
	doc.setDrawColor(0, 0, 0);
}

function addCornerMarkers(doc: jsPDF, x: number, y: number, width: number, height: number) {
	const markerSize = 5;

	doc.setFillColor(0, 0, 0);

	doc.rect(x - markerSize, y - markerSize, markerSize, markerSize, 'F');
	doc.rect(x + width, y - markerSize, markerSize, markerSize, 'F');
	doc.rect(x - markerSize, y + height, markerSize, markerSize, 'F');
	doc.rect(x + width, y + height, markerSize, markerSize, 'F');
}

function addDoAndDonts(doc: jsPDF, y: number): number {
	const pageWidth = doc.internal.pageSize.getWidth();
	const margin = 20;
	let currentY = y;

	doc.setFontSize(12);
	doc.setFont('helvetica', 'bold');
	doc.text('Instructions:', margin, currentY);
	currentY += 8;

	doc.setFontSize(10);
	doc.setFont('helvetica', 'normal');

	const doItems = [
		'✓ Write clearly and legibly',
		'✓ Use black or blue ink only',
		'✓ Answer all questions in the provided space',
		'✓ Write your CMS ID on every page',
	];
	const dontItems = [
		'✗ Do not write outside the answer boxes',
		'✗ Do not use red ink or pencil',
		'✗ Do not write your name anywhere except the cover page',
		'✗ Do not tear or damage the answer sheet',
	];

	currentY += 4;
	doc.setFont('helvetica', 'bold');
	doc.text('DO:', margin, currentY);
	currentY += 6;

	doc.setFont('helvetica', 'normal');
	doItems.forEach((item) => {
		doc.text(item, margin + 5, currentY);
		currentY += 6;
	});

	currentY += 4;
	doc.setFont('helvetica', 'bold');
	doc.text('DON\'T:', margin, currentY);
	currentY += 6;

	doc.setFont('helvetica', 'normal');
	dontItems.forEach((item) => {
		doc.text(item, margin + 5, currentY);
		currentY += 6;
	});

	return currentY;
}


async function addCoverPage(doc: jsPDF, data: AnswerSheetData, totalPages: number): Promise<void> {
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const margin = 20;

	try {
		const logoPath = '/watermark-logo.png';
		doc.addImage(logoPath, 'PNG', margin, 10, 30, 30);
	} catch (error) {
		console.log('Logo not found, skipping cover page logo');
	}

	let yPos = 27;

	doc.setFontSize(28);
	doc.setFont('time new roman', 'bold');
	doc.text('SUKKUR IBA UNIVERSITY ', (pageWidth / 2) + 15, yPos, { align: 'center' });
	yPos += 10;

	const qrData: QRCodeData = {
		studentCmsId: data.student.cmsId,
		studentName: data.student.name,
		courseCode: data.courseCode || '',
		section: data.section,
		pageNumber: 0,
		totalPages: totalPages,
	};

	const qrImage = await generateQRCodeImage(qrData);
	doc.addImage(qrImage, 'PNG', pageWidth - 70, 40, 40, 40);

	yPos = 60;
	doc.setFontSize(12);
	doc.setFont('helvetica', 'bold');
	doc.text('Mid Term Examination', margin, yPos);
	yPos += 8;
	doc.text('Final Examination', margin, yPos);

	yPos += 15;
	doc.setFontSize(11);
	doc.setFont('helvetica', 'bold');
	doc.text('FALL/SPRING/FOUNDATION/SUMMER SEMESTER 2026', margin, yPos);

	yPos += 12;
	doc.setFontSize(11);
	doc.setFont('helvetica', 'bold');
	doc.text(`Exam Date: ${formatDateToDDMMYYYY(data.examDate)}`, margin, yPos);
	yPos += 9;
	doc.text(`Student Name: ${data.student.name}`, margin, yPos);
	yPos += 9;
	doc.text(`CMD-ID: ${data.student.cmsId}`, margin, yPos);
	yPos += 9;
	doc.text(`Class: ${data.className}`, margin, yPos);
	yPos += 9;
	doc.text(`Section: ${data.section}`, margin, yPos);
	yPos += 9;
	doc.text(`Course: ${data.courseName}`, margin, yPos);
	yPos += 9;
	doc.text(`Instructor: ${data.instructor}`, margin, yPos);


	yPos += 20;
	doc.setFontSize(13);
	doc.setFont('helvetica', 'bold');
	doc.text('(PLEASE READ THESE INSTRUCTIONS CAREFULLY)', margin, yPos);

	yPos += 15;
	doc.setFontSize(12);
	doc.setFont('helvetica', 'bold');
	doc.text('DOs', margin, yPos);
	yPos += 10;

	doc.setFontSize(10);
	doc.setFont('helvetica', 'bold');
	const doItems = [
		'Write clearly using blue or black ink.',
		'Write your answer only in the space provided.',
		'Bring your valid student ID and Admit Card.',
		'Read each question carefully.',
		'Write neatly inside the given lines.',
	];
	doItems.forEach((item) => {
		doc.text(`• ${item}`, margin + 5, yPos);
		yPos += 7;
	});

	yPos += 5;
	doc.setFontSize(12);
	doc.setFont('helvetica', 'bold');
	doc.text("Don'ts", margin, yPos);
	yPos += 10;

	doc.setFontSize(10);
	doc.setFont('helvetica', 'bold');
	const dontItems = [
		'Do not write on the QR codes.',
		"Don't talk, share materials or look at other's work.",
		"Don't remove or damage any paper.",
		"Don't leave the hall without submitting your answer sheet.",
	];
	dontItems.forEach((item) => {
		doc.text(`• ${item}`, margin + 5, yPos);
		yPos += 7;
	});

	const signatureY = pageHeight - 20;
	const signatureX = pageWidth - 80;
	doc.setDrawColor(0, 0, 0);
	doc.setLineWidth(0.5);
	doc.line(signatureX - 10, signatureY, signatureX + 50, signatureY);
	doc.setFontSize(10);
	doc.setFont('helvetica', 'bold');
	doc.text('Student Signature', signatureX + 8, signatureY + 6);
}


function calculateTotalPages(paper: Paper): number {
	let total = 0;
	for (const question of paper.questions) {
		const hasParts = question.parts && question.parts.length > 0;
		const qPages = question.pages || (question.text && question.text.trim().length > 5 && !hasParts ? 1 : 0);
		total += qPages || 0;

		for (const part of question.parts) {
			const pPages = part.pages || (part.text && part.text.trim().length > 5 ? 1 : 0);
			total += pPages;

			for (const subPart of part.subParts) {
				const spPages = subPart.pages || (subPart.text && subPart.text.trim().length > 5 ? 1 : 0);
				total += spPages;
			}
		}
	}
	return total;
}

async function addQuestionPages(
	doc: jsPDF,
	data: AnswerSheetData,
	startPageNumber: number
): Promise<number> {
	let currentPage = startPageNumber;
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const margin = 20;
	const questionPages = calculateTotalPages(data.paper);
	const totalPages = questionPages;

	for (const question of data.paper.questions) {
		const hasParts = question.parts && question.parts.length > 0;
		const questionPages = question.pages || (question.text && question.text.trim().length > 5 && !hasParts ? 1 : 0) || 0;

		if (questionPages > 0) {
			doc.addPage();
			const qrData: QRCodeData = {
				studentCmsId: data.student.cmsId,
				studentName: data.student.name,
				courseCode: data.courseCode || '',
				section: data.section,
				questionLabel: question.label,
				pageNumber: currentPage,
				totalPages,
			};
			const qrImage = await generateQRCodeImage(qrData);
			doc.addImage(qrImage, 'PNG', pageWidth - 44, 7, 25, 25);

			addWatermark(doc);

			const questionMarks = question.marks ? ` (${question.marks} Marks)` : '';
			if (question.text) {
				doc.setFontSize(11);
				doc.setFont('helvetica', 'bold');
				doc.text(`${question.label}: ${question.text}${questionMarks}`, margin, 15, {
					maxWidth: pageWidth - 2 * margin - 50,
				});
			} else {
				doc.setFontSize(11);
				doc.setFont('helvetica', 'bold');
				doc.text(`${question.label}:${questionMarks}`, margin, 15);
			}

			let yPos = 25;
			if (question.text) {
				const textLines = doc.splitTextToSize((question.text + questionMarks) || '', pageWidth - 2 * margin - 50);
				yPos += textLines.length * 5;
			}
			yPos = Math.max(yPos, 40);

			doc.setDrawColor(0, 0, 0);
			doc.setLineWidth(0.5);
			const answerHeight = pageHeight - yPos - 30;
			doc.rect(margin, yPos, pageWidth - 2 * margin, answerHeight);

			addCornerMarkers(doc, margin, yPos, pageWidth - 2 * margin, answerHeight);

			addRuledLines(doc, margin, yPos, pageWidth - 2 * margin, answerHeight, 10);

			doc.setFontSize(9);
			doc.setFont('helvetica', 'normal');
			doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth / 2, pageHeight - 10, {
				align: 'center',
			});

			currentPage++;

			for (let i = 1; i < questionPages; i++) {
				doc.addPage();
				const qrDataMulti: QRCodeData = {
					studentCmsId: data.student.cmsId,
					studentName: data.student.name,
					courseCode: data.courseCode || '',
					section: data.section,
					questionLabel: question.label,
					pageNumber: currentPage,
					totalPages,
				};
				const qrImageMulti = await generateQRCodeImage(qrDataMulti);
				doc.addImage(qrImageMulti, 'PNG', pageWidth - 44, 7, 25, 25);

				addWatermark(doc);

				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.text(`Continuation of ${question.label}`, margin, 15);

				let yPosCont = 40;
				doc.setDrawColor(0, 0, 0);
				doc.setLineWidth(0.5);
				const contHeight = pageHeight - yPosCont - 20;
				doc.rect(margin, yPosCont, pageWidth - 2 * margin, contHeight);
				addCornerMarkers(doc, margin, yPosCont, pageWidth - 2 * margin, contHeight);
				addRuledLines(doc, margin, yPosCont, pageWidth - 2 * margin, contHeight, 10);

				doc.setFontSize(9);
				doc.setFont('helvetica', 'normal');
				doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth / 2, pageHeight - 10, {
					align: 'center',
				});

				currentPage++;
			}
		}

		for (const part of question.parts) {
			const partPages = part.pages || (part.text && part.text.trim().length > 5 ? 1 : 0);

			if (partPages > 0) {
				doc.addPage();

				const qrDataPart: QRCodeData = {
					studentCmsId: data.student.cmsId,
					studentName: data.student.name,
					courseCode: data.courseCode || '',
					section: data.section,
					questionLabel: question.label,
					partLabel: part.label,
					pageNumber: currentPage,
					totalPages,
				};
				const qrImagePart = await generateQRCodeImage(qrDataPart);
				doc.addImage(qrImagePart, 'PNG', pageWidth - 44, 7, 25, 25);

				addWatermark(doc);

				const partMarks = part.marks ? ` (${part.marks} Marks)` : '';
				if (part.text) {
					doc.setFontSize(11);
					doc.setFont('helvetica', 'bold');
					doc.text(`${question.label} ${part.label}: ${part.text}${partMarks}`, margin, 15, {
						maxWidth: pageWidth - 2 * margin - 50,
					});
				} else {
					doc.setFontSize(11);
					doc.setFont('helvetica', 'bold');
					doc.text(`${question.label} ${part.label}:${partMarks}`, margin, 15);
				}

				let yPosPart = 40;
				if (part.text) {
					const textLines = doc.splitTextToSize((part.text + partMarks) || '', pageWidth - 2 * margin - 50);
					yPosPart += textLines.length * 5;
				}
				yPosPart = Math.max(yPosPart, 40);

				doc.setDrawColor(0, 0, 0);
				doc.setLineWidth(0.5);
				const partHeight = pageHeight - yPosPart - 20;
				doc.rect(margin, yPosPart, pageWidth - 2 * margin, partHeight);

				addCornerMarkers(doc, margin, yPosPart, pageWidth - 2 * margin, partHeight);

				addRuledLines(doc, margin, yPosPart, pageWidth - 2 * margin, partHeight, 10);

				doc.setFontSize(9);
				doc.setFont('helvetica', 'normal');
				doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth / 2, pageHeight - 10, {
					align: 'center',
				});

				currentPage++;

				for (let i = 1; i < partPages; i++) {
					doc.addPage();
					const qrDataPartMulti: QRCodeData = {
						studentCmsId: data.student.cmsId,
						studentName: data.student.name,
						courseCode: data.courseCode || '',
						section: data.section,
						questionLabel: question.label,
						partLabel: part.label,
						pageNumber: currentPage,
						totalPages,
					};
					const qrImagePartMulti = await generateQRCodeImage(qrDataPartMulti);
					doc.addImage(qrImagePartMulti, 'PNG', pageWidth - 44, 7, 25, 25);

					addWatermark(doc);
					doc.setFontSize(10);
					doc.setFont('helvetica', 'bold');
					doc.text(`Continuation of ${question.label} ${part.label}`, margin, 15);

					let yPosPartCont = 40;
					doc.setDrawColor(0, 0, 0);
					doc.setLineWidth(0.5);
					const partContHeight = pageHeight - yPosPartCont - 20;
					doc.rect(margin, yPosPartCont, pageWidth - 2 * margin, partContHeight);

					addCornerMarkers(doc, margin, yPosPartCont, pageWidth - 2 * margin, partContHeight);

					addRuledLines(doc, margin, yPosPartCont, pageWidth - 2 * margin, partContHeight, 10);

					doc.setFontSize(9);
					doc.setFont('helvetica', 'normal');
					doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth / 2, pageHeight - 10, {
						align: 'center',
					});

					currentPage++;
				}
			}

			for (const subPart of part.subParts) {
				const subPartPages = subPart.pages || (subPart.text && subPart.text.trim().length > 5 ? 1 : 0);
				if (subPartPages === 0) continue;

				doc.addPage();

				const qrDataSubPart: QRCodeData = {
					studentCmsId: data.student.cmsId,
					studentName: data.student.name,
					courseCode: data.courseCode || '',
					section: data.section,
					questionLabel: question.label,
					partLabel: part.label,
					subPartLabel: subPart.label,
					pageNumber: currentPage,
					totalPages,
				};
				const qrImageSubPart = await generateQRCodeImage(qrDataSubPart);
				doc.addImage(qrImageSubPart, 'PNG', pageWidth - 44, 7, 25, 25);

				addWatermark(doc);

				const subPartMarks = subPart.marks ? ` (${subPart.marks} Marks)` : '';
				if (subPart.text) {
					doc.setFontSize(10);
					doc.setFont('helvetica', 'bold');
					doc.text(
						`${question.label} ${part.label} ${subPart.label}: ${subPart.text}${subPartMarks}`,
						margin,
						15,
						{
							maxWidth: pageWidth - 2 * margin - 50,
						}
					);
				} else {
					doc.setFontSize(10);
					doc.setFont('helvetica', 'bold');
					doc.text(`${question.label} ${part.label} ${subPart.label}:${subPartMarks}`, margin, 15);
				}

				let yPosSubPart = 40;
				if (subPart.text) {
					const textLines = doc.splitTextToSize((subPart.text + subPartMarks) || '', pageWidth - 2 * margin - 50);
					yPosSubPart += textLines.length * 5;
				}
				yPosSubPart = Math.max(yPosSubPart, 40);

				doc.setDrawColor(0, 0, 0);
				doc.setLineWidth(0.5);
				const subPartHeight = pageHeight - yPosSubPart - 30;
				doc.rect(margin, yPosSubPart, pageWidth - 2 * margin, subPartHeight);

				addCornerMarkers(doc, margin, yPosSubPart, pageWidth - 2 * margin, subPartHeight);

				addRuledLines(doc, margin, yPosSubPart, pageWidth - 2 * margin, subPartHeight, 10);

				doc.setFontSize(9);
				doc.setFont('helvetica', 'normal');
				doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth / 2, pageHeight - 10, {
					align: 'center',
				});

				currentPage++;
			}
		}
	}

	return currentPage;
}

export async function generateAnswerSheet(data: AnswerSheetData): Promise<jsPDF> {
	const doc = new jsPDF({
		orientation: 'portrait',
		unit: 'mm',
		format: 'a4',
	});

	const totalPages = calculateTotalPages(data.paper);

	await addCoverPage(doc, data, totalPages);

	await addQuestionPages(doc, data, 1);

	const currentTotalPages = 1 + totalPages;

	if (currentTotalPages % 2 !== 0) {
		doc.addPage();
	}

	return doc;
}

export async function generateAllAnswerSheets(
	paper: Paper,
	students: Student[],
	examDate: string,
	allocatedTime: string,
	className: string,
	courseName: string,
	courseCode: string,
	instructor: string,
	section: string
): Promise<Uint8Array> {
	const { PDFDocument } = await import('pdf-lib');

	const mergedPdf = await PDFDocument.create();

	for (const student of students) {
		const studentSheet = await generateAnswerSheet({
			paper,
			student,
			examDate,
			allocatedTime,
			className,
			courseName,
			courseCode,
			instructor,
			section,
		});

		const pdfBytes = studentSheet.output('arraybuffer');

		const studentPdf = await PDFDocument.load(pdfBytes);

		const pages = await mergedPdf.copyPages(studentPdf, studentPdf.getPageIndices());
		pages.forEach((page) => mergedPdf.addPage(page));
	}

	return await mergedPdf.save();
}

