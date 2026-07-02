// AssistantPanel.tsx
// ------------------
// Native Leon chat as a globally-available slide-over. Talks to Leon over its
// real socket.io protocol (via leonClient) — Leon streams replies as `answer`
// events; its HTTP endpoint does NOT return replies. The socket auth uses the
// user's Oz JWT, so the assistant requires being signed in.
//
// Streaming: in Agent mode Leon emits `llm-token` fragments which we render into
// a live bubble, then reconcile by replacing it with the final (HTML) `answer`.
import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Bot, User, Zap } from 'lucide-react';
import DOMPurify from 'dompurify';
import { leonClient, type LeonStatus } from '../utils/leonClient';

interface Msg { role: 'user' | 'assistant'; text: string }

// Leon returns HTML (<br>, <ul>, <li>…). Sanitize before rendering.
function renderAssistant(html: string): { __html: string } {
  return { __html: DOMPurify.sanitize(html, { ALLOWED_TAGS: ['br', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'code', 'pre', 'a', 'p', 'span'], ALLOWED_ATTR: ['href', 'target', 'rel'] }) };
}

const STATUS_META: Record<LeonStatus, { dot: string; label: string }> = {
  idle: { dot: '#64748b', label: 'Offline' },
  connecting: { dot: '#f59e0b', label: 'Connecting…' },
  ready: { dot: '#10b981', label: 'Online' },
  error: { dot: '#ef4444', label: 'Connection error' },
  unauthenticated: { dot: '#ef4444', label: 'Sign in required' },
};

export default function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', text: "Hi — I'm Leon. Ask me about your servers, containers, or to run an operation." },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [progress, setProgress] = useState('');
  const [status, setStatus] = useState<LeonStatus>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [agentMode, setAgentMode] = useState(false);
  const [stream, setStream] = useState<string | null>(null); // live streamed text, null = not streaming
  const endRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef('');          // authoritative streamed text (avoids stale closures)
  const activeRef = useRef(false);       // is a streamed generation in progress this turn?
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wire up the socket once, on mount; connect lazily when the panel opens.
  useEffect(() => {
    const clearFallback = () => { if (fallbackTimer.current) { clearTimeout(fallbackTimer.current); fallbackTimer.current = null; } };
    const resetStream = () => { activeRef.current = false; streamRef.current = ''; setStream(null); };

    const offStatus = leonClient.on('status', (s) => setStatus(s));
    // Final answer is authoritative (HTML). It replaces any streamed preview.
    const offAnswer = leonClient.on('answer', (text) => {
      clearFallback();
      resetStream();
      setMsgs((m) => [...m, { role: 'assistant', text }]);
      setTyping(false);
      setProgress('');
    });
    // Streamed token fragment — grow the live preview bubble.
    const offToken = leonClient.on('token', (chunk) => {
      activeRef.current = true;
      streamRef.current += chunk;
      setStream(streamRef.current);
      setTyping(false);
    });
    const offProgress = leonClient.on('progress', (p) => setProgress(p));
    const offTyping = leonClient.on('typing', (t) => {
      setTyping(t);
      // Fallback: if streaming happened but the final answer never lands, commit
      // the streamed text so the reply is never lost.
      if (!t && activeRef.current) {
        clearFallback();
        fallbackTimer.current = setTimeout(() => {
          if (activeRef.current && streamRef.current) {
            const text = streamRef.current;
            resetStream();
            setMsgs((m) => [...m, { role: 'assistant', text }]);
          }
        }, 4000);
      }
    });
    const offSuggest = leonClient.on('suggest', (s) => setSuggestions(s));
    return () => { clearFallback(); offStatus(); offAnswer(); offToken(); offProgress(); offTyping(); offSuggest(); };
  }, []);

  useEffect(() => { if (open) leonClient.connect(); }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open, typing, progress, stream]);

  const send = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text) return;
    setSuggestions([]);
    if (status === 'unauthenticated') {
      setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '⚠️ Please sign in to chat with Leon.' }]);
      setInput('');
      return;
    }
    // Reset any leftover stream state before the new turn.
    if (fallbackTimer.current) { clearTimeout(fallbackTimer.current); fallbackTimer.current = null; }
    activeRef.current = false; streamRef.current = ''; setStream(null);
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text }]);
    const ok = leonClient.send(text, { agentMode });
    if (ok) setTyping(true);
    else setMsgs((m) => [...m, { role: 'assistant', text: '⏳ Connecting to Leon — send again in a moment.' }]);
  };

  const meta = STATUS_META[status];

  return (
    <>
      {/* Floating launcher (bottom-right) */}
      <button onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-bold text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', boxShadow: '0 8px 30px rgba(14,165,233,0.4)' }}
        title="Ask Leon, the AI assistant">
        <Sparkles size={16} /> Assistant
      </button>

      {/* Slide-over */}
      <div className={`fixed top-0 right-0 h-full z-[65] w-full max-w-md transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', boxShadow: '-20px 0 60px rgba(0,0,0,0.4)' }}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(99,102,241,0.2))' }}>
                <Bot size={16} className="text-sky-400" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Leon Assistant</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot, boxShadow: `0 0 6px ${meta.dot}` }} />
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{meta.label}</p>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close assistant" style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: m.role === 'user' ? 'rgba(99,102,241,0.15)' : 'rgba(14,165,233,0.15)' }}>
                  {m.role === 'user' ? <User size={13} className="text-indigo-400" /> : <Bot size={13} className="text-sky-400" />}
                </div>
                {m.role === 'user' ? (
                  <div className="text-sm rounded-2xl px-3.5 py-2 max-w-[78%] whitespace-pre-wrap break-words"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}>
                    {m.text}
                  </div>
                ) : (
                  <div className="leon-msg text-sm rounded-2xl px-3.5 py-2 max-w-[78%] break-words"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    dangerouslySetInnerHTML={renderAssistant(m.text)} />
                )}
              </div>
            ))}
            {/* Live streaming preview (Agent mode): raw tokens + blinking caret. */}
            {stream !== null && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(14,165,233,0.15)' }}><Bot size={13} className="text-sky-400" /></div>
                <div className="text-sm rounded-2xl px-3.5 py-2 max-w-[78%] whitespace-pre-wrap break-words"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  {stream}<span className="leon-caret" />
                </div>
              </div>
            )}
            {/* Typing dots — only when not already streaming tokens. */}
            {typing && stream === null && (
              <div className="flex gap-2 items-center">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.15)' }}><Bot size={13} className="text-sky-400" /></div>
                <div className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5" style={{ background: 'var(--bg-input)' }}>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '300ms' }} />
                  </div>
                  {progress && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{progress}</span>}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggestion chips */}
          {suggestions.length > 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {suggestions.slice(0, 4).map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full transition-colors"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setAgentMode((a) => !a)}
                title="Agent mode runs Leon's agentic reasoning and streams the reply token-by-token."
                className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors"
                style={agentMode
                  ? { background: 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(99,102,241,0.2))', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.4)' }
                  : { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-input)' }}>
                <Zap size={12} /> Agent mode {agentMode ? 'on' : 'off'}
              </button>
              {agentMode && <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>streams · slower · can use tools</span>}
            </div>
            <div className="flex items-end gap-2">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={status === 'unauthenticated' ? 'Sign in to chat with Leon…' : 'Ask Leon…  (Enter to send)'}
                className="flex-1 text-sm px-3 py-2 rounded-xl resize-none max-h-32"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
              <button onClick={() => send()} disabled={!input.trim()}
                className="p-2.5 rounded-xl text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
