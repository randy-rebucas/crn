import { QuestionType } from '@prisma/client';
import { gradeResponse } from './grading.js';

describe('gradeResponse', () => {
  it('grades multiple choice case-insensitively and trims whitespace', () => {
    expect(gradeResponse(QuestionType.MULTIPLE_CHOICE, 'b', ' B ')).toEqual({
      needsManualGrading: false,
      isCorrect: true,
    });
    expect(gradeResponse(QuestionType.MULTIPLE_CHOICE, 'b', 'a')).toEqual({
      needsManualGrading: false,
      isCorrect: false,
    });
  });

  it('grades identification the same way as multiple choice', () => {
    expect(gradeResponse(QuestionType.IDENTIFICATION, 'Mitochondria', 'mitochondria')).toEqual({
      needsManualGrading: false,
      isCorrect: true,
    });
  });

  it('grades multiple response as an unordered set comparison', () => {
    expect(gradeResponse(QuestionType.MULTIPLE_RESPONSE, ['a', 'c'], ['c', 'a'])).toEqual({
      needsManualGrading: false,
      isCorrect: true,
    });
    expect(gradeResponse(QuestionType.MULTIPLE_RESPONSE, ['a', 'c'], ['a'])).toEqual({
      needsManualGrading: false,
      isCorrect: false,
    });
    expect(gradeResponse(QuestionType.MULTIPLE_RESPONSE, ['a', 'c'], ['a', 'b'])).toEqual({
      needsManualGrading: false,
      isCorrect: false,
    });
  });

  it('grades true/false by boolean coercion', () => {
    expect(gradeResponse(QuestionType.TRUE_FALSE, true, true)).toEqual({
      needsManualGrading: false,
      isCorrect: true,
    });
    expect(gradeResponse(QuestionType.TRUE_FALSE, true, false)).toEqual({
      needsManualGrading: false,
      isCorrect: false,
    });
  });

  it('grades numerical by numeric equality, rejecting non-numeric responses', () => {
    expect(gradeResponse(QuestionType.NUMERICAL, 98.6, 98.6)).toEqual({
      needsManualGrading: false,
      isCorrect: true,
    });
    expect(gradeResponse(QuestionType.NUMERICAL, 98.6, 'not a number')).toEqual({
      needsManualGrading: false,
      isCorrect: false,
    });
  });

  it('routes essay and image-based questions to manual grading, never auto-scoring them', () => {
    expect(gradeResponse(QuestionType.ESSAY, 'rubric text', 'a student answer')).toEqual({
      needsManualGrading: true,
      isCorrect: null,
    });
    expect(gradeResponse(QuestionType.IMAGE_BASED, 'expected', 'response')).toEqual({
      needsManualGrading: true,
      isCorrect: null,
    });
  });
});
