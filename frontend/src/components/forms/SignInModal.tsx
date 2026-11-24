import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { ErrorSummary, type SummaryErrorItem } from '@/components/ui/ErrorSummary';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatApiErrorMessage } from '@/utils/errors';
import { installFormValidationAria } from '@/utils/formValidation';

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
}

export function SignInModal({ open, onClose }: SignInModalProps) {
  const { login } = useAuth();
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

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
  }, [open]);

  const handleClose = () => {
    setPassword('');
    setShowPassword(false);
    setErrorMsg(null);
    setSummaryErrors([]);
    onClose();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const collected: SummaryErrorItem[] = [];
      const emailEl = form.elements.namedItem('email') as HTMLInputElement | null;
      const passEl = form.elements.namedItem('password') as HTMLInputElement | null;
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
          message: 'Password is required.',
        });
      }
      setSummaryErrors(collected);
      return;
    }

    setSummaryErrors([]);
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const me = await login(email, password);
      setPassword('');
      setShowPassword(false);
      notify({
        variant: 'success',
        title: 'Signed in',
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
      title="Sign in to Athenaeum"
      subtitle="Authenticate with your Spring Boot JWT account to unlock circulation and admin tools."
      size="sm"
    >
      <form ref={formRef} className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="modal-body form-stack">
          <ErrorSummary errors={summaryErrors} />

          {errorMsg ? (
            <div className="alert alert-danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" className="alert-icon" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          <div className="field">
            <label className="field-label" htmlFor="signin-email">
              Email address
            </label>
            <span id="signin-email-hint" className="field-hint">
              Enter your registered library account email (e.g. admin@library.local).
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
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="signin-email-hint"
              data-error="signin-email-error"
              placeholder="admin@library.local"
            />
            <div id="signin-email-error" className="field-error">
              <span role="img" aria-label="Error">
                !
              </span>{' '}
              Enter a valid email address.
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="signin-password">
              Password
            </label>
            <span id="signin-password-hint" className="field-hint">
              Paste or type your account password.
            </span>
            <div className="input-with-action">
              <input
                id="signin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="input-control"
                autoComplete="current-password"
                enterKeyHint="done"
                required
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
            <div id="signin-password-error" className="field-error">
              <span role="img" aria-label="Error">
                !
              </span>{' '}
              Password is required.
            </div>
          </div>

          <div className="alert alert-info">
            <Lock size={16} aria-hidden="true" className="alert-icon" />
            <span>
              Your JWT token is verified directly against <code>/api/auth/login</code> and expires
              automatically after 30 minutes.
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Signing In…' : 'Sign In'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
