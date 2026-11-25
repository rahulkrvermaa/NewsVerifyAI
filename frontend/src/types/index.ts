export type VerdictType =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'INSUFFICIENT EVIDENCE'
  | 'CONFLICTING EVIDENCE'
  | 'PENDING';

export type PageRoute =
  | 'overview'
  | 'new-investigation'
  | 'results'
  | 'history'
  | 'evidence'
  | 'about'
  | 'settings';

export interface Article {
  id: string;
  title: string;
  original_text: string;
  input_type: 'paste' | 'url' | 'upload';
  original_url?: string | null;
  publisher?: string | null;
  publication_date?: string | null;
  author?: string | null;
  language: string;
  word_count: number;
  char_count: number;
  overall_assessment?: string | null;
  overall_summary?: string | null;
  important_findings?: string[] | null;
  created_at: string;
  analyzed_at?: string | null;
}

export interface EvidenceItem {
  id: string;
  proposition_id: string;
  source_title: string;
  source_url: string;
  publisher: string;
  publication_date?: string | null;
  evidence_text: string;
  highlighted_excerpt?: string | null;
  source_category: string;
  relevance_score: number;
  nli_label?: string | null;
  nli_score?: number | null;
  stance: 'supporting' | 'contradicting' | 'neutral';
  created_at: string;
}

export interface VerificationDetail {
  id: string;
  proposition_id: string;
  verdict: VerdictType;
  explanation: string;
  supporting_evidence_ids: string[];
  contradicting_evidence_ids: string[];
  confidence?: number | null;
  search_queries: string[];
  verified_at: string;
}

export interface Proposition {
  id: string;
  article_id: string;
  claim_code: string;
  claim_text: string;
  original_sentence: string;
  sentence_index: number;
  claim_type: string;
  verifiability: string;
  entities: string[];
  dates: string[];
  numbers: string[];
  verification_status: VerdictType;
  evidence_count: number;
  confidence?: number | null;
  verification?: VerificationDetail | null;
  evidence_items: EvidenceItem[];
}

export interface VerificationSummaryStats {
  total_propositions: number;
  supported: number;
  contradicted: number;
  insufficient_evidence: number;
  conflicting_evidence: number;
}

export interface InvestigationReport {
  article: Article;
  summary: VerificationSummaryStats;
  propositions: Proposition[];
  latest_job_status?: string | null;
}

export interface AnalysisJob {
  job_id: string;
  article_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: string;
  progress: number;
  message: string;
  error?: string | null;
}

export interface HistoryItem {
  id: string;
  title: string;
  input_type: string;
  publisher?: string | null;
  publication_date?: string | null;
  created_at: string;
  analyzed_at?: string | null;
  proposition_count: number;
  overall_assessment?: string | null;
  summary: VerificationSummaryStats;
}

export interface DashboardStats {
  articles_analyzed: number;
  propositions_extracted: number;
  supported_claims: number;
  contradicted_claims: number;
  further_investigation_claims: number;
  conflicting_claims: number;
  distribution: Record<string, number>;
  recent_investigations: HistoryItem[];
  recent_sources: EvidenceItem[];
  latest_activity: Array<{
    id: string;
    article_id: string;
    article_title: string;
    claim_code: string;
    claim_text: string;
    verdict: string;
    timestamp: string;
  }>;
}

export interface EvidenceLibraryItem {
  id: string;
  proposition_id: string;
  article_id: string;
  article_title: string;
  claim_code: string;
  claim_text: string;
  source_title: string;
  source_url: string;
  publisher: string;
  publication_date?: string | null;
  evidence_text: string;
  highlighted_excerpt?: string | null;
  source_category: string;
  relevance_score: number;
  stance: string;
  created_at: string;
}

export interface ConfigStatus {
  llm_configured: boolean;
  tavily_configured: boolean;
  llm_model: string;
  embedding_model: string;
  nli_model: string;
  spacy_model: string;
  max_upload_mb: number;
}
