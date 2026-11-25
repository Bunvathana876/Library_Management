import { apiRequest } from '@/api/httpClient';
import type {
  CreateMemberRequest,
  Member,
  MemberDetailResponse,
  UpdateMemberRequest,
} from '@/types/api';

export const membersApi = {
  listMembers(signal?: AbortSignal): Promise<Member[]> {
    return apiRequest<Member[]>('/api/members', {
      method: 'GET',
      signal,
    });
  },

  getMemberDetail(id: number, signal?: AbortSignal): Promise<MemberDetailResponse> {
    return apiRequest<MemberDetailResponse>(`/api/members/${id}`, {
      method: 'GET',
      signal,
    });
  },

  registerMember(request: CreateMemberRequest): Promise<Member> {
    return apiRequest<Member>('/api/members', {
      method: 'POST',
      body: request,
    });
  },

  updateMember(id: number, request: UpdateMemberRequest): Promise<Member> {
    return apiRequest<Member>(`/api/members/${id}`, {
      method: 'PUT',
      body: request,
    });
  },

  updateMemberStatus(id: number, active: boolean): Promise<Member> {
    return apiRequest<Member>(`/api/members/${id}/status`, {
      method: 'PATCH',
      body: { active },
    });
  },

  deleteMember(id: number): Promise<void> {
    return apiRequest<void>(`/api/members/${id}`, {
      method: 'DELETE',
    });
  },
};
