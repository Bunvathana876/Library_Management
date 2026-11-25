export type UserRole = 'ADMIN' | 'LIBRARIAN' | 'MEMBER';

export interface Book {
  id: number;
  title: string;
  author: string;
  publicationYear: number;
  isbn?: string | null;
  publisher?: string | null;
  coverUrl?: string | null;
  available: boolean;
  activeHoldCount?: number;
  reservedForPickup?: boolean;
}

export interface BookRequest {
  title: string;
  author: string;
  publicationYear: number;
  isbn?: string | null;
  publisher?: string | null;
  coverUrl?: string | null;
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
}

export interface CreateMemberRequest {
  fullName: string;
  email: string;
}

export interface BorrowRequest {
  bookId: number;
  memberId: number;
}

export interface LoanResponse {
  id: number;
  bookId: number;
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
  activeLoans: LoanResponse[];
  returnHistory: LoanResponse[];
  activeHolds: HoldResponse[];
  pastHolds: HoldResponse[];
}

export interface LoginRequest {
  email: string;
  password: string;
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
