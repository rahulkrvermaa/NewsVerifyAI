import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpDown, ExternalLink, Search, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import type { HistoryItem } from '../types';
import { AssessmentBadge } from '../components/VerdictBadge';

interface HistoryPageProps {
  onOpenInvestigation: (articleId: string) => void;
  onStartNew: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  onOpenInvestigation,
  onStartNew,
  onNotify,
}) => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assessment, setAssessment] = useState('ALL');
  const [sort, setSort] = useState<'desc' | 'asc'>('desc');

  const fetchHistory = useCallback(() => {
    setLoading(true);
    api
      .getHistory({
        search: search.trim() || undefined,
        assessment: assessment !== 'ALL' ? assessment : undefined,
        sort,
      })
      .then(setItems)
      .catch((err) => onNotify('error', err instanceof Error ? err.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [search, assessment, sort, onNotify]);

  useEffect(() => {
    const timer = setTimeout(fetchHistory, 180);
    return () => clearTimeout(timer);
  }, [fetchHistory]);

  const handleDelete = async (articleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteArticle(articleId);
      setItems((prev) => prev.filter((item) => item.id !== articleId));
      onNotify('success', 'Investigation deleted.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to delete investigation.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--nv-border)] pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-mono-meta text-[11px] uppercase tracking-widest text-[var(--nv-accent)] mb-1">
            Archive
          </p>
          <h1 className="font-serif-editorial text-2xl sm:text-3xl font-bold tracking-tight">
            Investigation History
          </h1>
          <p className="text-sm text-[var(--nv-text-muted)] mt-1">
            All saved newsroom investigations, extracted propositions, and verification summaries.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-[var(--nv-text-muted)] absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by article headline or publisher..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--nv-surface)] border border-[var(--nv-border)] rounded-sm focus:outline-none focus:border-[var(--nv-accent)]"
          />
        </div>
        <select
          value={assessment}
          onChange={(e) => setAssessment(e.target.value)}
          className="px-3 py-2 text-sm bg-[var(--nv-surface)] border border-[var(--nv-border)] rounded-sm focus:outline-none focus:border-[var(--nv-accent)]"
        >
          <option value="ALL">All Assessments</option>
          <option value="Mostly supported">Mostly supported</option>
          <option value="Contains disputed claims">Contains disputed claims</option>
          <option value="Mixed evidence">Mixed evidence</option>
          <option value="Requires further verification">Requires further verification</option>
        </select>
        <button
          onClick={() => setSort((s) => (s === 'desc' ? 'asc' : 'desc'))}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm bg-[var(--nv-surface)] border border-[var(--nv-border)] hover:bg-[var(--nv-surface-alt)] rounded-sm"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{sort === 'desc' ? 'Newest first' : 'Oldest first'}</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-[var(--nv-surface)] border border-[var(--nv-border)] rounded-sm overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-[var(--nv-surface-alt)] animate-pulse rounded-sm" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-[var(--nv-text-muted)]">
              No investigations match your current filters.
            </p>
            <button
              onClick={onStartNew}
              className="text-xs font-medium text-[var(--nv-accent)] hover:underline"
            >
              Start a new investigation
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--nv-border)] text-[11px] uppercase tracking-wider text-[var(--nv-text-muted)]">
                <th className="py-3 px-4 font-semibold">Article Title</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Propositions</th>
                <th className="py-3 px-4 font-semibold">Summary</th>
                <th className="py-3 px-4 font-semibold">Assessment</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nv-border)] text-sm">
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onOpenInvestigation(item.id)}
                  className="hover:bg-[var(--nv-surface-alt)]/50 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="font-serif-editorial font-semibold text-[var(--nv-text)] truncate">
                      {item.title}
                    </p>
                    <p className="font-mono-meta text-[11px] text-[var(--nv-text-muted)]">
                      {item.publisher || item.input_type.toUpperCase()}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 font-mono-meta text-xs text-[var(--nv-text-muted)] whitespace-nowrap">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 font-mono-meta text-xs">
                    {item.proposition_count}
                  </td>
                  <td className="py-3.5 px-4 font-mono-meta text-xs whitespace-nowrap">
                    <span className="text-[var(--nv-supported)]">{item.summary.supported}S</span>{' '}
                    / <span className="text-[var(--nv-contradicted)]">{item.summary.contradicted}C</span>{' '}
                    / <span className="text-[var(--nv-insufficient)]">{item.summary.insufficient_evidence}I</span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <AssessmentBadge assessment={item.overall_assessment} />
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenInvestigation(item.id);
                        }}
                        title="Open investigation"
                        className="p-1.5 text-[var(--nv-text-muted)] hover:text-[var(--nv-accent)]"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        title="Delete investigation"
                        className="p-1.5 text-[var(--nv-text-muted)] hover:text-[var(--nv-contradicted)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
