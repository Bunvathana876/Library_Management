import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CameraOff,
  CheckCircle2,
  QrCode,
  Repeat,
  RotateCcw,
  ScanLine,
  UserCheck,
} from 'lucide-react';
import { loansApi } from '@/api/loansApi';
import { AccessibleTabs, type TabItem } from '@/components/ui/AccessibleTabs';
import { BookCoverImage } from '@/components/ui/BookCoverImage';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/context/ToastContext';
import type { Book, HoldResponse, LoanResponse, Member } from '@/types/api';
import {
  matchActiveLoanFromCode,
  matchBookFromCode,
  matchMemberFromCode,
  parseCirculationCode,
} from '@/utils/circulationCodes';
import { describeLoanSchedule, formatCalendarDate, previewDueDate } from '@/utils/dates';
import { formatApiErrorMessage } from '@/utils/errors';
import { formatCallNumber, formatLoanCode, formatMemberCardCode } from '@/utils/formatting';

export type ScannerMode = 'checkout' | 'return';

interface CirculationScannerModalProps {
  open: boolean;
  initialMode?: ScannerMode;
  books: Book[];
  members: Member[];
  activeLoans: LoanResponse[];
  activeHolds: HoldResponse[];
  onClose: () => void;
  onCompleted: () => void;
}

const CIRCULATION_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'code_128',
  'code_39',
  'qr_code',
] as const;

