const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/+$/,
  "",
);

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;
  readonly payload: unknown;

  constructor(
    message: string,
    status: number,
    fieldErrors: FieldErrors = {},
    payload: unknown = null,
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.payload = payload;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Converts nested DRF errors into paths such as:
// "changes.expiry_date": ["Must be later than current expiry."]
function flattenErrors(
  value: unknown,
  path = "",
  result: FieldErrors = {},
): FieldErrors {
  if (typeof value === "string") {
    const key = path || "non_field_errors";
    (result[key] ??= []).push(value);
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath =
        typeof item === "string"
          ? path
          : path
            ? `${path}.${index}`
            : String(index);

      flattenErrors(item, itemPath, result);
    });

    return result;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => {
      const childPath = path ? `${path}.${key}` : key;
      flattenErrors(item, childPath, result);
    });
  }

  return result;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  json?: unknown;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { json, headers: suppliedHeaders, ...requestOptions } = options;

  const headers = new Headers(suppliedHeaders);
  headers.set("Accept", "application/json");

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...requestOptions,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
  });

  const text = await response.text();

  let payload: unknown = null;
  let validJson = true;

  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      validJson = false;
    }
  }

  if (!response.ok) {
    const fieldErrors = validJson ? flattenErrors(payload) : {};

    const message =
      fieldErrors.detail?.[0] ??
      fieldErrors.non_field_errors?.[0] ??
      (response.status === 400
        ? "Please check the highlighted fields."
        : `Request failed (${response.status}).`);

    throw new ApiError(message, response.status, fieldErrors, payload);
  }

  if (!validJson) {
    throw new ApiError(
      "The server returned an unexpected response format.",
      response.status,
    );
  }

  return payload as T;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof TypeError) {
    return "Unable to reach the API. Check your connection and backend server.";
  }

  return "Something went wrong. Please try again.";
}
