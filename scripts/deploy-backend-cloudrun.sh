#!/usr/bin/env bash
# Deploy Chord Reaper Python backend to Google Cloud Run.
#
# Prerequisites (one-time):
#   1. gcloud auth login
#   2. gcloud config set project YOUR_GCP_PROJECT_ID
#   3. Billing enabled on that project
#   4. Docker running (used by Cloud Build or local build)
#
# Usage:
#   ./scripts/deploy-backend-cloudrun.sh
#   ./scripts/deploy-backend-cloudrun.sh --project chordmini-d29f9 --region us-east1
#
# After deploy, set on Netlify/Vercel:
#   PYTHON_API_URL=<service URL>
#   NEXT_PUBLIC_PYTHON_API_URL=<service URL>
#   NEXT_PUBLIC_BASE_URL=https://eclecticemporium.store

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/python_backend"

PROJECT_ID="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
REGION="${GCP_REGION:-us-east1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-chordreaper-backend}"
IMAGE_NAME="chordreaper-backend"
MEMORY="${CLOUD_RUN_MEMORY:-4Gi}"
CPU="${CLOUD_RUN_CPU:-2}"
TIMEOUT="${CLOUD_RUN_TIMEOUT:-600}"
MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-3}"
MIN_INSTANCES="${CLOUD_RUN_MIN_INSTANCES:-0}"
ALLOW_UNAUTHENTICATED=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --service) SERVICE_NAME="$2"; shift 2 ;;
    --memory) MEMORY="$2"; shift 2 ;;
    --cpu) CPU="$2"; shift 2 ;;
    --help)
      sed -n '1,25p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud not found. Install Google Cloud SDK and re-run." >&2
  exit 1
fi

if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
fi

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" ]]; then
  echo "ERROR: No GCP project set."
  echo "  gcloud auth login"
  echo "  gcloud config set project YOUR_PROJECT_ID"
  echo "Or: $0 --project YOUR_PROJECT_ID"
  exit 1
fi

ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)"
if [[ -z "$ACCOUNT" ]]; then
  echo "ERROR: No active gcloud account. Run:"
  echo "  gcloud auth login"
  exit 1
fi

echo "==> Project:  $PROJECT_ID"
echo "==> Account:  $ACCOUNT"
echo "==> Region:   $REGION"
echo "==> Service:  $SERVICE_NAME"
echo "==> Backend:  $BACKEND_DIR"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Enabling APIs (idempotent)..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  containerregistry.googleapis.com \
  --project="$PROJECT_ID"

IMAGE="gcr.io/${PROJECT_ID}/${IMAGE_NAME}:$(date +%Y%m%d-%H%M%S)"
IMAGE_LATEST="gcr.io/${PROJECT_ID}/${IMAGE_NAME}:latest"

echo "==> Building image via Cloud Build: $IMAGE"
# Build from python_backend so Dockerfile paths resolve correctly
gcloud builds submit "$BACKEND_DIR" \
  --tag "$IMAGE" \
  --project="$PROJECT_ID" \
  --timeout=3600s

gcloud container images add-tag "$IMAGE" "$IMAGE_LATEST" --quiet || true

echo "==> Deploying Cloud Run service..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --memory "$MEMORY" \
  --cpu "$CPU" \
  --timeout "$TIMEOUT" \
  --concurrency 1 \
  --max-instances "$MAX_INSTANCES" \
  --min-instances "$MIN_INSTANCES" \
  --cpu-boost \
  --port 8080 \
  --allow-unauthenticated \
  --set-env-vars "FLASK_ENV=production,FLASK_DEBUG=False,PYTHONUNBUFFERED=1" \
  --project="$PROJECT_ID"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format='value(status.url)')"

echo ""
echo "=============================================="
echo " Backend deployed"
echo " URL: $SERVICE_URL"
echo "=============================================="
echo ""
echo "Health check:"
echo "  curl -s \"$SERVICE_URL/\" "
echo ""
echo "Wire Netlify / Vercel env vars (production):"
echo "  PYTHON_API_URL=$SERVICE_URL"
echo "  NEXT_PUBLIC_PYTHON_API_URL=$SERVICE_URL"
echo "  NEXT_PUBLIC_BASE_URL=https://eclecticemporium.store"
echo "  GENIUS_API_KEY=<from your .env.local>"
echo ""
echo "Also update getDirectPythonUrl fallback if you still hardcode the old Cloud Run URL."
echo "Redeploy the frontend after setting env vars."
