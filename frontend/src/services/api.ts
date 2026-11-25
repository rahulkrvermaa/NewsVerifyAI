import type {
  AnalysisJob,
  Article,
  ConfigStatus,
  DashboardStats,
  EvidenceLibraryItem,
  HistoryItem,
  InvestigationReport,
} from '../types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // ignore JSON parse error
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getConfigStatus: () => request<ConfigStatus>('/config/status'),

  getDashboard: () => request<DashboardStats>('/dashboard'),

  pasteArticle: (payload: { title?: string; text: string; language?: string }) =>
    request<Article>('/articles/paste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  fetchUrlArticle: (payload: { url: string; language?: string }) =>
    request<Article>('/articles/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  uploadArticleFile: (file: File, language = 'auto'): Promise<Article> => {
    const form = new FormData();
    form.append('file', file);
    form.append('language', language);
    return request<Article>('/articles/upload', {
      method: 'POST',
      body: form,
    });
  },

  updateArticle: (articleId: string, payload: { title?: string; text: string; language?: string }) =>
    request<Article>(`/articles/${articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  deleteArticle: (articleId: string) =>
    request<{ deleted: boolean; article_id: string }>(`/articles/${articleId}`, {
      method: 'DELETE',
    }),

  startAnalysis: (articleId: string) =>
    request<AnalysisJob>(`/analyze/${articleId}`, {
      method: 'POST',
    }),

  getJobStatus: (jobId: string) => request<AnalysisJob>(`/analyze/job/${jobId}`),

  getAnalysisReport: (articleId: string) =>
    request<InvestigationReport>(`/analysis/${articleId}`),

  getHistory: (params?: { search?: string; assessment?: string; sort?: 'asc' | 'desc' }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.assessment) qs.set('assessment', params.assessment);
    if (params?.sort) qs.set('sort', params.sort);
    const query = qs.toString();
    return request<HistoryItem[]>(`/history${query ? `?${query}` : ''}`);
  },

  getEvidenceLibrary: (params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString();
    return request<EvidenceLibraryItem[]>(`/evidence${query ? `?${query}` : ''}`);
  },

  reverifyProposition: (propositionId: string, customQuery?: string) =>
    request<import('../types').Proposition>(`/propositions/${propositionId}/reverify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_query: customQuery || null }),
    }),
};
