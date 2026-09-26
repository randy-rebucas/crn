import type { IconName } from '../icons';

// Curated presentation for the four board programs. `match` finds the
// published program (by name) a card stands for; `lines` sets the card
// title's line breaks.
export interface BoardProgram {
  name: string;
  lines: string[];
  match: string;
  blurb: string;
  icon: IconName;
}

export const BOARD_PROGRAMS: BoardProgram[] = [
  { name: 'Nursing (NLE)', lines: ['Nursing', '(NLE)'], match: 'nursing', blurb: 'Comprehensive review program for future Registered Nurses.', icon: 'stethoscope' },
  { name: 'Midwifery', lines: ['Midwifery'], match: 'midwifery', blurb: 'Build a brighter future in midwifery.', icon: 'midwifery' },
  { name: 'Medical Technology', lines: ['Medical', 'Technology'], match: 'medical tech', blurb: 'Pass with confidence in Medical Technology.', icon: 'microscope' },
  { name: 'Physical Therapy', lines: ['Physical', 'Therapy'], match: 'physical therapy', blurb: 'Achieve your goals in allied health.', icon: 'therapy' },
];

// The curated entry for a published program name, if it is a board program.
export function boardProgramFor(name: string): BoardProgram | undefined {
  const lower = name.toLowerCase();
  return BOARD_PROGRAMS.find((b) => lower.includes(b.match));
}
