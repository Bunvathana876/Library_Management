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
  editingMember?: Member | null;
  onClose: () => void;
  onSaved: (member: Member) => void;
}

export function MemberFormModal({
  open,
  editingMember = null,
  onClose,
  onSaved,
}: MemberFormModalProps) {
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [summaryErrors, setSummaryErrors] = useState<SummaryErrorItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setFullName(editingMember?.fullName ?? '');
    setEmail(editingMember?.email ?? '');
    setPhone(editingMember?.phone ?? '');
    setNotes(editingMember?.notes ?? '');
    setErrorMsg(null);
    setFieldErrors({});
    setSummaryErrors([]);
    if (formRef.current) {
      return installFormValidationAria(formRef.current);
    }
  }, [open, editingMember]);

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
      const payload = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      };
      const saved = editingMember
        ? await membersApi.updateMember(editingMember.id, payload)
        : await membersApi.registerMember(payload);
      onSaved(saved);
      onClose();
      notify({
        variant: 'success',
        title: editingMember ? 'Member updated' : 'Member registered',
        message: editingMember
          ? `Updated profile for ${saved.fullName} (#${saved.id}).`
          : `${saved.fullName} (#${saved.id}) added to the member directory.`,
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
      title={editingMember ? `Edit Member #${editingMember.id}` : 'Register Library Member'}
      subtitle={
        editingMember
          ? 'Update patron contact details and circulation notes'
          : 'Create a borrower profile so this member can check out books'
      }
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

          <div className="field">
            <label className="field-label" htmlFor="member-phone">
              Phone number (optional)
            </label>
            <input
              id="member-phone"
              name="phone"
              type="tel"
              className="input-control"
              autoComplete="tel"
              maxLength={30}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+855 12 345 678"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="member-notes">
              Staff notes (optional)
            </label>
            <textarea
              id="member-notes"
              name="notes"
              rows={2}
              className="input-control"
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Student card verified, preferred contact window, etc."
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : editingMember ? 'Save Member' : 'Register Member'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
