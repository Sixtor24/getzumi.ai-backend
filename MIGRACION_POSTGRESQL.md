# 🔄 Guía de Migración: MongoDB → PostgreSQL

Esta guía detalla los pasos necesarios para migrar el backend de getzumi.ai de MongoDB a PostgreSQL.

## 📋 Cambios Necesarios

### 1. Dependencias del Proyecto

#### Eliminar dependencias de MongoDB:
```bash
npm uninstall mongodb
```

#### Instalar dependencias de PostgreSQL:
```bash
npm install pg @types/pg
npm install prisma @prisma/client --save-dev
```

### 2. Configuración de Prisma (ORM Recomendado)

Prisma es un ORM moderno que facilita el trabajo con PostgreSQL en Next.js.

#### Inicializar Prisma:
```bash
npx prisma init
```

Esto creará:
- `prisma/schema.prisma`: Esquema de la base de datos
- `.env`: Archivo de variables de entorno (si no existe)

#### Configurar `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Modelo de Usuario
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  videos    Video[]
  images    Image[]
  audios    Audio[]
  texts     Text[]
}

// Modelo de Video
model Video {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  prompt      String
  model       String
  videoUrl    String
  status      String   @default("pending")
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Modelo de Imagen
model Image {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  prompt      String
  model       String
  imageUrl    String
  status      String   @default("completed")
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Modelo de Audio
model Audio {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  text        String
  voice       String
  audioUrl    String
  status      String   @default("completed")
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Modelo de Texto
model Text {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  prompt      String
  model       String
  content     String
  status      String   @default("completed")
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### Generar el cliente de Prisma:
```bash
npx prisma generate
```

#### Crear las tablas en PostgreSQL:
```bash
npx prisma db push
```

### 3. Reemplazar `lib/mongodb.ts` con `lib/prisma.ts`

**Eliminar**: `lib/mongodb.ts`

**Crear**: `lib/prisma.ts`

```typescript
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

export default prisma;
```

### 4. Actualizar Rutas de API

Necesitarás actualizar **todos** los archivos de API que usan MongoDB. Aquí hay ejemplos:

#### Ejemplo: `app/api/auth/signup/route.ts`

**Antes (MongoDB)**:
```typescript
import clientPromise from '@/lib/mongodb';

const client = await clientPromise;
const db = client.db(process.env.MONGO_DB_NAME);
const users = db.collection('users');

const existingUser = await users.findOne({ email });
const result = await users.insertOne({ email, password: hashedPassword });
```

**Después (Prisma + PostgreSQL)**:
```typescript
import prisma from '@/lib/prisma';

const existingUser = await prisma.user.findUnique({ 
  where: { email } 
});

const newUser = await prisma.user.create({
  data: { email, password: hashedPassword }
});
```

#### Ejemplo: `app/api/save-image/route.ts`

**Antes (MongoDB)**:
```typescript
const client = await clientPromise;
const db = client.db(process.env.MONGO_DB_NAME);
const images = db.collection('images');

await images.insertOne({
  userId,
  prompt,
  imageUrl,
  createdAt: new Date()
});
```

**Después (Prisma + PostgreSQL)**:
```typescript
await prisma.image.create({
  data: {
    userId,
    prompt,
    imageUrl,
    model: 'seedream-4'
  }
});
```

### 5. Archivos que Necesitan Actualización

Basándome en el análisis del código, estos archivos usan MongoDB y necesitan migración:

#### Autenticación:
- `app/api/auth/signin/route.ts`
- `app/api/auth/signup/route.ts`

#### Generación de Contenido:
- `app/api/generate/route.ts`
- `app/api/video/generate/route.ts`
- `app/api/text/generate/route.ts`
- `app/api/tts/cartesia/route.ts`

#### Guardado de Recursos:
- `app/api/save-image/route.ts`
- `app/api/save-audio/route.ts`

#### Consulta de Recursos:
- `app/api/my-videos/route.ts`
- `app/api/my-images/route.ts`
- `app/api/my-audios/route.ts`
- `app/api/my-texts/route.ts`
- `app/api/view/[id]/route.ts`
- `app/api/view-audio/[id]/route.ts`

#### Tests:
- `__tests__/auth.test.ts`
- `__tests__/video.test.ts`
- `__tests__/save-image.test.ts`
- `__tests__/my-images.test.ts`
- `__tests__/my-audios.test.ts`
- `__tests__/tts.test.ts`
- Y otros archivos de test

### 6. Patrón de Migración Común

**MongoDB → Prisma**:

| Operación MongoDB | Operación Prisma |
|-------------------|------------------|
| `collection.findOne({ field })` | `prisma.model.findUnique({ where: { field } })` |
| `collection.find({}).toArray()` | `prisma.model.findMany({ where: {} })` |
| `collection.insertOne(data)` | `prisma.model.create({ data })` |
| `collection.updateOne({ id }, { $set: data })` | `prisma.model.update({ where: { id }, data })` |
| `collection.deleteOne({ id })` | `prisma.model.delete({ where: { id } })` |
| `collection.countDocuments()` | `prisma.model.count()` |

### 7. Variables de Entorno

**Antes**:
```env
MONGO_DB_URI=mongodb+srv://...
MONGO_DB_NAME=zumidb
```

**Después**:
```env
DATABASE_URL=postgresql://usuario:password@host:puerto/database
```

### 8. Despliegue en Railway

1. **Crear servicio PostgreSQL** en Railway (ya documentado en README)
2. **Agregar variable de entorno**: `DATABASE_URL=${{Postgres.DATABASE_URL}}`
3. **Ejecutar migraciones** automáticamente agregando a `package.json`:

```json
{
  "scripts": {
    "build": "prisma generate && prisma db push && next build",
    "postinstall": "prisma generate"
  }
}
```

## ✅ Checklist de Migración

- [ ] Instalar Prisma y dependencias de PostgreSQL
- [ ] Crear esquema de Prisma (`prisma/schema.prisma`)
- [ ] Configurar `DATABASE_URL` en `.env`
- [ ] Crear `lib/prisma.ts`
- [ ] Eliminar `lib/mongodb.ts`
- [ ] Actualizar todas las rutas de API (24 archivos)
- [ ] Actualizar todos los tests
- [ ] Ejecutar `npx prisma db push` para crear tablas
- [ ] Probar localmente con `npm run dev`
- [ ] Actualizar `package.json` con scripts de Prisma
- [ ] Desplegar en Railway
- [ ] Verificar que las migraciones se ejecuten en Railway

## 🚀 Inicio Rápido (Después de la Migración)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar .env con DATABASE_URL

# 3. Generar cliente de Prisma
npx prisma generate

# 4. Crear tablas en PostgreSQL
npx prisma db push

# 5. Iniciar servidor
npm run dev
```

## 📚 Recursos Adicionales

- [Documentación de Prisma](https://www.prisma.io/docs)
- [Prisma con Next.js](https://www.prisma.io/nextjs)
- [Migración de MongoDB a PostgreSQL](https://www.prisma.io/docs/guides/migrate-to-prisma/migrate-from-mongodb)
