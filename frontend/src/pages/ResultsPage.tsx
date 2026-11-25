import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Search,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { api } from '../services/api';
import type { EvidenceItem, InvestigationReport, Proposition } from '../types';
import { AssessmentBadge, VerdictBadge } from '../components/VerdictBadge';

interface ResultsPageProps {
  articleId: string;
  onBack: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

const VERDICT_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'SUPPORTED', label: 'Supported' },
  { id: 'CONTRADICTED', label: 'Contradicted' },
  { id: 'CONFLICTING EVIDENCE', label: 'Conflicting' },
  { id: 'INSUFFICIENT EVIDENCE', label: 'Insufficient' },
];

export const ResultsPage: React.FC<ResultsPageProps> = ({
  articleId,
  onBack,
  onNotify,
}) => {
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProp, setSelectedProp] = useState<Proposition | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters
  const [verdictFilter, setVerdictFilter] = useState('ALL');
  const [claimSearch, setClaimSearch] = useState('');

  // Source Article Context
  const [showSourceArticle, setShowSourceArticle] = useState(false);
  const highlightRef = useRef<HTMLElement>(null);

  // Single-claim re-verification
  const [customQuery, setCustomQuery] = useState('');
  const [reverifying, setReverifying] = useState(false);

  const loadReport = useCallback(
    (preservePropId?: string) => {
      setLoading(true);
      api
        .getAnalysisReport(articleId)
        .then((data) => {
          setReport(data);
          if (data.propositions.length > 0) {
            const match = preservePropId
              ? data.propositions.find((p) => p.id === preservePropId)
              : undefined;
            setSelectedProp(match || data.propositions[0]);
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load investigation report.');
        })
        .finally(() => setLoading(false));
    },
    [articleId]
  );

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const filteredPropositions = useMemo(() => {
    if (!report) return [];
    return report.propositions.filter((p) => {
      if (verdictFilter !== 'ALL' && p.verification_status !== verdictFilter) return false;
      if (claimSearch.trim()) {
        const q = claimSearch.trim().toLowerCase();
        return (
          p.claim_text.toLowerCase().includes(q) ||
          p.claim_code.toLowerCase().includes(q) ||
          p.claim_type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [report, verdictFilter, claimSearch]);

  // Keyboard navigation (J/K or ArrowDown/ArrowUp)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (filteredPropositions.length === 0) return;

      const idx = selectedProp
        ? filteredPropositions.findIndex((p) => p.id === selectedProp.id)
        : -1;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = filteredPropositions[Math.min(filteredPropositions.length - 1, idx + 1)];
        if (next) setSelectedProp(next);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = filteredPropositions[Math.max(0, idx - 1)];
        if (prev) setSelectedProp(prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filteredPropositions, selectedProp]);

  // Scroll highlighted sentence into view when source article pane is open
  useEffect(() => {
    if (showSourceArticle && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedProp?.id, showSourceArticle]);

  const handleCopyProposition = async (prop: Proposition, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${prop.claim_code}: ${prop.claim_text}`);
      setCopiedId(prop.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      onNotify('error', 'Failed to copy to clipboard.');
    }
  };

  const handleCopyMarkdown = async () => {
    if (!report) return;
    const lines = [
      `# ${report.article.title}`,
      `**Assessment:** ${report.article.overall_assessment || 'N/A'} | **Words:** ${report.article.word_count}`,
      '',
      report.article.overall_summary || '',
      '',
      '## Propositions & Citations',
      ...report.propositions.map((p) => {
        const sources = p.evidence_items
          .slice(0, 3)
          .map((ev) => `  - [${ev.stance.toUpperCase()}] [${ev.source_title}](${ev.source_url}) (${ev.publisher})`)
          .join('\n');
        return `### ${p.claim_code} — ${p.verification_status}\n- **Claim:** ${p.claim_text}\n- **Synthesis:** ${p.verification?.explanation || 'N/A'}\n${sources}`;
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      onNotify('success', 'Copied Markdown editorial brief with citations.');
    } catch {
      onNotify('error', 'Failed to copy Markdown brief.');
    }
  };

  const handleReverify = async () => {
    if (!selectedProp) return;
    setReverifying(true);
    try {
      await api.reverifyProposition(selectedProp.id, customQuery.trim() || undefined);
      setCustomQuery('');
      onNotify('success', `Re-verified ${selectedProp.claim_code} with fresh evidence.`);
      loadReport(selectedProp.id);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to re-verify proposition.');
    } finally {
      setReverifying(false);
    }
  };

  const handleExportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsverify-report-${report.article.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('success', 'Exported investigation report as JSON.');
  };

  const handleExportPDF = () => {
    if (!report) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 48;
    const margin = 44;
    const maxWidth = 505;

    const addText = (text: string, size = 10, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (y > 780) {
          doc.addPage();
          y = 48;
        }
        doc.text(line, margin, y);
        y += size * 1.4;
      }
      y += 4;
    };

    addText('NewsVerify AI — Investigation Report', 16, true);
    addText(report.article.title, 13, true);
    addText(
      `Publisher: ${report.article.publisher || 'N/A'} | Assessment: ${report.article.overall_assessment || 'N/A'} | Words: ${report.article.word_count}`,
      9
    );
    if (report.article.overall_summary) {
      addText(report.article.overall_summary, 10);
    }
    y += 8;
    addText(
      `Summary: ${report.summary.total_propositions} total | ${report.summary.supported} supported | ${report.summary.contradicted} contradicted | ${report.summary.conflicting_evidence} conflicting | ${report.summary.insufficient_evidence} insufficient`,
      10,
      true
    );
    y += 8;

    for (const p of report.propositions) {
      addText(`${p.claim_code} [${p.verification_status}] (${p.claim_type})`, 11, true);
      addText(`Claim: ${p.claim_text}`, 10);
      if (p.verification?.explanation) {
        addText(`Explanation: ${p.verification.explanation}`, 9);
      }
      for (const ev of p.evidence_items.slice(0, 3)) {
        addText(`  - [${ev.stance.toUpperCase()}] ${ev.source_title} (${ev.source_url})`, 8);
      }
      y += 6;
    }

    doc.save(`newsverify-report-${report.article.id.slice(0, 8)}.pdf`);
    onNotify('success', 'Exported investigation report as PDF.');
  };

  const renderHighlightedArticle = (fullText: string, sentence?: string) => {
    if (!sentence || sentence.length < 8) {
      return <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--nv-text)]">{fullText}</p>;
    }
    const idx = fullText.toLowerCase().indexOf(sentence.toLowerCase());
    if (idx === -1) {
      return <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--nv-text)]">{fullText}</p>;
    }
    const before = fullText.slice(0, idx);
    const match = fullText.slice(idx, idx + sentence.length);
    const after = fullText.slice(idx + sentence.length);
    return (
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--nv-text)]">
        {before}
        <mark
          ref={highlightRef}
          className="bg-[var(--nv-insufficient-bg)] text-[var(--nv-text)] border-b-2 border-[var(--nv-accent)] px-0.5 rounded-xs"
        >
          {match}
        </mark>
        {after}
      </p>
    );
  };

  if (loading && !report) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-[var(--nv-surface)] border border-[var(--nv-border)] animate-pulse rounded-sm" />
        <div className="h-80 bg-[var(--nv-surface)] border border-[var(--nv-border)] animate-pulse rounded-sm" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-[var(--nv-surface)] border border-[var(--nv-border)] p-8 text-center rounded-sm space-y-3">
        <p className="text-sm text-[var(--nv-contradicted)]">{error || 'Report not found.'}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--nv-accent)] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Return</span>
        </button>
      </div>
    );
  }

  const { article, summary, propositions } = report;
  const total = Math.max(summary.total_propositions, 1);

  const supportingEvidence: EvidenceItem[] = selectedProp
    ? selectedProp.evidence_items.filter((e) => e.stance === 'supporting')
    : [];
  const contradictingEvidence: EvidenceItem[] = selectedProp
    ? selectedProp.evidence_items.filter((e) => e.stance === 'contradicting')
    : [];
  const neutralEvidence: EvidenceItem[] = selectedProp
    ? selectedProp.evidence_items.filter((e) => e.stance === 'neutral')
    : [];

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--nv-text-muted)] hover:text-[var(--nv-text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to History</span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSourceArticle((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--nv-border)] bg-[var(--nv-surface)] hover:bg-[var(--nv-surface-alt)] rounded-sm"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>{showSourceArticle ? 'Hide Source Article' : 'View Source Article'}</span>
            {showSourceArticle ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <button
            onClick={handleCopyMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--nv-border)] bg-[var(--nv-surface)] hover:bg-[var(--nv-surface-alt)] rounded-sm"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Copy Markdown</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--nv-border)] bg-[var(--nv-surface)] hover:bg-[var(--nv-surface-alt)] rounded-sm"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--nv-border)] bg-[var(--nv-surface)] hover:bg-[var(--nv-surface-alt)] rounded-sm"
          >
            <FileJson className="h-3.5 w-3.5" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--nv-accent)] hover:bg-[var(--nv-accent-hover)] text-white rounded-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Collapsible Source Article Context */}
      {showSourceArticle && (
        <section className="bg-[var(--nv-surface)] border border-[var(--nv-border)] p-5 rounded-sm space-y-2 print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--nv-text-muted)]">
              Source Article Context {selectedProp ? `— Highlighting ${selectedProp.claim_code}` : ''}
            </h2>
            <span className="font-mono-meta text-[11px] text-[var(--nv-text-muted)]">
              {article.word_count} words
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto bg-[var(--nv-bg)] border border-[var(--nv-border)] p-4 rounded-sm">
            {renderHighlightedArticle(article.original_text, selectedProp?.original_sentence)}
          </div>
        </section>
      )}

      {/* A. Article Overview */}
      <section className="bg-[var(--nv-surface)] border border-[var(--nv-border)] p-6 rounded-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono-meta text-[var(--nv-text-muted)]">
              <span>{article.publisher || article.input_type.toUpperCase()}</span>
              {article.publication_date && (
                <>
                  <span>·</span>
                  <span>Published {article.publication_date}</span>
                </>
              )}
              <span>·</span>
              <span>{article.word_count} words</span>
              {article.analyzed_at && (
                <>
                  <span>·</span>
                  <span>Analyzed {new Date(article.analyzed_at).toLocaleString()}</span>
                </>
              )}
            </div>
            <h1 className="font-serif-editorial text-2xl sm:text-3xl font-bold tracking-tight">
              {article.title}
            </h1>
          </div>
          <div className="shrink-0">
            <AssessmentBadge assessment={article.overall_assessment} />
          </div>
        </div>

        {article.overall_summary && (
          <p className="text-sm text-[var(--nv-text)] leading-relaxed border-t border-[var(--nv-border)] pt-4">
            {article.overall_summary}
          </p>
        )}

        {article.important_findings && article.important_findings.length > 0 && (
          <div className="bg-[var(--nv-bg)] border border-[var(--nv-border)] p-4 rounded-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--nv-text-muted)] mb-2">
              Key Findings
            </h2>
            <ul className="space-y-1.5 text-xs text-[var(--nv-text)]">
              {article.important_findings.map((f, i) => (
                <li key={i} className="leading-relaxed">
                  • {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* B. Verification Summary Bar */}
      <section className="bg-[var(--nv-surface)] border border-[var(--nv-border)] p-5 rounded-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--nv-text-muted)]">
            Verification Summary
          </h2>
          <span className="font-mono-meta text-xs font-medium">
            {summary.total_propositions} Total Propositions
          </span>
        </div>

        <div className="w-full h-3 bg-[var(--nv-surface-alt)] rounded-sm overflow-hidden flex">
          {summary.supported > 0 && (
            <div
              style={{ width: `${(summary.supported / total) * 100}%` }}
              className="bg-[var(--nv-supported)] h-full"
              title={`Supported: ${summary.supported}`}
            />
          )}
          {summary.contradicted > 0 && (
            <div
              style={{ width: `${(summary.contradicted / total) * 100}%` }}
              className="bg-[var(--nv-contradicted)] h-full"
              title={`Contradicted: ${summary.contradicted}`}
            />
          )}
          {summary.conflicting_evidence > 0 && (
            <div
              style={{ width: `${(summary.conflicting_evidence / total) * 100}%` }}
              className="bg-[var(--nv-conflicting)] h-full"
              title={`Conflicting: ${summary.conflicting_evidence}`}
            />
          )}
          {summary.insufficient_evidence > 0 && (
            <div
              style={{ width: `${(summary.insufficient_evidence / total) * 100}%` }}
              className="bg-[var(--nv-insufficient)] h-full"
              title={`Insufficient Evidence: ${summary.insufficient_evidence}`}
            />
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-[var(--nv-supported)]" />
            <span className="text-[var(--nv-text-muted)]">Supported:</span>
            <span className="font-mono-meta font-semibold">{summary.supported}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-[var(--nv-contradicted)]" />
            <span className="text-[var(--nv-text-muted)]">Contradicted:</span>
            <span className="font-mono-meta font-semibold">{summary.contradicted}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-[var(--nv-conflicting)]" />
            <span className="text-[var(--nv-text-muted)]">Conflicting:</span>
            <span className="font-mono-meta font-semibold">{summary.conflicting_evidence}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-[var(--nv-insufficient)]" />
            <span className="text-[var(--nv-text-muted)]">Insufficient:</span>
            <span className="font-mono-meta font-semibold">{summary.insufficient_evidence}</span>
          </div>
        </div>
      </section>

      {/* C & D. Proposition Explorer + Detail Panel */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Proposition Table */}
        <div className="lg:col-span-6 bg-[var(--nv-surface)] border border-[var(--nv-border)] rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--nv-border)] space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--nv-text-muted)]">
                Proposition Explorer ({filteredPropositions.length}/{propositions.length})
              </h2>
              <span className="font-mono-meta text-[10px] text-[var(--nv-text-muted)] hidden sm:inline">
                J / K to navigate
              </span>
            </div>
            <div className="flex flex-wrap gap-1 print:hidden">
              {VERDICT_FILTERS.map((vf) => (
                <button
                  key={vf.id}
                  onClick={() => setVerdictFilter(vf.id)}
                  className={`px-2 py-0.5 text-[11px] rounded-sm border transition-colors ${
                    verdictFilter === vf.id
                      ? 'bg-[var(--nv-accent)] text-white border-[var(--nv-accent)]'
                      : 'bg-[var(--nv-bg)] text-[var(--nv-text-muted)] border-[var(--nv-border)] hover:text-[var(--nv-text)]'
                  }`}
                >
                  {vf.label}
                </button>
              ))}
            </div>
            <div className="relative print:hidden">
              <Search className="h-3.5 w-3.5 text-[var(--nv-text-muted)] absolute left-2.5 top-2" />
              <input
                type="text"
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
                placeholder="Filter claims by keyword or type..."
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-[var(--nv-bg)] border border-[var(--nv-border)] rounded-sm focus:outline-none focus:border-[var(--nv-accent)]"
              />
            </div>
          </div>
          {filteredPropositions.length === 0 ? (
            <div className="p-6 text-xs text-[var(--nv-text-muted)] text-center">
              No propositions match the active filter.
            </div>
          ) : (
            <div className="divide-y divide-[var(--nv-border)]">
              {filteredPropositions.map((prop) => {
                const isSelected = selectedProp?.id === prop.id;
                return (
                  <div
                    key={prop.id}
                    onClick={() => setSelectedProp(prop)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--nv-surface-alt)] border-l-2 border-l-[var(--nv-accent)]'
                        : 'hover:bg-[var(--nv-surface-alt)]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-meta text-xs font-semibold text-[var(--nv-accent)]">
                          {prop.claim_code}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 border border-[var(--nv-border)] rounded-sm text-[var(--nv-text-muted)]">
                          {prop.claim_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <VerdictBadge verdict={prop.verification_status} compact />
                        <button
                          onClick={(e) => handleCopyProposition(prop, e)}
                          title="Copy proposition"
                          className="p-1 text-[var(--nv-text-muted)] hover:text-[var(--nv-text)] print:hidden"
                        >
                          {copiedId === prop.id ? (
                            <Check className="h-3.5 w-3.5 text-[var(--nv-supported)]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--nv-text)] leading-snug">{prop.claim_text}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] font-mono-meta text-[var(--nv-text-muted)]">
                      <span>{prop.evidence_count} sources</span>
                      {prop.confidence !== null && prop.confidence !== undefined && (
                        <span>Confidence: {(prop.confidence * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* D & E. Proposition Detail & Evidence Comparison Panel */}
        <div className="lg:col-span-6 bg-[var(--nv-surface)] border border-[var(--nv-border)] rounded-sm p-5 space-y-5 lg:sticky lg:top-16">
          {!selectedProp ? (
            <p className="text-xs text-[var(--nv-text-muted)] text-center py-8">
              Select a proposition from the explorer to inspect its evidence and verdict.
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-[var(--nv-border)] pb-4">
                <div>
                  <span className="font-mono-meta text-xs font-semibold text-[var(--nv-accent)]">
                    {selectedProp.claim_code} · {selectedProp.claim_type}
                  </span>
                  <h3 className="font-serif-editorial text-lg font-semibold mt-1 leading-snug">
                    {selectedProp.claim_text}
                  </h3>
                </div>
                <VerdictBadge verdict={selectedProp.verification_status} />
              </div>

              {/* Direct Quotation from Article */}
              <div className="bg-[var(--nv-bg)] border-l-2 border-[var(--nv-border)] pl-3.5 py-2 pr-3">
                <span className="text-[10px] font-mono-meta uppercase tracking-wider text-[var(--nv-text-muted)] block mb-1">
                  Original Article Sentence (Direct Quotation)
                </span>
                <p className="text-xs italic text-[var(--nv-text)] leading-relaxed">
                  &ldquo;{selectedProp.original_sentence}&rdquo;
                </p>
              </div>

              {/* System-Generated Explanation */}
              {selectedProp.verification && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono-meta uppercase tracking-wider text-[var(--nv-text-muted)] block">
                    Evidence-Grounded Synthesis (System Summary)
                  </span>
                  <p className="text-sm text-[var(--nv-text)] leading-relaxed">
                    {selectedProp.verification.explanation}
                  </p>
                </div>
              )}

              {/* Single-Claim Re-Verification */}
              <div className="bg-[var(--nv-bg)] border border-[var(--nv-border)] p-3 rounded-sm space-y-2 print:hidden">
                <span className="text-[10px] font-mono-meta uppercase tracking-wider text-[var(--nv-text-muted)] block">
                  Re-Verify Claim with Custom Search Query (Optional)
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    placeholder="Leave blank to auto-generate queries, or enter a custom query..."
                    className="flex-1 px-2.5 py-1.5 text-xs bg-[var(--nv-surface)] border border-[var(--nv-border)] rounded-sm focus:outline-none focus:border-[var(--nv-accent)]"
                  />
                  <button
                    onClick={handleReverify}
                    disabled={reverifying}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--nv-accent)] hover:bg-[var(--nv-accent-hover)] disabled:opacity-50 text-white rounded-sm shrink-0"
                  >
                    {reverifying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    <span>Re-verify</span>
                  </button>
                </div>
              </div>

              {/* Evidence Comparison: Supporting vs Contradicting */}
              <div className="space-y-4 pt-2 border-t border-[var(--nv-border)]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--nv-text-muted)]">
                  Evidence Comparison ({selectedProp.evidence_items.length} Sources)
                </h4>

                {selectedProp.evidence_items.length === 0 && (
                  <p className="text-xs text-[var(--nv-text-muted)]">
                    No external evidence sources were retrieved for this proposition.
                  </p>
                )}

                {supportingEvidence.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[var(--nv-supported)]">
                      Supporting Sources ({supportingEvidence.length})
                    </p>
                    {supportingEvidence.map((ev) => (
                      <EvidenceCard key={ev.id} ev={ev} />
                    ))}
                  </div>
                )}

                {contradictingEvidence.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[var(--nv-contradicted)]">
                      Contradicting Sources ({contradictingEvidence.length})
                    </p>
                    {contradictingEvidence.map((ev) => (
                      <EvidenceCard key={ev.id} ev={ev} />
                    ))}
                  </div>
                )}

                {neutralEvidence.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[var(--nv-text-muted)]">
                      Contextual / Neutral Sources ({neutralEvidence.length})
                    </p>
                    {neutralEvidence.map((ev) => (
                      <EvidenceCard key={ev.id} ev={ev} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

const EvidenceCard: React.FC<{ ev: EvidenceItem }> = ({ ev }) => (
  <div className="border border-[var(--nv-border)] bg-[var(--nv-bg)] p-3 rounded-sm space-y-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--nv-text)] truncate">{ev.source_title}</p>
        <p className="font-mono-meta text-[11px] text-[var(--nv-text-muted)]">
          {ev.publisher} · {ev.source_category}
          {ev.publication_date ? ` · ${ev.publication_date}` : ''}
        </p>
      </div>
      <span className="font-mono-meta text-[11px] px-1.5 py-0.5 border border-[var(--nv-border)] rounded-sm shrink-0">
        Rel: {(ev.relevance_score * 100).toFixed(0)}%
      </span>
    </div>

    {ev.highlighted_excerpt && (
      <p className="text-xs bg-[var(--nv-surface)] border-l-2 border-[var(--nv-accent)] pl-2.5 py-1.5 text-[var(--nv-text)] leading-relaxed">
        &ldquo;{ev.highlighted_excerpt}&rdquo;
      </p>
    )}

    <div className="flex items-center justify-between pt-1">
      <span className="font-mono-meta text-[10px] text-[var(--nv-text-muted)]">
        NLI: {ev.nli_label || 'neutral'}
      </span>
      <a
        href={ev.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--nv-accent)] hover:underline"
      >
        <span>Visit Original Source</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  </div>
);
