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
*   **Base de Datos**: MongoDB (Driver nativo).
*   **Procesamiento de Video**: FFmpeg (fluent-ffmpeg) para stitching y extracción de frames.
*   **Autenticación**: JWT (Custom Auth).
*   **Integraciones IA**: ApiYi (Gateway para Sora/Veo/Gemini), Cartesia AI.

## ⚙️ Configuración (Variables de Entorno)

Para clonar e instalar el proyecto, crea un archivo `.env` en la raíz con las siguientes variables:

```env
# --- Base de Datos ---
MONGO_DB_URI=mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority&appName=<app>
MONGO_DB_NAME=zumidb

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

## 🏗️ Instalación y Ejecución

1.  **Instalar dependencias**:
    ```bash
    npm install
    ```

2.  **Configurar FFMPEG**:
    El proyecto usa `@ffmpeg-installer/ffmpeg`, por lo que el binario debería configurarse automáticamente. Si tienes problemas en Windows, asegúrate de tener permisos de ejecución.

3.  **Iniciar Servidor de Desarrollo**:
    ```bash
    npm run dev
    ```

4.  **Tests**:
    Ejecutar tests de integración para verificar generación de video.
    ```bash
    npm test
    ```

##  Despliegue en Netlify

El proyecto incluye `netlify.toml` preconfigurado.
Asegúrate de configurar las variables de entorno en el panel de Netlify.
