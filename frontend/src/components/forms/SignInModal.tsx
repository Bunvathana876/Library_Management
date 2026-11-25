import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, Lock, UserPlus } from 'lucide-react';
import { ErrorSummary, type SummaryErrorItem } from '@/components/ui/ErrorSummary';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatApiErrorMessage } from '@/utils/errors';
import { installFormValidationAria } from '@/utils/formValidation';
import { evaluatePasswordStrength } from '@/utils/formatting';

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'register';

export function SignInModal({ open, onClose }: SignInModalProps) {
  const { login, register } = useAuth();
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summaryErrors, setSummaryErrors] = useState<SummaryErrorItem[]>([]);

  useEffect(() => {
    if (!open || !formRef.current) return;
    setErrorMsg(null);
    setSummaryErrors([]);
    return installFormValidationAria(formRef.current);
  }, [open, mode]);

  const handleClose = () => {
    setPassword('');
    setShowPassword(false);
    setErrorMsg(null);
    setSummaryErrors([]);
    onClose();
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setPassword('');
    setShowPassword(false);
    setErrorMsg(null);
    setSummaryErrors([]);
    formRef.current?.reset();
  };

  const strength = evaluatePasswordStrength(password);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const collected: SummaryErrorItem[] = [];
      if (mode === 'register') {
        const nameEl = form.elements.namedItem('fullName') as HTMLInputElement | null;
        if (nameEl && !nameEl.validity.valid) {
          collected.push({
            fieldId: 'signup-fullname',
            label: 'Full name',
            message: 'Enter your full name.',
          });
        }
      }
      const emailEl = form.elements.namedItem('email') as HTMLInputElement | null;
      const passEl = form.elements.namedItem(mode === 'register' ? 'new-password' : 'password') as HTMLInputElement | null;
      if (emailEl && !emailEl.validity.valid) {
        collected.push({
          fieldId: 'signin-email',
          label: 'Email address',
          message: 'Enter a valid email address.',
        });
      }
      if (passEl && !passEl.validity.valid) {
        collected.push({
          fieldId: 'signin-password',
          label: 'Password',
          message:
            mode === 'register'
              ? 'Password must be between 12 and 72 characters.'
              : 'Password is required.',
        });
      }
      setSummaryErrors(collected);
      return;
    }

    setSummaryErrors([]);
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const me =
        mode === 'register'
          ? await register(fullName, email, password)
          : await login(email, password);
      setPassword('');
      setShowPassword(false);
      notify({
        variant: 'success',
        title: mode === 'register' ? 'Member account created' : 'Signed in',
        message: `Authenticated as ${me.email} (${me.roles.join(', ')}).`,
      });
    } catch (err) {
      setErrorMsg(formatApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={handleClose}
      title={mode === 'login' ? 'Sign in to Athenaeum' : 'Create a Patron Account'}
      subtitle={
        mode === 'login'
          ? 'Sign in with your account to access circulation, My Bookshelf, and holds'
          : 'Register for self-service loans, renewals, hold queues, and notifications'
      }
      size="sm"
    >
      <form ref={formRef} className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="modal-body form-stack">
          <div className="auth-mode-toggle" role="group" aria-label="Authentication mode">
            <button
              type="button"
              className="auth-mode-btn"
              aria-pressed={mode === 'login'}
              onClick={() => switchMode('login')}
            >
              <Lock size={14} aria-hidden="true" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              className="auth-mode-btn"
              aria-pressed={mode === 'register'}
              onClick={() => switchMode('register')}
            >
              <UserPlus size={14} aria-hidden="true" />
              <span>Create Account</span>
            </button>
          </div>

          <ErrorSummary errors={summaryErrors} />

          {errorMsg ? (
            <div className="alert alert-danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" className="alert-icon" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          {mode === 'register' ? (
            <div className="field">
              <label className="field-label" htmlFor="signup-fullname">
                Full name
              </label>
              <span id="signup-fullname-hint" className="field-hint">
                Displayed on your borrower pass and circulation receipts.
              </span>
              <input
                id="signup-fullname"
                name="fullName"
                type="text"
                className="input-control"
                autoComplete="name"
                enterKeyHint="next"
                required
                maxLength={120}
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-describedby="signup-fullname-hint"
                data-error="signup-fullname-error"
                placeholder="Sokha Dara"
              />
              <div id="signup-fullname-error" className="field-error">
                <AlertCircle size={14} aria-hidden="true" />
                <span>Please enter your full name.</span>
              </div>
            </div>
          ) : null}

          <div className="field">
            <label className="field-label" htmlFor="signin-email">
              Email address
            </label>
            <span id="signin-email-hint" className="field-hint">
              {mode === 'login'
                ? 'Enter your registered library account email (e.g. admin@library.local).'
                : 'Use your email address as your library sign-in identifier.'}
            </span>
            <input
              id="signin-email"
              name="email"
              type="email"
              className="input-control"
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="next"
              required
              autoFocus={mode === 'login'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="signin-email-hint"
              data-error="signin-email-error"
              placeholder={mode === 'login' ? 'admin@library.local' : 'patron@library.local'}
            />
            <div id="signin-email-error" className="field-error">
              <AlertCircle size={14} aria-hidden="true" />
              <span>Enter a valid email address.</span>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="signin-password">
              Password
            </label>
            <span id="signin-password-hint" className="field-hint">
              {mode === 'login'
                ? 'Paste or type your account password.'
                : 'Minimum 12 characters. Password managers and pasting are supported.'}
            </span>
            <div className="input-with-action">
              <input
                id="signin-password"
                name={mode === 'register' ? 'new-password' : 'password'}
                type={showPassword ? 'text' : 'password'}
                className="input-control"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                enterKeyHint="done"
                required
                minLength={mode === 'register' ? 12 : undefined}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="signin-password-hint"
                data-error="signin-password-error"
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
            {mode === 'register' ? (
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
                  <span>Strength: <strong>{strength.label}</strong></span>
                  <span className="mono">{password.length}/72</span>
                </div>
              </div>
            ) : null}
            <div id="signin-password-error" className="field-error">
              <AlertCircle size={14} aria-hidden="true" />
              <span>
                {mode === 'register'
                  ? 'Password must be between 12 and 72 characters.'
                  : 'Password is required.'}
              </span>
            </div>
          </div>

          <div className="alert alert-info">
            <Lock size={16} aria-hidden="true" className="alert-icon" />
            <span>
              Sessions remain active for 30 minutes before requiring re-authentication.
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? mode === 'register'
                ? 'Creating Account…'
                : 'Signing In…'
              : mode === 'register'
                ? 'Create Member Account'
                : 'Sign In'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
