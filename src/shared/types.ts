export type ApiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type Citation = {
  id?: string;
  sourceLabel?: string;
  text: string;
  section?: string;
  page?: number;
  url?: string;
  kind: 'paper' | 'external';
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citation?: Citation;
  citations?: Citation[];
  evidenceKind?: 'paper' | 'external' | 'model';
  createdAt: number;
};

export type PaperTextChunk = {
  id: string;
  paperId: string;
  page: number;
  section?: string;
  text: string;
};

export type ParsedPaper = {
  paperId: string;
  url: string;
  title: string;
  pageCount: number;
  chunks: PaperTextChunk[];
  parsedAt: number;
};

export type KnowledgeVersion = {
  id: string;
  version: number;
  markdown: string;
  summary: string;
  source: 'auto' | 'manual' | 'restore';
  createdAt: number;
};

export type KnowledgeRecord = {
  paperId: string;
  title: string;
  markdown: string;
  updatedAt: number;
  versions: KnowledgeVersion[];
};
