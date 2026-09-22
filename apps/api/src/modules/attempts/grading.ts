import { QuestionType } from '@prisma/client';

export interface GradeResult {
  needsManualGrading: boolean;
  isCorrect: boolean | null;
}

function arraysEqualAsSets(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}

// Auto-grades the objective question types; essay/image-based always fall
// through to manual grading (blueprint Section 15: auto + manual grading).
export function gradeResponse(
  type: QuestionType,
  correctAnswer: unknown,
  response: unknown,
): GradeResult {
  switch (type) {
    case QuestionType.MULTIPLE_CHOICE:
    case QuestionType.IDENTIFICATION: {
      if (typeof correctAnswer !== 'string' || typeof response !== 'string') {
        return { needsManualGrading: false, isCorrect: false };
      }
      return {
        needsManualGrading: false,
        isCorrect: correctAnswer.trim().toLowerCase() === response.trim().toLowerCase(),
      };
    }
    case QuestionType.MULTIPLE_RESPONSE:
      return { needsManualGrading: false, isCorrect: arraysEqualAsSets(correctAnswer, response) };
    case QuestionType.TRUE_FALSE:
      return { needsManualGrading: false, isCorrect: Boolean(correctAnswer) === Boolean(response) };
    case QuestionType.NUMERICAL: {
      const expected = Number(correctAnswer);
      const actual = Number(response);
      return { needsManualGrading: false, isCorrect: !Number.isNaN(actual) && expected === actual };
    }
    case QuestionType.ESSAY:
    case QuestionType.IMAGE_BASED:
      return { needsManualGrading: true, isCorrect: null };
    default:
      return { needsManualGrading: true, isCorrect: null };
  }
}
