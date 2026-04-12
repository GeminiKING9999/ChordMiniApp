interface ErrorResponsePayload {
  error?: string;
  details?: string;
  message?: string;
  suggestion?: string;
  debugInfo?: {
    errorResponse?: string;
  };
}

const MAX_ERROR_MESSAGE_LENGTH = 500;

function normalizeErrorText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function looksLikeHtml(value: string): boolean {
  return /^<!doctype html|^<html[\s>]/i.test(value);
}

function getPayloadMessage(payload: ErrorResponsePayload): string | null {
  const candidates = [
    payload.details,
    payload.error,
    payload.message,
    payload.suggestion,
    payload.debugInfo?.errorResponse,
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeErrorText(candidate ?? '');
    if (normalizedCandidate && !looksLikeHtml(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }

  return null;
}

export function extractErrorMessageFromText(responseText: string, fallbackMessage: string): string {
  const normalizedText = normalizeErrorText(responseText);
  if (!normalizedText || looksLikeHtml(normalizedText)) {
    return fallbackMessage;
  }

  try {
    const payload = JSON.parse(normalizedText) as ErrorResponsePayload;
    return getPayloadMessage(payload) ?? normalizedText.slice(0, MAX_ERROR_MESSAGE_LENGTH);
  } catch {
    return normalizedText.slice(0, MAX_ERROR_MESSAGE_LENGTH);
  }
}

export async function getResponseErrorMessage(
  response: Response,
  fallbackMessage = `Request failed: ${response.status} ${response.statusText}`,
): Promise<string> {
  const responseText = await response.text().catch(() => '');
  return extractErrorMessageFromText(responseText, fallbackMessage);
}
