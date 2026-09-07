import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, CircleStop, FileText, Search, Settings, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { askModel, summarizeLearning, testConnection } from '../shared/api';
import { defaultApiConfig, loadApiConfig, loadChat, loadKnowledge, makeVersion, saveApiConfig, saveChat, saveKnowledge } from '../shared/storage';
import type { ApiConfig, ChatMessage, Citation } from '../shared/types';
import { createPaperContext, type PaperContext } from '../shared/paper';
import { parsePaper, retrieveEvidence } from '../shared/pdf';
import type { ParsedPaper, PaperTextChunk } from '../shared/types';

type PendingSelection = { text: string; action: string; pageUrl: string; tabTitle?: string; createdAt: number };

function Header({ onSettings, onKnowledge, onFinish, busy }: { onSettings:()=>void; onKnowledge:()=>void; onFinish:()=>void; busy:boolean }) {
  return <header className="side-header"><h1>论文问答</h1><div className="header-actions">
    <button className="icon-button" title="模型 API 配置" aria-label="模型 API 配置" onClick={onSettings}><Settings size={16}/></button>
    <button className="icon-button" title="知识文档" aria-label="知识文档" onClick={onKnowledge}><FileText size={16}/></button>
    <button className="icon-button primary" title="结束本次学习" aria-label="结束本次学习" onClick={onFinish} disabled={busy}><CircleStop size={16}/></button>
  </div></header>;
}

function CitationAttachment({ citation, onRemove }: { citation:Citation; onRemove:()=>void }) {
  return <div className="attachment"><div className="attachment-head"><strong>引用 PDF 原文</strong><button aria-label="移除引用" onClick={onRemove}><X size={15}/></button></div><p>{citation.text}</p><small>{citation.section || '待确认章节'}{citation.page ? ` · Page ${citation.page}` : ''}</small></div>;
}

function Conversation({ messages }: { messages:ChatMessage[] }) {
  const [expandedSource,setExpandedSource]=useState<string>();
  if (!messages.length) return <div className="empty-chat"><div className="empty-mark"><FileText size={20}/></div><h2>基于论文原文开始提问</h2><p>在 PDF 中选中文字并右键“引用内容并提问”，或直接输入你的问题。</p></div>;
  return <div className="conversation">{messages.map(m => m.role === 'user' ? <article className="message user" key={m.id}>{m.citation && <><span className="citation-label">引用原文</span><blockquote>{m.citation.text}</blockquote></>}<p>{m.content}</p></article> : <article className="message assistant" key={m.id}><span className={`evidence-chip ${m.evidenceKind||'model'}`}>{m.evidenceKind==='paper'?'论文证据':m.evidenceKind==='external'?'外部知识':'模型回答'}</span><div className="markdown-answer"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({node:_,...props})=><a {...props} target="_blank" rel="noreferrer"/>}}>{m.content}</ReactMarkdown></div>{m.citations?.map((source,index)=>{const key=source.id||`${m.id}-${index}`;return <div className="source-item" key={key}><button className="source-row" onClick={()=>setExpandedSource(expandedSource===key?undefined:key)}>[{source.sourceLabel||`P${index+1}`}] {source.section || '原文片段'}{source.page ? ` · Page ${source.page}` : ''}<ArrowRight size={15}/></button>{expandedSource===key&&<blockquote className="source-excerpt">{source.text}</blockquote>}</div>})}</article>)}</div>;
}

