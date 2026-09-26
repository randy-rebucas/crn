'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { GradingView } from '@/components/grading-view';
import { Button, Card, PageHeader } from '@/components/ui';
import { icons as baseIcons } from '@/components/student-ui';
import { adminIcons } from '@/components/admin-shell';
import { type Exam, useAllQuestions } from './exams-shared';
import { ExamsTab } from './exams-tab';
import { QuestionBankTab } from './question-bank-tab';

type Tab = 'exams' | 'questions' | 'grading';

const plusIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

function Tile({
  icon,
  tone,
  label,
  value,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
  detail: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`} aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 text-left">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        <p className="truncate text-xs text-slate-500">{detail}</p>
      </div>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-red-200 hover:bg-red-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
    >
      {body}
    </button>
  ) : (
    <Card className="flex items-center gap-4 p-5">{body}</Card>
  );
}

export default function ExamsPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>('exams');
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = hasPermission('exams.create');
  const canReview = hasPermission('exams.approve');

  const examsQuery = useQuery<Exam[]>({
    queryKey: ['exams'],
    queryFn: async () => (await apiClient.get('/v1/exams')).data,
  });
  const questionsQuery = useAllQuestions();

  const exams = examsQuery.data ?? [];
  const questions = questionsQuery.data ?? [];
  const published = exams.filter((e) => e.status === 'PUBLISHED').length;
  const drafts = exams.filter((e) => e.status !== 'PUBLISHED' && e.status !== 'ARCHIVED').length;
  const usable = questions.filter((q) => q.status === 'APPROVED' || q.status === 'PUBLISHED').length;
  const inReview = questions.filter((q) => q.status === 'REVIEW').length;
  const attempts = exams.reduce((s, e) => s + (e._count?.attempts ?? 0), 0);
  const loading = examsQuery.isLoading || questionsQuery.isLoading;

  const tabs: { key: Tab; label: string; icon: React.ReactNode; visible: boolean; badge?: number }[] = [
    { key: 'exams', label: 'Exams', icon: baseIcons.exams, visible: true },
    { key: 'questions', label: 'Question bank', icon: adminIcons.fileText, visible: true, badge: canReview ? inReview : undefined },
    { key: 'grading', label: 'Grading', icon: adminIcons.checkSquare, visible: hasPermission('exams.grade') },
  ];

  const createLabel = tab === 'exams' ? 'New exam' : tab === 'questions' ? 'New question' : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description="Write and review questions, assemble them into exams, and grade what students submit."
        action={
          canCreate &&
          createLabel && (
            <Button onClick={() => setCreateOpen(true)} className="inline-flex shrink-0 items-center gap-1.5">
              {plusIcon}
              {createLabel}
            </Button>
          )
        }
      />

      <section aria-label="Exam summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={baseIcons.exams}
          tone="bg-red-700 text-white"
          label="Exams"
          value={loading ? '…' : String(exams.length)}
          detail={`${published} published · ${drafts} draft${drafts === 1 ? '' : 's'}`}
          onClick={() => setTab('exams')}
        />
        <Tile
          icon={adminIcons.fileText}
          tone="bg-slate-900 text-white"
          label="Ready-to-use questions"
          value={loading ? '…' : String(usable)}
          detail={`of ${questions.length} in the bank`}
          onClick={() => setTab('questions')}
        />
        <Tile
          icon={adminIcons.clipboardCheck}
          tone={inReview > 0 ? 'bg-amber-400 text-slate-900' : 'bg-slate-200 text-slate-600'}
          label="Waiting for review"
          value={loading ? '…' : String(inReview)}
          detail={inReview > 0 ? (canReview ? 'Approve them to use on exams' : 'Pending an approver') : 'Nothing waiting'}
          onClick={() => setTab('questions')}
        />
        <Tile
          icon={adminIcons.users}
          tone="bg-amber-400 text-slate-900"
          label="Attempts taken"
          value={loading ? '…' : String(attempts)}
          detail="across all exams"
          onClick={hasPermission('exams.grade') ? () => setTab('grading') : undefined}
        />
      </section>

      <div>
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Exam sections">
          {tabs
            .filter((t) => t.visible)
            .map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(t.key);
                    setCreateOpen(false);
                  }}
                  className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-red-600 [&_svg]:h-4 [&_svg]:w-4 ${
                    active ? 'border-red-700 text-red-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.icon}
                  {t.label}
                  {t.badge ? (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800">{t.badge}</span>
                  ) : null}
                </button>
              );
            })}
        </div>

        <div role="tabpanel">
          {tab === 'exams' && <ExamsTab createOpen={createOpen} onCloseCreate={() => setCreateOpen(false)} />}
          {tab === 'questions' && <QuestionBankTab createOpen={createOpen} onCloseCreate={() => setCreateOpen(false)} />}
          {tab === 'grading' && hasPermission('exams.grade') && <GradingView />}
        </div>
      </div>
    </div>
  );
}
