import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../services/api';
import type { ConfigStatus } from '../types';

interface SettingsPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ theme, onToggleTheme }) => {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getConfigStatus()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="border-b border-[var(--nv-border)] pb-5">
        <p className="font-mono-meta text-[11px] uppercase tracking-widest text-[var(--nv-accent)] mb-1">
          Configuration
        </p>
        <h1 className="font-serif-editorial text-2xl sm:text-3xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-[var(--nv-text-muted)] mt-1">
          Backend API credential status, active NLP models, and editorial interface preferences.
        </p>
      </header>

      {/* Appearance */}
      <section className="bg-[var(--nv-surface)] border border-[var(--nv-border)] p-5 rounded-sm flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Color Theme</h2>
          <p className="text-xs text-[var(--nv-text-muted)] mt-0.5">
            Switch between warm off-white editorial light mode and low-glare dark mode.
          </p>
        </div>
        <button
          onClick={onToggleTheme}
          className="px-3.5 py-1.5 text-xs font-medium border border-[var(--nv-border)] bg-[var(--nv-bg)] hover:bg-[var(--nv-surface-alt)] rounded-sm"
        >
          Current: {theme === 'light' ? 'Light' : 'Dark'}
        </button>
      </section>

      {/* Backend API & Model Status */}
      <section className="bg-[var(--nv-surface)] border border-[var(--nv-border)] p-5 rounded-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Backend Pipeline Configuration</h2>
          <p className="text-xs text-[var(--nv-text-muted)] mt-0.5">
            API keys are managed exclusively on the server via <code className="font-mono-meta">.env</code> and are never exposed to the browser.
          </p>
        </div>

        {loading ? (
          <div className="h-24 bg-[var(--nv-surface-alt)] animate-pulse rounded-sm" />
        ) : !config ? (
          <p className="text-xs text-[var(--nv-contradicted)]">
            Could not reach backend configuration endpoint. Ensure the FastAPI server is running.
          </p>
        ) : (
          <div className="divide-y divide-[var(--nv-border)] text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="font-medium">LLM API Key (Proposition Extraction &amp; Synthesis)</span>
              <span className="inline-flex items-center gap-1.5 font-mono-meta">
                {config.llm_configured ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--nv-supported)]" />
                    <span className="text-[var(--nv-supported)]">Configured</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-[var(--nv-contradicted)]" />
                    <span className="text-[var(--nv-contradicted)]">Missing in .env</span>
                  </>
                )}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="font-medium">Tavily Search API Key (External Evidence)</span>
              <span className="inline-flex items-center gap-1.5 font-mono-meta">
                {config.tavily_configured ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--nv-supported)]" />
                    <span className="text-[var(--nv-supported)]">Configured</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-[var(--nv-contradicted)]" />
                    <span className="text-[var(--nv-contradicted)]">Missing in .env</span>
                  </>
                )}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--nv-text-muted)]">LLM Model</span>
              <span className="font-mono-meta">{config.llm_model}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--nv-text-muted)]">Embedding Model</span>
              <span className="font-mono-meta">{config.embedding_model}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--nv-text-muted)]">NLI Verification Model</span>
              <span className="font-mono-meta">{config.nli_model}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--nv-text-muted)]">spaCy Pipeline</span>
              <span className="font-mono-meta">{config.spacy_model}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
