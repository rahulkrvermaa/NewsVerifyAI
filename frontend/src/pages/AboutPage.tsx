import React from 'react';

export const AboutPage: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Text Preprocessing & NER',
      desc: 'Cleans article text, segments sentences while preserving original positions, and extracts named entities, dates, and numerical figures using spaCy.',
    },
    {
      num: '02',
      title: 'Atomic Proposition Extraction',
      desc: 'Decomposes complex statements into standalone, independently verifiable factual claims while excluding subjective opinions.',
    },
    {
      num: '03',
      title: 'Targeted Query Generation',
      desc: 'Constructs 2–3 precision search queries per proposition preserving entities, dates, and figures to locate primary evidence.',
    },
    {
      num: '04',
      title: 'External Evidence Retrieval',
      desc: 'Queries Tavily Search across official government reports, research publications, and reputable news organizations without fabricating URLs.',
    },
    {
      num: '05',
      title: 'Hybrid Evidence Grounding',
      desc: 'Combines Sentence Transformers + FAISS dense retrieval, BM25 lexical scoring, and Cross-Encoder reranking. Semantic similarity is never treated as proof of truth.',
    },
    {
      num: '06',
      title: 'NLI & Evidence-Grounded Synthesis',
      desc: 'Evaluates each source against the proposition using Natural Language Inference (BART-MNLI) and synthesizes a verdict strictly from retrieved evidence.',
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <header className="border-b border-[var(--nv-border)] pb-5">
        <p className="font-mono-meta text-[11px] uppercase tracking-widest text-[var(--nv-accent)] mb-1">
          Methodology
        </p>
        <h1 className="font-serif-editorial text-2xl sm:text-3xl font-bold tracking-tight">
          About NewsVerify AI
        </h1>
        <p className="text-sm text-[var(--nv-text-muted)] mt-1.5">
          Every claim needs evidence. Every verdict needs a source.
        </p>
      </header>

      <section className="bg-[var(--nv-surface)] border border-[var(--nv-border)] p-6 rounded-sm space-y-3">
        <h2 className="font-serif-editorial text-lg font-semibold">Core Verification Philosophy</h2>
        <p className="text-sm text-[var(--nv-text)] leading-relaxed">
          NewsVerify AI is designed for investigative journalists, researchers, students, and fact-checkers.
          Rather than assigning opaque "truth scores" or labeling an entire article fake because of a single
          disputed detail, the platform decomposes articles into atomic factual propositions and evaluates each
          claim independently against retrieved external evidence.
        </p>
        <p className="text-sm text-[var(--nv-text-muted)] leading-relaxed">
          When external evidence is weak, tangential, or unavailable, the system explicitly reports{' '}
          <strong className="text-[var(--nv-text)]">Insufficient Evidence</strong> rather than guessing from
          internal model memory.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--nv-text-muted)]">
          Six-Stage Verification Pipeline
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((s) => (
            <div key={s.num} className="bg-[var(--nv-surface)] border border-[var(--nv-border)] p-5 rounded-sm">
              <span className="font-mono-meta text-xs text-[var(--nv-accent)] font-semibold">{s.num}</span>
              <h3 className="font-serif-editorial text-base font-semibold mt-1">{s.title}</h3>
              <p className="text-xs text-[var(--nv-text-muted)] leading-relaxed mt-1.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
