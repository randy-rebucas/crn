import { QuestionType } from '@prisma/client';

export interface QuestionOptionInput {
  id: string;
  text: string;
}

// Checks that an answer key has the shape grading.ts expects for its type, so
// a malformed key (a multiple-choice answer pointing at no option, a NaN
// numerical answer serialized as null) is refused at write time instead of
// silently marking every student wrong. Returns an error message, or null.
export function answerKeyProblem(
  type: QuestionType,
  options: QuestionOptionInput[] | undefined,
  correctAnswer: unknown,
): string | null {
  const isChoice = type === QuestionType.MULTIPLE_CHOICE || type === QuestionType.MULTIPLE_RESPONSE;

  if (isChoice) {
    if (!Array.isArray(options) || options.length < 2) return 'Choice questions need at least two options';
    const ids = new Set<string>();
    for (const o of options) {
      if (!o || typeof o.id !== 'string' || typeof o.text !== 'string' || o.text.trim() === '') {
        return 'Every option needs an id and non-empty text';
      }
      if (ids.has(o.id)) return 'Option ids must be unique';
      ids.add(o.id);
    }
    if (type === QuestionType.MULTIPLE_CHOICE) {
      return typeof correctAnswer === 'string' && ids.has(correctAnswer)
        ? null
        : 'The correct answer must be one of the options';
    }
    if (!Array.isArray(correctAnswer) || correctAnswer.length === 0) return 'Mark at least one option as correct';
    if (!correctAnswer.every((a) => typeof a === 'string' && ids.has(a))) {
      return 'Every correct answer must be one of the options';
    }
    if (new Set(correctAnswer).size !== correctAnswer.length) return 'Correct answers must not repeat';
    return null;
  }

  switch (type) {
    case QuestionType.TRUE_FALSE:
      return typeof correctAnswer === 'boolean' ? null : 'The correct answer must be true or false';
    case QuestionType.NUMERICAL:
      return typeof correctAnswer === 'number' && Number.isFinite(correctAnswer)
        ? null
        : 'The correct answer must be a number';
    case QuestionType.IDENTIFICATION:
      return typeof correctAnswer === 'string' && correctAnswer.trim() !== ''
        ? null
        : 'Enter the correct answer';
    case QuestionType.ESSAY:
    case QuestionType.IMAGE_BASED:
      // Graded by hand; the key is an optional model answer or rubric.
      return correctAnswer === null || typeof correctAnswer === 'string' ? null : 'The model answer must be text';
    default:
      return null;
  }
}
