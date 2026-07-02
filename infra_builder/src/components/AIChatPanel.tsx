import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Send, Bot, User, Plus, Loader2, Lightbulb, ArrowRight, Crown, Lock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useSubscriptionStore, isProOrAbove } from '../store/subscriptionStore';
import { generateInfrastructure, AIMessage } from '../utils/aiInfraGenerator';
import type { ResourceNodeData } from '../types/resources';
import type { Node, Edge } from 'reactflow';

const SUGGESTIONS_BY_PROVIDER: Record<string, string[]> = {
  aws: [
    'Create a VPC with two public subnets and an EC2 instance',
    'Build a web application with load balancer and auto scaling',
    'Set up an RDS database with VPC and security group',
    'Create a serverless architecture with Lambda and S3',
  ],
  azure: [
    'Create a VNet with two subnets and a virtual machine',
    'Build a web app with Application Gateway and VMSS',
    'Set up Azure SQL Database with VNet and NSG',
    'Create a serverless function with Storage Account',
  ],
  gcp: [
    'Create a VPC with two subnets and a Compute Instance',
    'Build a web app with HTTP Load Balancer and MIG',
    'Set up Cloud SQL with VPC and firewall rules',
    'Create a Cloud Function with Cloud Storage bucket',
  ],
  ansible: [
    'Set up nginx web server with package install and service',
    'Deploy a Docker container on remote hosts',
    'Create a LAMP stack with users and firewall rules',
    'Clone a Git repo and run deployment commands',
  ],
  crossplane: [
    'Create a VPC with subnets and an EC2 instance',
    'Set up an RDS database with security group',
    'Create an S3 bucket with IAM role',
    'Build a complete web app with ALB and EC2',
  ],
};

const DEFAULT_SUGGESTIONS = SUGGESTIONS_BY_PROVIDER.aws;

const PROVIDER_LABELS: Record<string, { title: string; desc: string }> = {
  aws:        { title: 'AI Assistant', desc: 'Describe cloud infra — get a diagram' },
  azure:      { title: 'AI Assistant', desc: 'Describe cloud infra — get a diagram' },
  gcp:        { title: 'AI Assistant', desc: 'Describe cloud infra — get a diagram' },
  ansible:    { title: 'AI Playbook Builder', desc: 'Describe automation — get a playbook' },
  crossplane: { title: 'AI Composition Builder', desc: 'Describe infra — get Crossplane resources' },
};

const DEFAULT_LABEL = { title: 'AI Assistant', desc: 'Natural language to infrastructure' };

