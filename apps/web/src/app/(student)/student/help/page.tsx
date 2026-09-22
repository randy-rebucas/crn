import { Card } from '@/components/ui';
import { StudentShell, StudentPageHeader } from '@/components/student-ui';

const FAQS = [
  {
    q: 'I missed a scheduled class or exam — what do I do?',
    a: 'Reach out to your registrar or program coordinator directly; they can advise on makeup sessions or reschedules.',
  },
  {
    q: 'My enrollment status looks wrong.',
    a: 'Enrollment status is set by the registrar as your requirements and payments are verified. Contact your branch office if it looks stale.',
  },
  {
    q: 'I can’t see a course, lesson, or exam I expect to have access to.',
    a: 'Content only appears once it’s published for your program and you have an active enrollment for the current batch.',
  },
];

// Static help content — there's no support-ticketing or org-contact API yet,
// so this is guidance + FAQ only, not a live contact form.
export default function StudentHelpPage() {
  return (
    <StudentShell>
      <StudentPageHeader title="Help &amp; Support" description="Common questions and where to go for help." />

      <Card className="p-4">
        <p className="text-sm text-slate-600">
          For anything account-specific — enrollment, payments, schedules, or exam issues — contact your branch
          registrar or program coordinator. They can see your record and act on it directly.
        </p>
      </Card>

      <div className="mt-6 space-y-2">
        {FAQS.map((item) => (
          <Card key={item.q} className="p-4">
            <p className="text-sm font-medium text-slate-900">{item.q}</p>
            <p className="mt-1 text-sm text-slate-500">{item.a}</p>
          </Card>
        ))}
      </div>
    </StudentShell>
  );
}
