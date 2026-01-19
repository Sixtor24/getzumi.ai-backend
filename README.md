# getzumi.ai Backend

Backend para **getzumi.ai**, una plataforma SaaS de generación y edición de contenido multimedia (UGC) impulsada por IA.

##  Stack Tecnológico

*   **Framework**: Next.js 15 (App Router) - API Routes.
*   **Lenguaje**: TypeScript.
*   **Base de Datos**: PostgreSQL (vía Prisma ORM).
*   **Colas (Async jobs)**: BullMQ + Redis (para procesamiento pesado de video/imagen).
*   **Storage**: AWS S3.
*   **Auth**: NextAuth.js.
*   **IA**: Integraciones con Replicate y ElevenLabs.
*   **Docs**: Swagger/OpenAPI generado automáticamente.

##  Arquitectura

El proyecto sigue una arquitectura distribuida en monolito modular:

*   `src/app/api`: Endpoints HTTP (Next.js).
*   `workers/`: Scripts de Node.js que corren en procesos separados para procesar colas de Redis.
*   `src/server`: Lógica compartida (DB, Config) usada tanto por la API como por los Workers.

##  Quickstart (Local)

1.  **Variables de Entorno**:
    Copia `.env.example` a `.env.local` y rellena las claves.

2.  **Instalar Dependencias**:
    ```bash
    npm install
    ```

3.  **Infraestructura Local (Docker)**:
    ```bash
    docker compose up -d
    ```

4.  **Iniciar Servidor de Desarrollo**:
    ```bash
    npm run dev
    # API: http://localhost:3000
    # Swagger: http://localhost:3000/docs
    ```

5.  **Iniciar Workers**:
    ```bash
    npm run worker:video
    ```

##  Despliegue en Netlify

El proyecto incluye `netlify.toml` preconfigurado.
Asegúrate de configurar las variables de entorno en el panel de Netlify.
