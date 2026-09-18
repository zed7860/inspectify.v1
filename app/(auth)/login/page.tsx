'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

function LoginForm() {
  const params = useSearchParams();
  const role = (params.get('role') ?? '').toUpperCase();
  const error = params.get('error');
  const [showPassword, setShowPassword] = useState(false);

  const displayRole = role ? role.replaceAll('_', ' ') : 'secure';

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="brandmark">SI</div>
          <div>
            <p className="eyebrow">Inspectifier by Cubixtop India</p>
            <h1>{displayRole} access</h1>
          </div>
        </div>

        <div className="auth-copy">
          <p>Secure project coordination for contractors, PMC teams, clients, and administrators.</p>
        </div>

        <form action="/api/auth/login" method="post" className="auth-form">
          {error && (
            <div className="alert error">
              {error === 'invalid' && 'Invalid email or password.'}
              {error === 'disabled' && 'This account is disabled.'}
              {error === 'profile' && 'Profile not found for this account.'}
            </div>
          )}

          <label className="field">
            <span>Email address</span>
            <input name="identifier" type="email" autoComplete="username" placeholder="you@company.com" required />
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

          <button type="submit" className="btn btn-primary auth-submit">Sign in</button>
        </form>
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense
      fallback={
        <main className="auth-shell">
          <div className="auth-panel">
            <div className="auth-brand">
              <div className="brandmark">SI</div>
              <div>
                <p className="eyebrow">Inspectifier by Cubixtop India</p>
                <h1>Loading</h1>
              </div>
            </div>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
