export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

export type MeResponse = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string>;
};

async function request<T>(
  path: string,
  opts: {
    method?: string;
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw (data ?? { code: 'http_error', message: `HTTP ${res.status}` }) as ApiError;
  }

  return data as T;
}

export const api = {
  register: (email: string, password: string, displayName?: string) =>
    request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password, displayName: displayName || null },
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  refresh: (refreshToken: string) =>
    request<AuthResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    }),

  logout: (refreshToken: string) =>
    request<void>('/api/v1/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    }),

  me: (token: string) => request<MeResponse>('/api/v1/users/me', { token }),

  createProject: (token: string, name: string, description?: string) =>
    request<Project>('/api/v1/projects', {
      method: 'POST',
      token,
      body: { name, description: description || null },
    }),

  listProjects: (token: string) => request<Project[]>('/api/v1/projects', { token }),

  updateProject: (token: string, projectId: string, body: { name?: string | null; description?: string | null }) =>
    request<Project>(`/api/v1/projects/${projectId}`, {
      method: 'PATCH',
      token,
      body,
    }),

  deleteProject: (token: string, projectId: string) =>
    request<void>(`/api/v1/projects/${projectId}`, {
      method: 'DELETE',
      token,
    }),

  createTask: (token: string, projectId: string, title: string, description?: string) =>
    request<Task>(`/api/v1/projects/${projectId}/tasks`, {
      method: 'POST',
      token,
      body: { title, description: description || null },
    }),

  updateTask: (
    token: string,
    projectId: string,
    taskId: string,
    body: {
      title?: string | null;
      description?: string | null;
      status?: TaskStatus | null;
      priority?: TaskPriority | null;
      dueAt?: string | null;
      completedAt?: string | null;
    }
  ) =>
    request<Task>(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      token,
      body,
    }),

  deleteTask: (token: string, projectId: string, taskId: string) =>
    request<void>(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
      token,
    }),

  listTasks: (
    token: string,
    projectId: string,
    params: {
      q?: string;
      status?: string;
      priority?: string;
      completed?: string;
      page?: number;
      size?: number;
      sort?: string;
    }
  ) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set('q', params.q);
    if (params.status) usp.set('status', params.status);
    if (params.priority) usp.set('priority', params.priority);
    if (params.completed) usp.set('completed', params.completed);
    if (params.page != null) usp.set('page', String(params.page));
    if (params.size != null) usp.set('size', String(params.size));
    if (params.sort) usp.set('sort', params.sort);

    const qs = usp.toString();
    return request<Page<Task>>(`/api/v1/projects/${projectId}/tasks${qs ? `?${qs}` : ''}`, {
      token,
    });
  },
};
