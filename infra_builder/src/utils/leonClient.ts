// leonClient.ts
// -------------
// Socket.io client for Leon's real chat protocol.
//
// IMPORTANT: Leon's HTTP `POST /leon/api/v1/utterance` only triggers processing
// and returns `{success:true}` — it NEVER returns the assistant's reply. Replies
// stream back over socket.io. So this is the ONLY way to actually chat with Leon.
//
// Flow (see orchestration/leon/server/src/core/socket-server.ts):
//   connect (auth: { token: <Oz JWT> })  ->  emit 'init'  ->  server 'ready'
//   emit 'utterance'  ->  server emits 'is-typing' / 'answer' / 'suggest'
//
// The gateway strips the `/leon` prefix, so the socket.io path is `/leon/socket.io`.
import { io, Socket } from 'socket.io-client';
import { LEON_BASE } from '../config/api';
import { getToken } from './ozClient';

const CLIENT_NAME = 'infrastudio-web';

export type LeonStatus = 'idle' | 'connecting' | 'ready' | 'error' | 'unauthenticated';

export interface LeonEvents {
  status: (status: LeonStatus, detail?: string) => void;
  answer: (html: string) => void;
  // Transient "Choosing skill… / Running action…" progress; empty string clears it.
  progress: (text: string) => void;
  // A streamed LLM token (agent mode). generationId groups a single generation.
  token: (chunk: string, generationId: string) => void;
  typing: (isTyping: boolean) => void;
  suggest: (suggestions: string[]) => void;
}

export interface SendOptions {
  // Force Leon's agentic (ReAct) routing, which streams `llm-token` events.
  agentMode?: boolean;
}

type Listener<K extends keyof LeonEvents> = LeonEvents[K];

/** Normalise Leon's `answer` payload (string | {answer,...} | widget) to text/HTML. */
function answerToText(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object') {
    const rec = payload as Record<string, unknown>;
    if (typeof rec.answer === 'string') return rec.answer;
    if (typeof rec.fallbackText === 'string') return rec.fallbackText;
  }
  return '';
}

class LeonClient {
  private socket: Socket | null = null;
  private status: LeonStatus = 'idle';
  private readonly listeners: { [K in keyof LeonEvents]: Set<Listener<K>> } = {
    status: new Set(),
    answer: new Set(),
    progress: new Set(),
    token: new Set(),
    typing: new Set(),
    suggest: new Set(),
  };

  on<K extends keyof LeonEvents>(event: K, fn: Listener<K>): () => void {
    this.listeners[event].add(fn as never);
    // Replay current status to late subscribers so the UI is never stale.
    if (event === 'status') (fn as Listener<'status'>)(this.status);
    return () => this.listeners[event].delete(fn as never);
  }

  private emit<K extends keyof LeonEvents>(event: K, ...args: Parameters<Listener<K>>): void {
    (this.listeners[event] as Set<(...a: unknown[]) => void>).forEach((fn) => fn(...args));
  }

  private setStatus(status: LeonStatus, detail?: string): void {
    this.status = status;
    this.emit('status', status, detail);
  }

  getStatus(): LeonStatus {
    return this.status;
  }

  /** Idempotent: connect once, reuse the socket across the app. */
  connect(): void {
    if (this.socket) {
      if (!this.socket.connected && this.status !== 'connecting') this.socket.connect();
      return;
    }

    const token = getToken();
    if (!token) {
      this.setStatus('unauthenticated', 'Sign in to use the assistant.');
      return;
    }

    this.setStatus('connecting');
    // origin is the gateway; path routes through the /leon proxy to Leon's socket.io.
    const socket = io(window.location.origin, {
      path: `${LEON_BASE}/socket.io`,
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 15000,
    });
    this.socket = socket;

    socket.on('connect', () => {
      // No sessionId: Leon rejects unknown ids ("session does not exist"). Omitting
      // it makes the server register us against its active session, which is also
      // the session its answers are emitted to — so replies route back to us.
      socket.emit('init', {
        client: CLIENT_NAME,
        capabilities: { supportsWidgets: false },
      });
    });

    // Server confirms the client is registered and the core is ready.
    socket.on('ready', () => this.setStatus('ready'));
    socket.on('init-client-core-server-handshake', () => this.setStatus('ready'));

    socket.on('answer', (payload: unknown) => {
      // Leon interleaves transient progress widgets (historyMode 'system_widget',
      // e.g. "Choosing skill…") with the real reply. Route progress to its own
      // channel so it shows as a status line, not a permanent chat bubble.
      if (payload && typeof payload === 'object' &&
          (payload as Record<string, unknown>).historyMode === 'system_widget') {
        this.emit('progress', answerToText(payload));
        return;
      }
      const text = answerToText(payload);
      if (text) { this.emit('progress', ''); this.emit('answer', text); }
    });
    // Streamed generation tokens (agent mode). Raw text fragments of the reply.
    socket.on('llm-token', (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const rec = payload as Record<string, unknown>;
      const chunk = typeof rec.token === 'string' ? rec.token : '';
      const generationId = typeof rec.generationId === 'string' ? rec.generationId : '';
      if (chunk) { this.emit('progress', ''); this.emit('token', chunk, generationId); }
    });
    socket.on('is-typing', (isTyping: boolean) => {
      this.emit('typing', !!isTyping);
      if (!isTyping) this.emit('progress', '');
    });
    socket.on('suggest', (suggestions: unknown) => {
      if (Array.isArray(suggestions)) this.emit('suggest', suggestions.map(String));
    });

    socket.on('connect_error', (err: Error) => {
      const msg = err?.message || 'Connection failed';
      // Auth failures from Leon's socket middleware ("Authentication required" /
      // "Invalid or expired token") mean the Oz token is missing or stale.
      if (/auth|token|unauthor/i.test(msg)) {
        this.setStatus('unauthenticated', 'Session expired — sign in again.');
      } else {
        this.setStatus('error', msg);
      }
    });
    socket.on('disconnect', (reason: string) => {
      // Manual disconnects stay idle; transient drops show reconnecting state.
      if (reason !== 'io client disconnect') this.setStatus('connecting', 'Reconnecting…');
    });
  }

  /** Send a chat message. Returns false if the socket isn't ready. */
  send(text: string, opts?: SendOptions): boolean {
    if (!this.socket || !this.socket.connected) {
      this.connect();
      return false;
    }
    this.socket.emit('utterance', {
      client: CLIENT_NAME,
      value: text,
      sentAt: Date.now(),
      ...(opts?.agentMode ? { commandContext: { forcedRoutingMode: 'agent' } } : {}),
    });
    return true;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.setStatus('idle');
  }
}

// Singleton — one socket shared by the whole app.
export const leonClient = new LeonClient();
