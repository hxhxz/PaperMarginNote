export type PaperContext = {
  id: string;
  title: string;
  url: string;
};

function hash(value: string): string {
  let result = 5381;
  for (let i = 0; i < value.length; i += 1) result = ((result << 5) + result) ^ value.charCodeAt(i);
  return (result >>> 0).toString(36);
}

function cleanTitle(value: string, url: string): string {
  const fromTab = value
    .replace(/\s*-\s*(Google Chrome|Chromium)$/i, '')
    .replace(/\.pdf$/i, '')
    .trim();
  if (fromTab && !/^pdf$/i.test(fromTab)) return fromTab;
  try {
    const filename = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return filename.replace(/\.pdf$/i, '').trim() || '未命名论文';
  } catch {
    return '未命名论文';
  }
}

export function createPaperContext(url: string, tabTitle = ''): PaperContext {
  const normalizedUrl = url.split('#')[0] || 'unknown-pdf';
  return { id: `paper-${hash(normalizedUrl)}`, title: cleanTitle(tabTitle, normalizedUrl), url: normalizedUrl };
}
