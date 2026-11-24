import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { membersApi } from '@/api/membersApi';
import { ErrorSummary, type SummaryErrorItem } from '@/components/ui/ErrorSummary';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { useToast } from '@/context/ToastContext';
import type { Member } from '@/types/api';
import { ApiError, formatApiErrorMessage } from '@/utils/errors';
import { installFormValidationAria } from '@/utils/formValidation';

interface MemberFormModalProps {
  open: boolean;
  onClose: () => void;
  onRegistered: (member: Member) => void;
}

export function MemberFormModal({ open, onClose, onRegistered }: MemberFormModalProps) {
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [summaryErrors, setSummaryErrors] = useState<SummaryErrorItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setFullName('');
    setEmail('');
    setErrorMsg(null);
    setFieldErrors({});
    setSummaryErrors([]);
    if (formRef.current) {
      return installFormValidationAria(formRef.current);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const collected: SummaryErrorItem[] = [];
      const nameEl = form.elements.namedItem('fullName') as HTMLInputElement | null;
      const emailEl = form.elements.namedItem('email') as HTMLInputElement | null;
      if (nameEl && !nameEl.validity.valid) {
        collected.push({
          fieldId: 'member-fullname',
          label: 'Full name',
          message: 'Please enter a full name.',
        });
      }
      if (emailEl && !emailEl.validity.valid) {
        collected.push({
          fieldId: 'member-email',
          label: 'Email address',
          message: 'Enter a valid email address.',
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
      const created = await membersApi.registerMember({
        fullName: fullName.trim(),
        email: email.trim(),
      });
      onRegistered(created);
      onClose();
      notify({
        variant: 'success',
        title: 'Member registered',
        message: `${created.fullName} (#${created.id}) added to the member directory.`,
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

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Register Library Member"
      subtitle="Create a borrower profile so this member can check out books."
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
            <label className="field-label" htmlFor="member-fullname">
              Full name
            </label>
            <span id="member-fullname-hint" className="field-hint">
              Enter the member&apos;s full name (up to 120 characters).
            </span>
            <input
              id="member-fullname"
              name="fullName"
              type="text"
              className="input-control"
              autoComplete="name"
              required
              maxLength={120}
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-describedby="member-fullname-hint"
              data-error="member-fullname-error"
              placeholder="Sokha Dara"
            />
            <div
              id="member-fullname-error"
              className="field-error"
              data-visible={fieldErrors.fullName ? 'true' : undefined}
            >
              {fieldErrors.fullName || 'Please enter a full name.'}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="member-email">
              Email address
            </label>
            <span id="member-email-hint" className="field-hint">
              Must be unique across registered members (e.g. reader@example.com).
            </span>
            <input
              id="member-email"
              name="email"
              type="email"
              className="input-control"
              autoComplete="email"
              spellCheck={false}
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="member-email-hint"
              data-error="member-email-error"
              placeholder="reader@example.com"
            />
            <div
              id="member-email-error"
              className="field-error"
              data-visible={fieldErrors.email ? 'true' : undefined}
            >
              {fieldErrors.email || 'Enter a valid email address.'}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Registering…' : 'Register Member'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
