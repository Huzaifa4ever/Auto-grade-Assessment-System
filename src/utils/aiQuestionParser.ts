import { Paper, Question, Part, SubPart } from '../types';

type GeminiStructure = {
  [key: string]: {
    question?: string;
    marks?: number;
    [key: string]: any;
  };
};

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function isRomanNumeral(str: string): boolean {
  return /^(i{1,3}|iv|v|vi{0,3}|ix|x)$/i.test(str);
}

function isPartLabel(str: string): boolean {
  return /^[a-z]$/i.test(str);
}

function isSubPartLabel(str: string): boolean {
  return isRomanNumeral(str);
}

export function convertGeminiStructureToPaper(
  geminiStructure: GeminiStructure,
  rawText: string
): Paper {
  const questions: Question[] = [];

  for (const [questionKey, questionData] of Object.entries(geminiStructure)) {
    const hasParts = Object.keys(questionData).some(key => isPartLabel(key));

    if (hasParts) {
      const parts: Part[] = [];

      for (const [partKey, partData] of Object.entries(questionData)) {
        if (isPartLabel(partKey)) {

          const hasSubParts = Object.keys(partData).some(key => isSubPartLabel(key));

          if (hasSubParts) {
            const subParts: SubPart[] = [];

            for (const [subPartKey, subPartData] of Object.entries(partData)) {
              if (isSubPartLabel(subPartKey) && typeof subPartData === 'object' && subPartData !== null && 'question' in subPartData) {
                const subPart: SubPart = {
                  id: cryptoRandomId(),
                  label: `(${subPartKey})`,
                  text: (subPartData as any).question || '',
                  marks: (subPartData as any).marks || null,
                  pages: null,
                  rubrics: [],
                };
                subParts.push(subPart);
              }
            }

            const part: Part = {
              id: cryptoRandomId(),
              label: `${partKey})`,
              text: '',
              marks: null,
              pages: null,
              subParts,
              rubrics: [],
            };
            parts.push(part);
          } else if (partData.question !== undefined) {
            const part: Part = {
              id: cryptoRandomId(),
              label: `${partKey})`,
              text: partData.question || '',
              marks: partData.marks || null,
              pages: null,
              subParts: [],
              rubrics: [],
            };
            parts.push(part);
          }
        }
      }

      const question: Question = {
        id: cryptoRandomId(),
        label: questionKey,
        text: questionData.question || '',
        marks: questionData.marks || null,
        pages: null,
        parts,
        rubrics: [],
      };
      questions.push(question);
    } else if (questionData.question !== undefined) {
      const question: Question = {
        id: cryptoRandomId(),
        label: questionKey,
        text: questionData.question || '',
        marks: questionData.marks || null,
        pages: null,
        parts: [],
        rubrics: [],
      };
      questions.push(question);
    }
  }

  return {
    rawText,
    questions,
  };
}

