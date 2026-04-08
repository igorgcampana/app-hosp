#!/bin/bash
# Fase 0 — Criar 5 usuários médicos temporários no Supabase Auth
# e garantir profiles com role=doctor
#
# Uso: bash scripts/fase0-create-doctors.sh

set -euo pipefail

SUPABASE_URL="https://gbcnmuppylwznhrticfv.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiY25tdXBweWx3em5ocnRpY2Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk2NzA3NSwiZXhwIjoyMDg3NTQzMDc1fQ.cHdGL9XbMlp5nb1PQqvA7QUl5TaeeiDnyXczm-1lWDE"

PASSWORD="12345"

declare -a EMAILS=(
  "igor@apphosp.com.br"
  "beatriz@apphosp.com.br"
  "eduardo@apphosp.com.br"
  "tamires@apphosp.com.br"
  "felipe.reinaldo@apphosp.com.br"
)

declare -a NAMES=(
  "Igor"
  "Beatriz"
  "Eduardo"
  "Tamires"
  "Felipe Reinaldo"
)

echo "=========================================="
echo " Fase 0 — Criando usuários médicos"
echo "=========================================="
echo ""

declare -a UUIDS=()

for i in "${!EMAILS[@]}"; do
  email="${EMAILS[$i]}"
  name="${NAMES[$i]}"

  echo "→ Criando: $name ($email)..."

  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"${email}\",
      \"password\": \"${PASSWORD}\",
      \"email_confirm\": true
    }")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    uuid=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
    UUIDS+=("$uuid")
    echo "  ✓ Criado — UUID: $uuid"
  else
    # Check if user already exists
    if echo "$body" | grep -qi "already been registered\|already exists\|duplicate"; then
      echo "  ⚠ Usuário já existe. Buscando UUID..."
      # List users and find this one
      list_response=$(curl -s \
        -X GET "${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "apikey: ${SERVICE_ROLE_KEY}")
      uuid=$(echo "$list_response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
users = data.get('users', data) if isinstance(data, dict) else data
for u in users:
    if u.get('email') == '${email}':
        print(u['id'])
        break
")
      if [ -n "$uuid" ]; then
        UUIDS+=("$uuid")
        echo "  ✓ Encontrado — UUID: $uuid"
      else
        echo "  ✗ ERRO: não encontrou UUID para $email"
        UUIDS+=("ERRO")
      fi
    else
      echo "  ✗ ERRO (HTTP $http_code): $body"
      UUIDS+=("ERRO")
    fi
  fi
  echo ""
done

echo "=========================================="
echo " Fase 0 — Garantindo profiles (role=doctor)"
echo "=========================================="
echo ""

for i in "${!UUIDS[@]}"; do
  uuid="${UUIDS[$i]}"
  name="${NAMES[$i]}"
  email="${EMAILS[$i]}"

  if [ "$uuid" = "ERRO" ]; then
    echo "→ Pulando $name — UUID não disponível"
    continue
  fi

  echo "→ Upsert profile: $name ($uuid)..."

  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${SUPABASE_URL}/rest/v1/profiles" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "{
      \"id\": \"${uuid}\",
      \"role\": \"doctor\"
    }")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "204" ]; then
    echo "  ✓ Profile OK — role=doctor"
  else
    echo "  ✗ ERRO (HTTP $http_code): $body"
  fi
  echo ""
done

echo "=========================================="
echo " RESUMO — Fase 0"
echo "=========================================="
echo ""
echo "Conta legada mantida: medicos@gmail.com (sem alteração)"
echo ""
printf "%-20s %-40s %s\n" "MÉDICO" "UUID" "EMAIL"
printf "%-20s %-40s %s\n" "------" "----" "-----"
for i in "${!NAMES[@]}"; do
  printf "%-20s %-40s %s\n" "${NAMES[$i]}" "${UUIDS[$i]}" "${EMAILS[$i]}"
done
echo ""
echo "Próximo passo: executar migration (Fase 1) e depois preencher doctor_name."