function ChatView({ onSettings }: { onSettings:()=>void }) {
  const [messages,setMessages]=useState<ChatMessage[]>([]); const [citation,setCitation]=useState<Citation>();
  const [question,setQuestion]=useState(''); const [external,setExternal]=useState(false); const [loading,setLoading]=useState(false); const [finishing,setFinishing]=useState(false);
  const [paper,setPaper]=useState<PaperContext>(()=>createPaperContext('unknown-pdf'));
  const [parsedPaper,setParsedPaper]=useState<ParsedPaper>(); const [parseStatus,setParseStatus]=useState<'loading'|'ready'|'error'>('loading'); const [parseMessage,setParseMessage]=useState('正在读取当前 PDF…');
  const abortRef=useRef<AbortController>();
  const composingRef=useRef(false);
  async function activatePaper(context:PaperContext){setPaper(context);setParsedPaper(undefined);setParseStatus('loading');setParseMessage('正在读取当前 PDF…');loadChat(context.id).then(setMessages);try{const parsed=await parsePaper(context);setParsedPaper(parsed);setPaper({...context,title:parsed.title});setParseStatus('ready');setParseMessage(`已读取 ${parsed.pageCount} 页，可基于原文问答`);}catch(error){setParseStatus('error');setParseMessage((error as Error).message);}}
  useEffect(()=>{chrome.tabs.query({active:true,currentWindow:true}).then(([tab])=>{if(!tab)return;activatePaper(createPaperContext(tab.url||'unknown-pdf',tab.title||''));});chrome.storage?.session?.get('pendingSelection').then(({pendingSelection})=>{if(pendingSelection) applySelection(pendingSelection);});
    const listener=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='session'&&changes.pendingSelection?.newValue) applySelection(changes.pendingSelection.newValue);}; chrome.storage?.onChanged?.addListener(listener); return()=>chrome.storage?.onChanged?.removeListener(listener);
  },[]);
  function applySelection(value:PendingSelection){const context=createPaperContext(value.pageUrl||'unknown-pdf',value.tabTitle||'');if(context.id!==paper.id)activatePaper(context);setCitation({text:value.text,kind:'paper'}); if(value.action==='translate')setQuestion('请翻译这段内容，并解释它在当前语境中的含义。'); if(value.action==='explain')setQuestion('请解释这段内容的概念、推理过程和作用。'); chrome.storage?.session?.remove('pendingSelection');}
  async function send(){const text=question.trim();if(!text||loading)return;const originalCitation=citation;const user:ChatMessage={id:crypto.randomUUID(),role:'user',content:text,citation:originalCitation,createdAt:Date.now()};const next=[...messages,user];setMessages(next);setQuestion('');setCitation(undefined);setLoading(true);abortRef.current=new AbortController();try{const config=await loadApiConfig();let evidence:PaperTextChunk[]=parsedPaper?retrieveEvidence(parsedPaper,text,originalCitation?.text):[];if(!evidence.length&&originalCitation)evidence=[{id:`${paper.id}-selection-${user.id}`,paperId:paper.id,page:0,text:originalCitation.text}];const result=await askModel(config,next,external,abortRef.current.signal,evidence);const evidenceKind=result.citations.length?'paper':external?'external':'model';const assistant:ChatMessage={id:crypto.randomUUID(),role:'assistant',content:result.text,citations:result.citations,evidenceKind,createdAt:Date.now()};const done=[...next,assistant];setMessages(done);await saveChat(paper.id,done);}catch(error){if((error as Error).name!=='AbortError'){const failed:ChatMessage={id:crypto.randomUUID(),role:'assistant',content:`无法生成回答：${(error as Error).message}`,evidenceKind:'model',createdAt:Date.now()};setMessages([...next,failed]);}}finally{setLoading(false);}}
  async function finish(){setFinishing(true);try{const [config,record]=await Promise.all([loadApiConfig(),loadKnowledge(paper.id,paper.title)]);const markdown=await summarizeLearning(config,messages,record.markdown);await saveKnowledge(makeVersion(record,markdown,'合并本次学习：新增理解与待解决问题','auto'));chrome.runtime?.sendMessage({type:'OPEN_KNOWLEDGE',paperId:paper.id,title:paper.title});}finally{setFinishing(false);}}
  function openKnowledge(){chrome.runtime?.sendMessage({type:'OPEN_KNOWLEDGE',paperId:paper.id,title:paper.title});}
  return <div className="side-shell"><Header onSettings={onSettings} onKnowledge={openKnowledge} onFinish={finish} busy={finishing}/><main className="chat-body"><Conversation messages={messages}/></main><div className={`paper-status ${parseStatus}`}>{parseMessage}</div><section className={`composer-wrap ${citation?'with-citation':'compact'}`}><div className="composer">{citation&&<CitationAttachment citation={citation} onRemove={()=>setCitation(undefined)}/>}<textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder={citation?'基于这段原文提问…':'输入论文问题…'} onCompositionStart={()=>{composingRef.current=true}} onCompositionEnd={()=>{composingRef.current=false}} onKeyDown={e=>{const composing=composingRef.current||e.nativeEvent.isComposing||e.nativeEvent.keyCode===229;if(e.key==='Enter'&&!e.shiftKey&&!composing){e.preventDefault();send();}}}/><div className="composer-divider"/><div className="composer-tools"><span className="mode active">论文优先</span><button className={`mode ${external?'active':''}`} onClick={()=>setExternal(v=>!v)}><Search size={14}/>外部知识</button>{loading?<button className="send" onClick={()=>abortRef.current?.abort()}><CircleStop size={16}/></button>:<button className="send" onClick={send} disabled={!question.trim()}><ArrowUp size={17}/></button>}</div></div></section>{finishing&&<div className="busy-layer">正在整理本次学习并创建版本…</div>}</div>;
}

