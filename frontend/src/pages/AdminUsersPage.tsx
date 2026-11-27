import { useConfirmation } from '@/hooks/useConfirmation';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Play,
  RefreshCw,
  Wand2,
} from 'lucide-react';
import { adminApi } from '@/api/adminApi';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorSummary, type SummaryErrorItem } from '@/components/ui/ErrorSummary';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { AccountResponse, ScheduledJobRunResponse } from '@/types/api';
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
  const { user, isAuthenticated, isAdmin, openSignInModal } = useAuth();
  const { notify } = useToast();
  const { confirm, confirmationDialog } = useConfirmation();
  const formRef = useRef<HTMLFormElement>(null);
  const matrixCaptionId = useId();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'LIBRARIAN' | 'MEMBER'>('LIBRARIAN');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [summaryErrors, setSummaryErrors] = useState<SummaryErrorItem[]>([]);

  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<number | null>(null);

  const [resetTarget, setResetTarget] = useState<AccountResponse | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const [runningJobs, setRunningJobs] = useState(false);
  const [lastJobResult, setLastJobResult] = useState<ScheduledJobRunResponse | null>(null);

  const fetchAccounts = useCallback(async (signal?: AbortSignal) => {
    if (!isAdmin) return;
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      const list = await adminApi.listAccounts(signal);
      setAccounts(list);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setAccountsError(formatApiErrorMessage(err));
    } finally {
      setLoadingAccounts(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    void fetchAccounts(controller.signal);
    return () => controller.abort();
  }, [isAdmin, fetchAccounts]);

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
            ? 'Only administrator accounts can manage staff and patron login accounts.'
            : 'Sign in with your administrator account to manage librarian and member login credentials.'
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
        ...(role === 'MEMBER' && fullName.trim() ? { fullName: fullName.trim() } : {}),
      });

      setAccounts((prev) => [...prev, created]);
      setEmail('');
      setFullName('');
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

  const handleToggleEnabled = async (acc: AccountResponse) => {
    if (!await confirm({
      title: acc.enabled ? 'Disable account?' : 'Enable account?',
      message: `${acc.enabled ? 'Prevent' : 'Restore'} sign-in for ${acc.email}?`,
      confirmLabel: acc.enabled ? 'Disable account' : 'Enable account',
      variant: acc.enabled ? 'danger' : 'primary',
    })) return;
    setBusyAccountId(acc.id);
    try {
      const updated = await adminApi.updateAccountStatus(acc.id, !acc.enabled);
      setAccounts((prev) => prev.map((a) => (a.id === acc.id ? updated : a)));
      notify({
        variant: 'info',
        title: updated.enabled ? 'Account enabled' : 'Account disabled',
        message: `${updated.email} is now ${updated.enabled ? 'active' : 'disabled'}.`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Status update failed',
        message: formatApiErrorMessage(err),
      });
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleRoleChange = async (acc: AccountResponse, nextRole: 'LIBRARIAN' | 'MEMBER') => {
    if (acc.role === nextRole) return;
    if (!await confirm({
      title: 'Change account role?',
      message: `Change ${acc.email} from ${acc.role} to ${nextRole}? This changes their access to library operations.`,
      confirmLabel: 'Change role',
      variant: 'primary',
    })) return;
    setBusyAccountId(acc.id);
    try {
      const updated = await adminApi.updateAccountRole(acc.id, nextRole);
      setAccounts((prev) => prev.map((a) => (a.id === acc.id ? updated : a)));
      notify({
        variant: 'success',
        title: 'Role updated',
        message: `${updated.email} assigned role ${updated.role}.`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Role update failed',
        message: formatApiErrorMessage(err),
      });
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleResetPasswordSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resetTarget || resetPasswordVal.length < 12) return;
    setResetBusy(true);
    try {
      await adminApi.resetPassword(resetTarget.id, resetPasswordVal);
      const targetEmail = resetTarget.email;
      setResetTarget(null);
      setResetPasswordVal('');
      setShowResetPassword(false);
      notify({
        variant: 'success',
        title: 'Password reset',
        message: `Updated login password for ${targetEmail}.`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Password reset failed',
        message: formatApiErrorMessage(err),
      });
    } finally {
      setResetBusy(false);
    }
  };

  const handleRunJobs = async () => {
    if (!await confirm({
      title: 'Run circulation maintenance?',
      message: 'Expire eligible holds and send due-soon and overdue notifications now.',
      confirmLabel: 'Run jobs',
      variant: 'primary',
    })) return;
    setRunningJobs(true);
    try {
      const result = await adminApi.runReminderJobs();
      setLastJobResult(result);
      notify({
        variant: 'success',
        title: 'Maintenance jobs completed',
        message: `Expired ${result.expiredHolds} holds, sent ${result.dueSoonNotifications} due-soon & ${result.overdueNotifications} overdue alerts.`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Job run failed',
        message: formatApiErrorMessage(err),
      });
    } finally {
      setRunningJobs(false);
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

  const enabledCount = accounts.filter((a) => a.enabled).length;

  return (
    <div className="admin-workspace">
      {confirmationDialog}

      <section className="page-intro" aria-label="Administration summary">
        <div>
          <div className="eyebrow">Administration</div>
          <h2>Staff &amp; system accounts</h2>
          <p>
            {loadingAccounts && accounts.length === 0
              ? 'Loading system login accounts…'
              : `${accounts.length} login ${accounts.length === 1 ? 'account' : 'accounts'} · ${enabledCount} enabled`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void fetchAccounts()}
          disabled={loadingAccounts}
          aria-label="Refresh accounts directory"
        >
          <RefreshCw size={14} className={loadingAccounts ? 'spin-animation' : undefined} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </section>

      <section className="ledger-section admin-directory" aria-label="System accounts directory">
        {accountsError ? (
          <div className="alert alert-danger alert-row" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} aria-hidden="true" className="alert-icon" />
              <span>{accountsError}</span>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void fetchAccounts()}>
              Retry
            </button>
          </div>
        ) : null}

        {loadingAccounts && accounts.length === 0 ? (
          <TableSkeleton rows={3} label="Loading system accounts" />
        ) : accounts.length === 0 && !accountsError ? (
          <p className="field-hint">
            No system accounts found. Newly created accounts will appear here.
          </p>
        ) : accounts.length > 0 ? (
          <div className="table-wrapper" role="region" aria-label="Login accounts" tabIndex={0}>
            <table
              className="data-table"
              style={{
                ['--label-2' as string]: '"Role"',
                ['--label-3' as string]: '"Actions"',
              }}
            >
              <caption>Library login accounts and access controls</caption>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Role</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => {
                  const isSelf = user?.email.toLowerCase() === acc.email.toLowerCase();
                  const isAccountAdmin = acc.role === 'ADMIN';
                  const busy = busyAccountId === acc.id;
                  return (
                    <tr key={acc.id}>
                      <th scope="row">
                        <div>
                          <div className="session-account-email">{acc.email}</div>
                          <div className="mono table-subline">
                            Account #{acc.id} · {acc.enabled ? 'Enabled' : 'Disabled'}
                            {isSelf ? ' · You' : ''}
                          </div>
                        </div>
                      </th>

                      <td>
                        {isAccountAdmin ? (
                          <StatusBadge tone="warning" dot={false}>
                            Administrator
                          </StatusBadge>
                        ) : (
                          <select
                            className="select-control account-role-select"
                            aria-label={`Role for ${acc.email}`}
                            value={acc.role}
                            disabled={busy}
                            onChange={(e) =>
                              void handleRoleChange(acc, e.target.value as 'LIBRARIAN' | 'MEMBER')
                            }
                          >
                            <option value="LIBRARIAN">Librarian</option>
                            <option value="MEMBER">Member</option>
                          </select>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy || isSelf}
                            title={isSelf ? 'Cannot disable your own active account' : undefined}
                            onClick={() => void handleToggleEnabled(acc)}
                          >
                            {acc.enabled ? 'Disable' : 'Enable'}
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-icon icon-square-btn"
                            disabled={busy}
                            onClick={() => {
                              setResetTarget(acc);
                              setResetPasswordVal('');
                              setShowResetPassword(false);
                            }}
                            aria-label={`Reset password for ${acc.email}`}
                            title="Reset password"
                          >
                            <KeyRound size={14} aria-hidden="true" />
                          </button>

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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <div className="admin-settings-grid">
        <details className="card admin-disclosure">
          <summary>Create login account</summary>
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
                Unique email address used for signing in
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
                  className="btn btn-secondary btn-sm"
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
                <li>12 to 72 characters ({password.length}/72 entered)</li>
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
              <label className="field-label" htmlFor="new-account-role">Assign role</label>
              <select
                id="new-account-role"
                className="select-control"
                value={role}
                onChange={(event) => setRole(event.target.value as 'LIBRARIAN' | 'MEMBER')}
              >
                <option value="LIBRARIAN">Librarian — circulation and catalog</option>
                <option value="MEMBER">Member — personal bookshelf</option>
              </select>
            </div>

            {role === 'MEMBER' ? (
              <div className="field">
                <label className="field-label" htmlFor="admin-user-fullname">
                  Patron full name (optional)
                </label>
                <span id="admin-user-fullname-hint" className="field-hint">
                  Links this login to a patron borrower card (derived from email if left blank).
                </span>
                <input
                  id="admin-user-fullname"
                  name="fullName"
                  type="text"
                  className="input-control"
                  maxLength={120}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  aria-describedby="admin-user-fullname-hint"
                  placeholder="Sokha Dara"
                />
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting
                  ? 'Creating Account…'
                  : `Create ${role === 'LIBRARIAN' ? 'Librarian' : 'Member'} Account`}
              </button>
            </div>
          </form>
        </details>

        <details className="card admin-disclosure">
          <summary>Circulation maintenance</summary>
          <div className="form-stack">
            <div className="toolbar">
              <div>
                <h3 id="scheduled-jobs-heading" className="card-title">
                  Scheduled Reminder &amp; Hold Jobs
                </h3>
                <p className="card-subtitle">
                  Expire unclaimed pickup holds and send due-soon or overdue reminders.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={runningJobs}
                onClick={() => void handleRunJobs()}
              >
                <Play size={14} aria-hidden="true" />
                <span>{runningJobs ? 'Running…' : 'Run Jobs Now'}</span>
              </button>
            </div>

            <p className="field-hint">
              Loan limits, fine rates, and reminder schedules follow server configuration. Active standing rules appear directly on member records.
            </p>

            {lastJobResult ? (
              <div className="alert alert-info">
                <CalendarClock size={16} aria-hidden="true" className="alert-icon" />
                <span>
                  Last manual run: <strong>{lastJobResult.expiredHolds}</strong> expired holds ·{' '}
                  <strong>{lastJobResult.dueSoonNotifications}</strong> due-soon alerts ·{' '}
                  <strong>{lastJobResult.overdueNotifications}</strong> overdue reminders.
                </span>
              </div>
            ) : null}
          </div>
        </details>

        <details className="card admin-disclosure admin-disclosure-wide">
          <summary>Role permissions</summary>
          <div
            tabIndex={0}
            role="region"
            aria-labelledby={matrixCaptionId}
            className="table-wrapper table-compact"
          >
            <table className="data-table">
              <caption id={matrixCaptionId}>Authorization matrix by user role</caption>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Catalog &amp; Holds</th>
                  <th scope="col">Self-Service</th>
                  <th scope="col">Circulation Desk</th>
                  <th scope="col">Accounts</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Guest</th>
                  <td>Browse &amp; sign up</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
                <tr>
                  <th scope="row">Member</th>
                  <td>Browse &amp; reserve</td>
                  <td>My Bookshelf</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
                <tr>
                  <th scope="row">Librarian</th>
                  <td>Full catalog &amp; copies</td>
                  <td>My Bookshelf</td>
                  <td>Loans, holds &amp; fines</td>
                  <td>—</td>
                </tr>
                <tr>
                  <th scope="row">Administrator</th>
                  <td>Full catalog &amp; copies</td>
                  <td>My Bookshelf</td>
                  <td>Loans, holds &amp; fines</td>
                  <td>Staff &amp; accounts</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <ModalDialog
        open={resetTarget !== null}
        onClose={() => setResetTarget(null)}
        size="sm"
        title="Reset Account Password"
        subtitle={resetTarget ? `Set a new password for ${resetTarget.email}` : undefined}
      >
        <form className="form-stack" onSubmit={handleResetPasswordSubmit}>
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={resetTarget?.email ?? ''}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="visually-hidden"
          />
          <div className="modal-body form-stack">
            <div className="field">
              <div className="field-label-row">
                <label className="field-label" htmlFor="admin-reset-pw-input">
                  New password
                </label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setResetPasswordVal(generateStrongPassword());
                    setShowResetPassword(true);
                  }}
                >
                  <Wand2 size={14} aria-hidden="true" />
                  <span>Generate</span>
                </button>
              </div>
              <div className="input-with-action">
                <input
                  id="admin-reset-pw-input"
                  type={showResetPassword ? 'text' : 'password'}
                  className="input-control"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={72}
                  autoFocus
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                />
                <button
                  type="button"
                  className="input-action-btn"
                  onClick={() => setShowResetPassword((p) => !p)}
                  aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                >
                  {showResetPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
              <span className="field-hint">Must be 12–72 characters.</span>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={resetBusy || resetPasswordVal.length < 12}
            >
              {resetBusy ? 'Resetting…' : 'Set New Password'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
