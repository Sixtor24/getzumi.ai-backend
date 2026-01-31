# getzumi.ai

Plataforma SaaS de generación de contenido multimedia (Video, Imagen, Audio) impulsada por Inteligencia Artificial Generativa.

## 🚀 Capacidades y Modelos

### 🎥 Generación de Video
Soporte avanzado para creación de video Text-to-Video e Image-to-Video.
*   **Sora 2 / Sora 2 Pro**:
    *   Generación de alta fidelidad.
    *   Soporte para "looping" y extensión de video >15s mediante encadenamiento recursivo.
    *   Resoluciones: 16:9 (1280x720), 9:16 (720x1280), 1:1 (1024x1024).
*   **Veo 3.1**:
    *   Modelos optimizados (`-fast`) y estándar.
    *   Lógica inteligente para Image-to-Video usando `input_reference` y sufijos `-fl`.
    *   Soporte de extensión de duración mediante stitching con FFMPEG.

### 🖼️ Generación de Imágenes
*   **SeeDream 4**: Imágenes de ultra alta definición (2048x2048).
*   **Standard / DALL-E 3**: Generación rápida y creativa (1024x1024).
*   **Optimización**: Compresión automática a JPEG (calidad 70) para visualización web rápida.

### 🎙️ Texto a Voz (TTS)
*   **Cartesia (Sonic)**:
    *   Latencia ultrabaja.
    *   Calidad estéreo 44.1kHz (MP3).
    *   Clonación de voz y selección de voces.

## 🛠️ Stack Tecnológico

*   **Framework**: Next.js 14 (App Router).
*   **Lenguaje**: TypeScript.
*   **Base de Datos**: PostgreSQL (Railway).
*   **Procesamiento de Video**: FFmpeg (fluent-ffmpeg) para stitching y extracción de frames.
*   **Autenticación**: JWT (Custom Auth).
*   **Integraciones IA**: ApiYi (Gateway para Sora/Veo/Gemini), Cartesia AI.

## ⚙️ Configuración (Variables de Entorno)

Para clonar e instalar el proyecto, crea un archivo `.env` en la raíz con las siguientes variables:

```env
# --- Base de Datos (PostgreSQL) ---
DATABASE_URL=postgresql://usuario:password@host:puerto/database

# --- Seguridad ---
JWT_SECRET=tu_clave_secreta_super_segura_para_jwt

# --- Integraciones IA (ApiYi) ---
# Proveedor principal para Video (Sora/Veo) e Imagen (Gemini/SeeDream)
APIYI_API_KEY=sk-apiyi-...
APIYI_BASE_URL=https://api.apiyi.com

# --- Integraciones IA (Audio) ---
# Proveedor para Text-to-Speech
CARTESIA_API_KEY=tu_api_key_de_cartesia

# --- Configuración App ---
# URL base para callbacks y visualización de recursos
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## 📋 Guía de Configuración Paso a Paso

### Paso 1: Clonar e Instalar Dependencias

```bash
git clone <tu-repositorio>
cd getzumi.ai-backend
npm install
```

### Paso 2: Obtener las Claves API Necesarias

#### 2.1 PostgreSQL (Base de Datos desde Railway)
**Nota**: Configuraremos PostgreSQL directamente en Railway durante el despliegue (ver sección de Railway más abajo).

Para desarrollo local, puedes:
1. Usar Docker: `docker run --name postgres-dev -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres`
2. O instalar PostgreSQL localmente desde [postgresql.org](https://www.postgresql.org/download/)
3. Crear una base de datos: `createdb zumidb`
4. Tu `DATABASE_URL` local será: `postgresql://postgres:mysecretpassword@localhost:5432/zumidb`

