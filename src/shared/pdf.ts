import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PaperContext } from './paper';
import type { ParsedPaper, PaperTextChunk } from './types';
import { getParsedPaper, putParsedPaper } from './pdfStore';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const SECTION_PATTERN = /\b(?:(\d+(?:\.\d+)*)\s+)?(abstract|introduction|related work|background|method(?:ology)?|approach|experiments?|results?|discussion|conclusion|limitations?)\b/i;

export function resolvePdfUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const nested = parsed.searchParams.get('file');
    return nested ? decodeURIComponent(nested) : url;
  } catch {
    return url;
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function splitPage(paperId: string, page: number, text: string, section?: string): PaperTextChunk[] {
  const normalized = normalizeText(text);
  const size = 1600;
  const overlap = 180;
  const chunks: PaperTextChunk[] = [];
  for (let start = 0, index = 0; start < normalized.length; start += size - overlap, index += 1) {
    const end = Math.min(start + size, normalized.length);
    chunks.push({ id: `${paperId}-p${page}-c${index}`, paperId, page, section, text: normalized.slice(start, end) });
    if (end === normalized.length) break;
  }
  return chunks;
}

export async function parsePaper(context: PaperContext): Promise<ParsedPaper> {
  const cached = await getParsedPaper(context.id);
  if (cached?.url === context.url && cached.chunks.length) return cached;

  const pdfUrl = resolvePdfUrl(context.url);
  if (!/^(https?:|file:)/i.test(pdfUrl)) throw new Error('当前标签不是可获取的 PDF 地址');
  const response = await fetch(pdfUrl);
  if (!response.ok) throw new Error(`PDF 下载失败（HTTP ${response.status}）`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const chunks: PaperTextChunk[] = [];
  let currentSection: string | undefined;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => 'str' in item ? item.str : '').join(' ');
    const match = pageText.match(SECTION_PATTERN);
    if (match) currentSection = `${match[1] ? `${match[1]} ` : ''}${match[2]}`;
    chunks.push(...splitPage(context.id, pageNumber, pageText, currentSection));
  }

  if (!chunks.length) throw new Error('PDF 没有可提取文字，可能是扫描版文档');
  const metadata = await document.getMetadata().catch(() => undefined);
  const metadataTitle = metadata && 'info' in metadata && typeof metadata.info === 'object' && metadata.info && 'Title' in metadata.info ? String(metadata.info.Title || '') : '';
  const paper: ParsedPaper = { paperId: context.id, url: context.url, title: metadataTitle.trim() || context.title, pageCount: document.numPages, chunks, parsedAt: Date.now() };
  await putParsedPaper(paper);
  return paper;
}

function terms(query: string): string[] {
  return [...new Set((query.toLowerCase().match(/[a-z][a-z0-9-]{2,}|[\u4e00-\u9fa5]{2,}/g) || []))];
}

export function retrieveEvidence(paper: ParsedPaper, query: string, selection?: string, limit = 6): PaperTextChunk[] {
  const queryTerms = terms(query);
  const requestedSection = ['introduction','abstract','related work','method','experiment','conclusion'].find(name => query.toLowerCase().includes(name));
  const normalizedSelection = selection ? normalizeText(selection).toLowerCase().slice(0, 160) : '';
  return paper.chunks.map((chunk, index) => {
    const haystack = chunk.text.toLowerCase();
    let score = queryTerms.reduce((sum, term) => sum + (haystack.includes(term) ? Math.min(4, haystack.split(term).length - 1) : 0), 0);
    if (requestedSection && chunk.section?.toLowerCase().includes(requestedSection)) score += 12;
    if (normalizedSelection && haystack.includes(normalizedSelection)) score += 30;
    if (index < 3) score += 0.25;
    return { chunk, score };
  }).sort((a,b) => b.score - a.score).slice(0, limit).map(item => item.chunk);
}
