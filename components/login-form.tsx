'use client';
import { AdminForm } from '@/components/admin-form';

import { Eye, EyeOff, ArrowUpRight, ShieldCheck, Check, ArrowRight } from 'lucide-react';
import { useState } from 'react';

export function LoginForm({ values }: { values: Record<string, string> }) {
  const params = new URLSearchParams(values);
  const role = (params.get('role') ?? '').toUpperCase();
  const error = params.get('error');
  const [showPassword, setShowPassword] = useState(false);


  return (
    <main className="auth-shell">
      <aside className="auth-story"><a href="/" className="story-brand"><span className="story-mark">i•</span>Inspectifier</a><div className="story-content"><span className="story-tag">A BETTER WAY TO BUILD</span><h1>Confidence.<br />At every stage.</h1><p>Bring your projects, people and inspection evidence together. From the first site photo to the final approval.</p><div className="story-steps"><span><Check size={15} /> Capture</span><i /><span><Check size={15} /> Review</span><i /><span><Check size={15} /> Approve</span></div></div><div className="story-footer"><span>Built for teams on the ground.</span><ArrowUpRight size={24} /></div></aside>
      <div className="auth-panel"><div className="login-topline"><span>YOUR PROJECT WORKSPACE</span><ShieldCheck size={20} /></div>
        <div className="auth-brand"><div><p className="eyebrow">LET’S GET TO WORK</p><h1>Welcome back.</h1></div></div>
        <div className="auth-copy"><p>Sign in to keep your projects moving.</p></div>
        <AdminForm action="/api/auth/login" method="post" className="auth-form" successMessage="Signed in successfully.">
          <input type="hidden" name="next" value={params.get("next") || ""} />
          {error && (
            <div className="alert error">
              {error === 'invalid' && 'Invalid username/email, password or account type.'}
              {error === 'disabled' && 'This account is disabled.'}
              {error === 'profile' && 'Profile not found for this account.'}
            </div>
          )}

          <label className="field">
            <span>Username or email address</span>
            <input name="identifier" type="text" autoComplete="username" placeholder="Username or you@company.com" required />
          </label>

          <label className="field">
            <span>Account type</span>
            <select name="selectedRole" defaultValue={role} required>
              <option value="" disabled>Select account type</option>
              <option value="CONTRACTOR">Contractor</option>
              <option value="PMC">PMC</option>
              <option value="CLIENT">Client</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>

          <label className="field">
            <span>Password</span>
            <span className="password-input">
              <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          <button type="submit" className="btn btn-primary auth-submit">Sign in to workspace <ArrowRight size={17} /></button>
        </AdminForm><p className="login-help">Need access or a password reset?<br /><strong>Contact your workspace administrator.</strong></p><div className="login-footer">Inspectifier <span>by Cubixtop India</span></div>
      </div>
    </main>
  );
}