export default function AIChatPanel() {
  const navigate = useNavigate();
  const { addBlueprint, cloudProvider } = useStore();
  const { tier } = useSubscriptionStore();
  const isUnlocked = isProOrAbove(tier);

  const label = PROVIDER_LABELS[cloudProvider] || DEFAULT_LABEL;
  const suggestions = SUGGESTIONS_BY_PROVIDER[cloudProvider] || DEFAULT_SUGGESTIONS;

  const welcomeText = useMemo(() => {
    if (cloudProvider === 'ansible') {
      return `Hi! I'm your Ansible playbook assistant. Describe the automation you want to build, and I'll generate the tasks for you. Try one of these suggestions:`;
    }
    if (cloudProvider === 'crossplane') {
      return `Hi! I'm your Crossplane composition assistant. Describe the infrastructure you want to manage, and I'll generate the resources. Try one of these suggestions:`;
    }
    return `Hi! I'm your AI infrastructure assistant. Describe what you want to build, and I'll generate the diagram for you. Try one of these suggestions:`;
  }, [cloudProvider]);

  const [messages, setMessages] = useState<AIMessage[]>([
    { id: 'welcome', role: 'assistant', content: welcomeText },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const prompt = (text || input).trim();
    if (!prompt || loading) return;

    setInput('');
    setLoading(true);

    const userMsg: AIMessage = { id: `user_${Date.now()}`, role: 'user', content: prompt };
    setMessages(prev => [...prev, userMsg]);

    try {
      const result = await generateInfrastructure(prompt, cloudProvider);
      const assistantMsg: AIMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: result.explanation,
        nodes: result.nodes,
        edges: result.edges,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCanvas = (nodes: Node<ResourceNodeData>[], edges: Edge[]) => {
    addBlueprint(nodes, edges);
    const ids = new Set(addedIds);
    nodes.forEach(n => ids.add(n.id));
    setAddedIds(ids);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-app)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 12px rgba(99,102,241,0.3)' }}>
          <Sparkles size={15} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{label.title}</h3>
          <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{label.desc}</p>
        </div>
      </div>

      {/* Subscription gate for free users */}
      {!isUnlocked && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.25)' }}>
            <Lock size={28} className="text-indigo-400" />
          </div>
          <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Pro Feature</h3>
          <p className="text-xs mb-4 max-w-xs" style={{ color: 'var(--text-muted)' }}>
            {cloudProvider === 'ansible'
              ? 'Unlock AI-powered playbook generation. Describe your automation in plain English and get a fully wired Ansible playbook in seconds.'
              : 'Unlock AI-powered infrastructure generation. Describe what you want in plain English and get a fully wired diagram in seconds.'}
          </p>
          <div className="space-y-2 mb-6 text-left">
            {[
              cloudProvider === 'ansible'
                ? 'Generate entire playbooks from text'
                : 'Generate entire architectures from text',
              'Smart resource placement & wiring',
              `Works with ${cloudProvider === 'ansible' ? 'Ansible' : cloudProvider === 'crossplane' ? 'Crossplane' : 'AWS, Azure, GCP'}`
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <Sparkles size={12} className="text-indigo-400 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/pricing')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
            <Crown size={14} /> Upgrade to Pro
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Chat area (only for Pro/Enterprise) */}
      {isUnlocked && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                msg.role === 'user' ? 'bg-indigo-500/20' : ''
              }`}
                style={msg.role === 'assistant' ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.3)' } : {}}>
                {msg.role === 'user' ? <User size={13} className="text-indigo-400" /> : <Bot size={13} className="text-indigo-300" />}
              </div>
              <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                {msg.id === 'welcome' ? (
                  <div className="rounded-xl px-3.5 py-2.5"
                    style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{welcomeText}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {suggestions.map((s, i) => (
                        <button key={i} onClick={() => handleSend(s)}
                          className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg transition-all hover:scale-[1.02]"
                          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}>
                          <Lightbulb size={10} />
                          {s.length > 40 ? s.slice(0, 40) + '...' : s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-xl px-3.5 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600/20 border border-indigo-500/30'
                      : ''
                  }`}
                    style={msg.role === 'assistant' ? { background: 'var(--bg-surface-2)', border: '1px solid var(--border)' } : {}}>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{msg.content}</p>
                    {msg.nodes && msg.nodes.length > 0 && (
                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {msg.nodes.map(n => (
                            <span key={n.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md"
                              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                              {n.data.definition?.icon || '📦'} {n.data.resourceName}
                            </span>
                          ))}
                        </div>
                        {!addedIds.has(msg.nodes[0]?.id) && (
                          <button onClick={() => handleAddToCanvas(msg.nodes!, msg.edges!)}
                            className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] mt-2"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 2px 10px rgba(99,102,241,0.3)' }}>
                            <Plus size={12} /> Add {msg.nodes.length} resources to canvas
                            <ArrowRight size={11} />
                          </button>
                        )}
                        {addedIds.has(msg.nodes[0]?.id) && (
                          <div className="flex items-center gap-1.5 text-[10px] font-medium mt-2" style={{ color: '#4ade80' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            Added to canvas
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.3)' }}>
                <Bot size={13} className="text-indigo-300" />
              </div>
              <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-2"
                style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                <Loader2 size={12} className="animate-spin text-indigo-400" />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {cloudProvider === 'ansible' ? 'Generating playbook...' : 'Generating infrastructure...'}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input (only for Pro/Enterprise) */}
      {isUnlocked && (
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={cloudProvider === 'ansible' ? 'Describe your automation...' : 'Describe your infrastructure...'}
              className="flex-1 text-xs px-3 py-2.5 rounded-xl outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
            />
            <button onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 2px 10px rgba(99,102,241,0.3)' }}>
              <Send size={14} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
