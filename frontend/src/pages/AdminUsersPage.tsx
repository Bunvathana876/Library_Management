import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { adminApi } from '@/api/adminApi';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorSummary, type SummaryErrorItem } from '@/components/ui/ErrorSummary';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { AccountResponse } from '@/types/api';
import { ApiError, formatApiErrorMessage } from '@/utils/errors';
import { installFormValidationAria } from '@/utils/formValidation';
import { evaluatePasswordStrength } from '@/utils/formatting';

function generateStrongPassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export function AdminUsersPage() {
  const { isAuthenticated, isAdmin, openSignInModal } = useAuth();
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const matrixCaptionId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'LIBRARIAN' | 'MEMBER'>('LIBRARIAN');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [summaryErrors, setSummaryErrors] = useState<SummaryErrorItem[]>([]);
  const [createdAccounts, setCreatedAccounts] = useState<AccountResponse[]>([]);

  useEffect(() => {
    if (!isAdmin || !formRef.current) return;
    return installFormValidationAria(formRef.current);
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<Lock size={22} />}
        title={isAuthenticated ? 'Administrator role required' : 'Admin sign-in required'}
        description={
          isAuthenticated
            ? 'Only ADMIN accounts can provision new Librarian or Member logins via POST /api/admin/users.'
            : 'Sign in with your administrator account to provision Librarian and Member login credentials.'
        }
        action={
          !isAuthenticated ? (
            <button type="button" className="btn btn-primary" onClick={openSignInModal}>
              <LogIn size={16} aria-hidden="true" />
              <span>Sign In</span>
            </button>
          ) : undefined
        }
      />
    );
  }

  const strength = evaluatePasswordStrength(password);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const collected: SummaryErrorItem[] = [];
      const emailEl = form.elements.namedItem('email') as HTMLInputElement | null;
      const passEl = form.elements.namedItem('password') as HTMLInputElement | null;
      if (emailEl && !emailEl.validity.valid) {
        collected.push({
          fieldId: 'admin-user-email',
          label: 'Account email',
          message: 'Enter a valid email address.',
        });
      }
      if (passEl && !passEl.validity.valid) {
        collected.push({
          fieldId: 'admin-user-password',
          label: 'Initial password',
          message: 'Password must be between 12 and 72 characters.',
        });
      }
      setSummaryErrors(collected);
      return;
    }

    setSummaryErrors([]);
    setSubmitting(true);
    setErrorMsg(null);
    setFieldErrors({});

    try {
      const created = await adminApi.createAccount({
        email: email.trim(),
        password,
        role,
      });

      setCreatedAccounts((prev) => [created, ...prev]);
      setEmail('');
      setPassword('');
      setShowPassword(false);
      form.reset();

      notify({
        variant: 'success',
        title: 'Account created',
        message: `${created.role} login created for ${created.email} (#${created.id}).`,
      });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      }
      setErrorMsg(formatApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyEmail = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify({
        variant: 'info',
        title: 'Email copied',
        message: `${text} copied to clipboard.`,
      });
    } catch {
      notify({
        variant: 'error',
        title: 'Clipboard unavailable',
        message: `Could not copy ${text} automatically.`,
      });
    }
  };

  return (
    <div className="two-col-grid">
      <section className="card card-padded form-stack" aria-labelledby="create-user-heading">
        <div>
          <h2 id="create-user-heading" className="card-title">
            Create Login Account
          </h2>
          <p className="card-subtitle">
            Provision new <code>LIBRARIAN</code> or <code>MEMBER</code> credentials via{' '}
            <code>POST /api/admin/users</code>
          </p>
        </div>

        <form ref={formRef} className="form-stack" onSubmit={handleSubmit} noValidate>
          <ErrorSummary errors={summaryErrors} />

          {errorMsg ? (
            <div className="alert alert-danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" className="alert-icon" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          <div className="field">
            <label className="field-label" htmlFor="admin-user-email">
              Account email
            </label>
            <span id="admin-user-email-hint" className="field-hint">
              Must be a unique email address for JWT sign-in.
            </span>
            <input
              id="admin-user-email"
              name="email"
              type="email"
              className="input-control"
              autoComplete="off"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="admin-user-email-hint"
              data-error="admin-user-email-error"
              placeholder="librarian@library.local"
            />
            <div
              id="admin-user-email-error"
              className="field-error"
              data-visible={fieldErrors.email ? 'true' : undefined}
            >
              {fieldErrors.email || 'Enter a valid email address.'}
            </div>
          </div>

          <div className="field">
            <div className="field-label-row">
              <label className="field-label" htmlFor="admin-user-password">
                Initial password
              </label>
              <button
                type="button"
                className="btn btn-brass btn-sm"
                onClick={() => {
                  setPassword(generateStrongPassword());
                  setShowPassword(true);
                }}
              >
                <Wand2 size={14} aria-hidden="true" />
                <span>Generate</span>
              </button>
            </div>
            <ul id="admin-user-password-rules" className="rules-list">
              <li>Length between 12 and 72 characters ({password.length}/72 entered)</li>
              <li>Stored hashed with BCrypt on the Spring Boot server</li>
            </ul>
            <div className="input-with-action">
              <input
                id="admin-user-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="input-control"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="admin-user-password-rules"
                data-error="admin-user-password-error"
              />
              <button
                type="button"
                className="input-action-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
              </button>
            </div>
            <div className="strength-meter" aria-live="polite">
              <div className="strength-bars" aria-hidden="true">
                {[1, 2, 3, 4].map((segment) => (
                  <span
                    key={segment}
                    className="strength-seg"
                    data-active={strength.score >= segment}
                    data-tone={strength.tone}
                  />
                ))}
              </div>
              <div className="strength-caption">
                <span>Password strength: <strong>{strength.label}</strong></span>
                <span className="mono">{password.length}/72</span>
              </div>
            </div>
            <div
              id="admin-user-password-error"
              className="field-error"
              data-visible={fieldErrors.password ? 'true' : undefined}
            >
              {fieldErrors.password || 'Password must be between 12 and 72 characters.'}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Assign role</span>
            <span className="field-hint">
              Backend security prevents creating ADMIN accounts through this endpoint.
            </span>
            <div className="role-card-grid" role="radiogroup" aria-label="Account role">
              <button
                type="button"
                role="radio"
                aria-checked={role === 'LIBRARIAN'}
                className="role-choice-card"
                data-selected={role === 'LIBRARIAN'}
                onClick={() => setRole('LIBRARIAN')}
              >
                <span className="role-choice-title">
                  <ShieldCheck size={16} aria-hidden="true" />
                  LIBRARIAN
                </span>
                <span className="field-hint">
                  Manage books, register members, and process loans &amp; returns.
                </span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={role === 'MEMBER'}
                className="role-choice-card"
                data-selected={role === 'MEMBER'}
                onClick={() => setRole('MEMBER')}
              >
                <span className="role-choice-title">
                  <KeyRound size={16} aria-hidden="true" />
                  MEMBER
                </span>
                <span className="field-hint">
                  Authenticated reader access to catalog &amp; personal JWT identity.
                </span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating Account…' : `Create ${role} Account`}
            </button>
          </div>
        </form>
      </section>

      <div className="overview-side-stack">
        <section className="card" aria-label="Spring Security role permissions matrix">
          <div className="card-header">
            <div>
              <h3 className="card-title">Role Permissions Matrix</h3>
              <p className="card-subtitle">Mirrors Spring Boot SecurityConfig rules</p>
            </div>
          </div>
          <div
            tabIndex={0}
            role="region"
            aria-labelledby={matrixCaptionId}
            className="table-wrapper table-compact"
          >
            <table className="data-table">
              <caption id={matrixCaptionId}>Backend endpoint authorization by role</caption>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Catalog</th>
                  <th scope="col">Desk Ops</th>
                  <th scope="col">Users</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Guest</th>
                  <td>Yes</td>
                  <td>No</td>
                  <td>No</td>
                </tr>
                <tr>
                  <th scope="row">MEMBER</th>
                  <td>Yes</td>
                  <td>No</td>
                  <td>No</td>
                </tr>
                <tr>
                  <th scope="row">LIBRARIAN</th>
                  <td>Yes</td>
                  <td>Full Access</td>
                  <td>No</td>
                </tr>
                <tr>
                  <th scope="row">ADMIN</th>
                  <td>Yes</td>
                  <td>Full Access</td>
                  <td>Yes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="card card-padded form-stack" aria-labelledby="session-accounts-heading">
          <div>
            <h3 id="session-accounts-heading" className="card-title">
              Created in This Session
            </h3>
            <p className="card-subtitle">
              Accounts returned by <code>POST /api/admin/users</code>
            </p>
          </div>

          {createdAccounts.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Newly created Librarian and Member accounts will appear here after submission.
            </p>
          ) : (
            <div className="form-stack" style={{ gap: '0.6rem' }}>
              {createdAccounts.map((acc) => (
                <div key={acc.id} className="session-account-row">
                  <div className="session-account-info">
                    <CheckCircle2
                      size={16}
                      aria-hidden="true"
                      style={{ color: 'var(--success)', flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="session-account-email">{acc.email}</div>
                      <div className="mono table-subline">Account #{acc.id}</div>
                    </div>
                  </div>
                  <div className="row-actions">
                    <StatusBadge tone={acc.role === 'LIBRARIAN' ? 'info' : 'neutral'} dot={false}>
                      {acc.role}
                    </StatusBadge>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon icon-square-btn"
                      onClick={() => void handleCopyEmail(acc.email)}
                      aria-label={`Copy ${acc.email}`}
                      title="Copy email"
                    >
                      <Copy size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
