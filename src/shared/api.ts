import type { ApiConfig, ChatMessage, Citation, PaperTextChunk } from './types';

const trimSlash = (value: string) => value.replace(/\/+$/, '');

async function apiError(response: Response, fallback: string): Promise<Error> {
  const raw = await response.text();
  let detail = '';
  try {
    const data = JSON.parse(raw);
    detail = data.error?.message || data.message || '';
  } catch {
    detail = raw.trim();
  }
  const message = detail || `${fallback}（HTTP ${response.status}）`;
  return new Error(message.length > 240 ? `${message.slice(0, 240)}…` : message);
}

export async function testConnection(config: ApiConfig): Promise<void> {
  if (!config.apiKey.trim()) throw new Error('请输入 API Key');
  if (!config.baseUrl.trim()) throw new Error('请输入 Base URL');
  const response = await fetch(`${trimSlash(config.baseUrl.trim())}/models`, {
    headers: { Authorization: `Bearer ${config.apiKey.trim()}`, Accept: 'application/json' },
  });
  if (!response.ok) throw await apiError(response, '连接失败');
}

function validatedCitations(text: string, evidence: PaperTextChunk[]): Citation[] {
  const ids = [...new Set([...text.matchAll(/\[P(\d+)\]/g)].map(match => Number(match[1]) - 1))];
  return ids.filter(index => evidence[index]).map(index => ({
    id: evidence[index].id,
    sourceLabel: `P${index + 1}`,
    text: evidence[index].text,
    section: evidence[index].section,
    page: evidence[index].page,
    kind: 'paper' as const,
  }));
}

export async function askModel(config: ApiConfig, messages: ChatMessage[], external: boolean, signal?: AbortSignal, evidence: PaperTextChunk[] = []): Promise<{ text: string; citations: Citation[] }> {
  if (!config.apiKey) throw new Error('请先配置 API Key');
  const evidenceBlock = evidence.length ? `\n\n以下是扩展从当前 PDF 中检索出的真实原文。引用时只能使用对应编号 [P1]、[P2]，不得创造编号。没有充分依据时明确说明。\n${evidence.map((chunk,index)=>`\n[P${index+1}] Section: ${chunk.section || '未识别章节'}; Page: ${chunk.page}\n${chunk.text}`).join('\n')}` : '\n\n本次请求没有注入 PDF 原文。不得声称回答基于当前论文，也不得伪造论文引用。';
  const system = `你是英文论文阅读助手。用简体中文回答，保留必要英文术语。区分当前论文原文、外部知识和模型推断。凡是依据当前论文作出的事实陈述，都必须在对应句末标注真实编号 [P1]、[P2]。${evidenceBlock}`;
  const input = messages.map(m => ({ role: m.role, content: m.citation ? `引用原文：${m.citation.text}\n\n${m.content}` : m.content }));

  if (external && trimSlash(config.baseUrl) === 'https://api.openai.com/v1') {
    const response = await fetch(`${trimSlash(config.baseUrl)}/responses`, {
      method: 'POST', signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, instructions: system, input, tools: [{ type: 'web_search' }] }),
    });
    if (!response.ok) throw await apiError(response, '请求失败');
    const data = await response.json();
    const text = data.output_text || data.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === 'output_text')?.text || '未获得回答';
    return { text, citations: validatedCitations(text, evidence) };
  }

  const response = await fetch(`${trimSlash(config.baseUrl)}/chat/completions`, {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: system }, ...input], temperature: 0.2 }),
  });
  if (!response.ok) throw await apiError(response, '请求失败');
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '未获得回答';
  return { text, citations: validatedCitations(text, evidence) };
}

export async function summarizeLearning(config: ApiConfig, messages: ChatMessage[], currentMarkdown: string): Promise<string> {
  if (!messages.length || !config.apiKey) return `${currentMarkdown}\n\n## 本次新增理解\n\n- 本次会话已结束，后续可在编辑模式中补充学习记录。\n`;
  const prompt = `请根据以下论文学习对话更新 Markdown 知识文档。保留原文中标记为人工编辑的内容，不要删除已有事实；新增“本次新增理解”和“待解决问题”。只输出完整 Markdown。\n\n现有文档：\n${currentMarkdown}\n\n对话：\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`;
  const result = await askModel(config, [{ id: 'summary', role: 'user', content: prompt, createdAt: Date.now() }], false);
  return result.text.replace(/^```markdown\s*|```$/g, '').trim();
}
