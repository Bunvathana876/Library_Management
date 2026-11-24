import { apiRequest } from '@/api/httpClient';
import type { CreateMemberRequest, Member } from '@/types/api';

export const membersApi = {
  listMembers(signal?: AbortSignal): Promise<Member[]> {
    return apiRequest<Member[]>('/api/members', {
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
};
