'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const params = useSearchParams();
  const role = (params.get('role') ?? 'admin').toLowerCase();
  const error = params.get('error');

  const displayRole = role === 'user' ? 'Admin' : role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="brandmark">SI</div>
          <div>
            <p className="eyebrow">SiteInspect</p>
            <h1>{displayRole} access</h1>
          </div>
        </div>

        <div className="auth-copy">
          <p>Secure project coordination for contractors, PMC teams, clients, and administrators.</p>
        </div>

        <form action="/api/auth/login" method="post" className="auth-form">
          <input type="hidden" name="selectedRole" value={role} />

          {error && (
            <div className="alert error">
              {error === 'invalid' && 'Invalid email or password.'}
              {error === 'disabled' && 'This account is disabled.'}
              {error === 'profile' && 'Profile not found for this account.'}
            </div>
          )}

          <label className="field">
            <span>Email address</span>
            <input name="identifier" type="email" defaultValue="admin@inspectify.com" required />
          </label>

          <label className="field">
            <span>Password</span>
            <input name="password" type="password" defaultValue="Admin@123456" required />
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
                <p className="eyebrow">SiteInspect</p>
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
