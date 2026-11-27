import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/api/authApi';
import { ErrorSummary, type SummaryErrorItem } from '@/components/ui/ErrorSummary';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { useToast } from '@/context/ToastContext';
import { formatApiErrorMessage } from '@/utils/errors';
import { installFormValidationAria } from '@/utils/formValidation';
import { evaluatePasswordStrength } from '@/utils/formatting';

interface ChangePasswordModalProps {
  open: boolean;
  email?: string;
  onClose: () => void;
}

export function ChangePasswordModal({ open, email, onClose }: ChangePasswordModalProps) {
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summaryErrors, setSummaryErrors] = useState<SummaryErrorItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setErrorMsg(null);
    setSummaryErrors([]);
    formRef.current?.reset();
    if (formRef.current) {
      return installFormValidationAria(formRef.current);
    }
  }, [open]);

  const strength = evaluatePasswordStrength(newPassword);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const collected: SummaryErrorItem[] = [];
      if (!currentPassword) {
        collected.push({
          fieldId: 'change-current-password',
          label: 'Current password',
          message: 'Enter your current password.',
        });
      }
      if (newPassword.length < 12 || newPassword.length > 72) {
        collected.push({
          fieldId: 'change-new-password',
          label: 'New password',
          message: 'New password must be between 12 and 72 characters.',
        });
      }
      setSummaryErrors(collected);
      return;
    }

    setSummaryErrors([]);
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      onClose();
      notify({
        variant: 'success',
        title: 'Password updated',
        message: 'Your account password has been changed.',
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
      onClose={onClose}
      size="sm"
      title="Change Password"
      subtitle="Update the password for your signed-in account"
    >
      <form ref={formRef} className="form-stack" onSubmit={handleSubmit} noValidate>
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email ?? ''}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="visually-hidden"
        />
        <div className="modal-body form-stack">
          <ErrorSummary errors={summaryErrors} />

          {errorMsg ? (
            <div className="alert alert-danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" className="alert-icon" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          <div className="field">
            <label className="field-label" htmlFor="change-current-password">
              Current password
            </label>
            <div className="input-with-action">
              <input
                id="change-current-password"
                name="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                className="input-control"
                autoComplete="current-password"
                enterKeyHint="next"
                required
                autoFocus
                data-dialog-autofocus
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                data-error="change-current-password-error"
              />
              <button
                type="button"
                className="input-action-btn"
                onClick={() => setShowCurrent((p) => !p)}
                aria-pressed={showCurrent}
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
              >
                {showCurrent ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
              </button>
            </div>
            <div id="change-current-password-error" className="field-error">
              <AlertCircle size={14} aria-hidden="true" />
              <span>Current password is required.</span>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="change-new-password">
              New password
            </label>
            <span id="change-new-password-hint" className="field-hint">
              Between 12 and 72 characters.
            </span>
            <div className="input-with-action">
              <input
                id="change-new-password"
                name="newPassword"
                type={showNew ? 'text' : 'password'}
                className="input-control"
                autoComplete="new-password"
                enterKeyHint="done"
                required
                minLength={12}
                maxLength={72}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                aria-describedby="change-new-password-hint"
                data-error="change-new-password-error"
              />
              <button
                type="button"
                className="input-action-btn"
                onClick={() => setShowNew((p) => !p)}
                aria-pressed={showNew}
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
              >
                {showNew ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
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
                <span>Strength: <strong>{strength.label}</strong></span>
                <span className="mono">{newPassword.length}/72</span>
              </div>
            </div>
            <div id="change-new-password-error" className="field-error">
              <AlertCircle size={14} aria-hidden="true" />
              <span>New password must be between 12 and 72 characters.</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <span>{submitting ? 'Updating…' : 'Update Password'}</span>
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
