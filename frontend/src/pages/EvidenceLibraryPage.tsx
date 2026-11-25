import React, { useEffect, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { api } from '../services/api';
import type { EvidenceLibraryItem } from '../types';

interface EvidenceLibraryPageProps {
  onOpenInvestigation: (articleId: string) => void;
}

const CATEGORIES = [
  'ALL',
  'Official sources',
  'Research publications',
  'News organizations',
  'Other sources',
];

export const EvidenceLibraryPage: React.FC<EvidenceLibraryPageProps> = ({
  onOpenInvestigation,
}) => {
  const [items, setItems] = useState<EvidenceLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .getEvidenceLibrary({
          category: category !== 'ALL' ? category : undefined,
          search: search.trim() || undefined,
        })
        .then(setItems)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [category, search]);

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--nv-border)] pb-5">
        <p className="font-mono-meta text-[11px] uppercase tracking-widest text-[var(--nv-accent)] mb-1">
          Evidence Repository
        </p>
        <h1 className="font-serif-editorial text-2xl sm:text-3xl font-bold tracking-tight">
          Sources &amp; Evidence
        </h1>
        <p className="text-sm text-[var(--nv-text-muted)] mt-1">
          External sources retrieved across investigations. Source authority is evaluated by subject relevance, primary attribution, and publication date—never blind domain scores.
        </p>
      </header>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors ${
                category === cat
                  ? 'bg-[var(--nv-accent)] text-white border-[var(--nv-accent)]'
                  : 'bg-[var(--nv-surface)] text-[var(--nv-text-muted)] border-[var(--nv-border)] hover:text-[var(--nv-text)]'
              }`}
            >
              {cat === 'ALL' ? 'All Categories' : cat}
            </button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search className="h-4 w-4 text-[var(--nv-text-muted)] absolute left-3 top-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by publisher or excerpt..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-[var(--nv-surface)] border border-[var(--nv-border)] rounded-sm focus:outline-none focus:border-[var(--nv-accent)]"
          />
        </div>
      </div>

      {/* Evidence List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[var(--nv-surface)] border border-[var(--nv-border)] animate-pulse rounded-sm" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[var(--nv-surface)] border border-[var(--nv-border)] p-10 text-center rounded-sm">
          <p className="text-sm text-[var(--nv-text-muted)]">
            No retrieved evidence sources found yet. Run an investigation to populate the evidence library.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--nv-border)] bg-[var(--nv-surface)] border border-[var(--nv-border)] rounded-sm">
          {items.map((ev) => (
            <div key={ev.id} className="p-5 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <a
                    href={ev.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-serif-editorial text-base font-semibold text-[var(--nv-text)] hover:text-[var(--nv-accent)] inline-flex items-center gap-1.5"
                  >
                    <span>{ev.source_title}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                  <p className="font-mono-meta text-[11px] text-[var(--nv-text-muted)] mt-0.5">
                    {ev.publisher} · {ev.source_category}
                    {ev.publication_date ? ` · ${ev.publication_date}` : ''} · Relevance {(ev.relevance_score * 100).toFixed(0)}%
                  </p>
                </div>
                <span className="font-mono-meta text-[11px] px-2 py-0.5 border border-[var(--nv-border)] rounded-sm uppercase self-start">
                  {ev.stance}
                </span>
              </div>

              <p className="text-xs text-[var(--nv-text)] leading-relaxed bg-[var(--nv-bg)] border-l-2 border-[var(--nv-accent)] pl-3 py-2">
                &ldquo;{ev.highlighted_excerpt || ev.evidence_text}&rdquo;
              </p>

              <div className="flex items-center justify-between text-xs text-[var(--nv-text-muted)] pt-1">
                <span className="truncate">
                  Associated Claim:{' '}
                  <strong className="font-mono-meta text-[var(--nv-text)]">{ev.claim_code}</strong>{' '}
                  {ev.claim_text}
                </span>
                {ev.article_id && (
                  <button
                    onClick={() => onOpenInvestigation(ev.article_id)}
                    className="text-[var(--nv-accent)] hover:underline shrink-0 ml-3"
                  >
                    Open Report
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