#### 2.2 ApiYi (Sora, Veo, Gemini, SeeDream)
1. Ve a [ApiYi](https://apiyi.com) o tu proveedor de API
2. Crea una cuenta y accede al dashboard
3. Genera una nueva API Key (debería comenzar con `sk-apiyi-...`)
4. Copia la clave y guárdala de forma segura
5. **Importante**: Asegúrate de tener créditos/tokens disponibles en tu cuenta

#### 2.3 Cartesia AI (Text-to-Speech)
1. Ve a [Cartesia AI](https://cartesia.ai)
2. Regístrate y accede a tu dashboard
3. En la sección "API Keys", genera una nueva clave
4. Copia la API key

#### 2.4 JWT Secret
Genera una clave secreta segura para JWT:
```bash
# En terminal (macOS/Linux):
openssl rand -base64 32

# O usa cualquier generador de contraseñas seguras
```

### Paso 3: Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env`:

```bash
cp .env.example .env
```

El archivo `.env.example` ya contiene las credenciales configuradas. Solo necesitas ajustar `DATABASE_URL` para desarrollo local:

```env
# --- Base de Datos (PostgreSQL) ---
DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5432/zumidb

# --- Seguridad ---
JWT_SECRET=tu_clave_secreta_super_segura_para_jwt

# --- Integraciones IA (ApiYi) ---
APIYI_API_KEY=sk-apiyi-...
APIYI_BASE_URL=https://api.apiyi.com

# --- Integraciones IA (Audio) ---
CARTESIA_API_KEY=tu_api_key_de_cartesia

# --- Configuración App ---
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Paso 4: Configurar FFMPEG

El proyecto usa `@ffmpeg-installer/ffmpeg`, por lo que el binario debería configurarse automáticamente. Si tienes problemas en Windows, asegúrate de tener permisos de ejecución.

### Paso 5: Iniciar el Servidor de Desarrollo

```bash
npm run dev
```

El backend estará disponible en `http://localhost:3000`

### Paso 6: Verificar la Instalación

Ejecuta los tests para verificar que todo funciona correctamente:

```bash
npm test
```

---

## 🚂 Despliegue en Railway

Railway es una plataforma moderna para desplegar aplicaciones y bases de datos con facilidad.

### Paso 1: Crear Cuenta en Railway

1. Ve a [Railway.app](https://railway.app)
2. Regístrate con GitHub (recomendado)
3. Verifica tu cuenta

### Paso 2: Crear un Nuevo Proyecto

1. En el dashboard de Railway, haz clic en **"New Project"**
2. Selecciona **"Deploy from GitHub repo"**
3. Conecta tu repositorio de GitHub
4. Selecciona el repositorio `getzumi.ai-backend`

### Paso 3: Agregar Base de Datos PostgreSQL

1. En tu proyecto de Railway, haz clic en **"+ New"**
2. Selecciona **"Database"** → **"Add PostgreSQL"**
3. Railway creará automáticamente una instancia de PostgreSQL
4. Railway generará automáticamente las siguientes variables:
   - `DATABASE_URL`: URL completa de conexión
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`: Variables individuales
5. La variable `DATABASE_URL` se agregará automáticamente a tu servicio de backend

### Paso 4: Configurar el Servicio de Backend

Railway detectará automáticamente que es un proyecto Next.js y configurará:
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

Si necesitas ajustar estos comandos:
1. Ve a tu servicio en Railway
2. Haz clic en **"Settings"**
3. Ajusta **"Build Command"** y **"Start Command"** si es necesario

### Paso 5: Configurar Variables de Entorno en Railway

1. En tu servicio de Railway, ve a la pestaña **"Variables"**
2. Agrega todas las variables de entorno necesarias:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<tu_jwt_secret_seguro>
APIYI_API_KEY=sk-apiyi-...
APIYI_BASE_URL=https://api.apiyi.com
CARTESIA_API_KEY=<tu_cartesia_key>
NEXT_PUBLIC_BASE_URL=https://<tu-proyecto>.up.railway.app
```

**Importante**: 
- `DATABASE_URL` se vinculará automáticamente si agregaste PostgreSQL en el Paso 3
- Reemplaza `<tu-proyecto>` con el dominio que Railway te asigne
- Puedes ver tu dominio en la pestaña **"Settings"** → **"Domains"**

### Paso 6: Configurar Dominio Personalizado (Opcional)

1. En Railway, ve a **"Settings"** → **"Domains"**
2. Railway te asigna un dominio automático: `https://<proyecto>.up.railway.app`
3. Para usar un dominio personalizado:
   - Haz clic en **"Custom Domain"**
   - Agrega tu dominio (ej: `api.getzumi.ai`)
   - Configura los registros DNS según las instrucciones de Railway

### Paso 7: Desplegar

1. Railway desplegará automáticamente cuando hagas push a tu rama principal
2. Puedes ver los logs en tiempo real en la pestaña **"Deployments"**
3. Una vez completado, tu backend estará disponible en la URL asignada

### Paso 8: Verificar el Despliegue

1. Accede a tu URL de Railway: `https://<tu-proyecto>.up.railway.app`
2. Verifica que el backend responde correctamente
3. Revisa los logs en Railway para detectar posibles errores

### Monitoreo y Logs

- **Ver Logs**: En Railway, ve a la pestaña **"Deployments"** y haz clic en el despliegue activo
- **Métricas**: Railway muestra uso de CPU, memoria y ancho de banda
- **Reiniciar**: Si necesitas reiniciar el servicio, ve a **"Settings"** → **"Restart"**

### Costos

- Railway ofrece **$5 USD de crédito gratis** cada mes
- Después de eso, pagas por uso (CPU, RAM, ancho de banda)
- Monitorea tu uso en el dashboard para evitar cargos inesperados

---

## 🔄 Flujo de Trabajo de Desarrollo

1. **Desarrollo Local**: Trabaja en tu máquina con `npm run dev`
2. **Commit y Push**: Sube tus cambios a GitHub
3. **Despliegue Automático**: Railway despliega automáticamente los cambios
4. **Verificación**: Revisa los logs y prueba la aplicación en producción

---

##  Despliegue Alternativo: Netlify

El proyecto incluye `netlify.toml` preconfigurado si prefieres usar Netlify.
Asegúrate de configurar las variables de entorno en el panel de Netlify.
