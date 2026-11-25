import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  FileText,
  Globe,
  Loader2,
  Play,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '../services/api';
import type { AnalysisJob, Article, ConfigStatus } from '../types';

interface NewInvestigationPageProps {
  onAnalysisComplete: (articleId: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

type InputTab = 'paste' | 'url' | 'upload';

const PIPELINE_STAGES = [
  'Extracting article',
  'Identifying propositions',
  'Generating search queries',
  'Retrieving evidence',
  'Comparing evidence',
  'Generating final report',
];

export const NewInvestigationPage: React.FC<NewInvestigationPageProps> = ({
  onAnalysisComplete,
  onNotify,
}) => {
  const [tab, setTab] = useState<InputTab>('paste');
  const [config, setConfig] = useState<ConfigStatus | null>(null);

  // Paste state
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [language, setLanguage] = useState('auto');

  // URL state
  const [urlInput, setUrlInput] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prepared article preview state
  const [preparedArticle, setPreparedArticle] = useState<Article | null>(null);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableText, setEditableText] = useState('');
  const [preparingPaste, setPreparingPaste] = useState(false);

  // Analysis job state
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [startingAnalysis, setStartingAnalysis] = useState(false);

  useEffect(() => {
    api.getConfigStatus().then(setConfig).catch(() => {});
  }, []);

  // Poll / SSE for active job
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;

    let closed = false;
    const es = new EventSource(`/api/analyze/stream/${job.job_id}`);

    es.onmessage = (event) => {
      if (closed) return;
      try {
        const data = JSON.parse(event.data) as AnalysisJob;
        setJob(data);
        if (data.status === 'completed') {
          es.close();
          onNotify('success', 'Investigation completed. Opening report.');
          onAnalysisComplete(data.article_id);
        } else if (data.status === 'failed') {
          es.close();
          onNotify('error', data.error || 'Verification pipeline failed.');
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      // Fallback polling if SSE drops
      const timer = setInterval(async () => {
        try {
          const latest = await api.getJobStatus(job.job_id);
          setJob(latest);
          if (latest.status === 'completed') {
            clearInterval(timer);
            onNotify('success', 'Investigation completed. Opening report.');
            onAnalysisComplete(latest.article_id);
          } else if (latest.status === 'failed') {
            clearInterval(timer);
            onNotify('error', latest.error || 'Verification pipeline failed.');
          }
        } catch {
          clearInterval(timer);
        }
      }, 1500);
    };

    return () => {
      closed = true;
      es.close();
    };
  }, [job?.job_id, job?.status, onAnalysisComplete, onNotify]);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPasteText(text);
        onNotify('info', 'Pasted article text from clipboard.');
      }
    } catch {
      onNotify('error', 'Clipboard access denied by browser. Use Ctrl+V in the editor.');
    }
  };

  const handlePreparePaste = async () => {
    if (pasteText.trim().length < 20) {
      onNotify('error', 'Please paste at least 20 characters of article text.');
      return;
    }
    setPreparingPaste(true);
    try {
      const article = await api.pasteArticle({
        title: pasteTitle.trim() || undefined,
        text: pasteText.trim(),
        language,
      });
      setPreparedArticle(article);
      setEditableTitle(article.title);
      setEditableText(article.original_text);
      onNotify('success', 'Article prepared for review. Click "Analyze & Verify Article" to begin.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to prepare article.');
    } finally {
      setPreparingPaste(false);
    }
  };

  const handleFetchUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      const msg = 'Enter a valid HTTP or HTTPS URL.';
      setUrlError(msg);
      onNotify('error', msg);
      return;
    }
    setUrlError(null);
    setFetchingUrl(true);
    try {
      const article = await api.fetchUrlArticle({ url: trimmed, language });
      setPreparedArticle(article);
      setEditableTitle(article.title);
      setEditableText(article.original_text);
      onNotify('success', 'Article extracted from URL. Review and edit before verification.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to extract article from URL.';
      setUrlError(msg);
      onNotify('error', msg);
    } finally {
      setFetchingUrl(false);
    }
  };

  const processFileUpload = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['txt', 'pdf', 'docx'].includes(ext)) {
      onNotify('error', 'Unsupported file type. Please upload .txt, .pdf, or .docx.');
      return;
    }
    const maxMb = config?.max_upload_mb ?? 10;
    if (file.size > maxMb * 1024 * 1024) {
      onNotify('error', `File exceeds the ${maxMb} MB limit.`);
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    setUploadProgress(30);
    try {
      const interval = setInterval(() => {
        setUploadProgress((p) => (p < 85 ? p + 15 : p));
      }, 150);
      const article = await api.uploadArticleFile(file, language);
      clearInterval(interval);
      setUploadProgress(100);
      setPreparedArticle(article);
      setEditableTitle(article.title);
      setEditableText(article.original_text);
      onNotify('success', `Extracted text from ${file.name}.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to extract uploaded file.');
      setSelectedFile(null);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyzeArticle = async () => {
    if (!preparedArticle) return;
    if (editableText.trim().length < 20) {
      onNotify('error', 'Article text is too short to analyze.');
      return;
    }
    setStartingAnalysis(true);
    try {
      // Persist any user edits before running analysis
      let targetArticle = preparedArticle;
      if (
        editableText.trim() !== preparedArticle.original_text ||
        editableTitle.trim() !== preparedArticle.title
      ) {
        targetArticle = await api.updateArticle(preparedArticle.id, {
          title: editableTitle.trim() || preparedArticle.title,
          text: editableText.trim(),
          language: preparedArticle.language,
        });
        setPreparedArticle(targetArticle);
      }

      const startedJob = await api.startAnalysis(targetArticle.id);
      setJob(startedJob);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to start verification.');
    } finally {
      setStartingAnalysis(false);
    }
  };

  const resetPrepared = () => {
    setPreparedArticle(null);
    setEditableTitle('');
    setEditableText('');
    setSelectedFile(null);
    setUploadProgress(0);
    setJob(null);
  };

  const liveWordCount = editableText.trim() ? editableText.trim().split(/\s+/).length : 0;
  const liveCharCount = editableText.trim().length;
  const missingKeys = config && (!config.llm_configured || !config.tavily_configured);

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--nv-border)] pb-5">
        <p className="font-mono-meta text-[11px] uppercase tracking-widest text-[var(--nv-accent)] mb-1">
          New Investigation
        </p>
        <h1 className="font-serif-editorial text-2xl sm:text-3xl font-bold tracking-tight">
          Submit Article for Claim Verification
        </h1>
        <p className="text-sm text-[var(--nv-text-muted)] mt-1">
          Provide news content via text, URL, or document upload. Review the extracted text before initiating external evidence retrieval.
        </p>
      </header>

      {missingKeys && (
        <div className="border border-[var(--nv-insufficient)]/40 bg-[var(--nv-insufficient-bg)] p-4 rounded-sm flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-[var(--nv-insufficient)] mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <p className="font-semibold text-[var(--nv-text)]">
              API Credentials Required for Live Verification
            </p>
            <p className="text-[var(--nv-text-muted)] mt-0.5">
              Missing:{' '}
              {!config.llm_configured && <code className="font-mono-meta">LLM_API_KEY</code>}
              {!config.llm_configured && !config.tavily_configured && ', '}
              {!config.tavily_configured && <code className="font-mono-meta">TAVILY_API_KEY</code>}.
              Configure them in <code className="font-mono-meta">.env</code> (see Settings) to run live proposition extraction and web evidence retrieval.
            </p>
          </div>
        </div>
      )}

      {/* Unified Input Card */}
      {!preparedArticle && (
        <section className="bg-[var(--nv-surface)] border border-[var(--nv-border)] rounded-sm">
          {/* Tabs */}
          <div className="flex border-b border-[var(--nv-border)]">
            {[
              { id: 'paste' as InputTab, label: 'Paste Article', icon: FileText },
              { id: 'url' as InputTab, label: 'Article URL', icon: Globe },
              { id: 'upload' as InputTab, label: 'Upload File', icon: Upload },
            ].map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? 'border-[var(--nv-accent)] text-[var(--nv-text)] bg-[var(--nv-surface)]'
                      : 'border-transparent text-[var(--nv-text-muted)] hover:text-[var(--nv-text)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {/* TAB 1: PASTE ARTICLE */}
            {tab === 'paste' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h2 className="font-serif-editorial text-lg font-semibold">
                    Paste your news article
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-[var(--nv-border)] hover:bg-[var(--nv-surface-alt)] rounded-sm"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" />
                      <span>Paste from clipboard</span>
                    </button>
                    {pasteText && (
                      <button
                        type="button"
                        onClick={() => {
                          setPasteText('');
                          setPasteTitle('');
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-[var(--nv-border)] hover:bg-[var(--nv-surface-alt)] text-[var(--nv-text-muted)] rounded-sm"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[var(--nv-text-muted)] mb-1">
                      Article Title (optional)
                    </label>
                    <input
                      type="text"
                      value={pasteTitle}
                      onChange={(e) => setPasteTitle(e.target.value)}
                      placeholder="Headline or working title for this investigation"
                      className="w-full px-3 py-2 text-sm bg-[var(--nv-bg)] border border-[var(--nv-border)] rounded-sm focus:outline-none focus:border-[var(--nv-accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--nv-text-muted)] mb-1">
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[var(--nv-bg)] border border-[var(--nv-border)] rounded-sm focus:outline-none focus:border-[var(--nv-accent)]"
                    >
                      <option value="auto">Auto-detect</option>
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </select>
                  </div>
                </div>

                <div>
                  <textarea
                    rows={12}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste the complete news article here. Our system will identify individual factual claims and verify them using external evidence."
                    className="w-full p-3.5 text-sm leading-relaxed bg-[var(--nv-bg)] border border-[var(--nv-border)] rounded-sm focus:outline-none focus:border-[var(--nv-accent)] resize-y"
                  />
                  <div className="flex items-center justify-between mt-1.5 text-xs font-mono-meta text-[var(--nv-text-muted)]">
                    <span>{pasteText.trim() ? pasteText.trim().split(/\s+/).length : 0} words</span>
                    <span>{pasteText.length} characters</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handlePreparePaste}
                    disabled={preparingPaste || pasteText.trim().length < 20}
                    className="inline-flex items-center gap-2 bg-[var(--nv-accent)] hover:bg-[var(--nv-accent-hover)] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-sm transition-colors"
                  >
                    {preparingPaste && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Review &amp; Prepare Article</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: ARTICLE URL */}
            {tab === 'url' && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-serif-editorial text-lg font-semibold">
                    Fetch article from URL
                  </h2>
                  <p className="text-xs text-[var(--nv-text-muted)] mt-1">
                    Extracts main body text, headline, publisher, and publication date while stripping navigation and advertisements.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/news/article"
                    className="flex-1 px-3 py-2 text-sm bg-[var(--nv-bg)] border border-[var(--nv-border)] rounded-sm focus:outline-none focus:border-[var(--nv-accent)] font-mono-meta"
                  />
                  <button
                    onClick={handleFetchUrl}
                    disabled={fetchingUrl || !urlInput.trim()}
                    className="inline-flex items-center justify-center gap-2 bg-[var(--nv-accent)] hover:bg-[var(--nv-accent-hover)] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-sm transition-colors shrink-0"
                  >
                    {fetchingUrl && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Fetch Article</span>
                  </button>
                </div>
                {urlError && (
                  <div className="border border-[var(--nv-contradicted)]/30 bg-[var(--nv-contradicted-bg)] text-[var(--nv-contradicted)] px-3.5 py-2.5 text-xs rounded-sm">
                    {urlError} If this site blocks automated fetching or is paywalled, copy the article text and use the <strong>Paste Article</strong> tab.
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: UPLOAD FILE */}
            {tab === 'upload' && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-serif-editorial text-lg font-semibold">
                    Upload an article
                  </h2>
                  <p className="text-xs text-[var(--nv-text-muted)] mt-1">
                    Supported formats: <span className="font-mono-meta">.txt</span>,{' '}
                    <span className="font-mono-meta">.pdf</span>,{' '}
                    <span className="font-mono-meta">.docx</span> (up to {config?.max_upload_mb ?? 10} MB).
                  </p>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) processFileUpload(f);
                  }}
                  className={`border-2 border-dashed rounded-sm p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-[var(--nv-accent)] bg-[var(--nv-surface-alt)]'
                      : 'border-[var(--nv-border)] bg-[var(--nv-bg)]'
                  }`}
                >
                  <Upload className="h-7 w-7 text-[var(--nv-text-muted)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--nv-text)] font-medium">
                    Drag and drop an article document here
                  </p>
                  <p className="text-xs text-[var(--nv-text-muted)] mt-1">or</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processFileUpload(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium border border-[var(--nv-border)] bg-[var(--nv-surface)] hover:bg-[var(--nv-surface-alt)] rounded-sm"
                  >
                    Browse files
                  </button>

                  {selectedFile && (
                    <div className="mt-4 max-w-md mx-auto text-left bg-[var(--nv-surface)] border border-[var(--nv-border)] p-3 rounded-sm">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate">{selectedFile.name}</span>
                        <span className="font-mono-meta text-[var(--nv-text-muted)]">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      {uploading && (
                        <div className="w-full h-1.5 bg-[var(--nv-surface-alt)] mt-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--nv-accent)] transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Prepared Article Review & Analysis Trigger */}
      {preparedArticle && (
        <section className="bg-[var(--nv-surface)] border border-[var(--nv-border)] p-6 rounded-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--nv-border)] pb-4">
            <div>
              <span className="font-mono-meta text-[11px] uppercase tracking-wider text-[var(--nv-accent)]">
                Article Ready for Verification · Source: {preparedArticle.input_type.toUpperCase()}
              </span>
              <h2 className="font-serif-editorial text-xl font-semibold mt-0.5">
                Review Extracted Content
              </h2>
            </div>
            <button
              onClick={resetPrepared}
              disabled={Boolean(job && job.status === 'running')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[var(--nv-border)] hover:bg-[var(--nv-surface-alt)] rounded-sm disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear &amp; Start Over</span>
            </button>
          </div>

          {/* Metadata Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--nv-bg)] border border-[var(--nv-border)] p-3.5 rounded-sm text-xs">
            <div>
              <span className="text-[var(--nv-text-muted)] block">Input Source</span>
              <span className="font-mono-meta font-medium uppercase">{preparedArticle.input_type}</span>
            </div>
            <div>
              <span className="text-[var(--nv-text-muted)] block">Detected Language</span>
              <span className="font-mono-meta font-medium uppercase">{preparedArticle.language}</span>
            </div>
            <div>
              <span className="text-[var(--nv-text-muted)] block">Word Count</span>
              <span className="font-mono-meta font-medium">{liveWordCount}</span>
            </div>
            <div>
              <span className="text-[var(--nv-text-muted)] block">Character Count</span>
              <span className="font-mono-meta font-medium">{liveCharCount}</span>
            </div>
          </div>

          {/* Editable Title & Text */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--nv-text-muted)] mb-1">
                Article Headline
              </label>
              <input
                type="text"
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                disabled={Boolean(job && job.status === 'running')}
                className="w-full px-3 py-2 text-sm font-serif-editorial font-semibold bg-[var(--nv-bg)] border border-[var(--nv-border)] rounded-sm focus:outline-none focus:border-[var(--nv-accent)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--nv-text-muted)] mb-1">
                Article Text Preview (editable before verification)
              </label>
              <textarea
                rows={10}
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                disabled={Boolean(job && job.status === 'running')}
                className="w-full p-3.5 text-sm leading-relaxed bg-[var(--nv-bg)] border border-[var(--nv-border)] rounded-sm focus:outline-none focus:border-[var(--nv-accent)]"
              />
            </div>
          </div>

          {/* Active Pipeline Progress */}
          {job && (
            <div className="border border-[var(--nv-border)] bg-[var(--nv-bg)] p-4 rounded-sm space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium flex items-center gap-2">
                  {job.status === 'running' || job.status === 'queued' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--nv-accent)]" />
                  ) : job.status === 'completed' ? (
                    <Check className="h-3.5 w-3.5 text-[var(--nv-supported)]" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--nv-contradicted)]" />
                  )}
                  <span>{job.message}</span>
                </span>
                <span className="font-mono-meta text-[var(--nv-text-muted)]">{job.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-[var(--nv-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--nv-accent)] transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
                {PIPELINE_STAGES.map((stageName, i) => {
                  const currentIdx = PIPELINE_STAGES.indexOf(job.stage);
                  const done = job.status === 'completed' || (currentIdx > i && currentIdx !== -1);
                  const active = job.stage === stageName && job.status === 'running';
                  return (
                    <div
                      key={stageName}
                      className={`text-[11px] px-2 py-1 border rounded-sm truncate ${
                        active
                          ? 'border-[var(--nv-accent)] text-[var(--nv-accent)] font-medium bg-[var(--nv-surface)]'
                          : done
                            ? 'border-[var(--nv-supported)]/30 text-[var(--nv-supported)] bg-[var(--nv-supported-bg)]'
                            : 'border-[var(--nv-border)] text-[var(--nv-text-muted)]'
                      }`}
                    >
                      {stageName}
                    </div>
                  );
                })}
              </div>
              {job.error && (
                <p className="text-xs text-[var(--nv-contradicted)]">{job.error}</p>
              )}
            </div>
          )}

          {/* Primary Action */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--nv-border)]">
            <p className="text-xs text-[var(--nv-text-muted)]">
              Verification runs NLP preprocessing, LLM claim extraction, Tavily search, hybrid retrieval, and NLI comparison.
            </p>
            <button
              onClick={handleAnalyzeArticle}
              disabled={startingAnalysis || Boolean(job && (job.status === 'running' || job.status === 'queued'))}
              className="inline-flex items-center gap-2 bg-[var(--nv-accent)] hover:bg-[var(--nv-accent-hover)] disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-sm transition-colors shrink-0"
            >
              {startingAnalysis ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>Analyze &amp; Verify Article</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
