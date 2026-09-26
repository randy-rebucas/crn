import { QuestionType } from '@prisma/client';
import { answerKeyProblem } from './answer-key.js';

const options = [
  { id: 'opt-0', text: 'A' },
  { id: 'opt-1', text: 'B' },
];

describe('answerKeyProblem', () => {
  it('accepts a multiple-choice key that names an option', () => {
    expect(answerKeyProblem(QuestionType.MULTIPLE_CHOICE, options, 'opt-1')).toBeNull();
  });

  it('rejects a multiple-choice key pointing at no option', () => {
    expect(answerKeyProblem(QuestionType.MULTIPLE_CHOICE, options, 'opt-3')).toMatch(/one of the options/);
  });

  it('rejects blank option text', () => {
    expect(answerKeyProblem(QuestionType.MULTIPLE_CHOICE, [...options, { id: 'opt-2', text: ' ' }], 'opt-0')).toMatch(
      /non-empty text/,
    );
  });

  it('requires at least one valid multiple-response answer', () => {
    expect(answerKeyProblem(QuestionType.MULTIPLE_RESPONSE, options, [])).toMatch(/at least one/);
    expect(answerKeyProblem(QuestionType.MULTIPLE_RESPONSE, options, ['opt-0', 'nope'])).toMatch(/one of the options/);
    expect(answerKeyProblem(QuestionType.MULTIPLE_RESPONSE, options, ['opt-0', 'opt-1'])).toBeNull();
  });

  it('rejects a numerical key that is not a finite number', () => {
    expect(answerKeyProblem(QuestionType.NUMERICAL, undefined, null)).toMatch(/number/);
    expect(answerKeyProblem(QuestionType.NUMERICAL, undefined, '12')).toMatch(/number/);
    expect(answerKeyProblem(QuestionType.NUMERICAL, undefined, 12.5)).toBeNull();
  });

  it('requires a boolean for true/false', () => {
    expect(answerKeyProblem(QuestionType.TRUE_FALSE, undefined, 'true')).toMatch(/true or false/);
    expect(answerKeyProblem(QuestionType.TRUE_FALSE, undefined, false)).toBeNull();
  });

  it('allows an empty rubric for hand-graded types', () => {
    expect(answerKeyProblem(QuestionType.ESSAY, undefined, '')).toBeNull();
  });
});
