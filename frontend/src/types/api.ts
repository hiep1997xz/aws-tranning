// Generic API response shapes

export interface ApiError {
  error: string;
  details?: Array<{ field: string; message: string }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface MeResponse {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}
