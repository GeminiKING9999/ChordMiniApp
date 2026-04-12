const DEFAULT_PYTHON_API_URL = 'http://localhost:5001';
const DEFAULT_PRODUCTION_PYTHON_API_URL = 'https://chordmini-backend-full-191567167632.us-central1.run.app';
const DEFAULT_FRONTEND_URL = 'http://localhost:3000';
const DEFAULT_LOCAL_SONGFORMER_API_URL = 'http://localhost:8080';
const DEFAULT_LOCAL_SHEETSAGE_API_URL = 'http://localhost:8082';

function hasNonEmptyEnv(name: string): boolean {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0;
}

function isLocalUrl(candidateUrl: string | undefined): boolean {
  if (!candidateUrl) {
    return false;
  }

  try {
    const { hostname } = new URL(candidateUrl);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return candidateUrl.includes('localhost') || candidateUrl.includes('127.0.0.1');
  }
}

function isHostedDeployment(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production' || vercelEnv === 'preview') {
    return true;
  }

  const netlifyContext = process.env.CONTEXT;
  if (process.env.NETLIFY === 'true') {
    if (netlifyContext === 'dev' || netlifyContext === 'local') {
      return false;
    }

    const hostedNetlifyUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL;
    return !isLocalUrl(hostedNetlifyUrl) || hasNonEmptyEnv('CONTEXT');
  }

  return false;
}

export function getPythonApiUrl(): string {
  return process.env.PYTHON_API_URL
    || (isHostedDeployment() ? DEFAULT_PRODUCTION_PYTHON_API_URL : DEFAULT_PYTHON_API_URL);
}

export function getSongformerApiUrl(): string {
  if (isHostedDeployment()) {
    return process.env.SONGFORMER_API_URL || getPythonApiUrl();
  }

  const localSongformerUrl = process.env.LOCAL_SONGFORMER_API_URL || process.env.SONGFORMER_API_URL;
  return localSongformerUrl && isLocalUrl(localSongformerUrl)
    ? localSongformerUrl
    : DEFAULT_LOCAL_SONGFORMER_API_URL;
}

export function getSheetSageApiUrl(): string {
  if (isHostedDeployment()) {
    return process.env.SHEETSAGE_API_URL || getPythonApiUrl();
  }

  const localSheetSageUrl = process.env.LOCAL_SHEETSAGE_API_URL || process.env.SHEETSAGE_API_URL;
  return localSheetSageUrl && isLocalUrl(localSheetSageUrl)
    ? localSheetSageUrl
    : DEFAULT_LOCAL_SHEETSAGE_API_URL;
}

export function getFrontendBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_FRONTEND_URL;
}

export function isLocalPythonApi(): boolean {
  const backendUrl = getPythonApiUrl();
  return backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1');
}
