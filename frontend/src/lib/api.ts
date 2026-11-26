/**
 * Enterprise Accounting & Inventory ERP API Client
 * Strict implementation of Master Build Document Section 9 (API Conventions)
 */

export interface ApiResponse<T = any> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, error: ApiErrorPayload) {
    super(error.message);
    this.name = "ApiError";
    this.status = status;
    this.code = error.code || "UNKNOWN_ERROR";
    this.details = error.details;
  }
}

export interface RequestOptions extends RequestInit {
  companyId?: string;
  params?: Record<string, string | number | boolean | undefined>;
  _retry?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// In-memory token store for performance & safety
let inMemoryAccessToken: string | null = null;
let inMemoryCompanyId: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let onAuthFailedListener: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  inMemoryAccessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
  }
}

export function getAuthToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (typeof window !== "undefined") {
    inMemoryAccessToken = localStorage.getItem("accessToken");
    return inMemoryAccessToken;
  }
  return null;
}

export function setActiveCompanyId(companyId: string | null) {
  inMemoryCompanyId = companyId;
  if (typeof window !== "undefined") {
    if (companyId) {
      localStorage.setItem("activeCompanyId", companyId);
    } else {
      localStorage.removeItem("activeCompanyId");
    }
  }
}

export function getActiveCompanyId(): string | null {
  if (inMemoryCompanyId) return inMemoryCompanyId;
  if (typeof window !== "undefined") {
    inMemoryCompanyId = localStorage.getItem("activeCompanyId");
    return inMemoryCompanyId;
  }
  return null;
}

export function registerAuthFailedListener(callback: () => void) {
  onAuthFailedListener = callback;
}

export function clearSession() {
  setAuthToken(null);
  setActiveCompanyId(null);
  if (typeof window !== "undefined") {
    localStorage.removeItem("user");
  }
  if (onAuthFailedListener) {
    onAuthFailedListener();
  }
}

/**
 * Concurrency-safe token refresh mechanism.
 * Multiple simultaneous 401s await the exact same refresh promise.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const url = `${API_BASE.replace(/\/+$/, "")}/auth/refresh`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        credentials: "include" // sends httpOnly refreshToken cookie
      });

      if (!response.ok) {
        clearSession();
        return null;
      }

      const json = await response.json();
      const newToken = json?.data?.accessToken;
      if (newToken) {
        setAuthToken(newToken);
        return newToken;
      }

      clearSession();
      return null;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { companyId, params, headers, _retry, ...customConfig } = options;

  let url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined) searchParams.append(key, String(val));
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `${url.includes("?") ? "&" : "?"}${queryString}`;
    }
  }

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  const currentToken = getAuthToken();
  if (currentToken) {
    defaultHeaders["Authorization"] = `Bearer ${currentToken}`;
  }

  const currentCompany = companyId || getActiveCompanyId();
  if (currentCompany) {
    defaultHeaders["X-Company-Id"] = currentCompany;
  }

  const response = await fetch(url, {
    headers: {
      ...defaultHeaders,
      ...(headers as Record<string, string>)
    },
    credentials: "include", // Required for httpOnly refresh cookies
    ...customConfig
  });

  // Handle Token Expiry & Automatic Refresh (Requirement Phase C & D)
  if (response.status === 401 && !_retry) {
    const isAuthEndpoint =
      endpoint.includes("/auth/login") ||
      endpoint.includes("/auth/register") ||
      endpoint.includes("/auth/refresh");

    if (!isAuthEndpoint) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Re-execute original request exactly once with new token
        return apiClient<T>(endpoint, {
          ...options,
          _retry: true,
          headers: {
            ...headers,
            Authorization: `Bearer ${newToken}`
          }
        });
      }
    }
  }

  if (!response.ok) {
    let errorData: ApiErrorPayload;
    try {
      const json = await response.json();
      errorData = json.error || { code: "SERVER_ERROR", message: response.statusText };
    } catch {
      errorData = {
        code: "HTTP_ERROR",
        message: response.statusText || `Request failed with status ${response.status}`
      };
    }

    if (response.status === 401 && !options._retry) {
      clearSession();
    }

    throw new ApiError(response.status, errorData);
  }

  return response.json();
}

/**
 * Helper to download binary files (PDFs, Excel) with auth and error checking
 */
export async function apiDownload(
  endpoint: string,
  defaultFilename: string,
  options: RequestOptions = {}
): Promise<void> {
  const { companyId, params, headers, ...customConfig } = options;

  let url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined) searchParams.append(key, String(val));
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `${url.includes("?") ? "&" : "?"}${queryString}`;
    }
  }

  const reqHeaders: Record<string, string> = {};
  const currentToken = getAuthToken();
  if (currentToken) {
    reqHeaders["Authorization"] = `Bearer ${currentToken}`;
  }

  const currentCompany = companyId || getActiveCompanyId();
  if (currentCompany) {
    reqHeaders["X-Company-Id"] = currentCompany;
  }

  const response = await fetch(url, {
    headers: {
      ...reqHeaders,
      ...(headers as Record<string, string>)
    },
    credentials: "include",
    ...customConfig
  });

  if (!response.ok) {
    if (response.status === 401 && !options._retry) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return apiDownload(endpoint, defaultFilename, { ...options, _retry: true });
      }
    }
    throw new Error(`Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  if (typeof window !== "undefined") {
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }
}

/**
 * Health check helper querying the backend root health endpoint
 */
export async function checkBackendHealth(): Promise<{
  status: string;
  database?: string;
  timestamp: string;
  environment: string;
  uptime?: number;
}> {
  const baseOrigin = API_BASE.replace(/\/api\/?$/, "");
  const response = await fetch(`${baseOrigin}/health`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Backend returned HTTP status ${response.status}`);
  }
  return response.json();
}
