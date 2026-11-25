import React, { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink, FileText, Plus } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import type { DashboardStats, PageRoute } from '../types';
import { AssessmentBadge, VerdictBadge } from '../components/VerdictBadge';

interface OverviewPageProps {
  onNavigate: (page: PageRoute) => void;
  onOpenInvestigation: (articleId: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  onNavigate,
  onOpenInvestigation,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getDashboard()
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const chartData = stats
    ? [
        { name: 'Supported', count: stats.distribution['Supported'] ?? 0, color: '#1F6E4A' },
        { name: 'Contradicted', count: stats.distribution['Contradicted'] ?? 0, color: '#9E2A2B' },
        { name: 'Insufficient', count: stats.distribution['Insufficient Evidence'] ?? 0, color: '#9A6700' },
        { name: 'Conflicting', count: stats.distribution['Conflicting Evidence'] ?? 0, color: '#2F5D8A' },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Editorial Header */}
      <section className="border-b border-[var(--nv-border)] pb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="font-mono-meta text-[11px] uppercase tracking-widest text-[var(--nv-accent)] mb-1.5">
            Verification Desk
          </p>
          <h1 className="font-serif-editorial text-2xl sm:text-3xl font-bold tracking-tight text-[var(--nv-text)]">
            News Intelligence &amp; Verification
          </h1>
          <p className="text-sm text-[var(--nv-text-muted)] mt-1.5">
            Investigate claims. Examine evidence. Understand what is true.
          </p>
        </div>
        <button
          onClick={() => onNavigate('new-investigation')}
          className="inline-flex items-center gap-2 bg-[var(--nv-accent)] hover:bg-[var(--nv-accent-hover)] text-white text-sm font-medium px-4 py-2.5 rounded-sm transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Start New Investigation</span>
        </button>
      </section>

      {error && (
        <div className="border border-[var(--nv-contradicted)]/30 bg-[var(--nv-contradicted-bg)] text-[var(--nv-contradicted)] px-4 py-3 text-sm rounded-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-[var(--nv-surface)] border border-[var(--nv-border)] animate-pulse rounded-sm" />
            ))}
          </div>
          <div className="h-64 bg-[var(--nv-surface)] border border-[var(--nv-border)] animate-pulse rounded-sm" />
        </div>
      ) : !stats || stats.articles_analyzed === 0 ? (
        /* Empty State */
        <section className="bg-[var(--nv-surface)] border border-[var(--nv-border)] p-10 text-center rounded-sm">
          <div className="max-w-md mx-auto space-y-3">
            <FileText className="h-8 w-8 text-[var(--nv-accent)] mx-auto" />
            <h2 className="font-serif-editorial text-xl font-semibold">
              No completed investigations yet
            </h2>
            <p className="text-sm text-[var(--nv-text-muted)] leading-relaxed">
              Submit a news article via text, URL, or document upload to extract atomic factual propositions,
              retrieve external primary sources, and generate evidence-grounded verdicts.
            </p>
            <div className="pt-2">
              <button
                onClick={() => onNavigate('new-investigation')}
                className="inline-flex items-center gap-2 bg-[var(--nv-accent)] hover:bg-[var(--nv-accent-hover)] text-white text-sm font-medium px-4 py-2 rounded-sm transition-colors"
              >
                <span>Start New Investigation</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Key Metrics Strip */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border border-[var(--nv-border)] bg-[var(--nv-surface)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--nv-border)] rounded-sm">
            <div className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-[var(--nv-text-muted)]">Articles Analyzed</p>
              <p className="font-mono-meta text-2xl font-semibold mt-1">{stats.articles_analyzed}</p>
            </div>
            <div className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-[var(--nv-text-muted)]">Propositions</p>
              <p className="font-mono-meta text-2xl font-semibold mt-1">{stats.propositions_extracted}</p>
            </div>
            <div className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-[var(--nv-supported)]">Supported Claims</p>
              <p className="font-mono-meta text-2xl font-semibold mt-1 text-[var(--nv-supported)]">
                {stats.supported_claims}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-[var(--nv-contradicted)]">Contradicted Claims</p>
              <p className="font-mono-meta text-2xl font-semibold mt-1 text-[var(--nv-contradicted)]">
                {stats.contradicted_claims}
              </p>
            </div>
            <div className="p-4 col-span-2 sm:col-span-1">
              <p className="text-[11px] uppercase tracking-wider text-[var(--nv-insufficient)]">Needs Review</p>
              <p className="font-mono-meta text-2xl font-semibold mt-1 text-[var(--nv-insufficient)]">
                {stats.further_investigation_claims}
              </p>
            </div>
          </section>

          {/* Distribution Chart & Latest Activity */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-[var(--nv-surface)] border border-[var(--nv-border)] p-5 rounded-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--nv-text-muted)] mb-4">
                Verification Distribution
              </h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--nv-text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--nv-text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--nv-surface-alt)' }}
                      contentStyle={{
                        backgroundColor: 'var(--nv-surface)',
                        borderColor: 'var(--nv-border)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-7 bg-[var(--nv-surface)] border border-[var(--nv-border)] p-5 rounded-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--nv-text-muted)]">
                  Latest Verification Activity
                </h2>
                <button
                  onClick={() => onNavigate('history')}
                  className="text-xs text-[var(--nv-accent)] hover:underline"
                >
                  View all history
                </button>
              </div>
              <div className="divide-y divide-[var(--nv-border)]">
                {stats.latest_activity.slice(0, 5).map((act) => (
                  <div
                    key={act.id}
                    onClick={() => onOpenInvestigation(act.article_id)}
                    className="py-2.5 flex items-start justify-between gap-3 cursor-pointer hover:bg-[var(--nv-surface-alt)]/50 px-1.5 -mx-1.5 rounded-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-meta text-[11px] text-[var(--nv-text-muted)]">
                          {act.claim_code}
                        </span>
                        <span className="text-xs font-medium truncate text-[var(--nv-text)]">
                          {act.article_title}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--nv-text-muted)] line-clamp-1 mt-0.5">
                        {act.claim_text}
                      </p>
                    </div>
                    <VerdictBadge verdict={act.verdict} compact />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Recent Investigations & Recently Retrieved Sources */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-[var(--nv-surface)] border border-[var(--nv-border)] p-5 rounded-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--nv-text-muted)] mb-4">
                Recent Investigations
              </h2>
              <div className="divide-y divide-[var(--nv-border)]">
                {stats.recent_investigations.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => onOpenInvestigation(inv.id)}
                    className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-[var(--nv-surface-alt)]/50 px-1.5 -mx-1.5 rounded-sm"
                  >
                    <div className="min-w-0">
                      <h3 className="font-serif-editorial text-sm font-semibold text-[var(--nv-text)] truncate">
                        {inv.title}
                      </h3>
                      <p className="font-mono-meta text-[11px] text-[var(--nv-text-muted)] mt-0.5">
                        {inv.proposition_count} propositions · {new Date(inv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <AssessmentBadge assessment={inv.overall_assessment} />
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bg-[var(--nv-surface)] border border-[var(--nv-border)] p-5 rounded-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--nv-text-muted)]">
                  Recently Retrieved Sources
                </h2>
                <button
                  onClick={() => onNavigate('evidence')}
                  className="text-xs text-[var(--nv-accent)] hover:underline"
                >
                  Evidence library
                </button>
              </div>
              <div className="divide-y divide-[var(--nv-border)]">
                {stats.recent_sources.map((src) => (
                  <div key={src.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={src.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-[var(--nv-text)] hover:text-[var(--nv-accent)] line-clamp-1 flex items-center gap-1"
                      >
                        <span className="truncate">{src.source_title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    <p className="font-mono-meta text-[11px] text-[var(--nv-text-muted)] mt-0.5">
                      {src.publisher} · {src.source_category}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
