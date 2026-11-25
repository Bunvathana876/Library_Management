export type UserRole = 'ADMIN' | 'LIBRARIAN' | 'MEMBER';

export type BookCopyStatus = 'AVAILABLE' | 'LOANED' | 'ON_HOLD' | 'DAMAGED' | 'LOST';

export type FineStatus = 'NONE' | 'UNPAID' | 'PAID' | 'WAIVED';

export type NotificationType =
  | 'HOLD_READY'
  | 'HOLD_EXPIRED'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'FINE_ASSESSED'
  | 'ACCOUNT';

export interface Book {
  id: number;
  title: string;
  author: string;
  publicationYear: number;
  isbn?: string | null;
  publisher?: string | null;
  coverUrl?: string | null;
  category?: string | null;
  shelfLocation?: string | null;
  available: boolean;
  activeHoldCount?: number;
  reservedForPickup?: boolean;
  totalCopies?: number;
  availableCopies?: number;
  loanedCopies?: number;
  onHoldCopies?: number;
}

export interface BookRequest {
  title: string;
  author: string;
  publicationYear: number;
  isbn?: string | null;
  publisher?: string | null;
  coverUrl?: string | null;
  category?: string | null;
  shelfLocation?: string | null;
  initialCopies?: number | null;
}

export interface BookCopyResponse {
  id: number;
  bookId: number;
  barcode: string;
  status: BookCopyStatus;
  shelfLocation: string | null;
  conditionNotes: string | null;
  createdAt: string;
}

export interface BookCopyRequest {
  barcode?: string | null;
  shelfLocation?: string | null;
  conditionNotes?: string | null;
  status?: BookCopyStatus | null;
}

export interface BookMetadataResponse {
  isbn: string;
  title: string;
  author: string | null;
  publicationYear: number | null;
  publisher: string | null;
  coverUrl: string | null;
  source: string;
}

export interface Member {
  id: number;
  fullName: string;
  email: string;
  active?: boolean;
  phone?: string | null;
  notes?: string | null;
  createdAt?: string;
  activeLoanCount?: number;
  overdueLoanCount?: number;
  unpaidFinesTotal?: number;
  borrowingBlocked?: boolean;
  borrowingBlockReason?: string | null;
}

export interface CreateMemberRequest {
  fullName: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
}

export interface UpdateMemberRequest {
  fullName: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
}

export interface MemberDetailResponse {
  id: number;
  fullName: string;
  email: string;
  active: boolean;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  activeLoanCount: number;
  overdueLoanCount: number;
  activeLoanLimit: number;
  unpaidFinesTotal: number;
  fineBlockThreshold: number;
  borrowingBlocked: boolean;
  borrowingBlockReason: string | null;
  activeLoans: LoanResponse[];
  returnHistory: LoanResponse[];
  fineLoans: LoanResponse[];
  activeHolds: HoldResponse[];
  pastHolds: HoldResponse[];
}

export interface BorrowRequest {
  bookId: number;
  memberId: number;
  copyId?: number | null;
}

export interface LoanResponse {
  id: number;
  bookId: number;
  copyId?: number | null;
  copyBarcode?: string | null;
  bookTitle: string;
  bookAuthor?: string | null;
  bookIsbn?: string | null;
  bookCoverUrl?: string | null;
  memberId: number;
  memberName: string;
  borrowedOn: string;
  dueOn: string;
  returnedOn: string | null;
  overdue: boolean;
  overdueDays?: number;
  fineAmount?: number;
  fineStatus?: FineStatus;
  fineSettledAt?: string | null;
  fineNote?: string | null;
  renewalCount: number;
  maxRenewals: number;
  lastRenewedOn: string | null;
  hasActiveHold: boolean;
  renewable: boolean;
  renewDisabledReason: string | null;
  heldForMemberName: string | null;
}

export type HoldStatus =
  | 'WAITING'
  | 'READY_FOR_PICKUP'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface CreateHoldRequest {
  bookId: number;
  memberId?: number;
}

export interface HoldResponse {
  id: number;
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
  bookIsbn: string | null;
  bookCoverUrl: string | null;
  copyBarcode?: string | null;
  memberId: number;
  memberName: string;
  memberEmail: string;
  status: HoldStatus;
  queuePosition: number;
  placedAt: string;
  readyAt: string | null;
  expiresOn: string | null;
}

export interface MemberBookshelfResponse {
  memberId: number;
  fullName: string;
  email: string;
  active?: boolean;
  activeLoanLimit?: number;
  dailyFineRate?: number;
  unpaidFinesTotal?: number;
  fineBlockThreshold?: number;
  borrowingBlocked?: boolean;
  borrowingBlockReason?: string | null;
  activeLoans: LoanResponse[];
  returnHistory: LoanResponse[];
  fineLoans?: LoanResponse[];
  activeHolds: HoldResponse[];
  pastHolds: HoldResponse[];
}

export interface NotificationItem {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  unreadCount: number;
  items: NotificationItem[];
}

export interface ScheduledJobRunResponse {
  expiredHolds: number;
  dueSoonNotifications: number;
  overdueNotifications: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
}

export interface AuthUser {
  email: string;
  roles: UserRole[];
}

export interface CreateAccountRequest {
  email: string;
  password: string;
  role: 'LIBRARIAN' | 'MEMBER';
  fullName?: string;
}

export interface AccountResponse {
  id: number;
  email: string;
  role: UserRole;
  enabled: boolean;
}

export interface HealthResponse {
  status: string;
  groups?: string[];
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string>;
}