export function CirculationScannerModal({
  open,
  initialMode = 'checkout',
  books,
  members,
  activeLoans,
  activeHolds,
  onClose,
  onCompleted,
}: CirculationScannerModalProps) {
  const { notify } = useToast();
  const tabsPrefix = useId();
  const codeInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });

  const [mode, setMode] = useState<ScannerMode>(initialMode);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('Starting camera…');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerEngine, setScannerEngine] = useState<'native' | 'zxing' | null>(null);

  const [manualCode, setManualCode] = useState('');
  const [scanMessage, setScanMessage] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);

  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [matchedLoanId, setMatchedLoanId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedBook = useMemo(
    () => books.find((b) => String(b.id) === selectedBookId) ?? null,
    [books, selectedBookId],
  );
  const selectedMember = useMemo(
    () => members.find((m) => String(m.id) === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );
  const matchedLoan = useMemo(
    () => activeLoans.find((l) => l.id === matchedLoanId) ?? null,
    [activeLoans, matchedLoanId],
  );

  const readyHoldForSelectedBook = useMemo(() => {
    if (!selectedBook) return null;
    return (
      activeHolds.find(
        (h) => h.bookId === selectedBook.id && h.status === 'READY_FOR_PICKUP',
      ) ?? null
    );
  }, [activeHolds, selectedBook]);

  useEffect(() => {
    if (!open) {
      setCameraActive(false);
      return;
    }
    setMode(initialMode);
    setManualCode('');
    setScanError(null);
    setScanMessage('');
    setSelectedBookId('');
    setSelectedMemberId('');
    setMatchedLoanId(null);
    setCameraError(null);
    setCameraActive(true);
    window.requestAnimationFrame(() => {
      codeInputRef.current?.focus();
    });
  }, [open, initialMode]);

  const resolveScannedPayload = useCallback(
    (rawValue: string) => {
      const trimmed = rawValue.trim();
      if (!trimmed) return;
      setScanError(null);

      if (mode === 'return') {
        const loan = matchActiveLoanFromCode(trimmed, activeLoans, books);
        if (!loan) {
          setScanError(
            `No active loan matched "${trimmed}". Scan a checked-out book ISBN, CAT-ID, or LOAN-ID.`,
          );
          return;
        }
        setMatchedLoanId(loan.id);
        setScanMessage(
          `Matched ${formatLoanCode(loan.id)}: "${loan.bookTitle}" borrowed by ${loan.memberName}.`,
        );
        return;
      }

      // Checkout mode: try book/ISBN first, then member/email
      const parsed = parseCirculationCode(trimmed);
      if (parsed?.kind === 'member' || parsed?.kind === 'email') {
        const matchedMember = matchMemberFromCode(trimmed, members);
        if (!matchedMember) {
          setScanError(`No registered member matched "${trimmed}".`);
          return;
        }
        setSelectedMemberId(String(matchedMember.id));
        setScanMessage(
          `Selected member ${matchedMember.fullName} (${formatMemberCardCode(matchedMember.id)}).`,
        );
        return;
      }

      const matchedBook = matchBookFromCode(trimmed, books);
      if (matchedBook) {
        setSelectedBookId(String(matchedBook.id));
        const readyHold = activeHolds.find(
          (h) => h.bookId === matchedBook.id && h.status === 'READY_FOR_PICKUP',
        );
        if (readyHold) {
          setSelectedMemberId(String(readyHold.memberId));
          setScanMessage(
            `Matched "${matchedBook.title}" (${formatCallNumber(matchedBook.id)}) — held at desk for ${readyHold.memberName}.`,
          );
        } else if (!matchedBook.available) {
          setScanError(
            `"${matchedBook.title}" is currently checked out. Switch to Quick Return to check it back in.`,
          );
        } else {
          setScanMessage(
            `Selected book "${matchedBook.title}" (${formatCallNumber(matchedBook.id)}). Scan a member QR or choose a borrower below.`,
          );
        }
        return;
      }

      const fallbackMember = matchMemberFromCode(trimmed, members);
      if (fallbackMember) {
        setSelectedMemberId(String(fallbackMember.id));
        setScanMessage(
          `Selected member ${fallbackMember.fullName} (${formatMemberCardCode(fallbackMember.id)}).`,
        );
        return;
      }

      setScanError(
        `Could not match "${trimmed}" to any catalog book or registered member.`,
      );
    },
    [mode, activeLoans, books, members, activeHolds],
  );

  const resolveRef = useRef(resolveScannedPayload);
  resolveRef.current = resolveScannedPayload;

  useEffect(() => {
    if (!open || !cameraActive) {
      return;
    }

    let cancelled = false;
    let rafId: number | null = null;
    let mediaStream: MediaStream | null = null;
    let zxingControls: { stop: () => void } | null = null;

    const cleanupStream = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (zxingControls) {
        try {
          zxingControls.stop();
        } catch {
          // Ignore teardown errors
        }
        zxingControls = null;
      }
      if (mediaStream) {
        for (const track of mediaStream.getTracks()) {
          track.stop();
        }
        mediaStream = null;
      }
      const video = videoRef.current;
      if (video) {
        const attached = video.srcObject as MediaStream | null;
        if (attached) {
          for (const track of attached.getTracks()) {
            track.stop();
          }
        }
        video.srcObject = null;
      }
    };

    const onDecoded = (rawText: string) => {
      if (cancelled) return;
      const now = Date.now();
      if (
        lastScanRef.current.value === rawText &&
        now - lastScanRef.current.at < 1600
      ) {
        return;
      }
      lastScanRef.current = { value: rawText, at: now };
      resolveRef.current(rawText);
    };

    const startCamera = async () => {
      setCameraError(null);
      setCameraStatus('Requesting camera access…');

      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setCameraError(
          'Camera scanning requires HTTPS or localhost. You can type, paste, or use a USB/Bluetooth scanner in the code box below.',
        );
        setCameraActive(false);
        return;
      }

      const videoEl = videoRef.current;
      if (!videoEl) return;

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      try {
        if (typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function') {
          let formats: string[] = [...CIRCULATION_FORMATS];
          if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
            try {
              const supported = await window.BarcodeDetector.getSupportedFormats();
              const filtered = CIRCULATION_FORMATS.filter((f) => supported.includes(f));
              if (filtered.length > 0) {
                formats = filtered;
              }
            } catch {
              // Keep defaults
            }
          }

          if (cancelled) return;
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) {
            cleanupStream();
            return;
          }

          videoEl.srcObject = mediaStream;
          await videoEl.play();
          if (cancelled) {
            cleanupStream();
            return;
          }

          const detector = new window.BarcodeDetector({ formats });
          setScannerEngine('native');
          setCameraStatus('Point camera at a book ISBN barcode or CAT / MEM / LOAN QR code.');

          let lastTick = 0;
          const scanLoop = async (ts: number) => {
            if (cancelled) return;
            if (ts - lastTick >= 150 && videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              lastTick = ts;
              try {
                const detected = await detector.detect(videoEl);
                for (const code of detected) {
                  if (code.rawValue) {
                    onDecoded(code.rawValue);
                    break;
                  }
                }
              } catch {
                // Keep scanning
              }
            }
            if (!cancelled) {
              rafId = window.requestAnimationFrame((nextTs) => {
                void scanLoop(nextTs);
              });
            }
          };

          rafId = window.requestAnimationFrame((ts) => {
            void scanLoop(ts);
          });
          return;
        }

        // Cross-browser fallback (Safari / Firefox) via lazy-loaded ZXing multi-format reader
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
          await Promise.all([import('@zxing/browser'), import('@zxing/library')]);

        if (cancelled) return;

        const hints = new Map<unknown, unknown>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
        ]);

        const reader = new BrowserMultiFormatReader(
          hints as Map<import('@zxing/library').DecodeHintType, unknown>,
        );
        setScannerEngine('zxing');
        setCameraStatus('Point camera at a book ISBN barcode or CAT / MEM / LOAN QR code.');

        const controls = await reader.decodeFromConstraints(constraints, videoEl, (result) => {
          if (result) {
            onDecoded(result.getText());
          }
        });

        if (cancelled) {
          controls.stop();
          cleanupStream();
          return;
        }
        zxingControls = controls;
      } catch (err) {
        if (cancelled) return;
        cleanupStream();
        setCameraActive(false);
        const msg = err instanceof Error ? err.message : '';
        if (
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
        ) {
          setCameraError(
            'Camera permission was denied. Allow camera access or scan/enter codes manually below.',
          );
        } else if (
          err instanceof DOMException &&
          (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')
        ) {
          setCameraError(
            'No webcam detected on this device. Use a USB/Bluetooth scanner or enter a code below.',
          );
        } else {
          setCameraError(
            msg
              ? `Camera unavailable (${msg}). Enter or scan a code manually below.`
              : 'Camera unavailable. Enter or scan a code manually below.',
          );
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      cleanupStream();
    };
  }, [open, cameraActive]);

  const handleManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    resolveScannedPayload(manualCode);
    setManualCode('');
  };

  const handleConfirmReturn = async () => {
    if (!matchedLoan) return;
    setSubmitting(true);
    setScanError(null);
    try {
      const updated = await loansApi.returnBook(matchedLoan.id);
      onCompleted();
      setMatchedLoanId(null);
      if (updated.heldForMemberName) {
        notify({
          variant: 'info',
          title: 'Book returned & held at desk',
          message: `"${updated.bookTitle}" is now reserved for ${updated.heldForMemberName} (3-day pickup window).`,
        });
        setScanMessage(
          `Returned "${updated.bookTitle}" — held at desk for ${updated.heldForMemberName}.`,
        );
      } else {
        notify({
          variant: 'success',
          title: 'Book returned',
          message: `Loan #${updated.id} ("${updated.bookTitle}") checked back in.`,
        });
        setScanMessage(`Returned "${updated.bookTitle}". Ready for next scan.`);
      }
    } catch (err) {
      setScanError(formatApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCheckout = async () => {
    if (!selectedBook || !selectedMember) return;
    setSubmitting(true);
    setScanError(null);
    try {
      const created = await loansApi.borrowBook({
        bookId: selectedBook.id,
        memberId: selectedMember.id,
      });
      onCompleted();
      setSelectedBookId('');
      setScanMessage(`Checked out "${created.bookTitle}" to ${created.memberName}. Ready for next book.`);
      notify({
        variant: 'success',
        title: 'Checkout complete',
        message: `"${created.bookTitle}" issued to ${created.memberName} (due ${formatCalendarDate(created.dueOn)}).`,
      });
    } catch (err) {
      setScanError(formatApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const modeTabs: ReadonlyArray<TabItem<ScannerMode>> = [
    { id: 'checkout', label: 'Quick Checkout', icon: <Repeat size={15} /> },
    { id: 'return', label: 'Quick Return', icon: <RotateCcw size={15} /> },
  ];

  const canCheckout =
    Boolean(selectedBook) &&
    Boolean(selectedMember) &&
    (selectedBook?.available ||
      (readyHoldForSelectedBook !== null &&
        String(readyHoldForSelectedBook.memberId) === selectedMemberId));

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Circulation Barcode & QR Scanner"
      subtitle="Scan ISBN barcodes or CAT / MEM / LOAN QR passes for instant checkout and returns"
    >
      <div className="modal-body scanner-modal-body">
        <div className="scanner-toolbar-row">
          <AccessibleTabs
            ariaLabel="Scanner circulation mode"
            tabs={modeTabs}
            activeTab={mode}
            idPrefix={tabsPrefix}
            onChange={(nextMode) => {
              setMode(nextMode);
              setScanError(null);
              setScanMessage('');
            }}
          />

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setCameraError(null);
              setCameraActive((prev) => !prev);
            }}
          >
            {cameraActive ? <CameraOff size={15} aria-hidden="true" /> : <Camera size={15} aria-hidden="true" />}
            <span>{cameraActive ? 'Pause Camera' : 'Start Camera'}</span>
          </button>
        </div>

        <div
          role="tabpanel"
          aria-labelledby={`${tabsPrefix}-tab-${mode}`}
          className="scanner-tab-stack"
        >
          {cameraError ? (
            <div className="alert alert-warning" role="alert">
              <CameraOff size={17} aria-hidden="true" className="alert-icon" />
              <span>{cameraError}</span>
            </div>
          ) : cameraActive ? (
            <div className="isbn-scanner-panel">
              <div className="isbn-scanner-header">
                <div className="isbn-scanner-title-group">
                  <ScanLine size={16} aria-hidden="true" />
                  <span>Live Camera Feed</span>
                </div>
                {scannerEngine ? (
                  <span className="badge badge-neutral">
                    {scannerEngine === 'native' ? 'Native BarcodeDetector' : 'ZXing Fallback'}
                  </span>
                ) : null}
              </div>
              <div className="isbn-scanner-viewport scanner-viewport-compact">
                <video ref={videoRef} playsInline muted autoPlay className="isbn-scanner-video" />
                <div className="isbn-scanner-reticle" aria-hidden="true">
                  <span className="isbn-reticle-corner isbn-reticle-tl" />
                  <span className="isbn-reticle-corner isbn-reticle-tr" />
                  <span className="isbn-reticle-corner isbn-reticle-bl" />
                  <span className="isbn-reticle-corner isbn-reticle-br" />
                </div>
              </div>
              <p className="field-hint">{cameraStatus}</p>
            </div>
          ) : null}

          <form onSubmit={handleManualSubmit} className="scanner-manual-form">
            <div className="field" style={{ flex: '1 1 240px' }}>
              <label className="field-label" htmlFor="circulation-scan-input">
                Barcode / QR Code Entry (USB scanner or keyboard)
              </label>
              <div className="isbn-input-row scanner-code-row">
                <input
                  ref={codeInputRef}
                  id="circulation-scan-input"
                  name="scanCode"
                  type="text"
                  className="input-control mono scanner-code-input"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  autoComplete="off"
                  enterKeyHint="go"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder={
                    mode === 'return'
                      ? '9780132350884, CAT-0001, or LOAN-0001'
                      : '9780132350884, CAT-0001, or MEM-0001'
                  }
                />
                <button type="submit" className="btn btn-secondary btn-sm">
                  <QrCode size={15} aria-hidden="true" />
                  <span>Resolve</span>
                </button>
              </div>
            </div>
          </form>

          <div role="status" aria-live="polite" className="isbn-status-live">
            {scanError ? (
              <div className="alert alert-danger" role="alert">
                <AlertTriangle size={17} aria-hidden="true" className="alert-icon" />
                <span>{scanError}</span>
              </div>
            ) : scanMessage ? (
              <div className="alert alert-info">
                <CheckCircle2 size={17} aria-hidden="true" className="alert-icon" />
                <span>{scanMessage}</span>
              </div>
            ) : null}
          </div>

          {mode === 'return' ? (
            matchedLoan ? (
              <div className="scanner-match-card">
                <div className="queue-row-main">
                  <div className="queue-row-top">
                    <span className="catalog-id-badge mono">{formatLoanCode(matchedLoan.id)}</span>
                    <span className="queue-row-title">{matchedLoan.bookTitle}</span>
                    <StatusBadge tone={matchedLoan.overdue ? 'danger' : 'info'}>
                      {matchedLoan.overdue ? 'Overdue' : 'Active'}
                    </StatusBadge>
                  </div>
                  <p className="queue-row-sub">
                    Borrowed by <strong>{matchedLoan.memberName}</strong> · Due{' '}
                    {formatCalendarDate(matchedLoan.dueOn)} (
                    {describeLoanSchedule(
                      matchedLoan.dueOn,
                      matchedLoan.returnedOn,
                      matchedLoan.overdue,
                    )}
                    )
                  </p>
                  {matchedLoan.hasActiveHold ? (
                    <div className="alert alert-warning" style={{ marginTop: '0.6rem' }}>
                      <AlertTriangle size={16} aria-hidden="true" className="alert-icon" />
                      <span>
                        Active hold waiting: returning this copy will hold it at the desk for the
                        next patron in queue.
                      </span>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submitting}
                  onClick={() => void handleConfirmReturn()}
                >
                  {submitting ? 'Returning…' : 'Confirm Return'}
                </button>
              </div>
            ) : (
              <div className="access-info-panel">
                <BookOpen size={18} aria-hidden="true" className="access-key-icon" />
                <span>
                  Scan a book&apos;s ISBN barcode, catalog QR (<code>CAT-0001</code>), or loan ID (
                  <code>LOAN-0001</code>) to check it back in.
                </span>
              </div>
            )
          ) : (
            <div className="scanner-checkout-grid">
              <div className="field">
                <label className="field-label" htmlFor="scanner-book-select">
                  1. Book to Checkout
                </label>
                <select
                  id="scanner-book-select"
                  className="select-control"
                  value={selectedBookId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedBookId(nextId);
                    const picked = books.find((b) => String(b.id) === nextId);
                    if (picked) {
                      const readyHold = activeHolds.find(
                        (h) => h.bookId === picked.id && h.status === 'READY_FOR_PICKUP',
                      );
                      if (readyHold) {
                        setSelectedMemberId(String(readyHold.memberId));
                      }
                    }
                  }}
                >
                  <option value="">Scan or choose a book…</option>
                  {books.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.title} ({formatCallNumber(b.id)}
                      {b.isbn ? ` · ${b.isbn}` : ''})
                      {b.reservedForPickup
                        ? ' [Held at Desk]'
                        : b.available
                          ? ''
                          : ' [Checked Out]'}
                    </option>
                  ))}
                </select>
                {selectedBook ? (
                  <div className="scanner-selected-chip">
                    <div className="highlight-cover-thumb" aria-hidden="true">
                      <BookCoverImage
                        book={selectedBook}
                        width={40}
                        height={52}
                        className="highlight-cover-img"
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="queue-row-title">{selectedBook.title}</div>
                      <div className="table-subline">
                        {selectedBook.author} ·{' '}
                        {readyHoldForSelectedBook
                          ? `Reserved for ${readyHoldForSelectedBook.memberName}`
                          : selectedBook.available
                            ? `Due ${previewDueDate(14)}`
                            : 'Currently borrowed'}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="field">
                <label className="field-label" htmlFor="scanner-member-select">
                  2. Patron / Member
                </label>
                <select
                  id="scanner-member-select"
                  className="select-control"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                >
                  <option value="">Scan member QR or select…</option>
                  {members.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.fullName} ({formatMemberCardCode(m.id)} · {m.email})
                    </option>
                  ))}
                </select>
                {selectedMember ? (
                  <div className="scanner-selected-chip">
                    <UserCheck size={18} aria-hidden="true" className="access-key-icon" />
                    <div style={{ minWidth: 0 }}>
                      <div className="queue-row-title">{selectedMember.fullName}</div>
                      <div className="table-subline mono">
                        {formatMemberCardCode(selectedMember.id)} · {selectedMember.email}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="modal-footer modal-footer-split">
        <span className="field-hint">
          {mode === 'checkout'
            ? `Standard 14-day loan (due ${previewDueDate(14)})`
            : `${activeLoans.length} active loan${activeLoans.length === 1 ? '' : 's'} eligible`}
        </span>
        <div className="row-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {mode === 'checkout' ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canCheckout || submitting}
              onClick={() => void handleConfirmCheckout()}
            >
              {submitting ? 'Issuing Loan…' : 'Complete 14-Day Checkout'}
            </button>
          ) : null}
        </div>
      </div>
    </ModalDialog>
  );
}
