import type { ApiConfig, ChatMessage, KnowledgeRecord, KnowledgeVersion } from './types';

const API_KEY = 'articleRead.api';
const CHAT_KEY = 'articleRead.chat.v2';
const KNOWLEDGE_KEY = 'articleRead.knowledge';

const canUseChrome = typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);

async function getValue<T>(key: string, fallback: T): Promise<T> {
  if (canUseChrome) return ((await chrome.storage.local.get(key))[key] as T) ?? fallback;
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) as T : fallback;
}

async function setValue<T>(key: string, value: T): Promise<void> {
  if (canUseChrome) await chrome.storage.local.set({ [key]: value });
  else localStorage.setItem(key, JSON.stringify(value));
}

export const defaultApiConfig: ApiConfig = { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4.1-mini' };
export const loadApiConfig = () => getValue(API_KEY, defaultApiConfig);
export const saveApiConfig = (value: ApiConfig) => setValue(API_KEY, value);
export async function loadChat(paperId: string): Promise<ChatMessage[]> {
  const all = await getValue<Record<string, ChatMessage[]>>(CHAT_KEY, {});
  return all[paperId] ?? [];
}

export async function saveChat(paperId: string, value: ChatMessage[]): Promise<void> {
  const all = await getValue<Record<string, ChatMessage[]>>(CHAT_KEY, {});
  await setValue(CHAT_KEY, { ...all, [paperId]: value });
}

const initialMarkdown = (title: string) => `# ${title}\n\n> 本文档由 Article Read 根据当前论文的阅读与问答记录生成。\n\n## 一句话定位\n\n待本次学习结束后生成。\n\n## 核心概念\n\n待补充。\n\n## 学习记录\n\n- 人工编辑内容会被保护，不会在自动合并时静默删除。\n`;

export async function loadKnowledge(paperId: string, title = '未命名论文'): Promise<KnowledgeRecord> {
  const all = await getValue<Record<string, KnowledgeRecord>>(KNOWLEDGE_KEY, {});
  return all[paperId] ?? { paperId, title, markdown: initialMarkdown(title), updatedAt: Date.now(), versions: [] };
}

export async function saveKnowledge(record: KnowledgeRecord): Promise<void> {
  const all = await getValue<Record<string, KnowledgeRecord>>(KNOWLEDGE_KEY, {});
  await setValue(KNOWLEDGE_KEY, { ...all, [record.paperId]: record });
}

export function makeVersion(record: KnowledgeRecord, markdown: string, summary: string, source: KnowledgeVersion['source']): KnowledgeRecord {
  const version: KnowledgeVersion = { id: crypto.randomUUID(), version: record.versions.length + 1, markdown, summary, source, createdAt: Date.now() };
  return { ...record, markdown, updatedAt: version.createdAt, versions: [version, ...record.versions] };
}
