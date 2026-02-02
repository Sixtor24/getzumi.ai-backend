# Arquitectura del Backend - GetZumi.ai

## 📋 Stack Tecnológico

### Core
- **Node.js** - Runtime
- **Express.js** - Framework web
- **TypeScript** - Type safety
- **Prisma ORM** - Database toolkit
- **PostgreSQL** - Base de datos relacional

### Autenticación
- **JWT (jsonwebtoken)** - Tokens de autenticación
- **bcryptjs** - Hash de contraseñas
- **HTTP-only Cookies** - Almacenamiento seguro de tokens

### Deployment
- **Railway** - Hosting de aplicación y base de datos
- **Port**: 8080

## 🏗️ Estructura del Proyecto

```
src/
├── routes/                 # 🛣️ RUTAS DE LA API
│   ├── auth.ts            # Autenticación (login, signup, signout)
│   ├── projects.ts        # CRUD de proyectos y carpetas
│   └── images.ts          # Generación y gestión de imágenes
│
├── lib/                    # 📚 UTILIDADES
│   └── prisma.ts          # Cliente Prisma singleton
│
├── index.ts               # 🚀 Entry point del servidor
│
prisma/
├── schema.prisma          # 📊 Modelo de datos
└── migrations/            # 🔄 Migraciones de BD
```

## 📊 Modelo de Datos (Prisma Schema)

### Entidades Principales

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  username      String    @unique
  fullName      String
  passwordHash  String
  isSubscribed  Boolean   @default(false)
  plan          String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  folders       Folder[]
  projects      Project[]
  images        Image[]
}

model Folder {
  id        String    @id @default(uuid())
  userId    String
  name      String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  projects  Project[]
}

model Project {
  id          String    @id @default(uuid())
  userId      String
  folderId    String?
  name        String
  description String?
  metadata    Json?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  folder      Folder?   @relation(fields: [folderId], references: [id], onDelete: SetNull)
  images      Image[]
}

model Image {
  id        String   @id @default(uuid())
  userId    String
  projectId String?
  prompt    String
  model     String
  imageUrl  String
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
}
```

## 🛣️ Endpoints de la API

### Autenticación (`/api/auth`)

| Método | Endpoint | Descripción | Body |
|--------|----------|-------------|------|
| POST | `/signup` | Registro de usuario | `{ fullName, username, email, password }` |
| POST | `/signin` | Inicio de sesión | `{ identifier, password }` |
| POST | `/signout` | Cerrar sesión | - |
| GET | `/me` | Usuario actual | - |

### Proyectos (`/api/projects`)

| Método | Endpoint | Descripción | Body |
|--------|----------|-------------|------|
| GET | `/` | Listar proyectos del usuario | - |
| POST | `/` | Crear proyecto | `{ name, folderId, metadata }` |
| PUT | `/:id` | Actualizar proyecto | `{ name?, folderId?, metadata? }` |
| DELETE | `/:id` | Eliminar proyecto | - |

### Carpetas (`/api/projects/folders`)

| Método | Endpoint | Descripción | Body |
|--------|----------|-------------|------|
| GET | `/folders` | Listar carpetas del usuario | - |
| POST | `/folders` | Crear carpeta | `{ name }` |
| DELETE | `/folders/:id` | Eliminar carpeta | - |

### Imágenes (`/api/images`)

| Método | Endpoint | Descripción | Body |
|--------|----------|-------------|------|
| POST | `/generate` | Generar imagen con IA | `{ prompt, model, projectId? }` |
| POST | `/save-image` | Guardar imagen generada | `{ imageUrl, prompt, model, projectId? }` |
| GET | `/my-images` | Listar imágenes del usuario | - |
| DELETE | `/:id` | Eliminar imagen | - |

## 🔐 Autenticación

### Flujo de Login
1. Usuario envía `identifier` (email o username) + `password`
2. Backend busca usuario por email o username
3. Verifica password con `bcrypt.compare()`
4. Genera JWT con `userId` (expira en 7 días)
5. Establece cookie `auth_token` (httpOnly, secure, sameSite: lax)
6. Retorna datos del usuario

### Extracción de Token
```typescript
const getUserIdFromToken = (req: Request): string | null => {
  // 1. Buscar en cookies
  let token = req.cookies.auth_token;
  
  // 2. Fallback a header Authorization
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.substring(7); // "Bearer xxx"
  }
  
  // 3. Verificar y decodificar
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.userId;
};
```

### Configuración de Cookies
```typescript
res.cookie('auth_token', token, {
  httpOnly: true,           // No accesible desde JS
  secure: true,             // Solo HTTPS en producción
  sameSite: 'lax',          // Protección CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 días
});
```

## 📁 Gestión de Proyectos y Carpetas

### Límites
- **Máximo 15 proyectos por usuario** (configurable en `MAX_PROJECTS_PER_USER`)
- Carpeta por defecto "Nuevo proyecto" creada automáticamente en signup

### Relaciones
- Un usuario tiene múltiples carpetas
- Una carpeta tiene múltiples proyectos
- Al eliminar carpeta → proyectos quedan con `folderId: null`
- Al eliminar usuario → cascade delete de todo

### Metadata de Proyecto
```typescript
interface ProjectMetadata {
  totalMessages: number;
  lastPrompt: string;
  mediaGenerated: Array<{ type: string; url: string }>;
  chatHistory?: ChatMessage[];
  promptConfig?: PromptConfig;
}
```

## 🔄 Flujo de Datos Frontend ↔ Backend

### Crear Proyecto
```
Frontend (SidebarFolder.tsx)
    ↓ createProject(folderId)
AppContext.tsx
    ↓ projectRepository.createProject({ name, folderId, metadata })
ProjectRepository.ts
    ↓ POST /api/projects
Backend (projects.ts)
    ↓ prisma.project.create()
PostgreSQL
```

### Crear Carpeta
```
Frontend (SidebarFolder.tsx)
    ↓ createFolder(name)
AppContext.tsx
    ↓ projectRepository.createFolder(name)
ProjectRepository.ts
    ↓ POST /api/projects/folders
Backend (projects.ts)
    ↓ prisma.folder.create()
PostgreSQL
```

## ⚙️ Variables de Entorno

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key
APIYI_API_KEY=replicate-api-key
PORT=8080
FRONTEND_URL=https://your-frontend.com
```

## 🚀 Comandos

```bash
npm run dev       # Desarrollo con ts-node-dev
npm run build     # Compilar TypeScript
npm start         # Producción (migrations + start)
npm run migrate   # Ejecutar migraciones Prisma
npm run studio    # Abrir Prisma Studio
```

## 🔒 Seguridad

### Implementado
- **Passwords hasheados** con bcrypt (10 salt rounds)
- **JWT en HTTP-only cookies** (no accesible desde JS)
- **CORS configurado** para frontend específico
- **Validación de ownership** antes de operaciones CRUD
- **Verificación de token** en todas las rutas protegidas

### Configuración CORS
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

## 📈 Escalabilidad

### Para agregar nuevo endpoint
1. Crear/modificar archivo en `src/routes/`
2. Definir modelo en `prisma/schema.prisma` (si necesario)
3. Ejecutar `npx prisma migrate dev`
4. Registrar router en `src/index.ts`

### Para integrar servicio externo
1. Crear archivo de servicio en `src/services/`
2. Usar en rutas correspondientes
3. Manejar errores y timeouts apropiadamente
