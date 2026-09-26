// Anonymous lead intake: the honeypot must never create a lead, and a lead
// must carry at least one way to reach the person.
import { BadRequestException } from '@nestjs/common';
import { PublicService } from './public.service.js';
import type { CreatePublicLeadDto } from './dto/create-public-lead.dto.js';

function makeService() {
  const prisma = { organization: { findFirst: vi.fn().mockResolvedValue({ id: 'org-1' }) } };
  const leads = { create: vi.fn().mockResolvedValue({ id: 'lead-1' }) };
  const service = new PublicService(prisma as never, leads as never, {} as never);
  return { service, leads };
}

describe('PublicService.createLead', () => {
  it('acknowledges a honeypot submission without creating a lead', async () => {
    const { service, leads } = makeService();
    const result = await service.createLead({ fullName: 'Bot', phone: '0917', website: 'http://spam' } as CreatePublicLeadDto);
    expect(result.received).toBe(true);
    expect(leads.create).not.toHaveBeenCalled();
  });

  it('rejects a lead with neither phone nor email', async () => {
    const { service, leads } = makeService();
    await expect(service.createLead({ fullName: 'Maria', phone: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(leads.create).not.toHaveBeenCalled();
  });

  it.each([{ phone: '0917 165 4780' }, { email: 'maria@example.com' }])('creates a lead with %o', async (contact) => {
    const { service, leads } = makeService();
    const result = await service.createLead({ fullName: 'Maria', ...contact });
    expect(result).toEqual({ id: 'lead-1', received: true });
    expect(leads.create).toHaveBeenCalledWith('org-1', undefined, expect.objectContaining({ source: 'Website', ...contact }));
  });
});
