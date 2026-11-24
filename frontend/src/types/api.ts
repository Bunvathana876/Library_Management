export type UserRole = 'ADMIN' | 'LIBRARIAN' | 'MEMBER';

export interface Book {
  id: number;
  title: string;
  author: string;
  publicationYear: number;
  available: boolean;
}

export interface BookRequest {
  title: string;
  author: string;
  publicationYear: number;
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
  memberId: number;
  memberName: string;
  borrowedOn: string;
  dueOn: string;
  returnedOn: string | null;
  overdue: boolean;
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
