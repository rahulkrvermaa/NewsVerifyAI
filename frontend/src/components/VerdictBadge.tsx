import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, XCircle } from 'lucide-react';

interface VerdictBadgeProps {
  verdict: string;
  compact?: boolean;
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({ verdict, compact = false }) => {
  const upper = verdict.toUpperCase();

  let styles =
    'bg-[var(--nv-surface-alt)] text-[var(--nv-text-muted)] border-[var(--nv-border)]';
  let Icon = Clock;
  let label = verdict;

  if (upper === 'SUPPORTED') {
    styles = 'bg-[var(--nv-supported-bg)] text-[var(--nv-supported)] border-[var(--nv-supported)]/25';
    Icon = CheckCircle2;
    label = 'Supported';
  } else if (upper === 'CONTRADICTED') {
    styles = 'bg-[var(--nv-contradicted-bg)] text-[var(--nv-contradicted)] border-[var(--nv-contradicted)]/25';
    Icon = XCircle;
    label = 'Contradicted';
  } else if (upper === 'CONFLICTING EVIDENCE') {
    styles = 'bg-[var(--nv-conflicting-bg)] text-[var(--nv-conflicting)] border-[var(--nv-conflicting)]/25';
    Icon = AlertTriangle;
    label = 'Conflicting Evidence';
  } else if (upper === 'INSUFFICIENT EVIDENCE') {
    styles = 'bg-[var(--nv-insufficient-bg)] text-[var(--nv-insufficient)] border-[var(--nv-insufficient)]/25';
    Icon = HelpCircle;
    label = 'Insufficient Evidence';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-medium tracking-tight ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } rounded-sm ${styles}`}
    >
      <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span>{label}</span>
    </span>
  );
};

export const AssessmentBadge: React.FC<{ assessment?: string | null }> = ({ assessment }) => {
  if (!assessment) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs border border-[var(--nv-border)] text-[var(--nv-text-muted)] rounded-sm">
        Unanalyzed
      </span>
    );
  }

  let styles = 'bg-[var(--nv-insufficient-bg)] text-[var(--nv-insufficient)] border-[var(--nv-insufficient)]/25';
  if (assessment === 'Mostly supported') {
    styles = 'bg-[var(--nv-supported-bg)] text-[var(--nv-supported)] border-[var(--nv-supported)]/25';
  } else if (assessment === 'Contains disputed claims') {
    styles = 'bg-[var(--nv-contradicted-bg)] text-[var(--nv-contradicted)] border-[var(--nv-contradicted)]/25';
  } else if (assessment === 'Mixed evidence') {
    styles = 'bg-[var(--nv-conflicting-bg)] text-[var(--nv-conflicting)] border-[var(--nv-conflicting)]/25';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border rounded-sm ${styles}`}>
      {assessment}
    </span>
  );
};