function SettingsView({ onBack }: { onBack:()=>void }) {
  const [config,setConfig]=useState<ApiConfig>(defaultApiConfig); const [status,setStatus]=useState<'idle'|'testing'|'success'|'error'>('idle'); const [message,setMessage]=useState('');
  useEffect(()=>{loadApiConfig().then(setConfig)},[]); const field=(key:keyof ApiConfig)=>(e:React.ChangeEvent<HTMLInputElement>)=>setConfig({...config,[key]:e.target.value});
  async function ensurePermission(){if(!chrome.permissions)return true;const origin=`${new URL(config.baseUrl).origin}/*`;const has=await chrome.permissions.contains({origins:[origin]});return has||chrome.permissions.request({origins:[origin]});}
  async function test(){setStatus('testing');try{if(!await ensurePermission())throw new Error('未授予模型接口访问权限');await testConnection(config);setStatus('success');setMessage('接口可访问 · 模型服务已响应');}catch(e){setStatus('error');setMessage((e as Error).message);}}
  async function save(){try{if(!await ensurePermission())throw new Error('未授予模型接口访问权限');await saveApiConfig(config);if(status==='success')setMessage('配置已保存 · 模型服务已响应');}catch(e){setStatus('error');setMessage((e as Error).message);}}
  return <div className="settings-view"><header className="settings-header"><button className="icon-button" onClick={onBack} aria-label="返回"><ArrowLeft size={17}/></button><h1>模型 API 配置</h1></header><main><section className="privacy"><strong>密钥仅保存在当前浏览器</strong><span>不会写入论文、对话或知识文档。</span></section><label>服务类型<input value="OpenAI / 兼容接口" disabled/></label><label>Base URL<input value={config.baseUrl} onChange={field('baseUrl')}/></label><label>API Key<input type="password" value={config.apiKey} onChange={field('apiKey')} placeholder="sk-…"/></label><label>模型名称<input value={config.model} onChange={field('model')}/></label>{status!=='idle'&&<section className={`connection ${status}`}><CheckCircle2 size={18}/><strong>{status==='testing'?'正在测试':status==='error'?'连接失败':'连接成功'}</strong><span>{message||'正在验证模型接口'}</span></section>}<div className="settings-actions"><button className="button" onClick={test} disabled={status==='testing'}>测试连接</button><button className="button primary" onClick={save}>保存配置</button></div><p className="permission-note">读取本地 PDF 前，还需要在 Chrome 扩展详情中开启“允许访问文件网址”。</p></main></div>;
}

export function SidebarApp(){const [view,setView]=useState<'chat'|'settings'>('chat');return view==='chat'?<ChatView onSettings={()=>setView('settings')}/>:<SettingsView onBack={()=>setView('chat')}/>;}
