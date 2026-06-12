import { useState, useCallback } from 'react';
import { Cpu, Eye, EyeOff, Mail, Lock, UserPlus, LogIn, ArrowRight } from 'lucide-react';

const FLOATING_ICONS = [
  { icon: '☁️', x: '5%', y: '10%', size: 32, delay: '0s', dur: '7s', class: 'login-float-1' },
  { icon: '🖥️', x: '15%', y: '60%', size: 28, delay: '1s', dur: '9s', class: 'login-float-2' },
  { icon: '🐳', x: '25%', y: '20%', size: 36, delay: '0.5s', dur: '8s', class: 'login-float-3' },
  { icon: '🌐', x: '40%', y: '70%', size: 30, delay: '2s', dur: '10s', class: 'login-float-4' },
  { icon: '📦', x: '55%', y: '15%', size: 26, delay: '1.5s', dur: '7.5s', class: 'login-float-1' },
  { icon: '⚙️', x: '65%', y: '55%', size: 34, delay: '0.8s', dur: '8.5s', class: 'login-float-2' },
  { icon: '🔒', x: '75%', y: '25%', size: 24, delay: '2.5s', dur: '9.5s', class: 'login-float-3' },
  { icon: '🚀', x: '85%', y: '65%', size: 32, delay: '1.2s', dur: '7s', class: 'login-float-4' },
  { icon: '🗄️', x: '92%', y: '10%', size: 28, delay: '0.3s', dur: '8s', class: 'login-float-2' },
  { icon: '📡', x: '8%', y: '85%', size: 26, delay: '1.8s', dur: '9s', class: 'login-float-3' },
  { icon: '🔧', x: '48%', y: '40%', size: 22, delay: '3s', dur: '11s', class: 'login-float-1' },
  { icon: '☸️', x: '72%', y: '80%', size: 30, delay: '0.6s', dur: '8s', class: 'login-float-4' },
];

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      localStorage.setItem('infrastudio_logged_in', 'true');
      onLogin();
    }, 600);
  }, [onLogin]);

  const toggleMode = useCallback(() => {
    setMode(m => m === 'signin' ? 'signup' : 'signin');
    setSubmitted(false);
  }, []);

  return (
    <div className="h-screen w-screen flex overflow-hidden"
      style={{ background: 'var(--bg-app)' }}>
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(56,189,248,0.04) 30%, rgba(168,85,247,0.06) 60%, rgba(52,211,153,0.04) 100%)',
            backgroundSize: '300% 300%',
            animation: 'login-gradient 12s ease infinite',
          }}
        />
        {/* Floating infrastructure icons */}
        {FLOATING_ICONS.map((item, i) => (
          <div
            key={i}
            className={`absolute ${item.class}`}
            style={{
              left: item.x,
              top: item.y,
              fontSize: item.size,
              opacity: 0.12,
              animationDelay: item.delay,
              animationDuration: item.dur,
            }}
          >
            {item.icon}
          </div>
        ))}
        {/* Radial glow spots */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', animation: 'login-pulse-ring 4s ease-in-out infinite' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)', animation: 'login-pulse-ring 5s ease-in-out infinite 1s' }} />
      </div>

      {/* Login card */}
      <div className="relative z-10 m-auto w-full max-w-md px-4">
        <div className={`rounded-2xl overflow-hidden shadow-2xl ${submitted ? 'opacity-0 scale-95 transition-all duration-500' : 'login-slide-up'}`}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 0 80px rgba(99,102,241,0.08), 0 25px 60px rgba(0,0,0,0.4)',
          }}>
          {/* Branding */}
          <div className="px-8 pt-8 pb-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
                border: '1px solid var(--accent-border)',
                boxShadow: '0 0 30px rgba(99,102,241,0.15)',
              }}>
              <Cpu size={32} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-extrabold gradient-text tracking-tight">
              InfraStudio
            </h1>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Design. Compare. Deploy.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex mx-8 mb-6 rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}>
            <button onClick={() => mode !== 'signin' && toggleMode()}
              className="flex-1 py-2.5 text-xs font-bold transition-all"
              style={mode === 'signin'
                ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }
                : { color: 'var(--text-muted)' }}>
              <LogIn size={13} className="inline mr-1.5" />Sign In
            </button>
            <button onClick={() => mode !== 'signup' && toggleMode()}
              className="flex-1 py-2.5 text-xs font-bold transition-all"
              style={mode === 'signup'
                ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }
                : { color: 'var(--text-muted)' }}>
              <UserPlus size={13} className="inline mr-1.5" />Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
            {mode === 'signup' && (
              <div className="login-fade-in">
                <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Full Name
                </label>
                <div className="relative">
                  <UserPlus size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
                  <input type="text" placeholder="John Doe" value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                    required={mode === 'signup'} />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Email Address
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
                <input type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                  required />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
                <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full text-sm pl-9 pr-9 py-2.5 rounded-xl"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                  required />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div className="login-fade-in">
                <label className="text-[10px] font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
                  <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                    required={mode === 'signup'} />
                </div>
              </div>
            )}

            <button type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
              }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)' }} />
              <span className="relative flex items-center gap-2">
                {mode === 'signin' ? (
                  <><LogIn size={15} /> Sign In</>
                ) : (
                  <><UserPlus size={15} /> Create Account</>
                )}
                <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
            </button>

            {mode === 'signin' && (
              <p className="text-center text-[10px]" style={{ color: 'var(--text-faint)' }}>
                Don&apos;t have an account?{' '}
                <button type="button" onClick={toggleMode}
                  className="font-semibold hover:underline" style={{ color: 'var(--accent-light)' }}>
                  Create one
                </button>
              </p>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] mt-6 login-fade-in" style={{ color: 'var(--text-faint)' }}>
          © 2026 InfraStudio — Infrastructure Visual Builder
        </p>
      </div>
    </div>
  );
}
