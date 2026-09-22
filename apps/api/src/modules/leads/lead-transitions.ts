import { LeadStatus } from '@prisma/client';

// CRM pipeline (blueprint Section 23): Lead -> Inquiry -> Application ->
// Applicant -> Enrolled, with Lost reachable from any open stage.
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  LEAD: [LeadStatus.INQUIRY, LeadStatus.LOST],
  INQUIRY: [LeadStatus.APPLICATION, LeadStatus.LOST],
  APPLICATION: [LeadStatus.APPLICANT, LeadStatus.LOST],
  APPLICANT: [LeadStatus.ENROLLED, LeadStatus.LOST],
  ENROLLED: [],
  LOST: [],
};
