import type { Metadata } from 'next';
import { EnrollmentForm } from './enrollment-form';

export const metadata: Metadata = {
  title: 'Enroll / Apply Now',
  description: 'Submit an enrollment inquiry or contact OBIAS Review Center directly.',
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Enroll / Apply Now</h1>
      <p className="mt-2 max-w-xl text-slate-600">
        Tell us which program you&apos;re interested in and we&apos;ll get back to you, or reach
        us directly using the details below.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-brand-cream p-6">
          <EnrollmentForm />
        </div>

        <div className="text-sm text-slate-600">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Visit or Call Us</h2>
          <p className="mt-3">Jinyang Bldg. #1, Manila Doctors Access Road, Almanza Uno, Las Piñas City</p>
          <p className="mt-3">
            0917 165 4780
            <br />
            0939 126 2602
            <br />
            0951 562 4048
            <br />
            0923 812 2649
          </p>
          <p className="mt-3">centerofreviewfornursing@gmail.com</p>
          <p className="mt-3">Facebook: Obias Nursing &amp; Allied Courses Review Center</p>
        </div>
      </div>
    </div>
  );
}
