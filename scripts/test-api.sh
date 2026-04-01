#!/bin/bash
# API統合テスト
# 使い方: bash scripts/test-api.sh

BASE_URL="https://translator-api.s-daisuke222.workers.dev"
TOKEN="app_tr_s3cr3t_k3y_2024"
PASS=0
FAIL=0

test_endpoint() {
  local name="$1"
  local expected_code="$2"
  local actual_code="$3"
  if [ "$actual_code" = "$expected_code" ]; then
    echo "PASS $name (HTTP $actual_code)"
    PASS=$((PASS + 1))
  else
    echo "FAIL $name (expected $expected_code, got $actual_code)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== API Integration Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# 新規ユーザー登録
TIMESTAMP=$(date +%s)
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"jest-${TIMESTAMP}@test.com\",\"password\":\"Pass12345\",\"name\":\"Test\"}")
test_endpoint "POST /api/auth/sign-up/email (新規登録)" "200" "$CODE"

# ログイン成功
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"functest@example.com","password":"Pass12345"}')
test_endpoint "POST /api/auth/sign-in/email (ログイン成功)" "200" "$CODE"

# ログイン失敗（誤パスワード）
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"functest@example.com","password":"WrongPass"}')
test_endpoint "POST /api/auth/sign-in/email (誤パスワード)" "401" "$CODE"

# クォータ初期化（認証あり）
DEVICE_ID="jest-test-${TIMESTAMP}"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/quota/init" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Device-Id: $DEVICE_ID")
test_endpoint "POST /api/quota/init (認証あり)" "201" "$CODE"

# クォータ取得（存在しないデバイス）
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/quota" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Device-Id: jest-test-1")
test_endpoint "GET /api/quota (存在しないデバイス)" "404" "$CODE"

# クォータ初期化（認証なし）
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/quota/init" \
  -H "X-Device-Id: no-auth-test")
test_endpoint "POST /api/quota/init (認証なし)" "401" "$CODE"

# クォータ初期化（デバイスIDなし）
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/quota/init" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "POST /api/quota/init (デバイスIDなし)" "400" "$CODE"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
