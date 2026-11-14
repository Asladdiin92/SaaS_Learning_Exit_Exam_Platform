#!/usr/bin/env bash
set -e

# ==============================================================================
# Week 1 End-to-End Verification & Physical Android Device Setup Helper
# Fedora Linux + Samsung Galaxy A04s / A05s (scrcpy / ADB)
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
MOBILE_DIR="${ROOT_DIR}/mobile"

# Terminal Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${CYAN}==============================================================================${NC}"
echo -e "${BOLD}${CYAN}  WEEK 1 VERIFICATION GATE: SaaS Learning Exit Exam Platform ${NC}"
echo -e "${BOLD}${CYAN}==============================================================================${NC}"

# Find ADB binary
ADB_BIN="$(which adb 2>/dev/null || echo "${HOME}/Android/Sdk/platform-tools/adb")"

FAILED_GATES=0

# ------------------------------------------------------------------------------
# Gate 1: Backend Verification (FastAPI + Supabase RLS / PostgreSQL 16)
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${BLUE}[1/3] Running Backend Verification Suite (pytest backend/tests/)...${NC}"
cd "${BACKEND_DIR}"

if [ -f ".venv/bin/pytest" ]; then
  PYTEST_BIN=".venv/bin/pytest"
elif command -v pytest &>/dev/null; then
  PYTEST_BIN="pytest"
else
  echo -e "${RED}Error: pytest not found in backend/.venv or system PATH.${NC}"
  FAILED_GATES=$((FAILED_GATES + 1))
fi

if [ -n "${PYTEST_BIN}" ]; then
  if "${PYTEST_BIN}" -v; then
    echo -e "${GREEN}✓ Gate 1 Passed: All backend tests passed successfully.${NC}"
  else
    echo -e "${RED}✗ Gate 1 Failed: Backend tests encountered failures.${NC}"
    FAILED_GATES=$((FAILED_GATES + 1))
  fi
fi

# ------------------------------------------------------------------------------
# Gate 2: Mobile Client Verification (TypeScript Typecheck + Jest Suites)
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${BLUE}[2/3] Running Mobile Verification Suite (npm run typecheck && npm test)...${NC}"
cd "${MOBILE_DIR}"

echo -e "  --> Checking TypeScript strict compilation (tsc --noEmit)..."
if npm run typecheck; then
  echo -e "${GREEN}  ✓ TypeScript check passed with 0 errors.${NC}"
else
  echo -e "${RED}  ✗ TypeScript check failed.${NC}"
  FAILED_GATES=$((FAILED_GATES + 1))
fi

echo -e "  --> Running Jest unit and integration test suites..."
if npm test; then
  echo -e "${GREEN}✓ Gate 2 Passed: All mobile test suites passed successfully.${NC}"
else
  echo -e "${RED}✗ Gate 2 Failed: Mobile tests encountered failures.${NC}"
  FAILED_GATES=$((FAILED_GATES + 1))
fi

# ------------------------------------------------------------------------------
# Gate 3: Android Physical Device Connectivity & ADB Port Reversal
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${BLUE}[3/3] Inspecting Android Physical Device (ADB / scrcpy)...${NC}"

if [ -x "${ADB_BIN}" ]; then
  CONNECTED_DEVICES="$("${ADB_BIN}" devices -l | grep -w "device" | grep -v "devices attached" || true)"

  if [ -n "${CONNECTED_DEVICES}" ]; then
    DEVICE_MODEL="$(echo "${CONNECTED_DEVICES}" | awk '{for(i=1;i<=NF;i++) if($i ~ /^model:/) print $i}' | cut -d: -f2)"
    DEVICE_SERIAL="$(echo "${CONNECTED_DEVICES}" | awk '{print $1}')"

    echo -e "${GREEN}✓ Android Physical Device Detected:${NC}"
    echo -e "    ${BOLD}Model:${NC}  ${DEVICE_MODEL:-Unknown} (${DEVICE_SERIAL})"
    echo -e "    ${BOLD}Status:${NC} Authorized (USB Debugging Active)"

    echo -e "\n  --> Configuring reverse socket tunnels for local host communication..."
    "${ADB_BIN}" reverse tcp:8000 tcp:8000
    "${ADB_BIN}" reverse tcp:8081 tcp:8081

    echo -e "${GREEN}  ✓ Port 8000 (FastAPI Backend) reversed to device.${NC}"
    echo -e "${GREEN}  ✓ Port 8081 (Expo/Metro Bundler) reversed to device.${NC}"

    echo -e "\n  ${BOLD}Active ADB Reverse Tunnels:${NC}"
    "${ADB_BIN}" reverse --list | sed 's/^/    /'

    if command -v scrcpy &>/dev/null; then
      echo -e "\n  ${CYAN}${BOLD}[TIP] Launch Screen Mirroring on Fedora Linux:${NC}"
      echo -e "    Run ${BOLD}scrcpy -m 1024 --max-fps 60${NC} in a terminal to view your phone screen on Fedora desktop."
    fi

    echo -e "\n  ${CYAN}${BOLD}[TIP] Start Expo Mobile App on Device:${NC}"
    echo -e "    Run ${BOLD}cd mobile && npx expo start --android${NC} to run on your connected physical phone."
  else
    echo -e "${YELLOW}Notice: No authorized Android physical device detected via ADB.${NC}"
    echo -e "  To connect your Samsung phone:"
    echo -e "  1. Enable 'Developer options' -> 'USB debugging' on phone."
    echo -e "  2. Connect via USB cable and allow 'Always trust this computer'."
    echo -e "  3. Re-run this script to automatically reverse ports 8000 and 8081."
  fi
else
  echo -e "${YELLOW}Notice: adb binary not found at ${ADB_BIN}.${NC}"
fi

# ------------------------------------------------------------------------------
# Final Verification Summary
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}==============================================================================${NC}"
if [ ${FAILED_GATES} -eq 0 ]; then
  echo -e "${BOLD}${GREEN}  WEEK 1 VERIFICATION PASSED: ALL GATES SUCCEEDED (100%)${NC}"
  echo -e "${BOLD}${CYAN}==============================================================================${NC}"
  exit 0
else
  echo -e "${BOLD}${RED}  WEEK 1 VERIFICATION FAILED: ${FAILED_GATES} GATE(S) FAILED${NC}"
  echo -e "${BOLD}${CYAN}==============================================================================${NC}"
  exit 1
fi
