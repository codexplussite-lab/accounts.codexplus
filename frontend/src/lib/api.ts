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
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
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

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  if (companyId) {
    defaultHeaders["X-Company-Id"] = companyId;
  }

  const response = await fetch(url, {
    headers: {
      ...defaultHeaders,
      ...(headers as Record<string, string>)
    },
    credentials: "include", // Required for httpOnly refresh cookies
    ...customConfig
  });

  if (!response.ok) {
    let errorData: ApiErrorPayload;
    try {
      const json = await response.json();
      errorData = json.error || { code: "SERVER_ERROR", message: response.statusText };
    } catch {
      errorData = { code: "HTTP_ERROR", message: response.statusText || `Request failed with ${response.status}` };
    }
    throw new ApiError(response.status, errorData);
  }

  return response.json();
}

/**
 * Health check helper querying the backend root health endpoint
 */
export async function checkBackendHealth(): Promise<{ status: string; timestamp: string; environment: string; uptime?: number }> {
  const baseOrigin = API_BASE.replace(/\/api\/?$/, "");
  const response = await fetch(`${baseOrigin}/health`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Backend returned HTTP status ${response.status}`);
  }
  return response.json();
}
