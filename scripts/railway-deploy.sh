#!/bin/bash

echo "🚂 Preparando deployment para Railway..."

# Verificar que estamos en la rama correcta
BRANCH=$(git branch --show-current)
echo "📍 Rama actual: $BRANCH"

# Verificar que no hay cambios sin commitear
if [[ -n $(git status -s) ]]; then
  echo "⚠️  Tienes cambios sin commitear. Por favor, haz commit primero."
  exit 1
fi

# Verificar que existe .env con las variables necesarias
if [ ! -f .env ]; then
  echo "⚠️  No se encontró archivo .env"
  echo "📝 Copia .env.example a .env y configura tus variables"
  exit 1
fi

echo "✅ Pre-checks completados"
echo ""
echo "📦 Instalando dependencias..."
npm ci

echo ""
echo "🔨 Generando Prisma Client..."
npx prisma generate

echo ""
echo "🏗️  Building proyecto..."
npm run build

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Build exitoso!"
  echo ""
  echo "🚀 Próximos pasos:"
  echo "1. Haz push a GitHub: git push origin $BRANCH"
  echo "2. Railway detectará el cambio y desplegará automáticamente"
  echo "3. Monitorea el deployment en: https://railway.app"
else
  echo ""
  echo "❌ Build falló. Revisa los errores arriba."
  exit 1
fi
