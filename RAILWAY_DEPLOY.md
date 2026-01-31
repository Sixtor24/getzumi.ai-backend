# 🚂 Guía Completa: Despliegue en Railway con PostgreSQL

Esta guía te llevará paso a paso para desplegar tu backend de getzumi.ai en Railway con PostgreSQL.

## ✅ Prerequisitos Completados

- ✅ Prisma instalado y configurado
- ✅ Esquema de base de datos creado (`prisma/schema.prisma`)
- ✅ Cliente de Prisma generado
- ✅ Base de datos local funcionando
- ✅ Scripts de `package.json` actualizados para Railway

## 📋 Pasos desde el Dashboard de Railway

### **Paso 1: Crear Nuevo Proyecto**

1. Ve a tu dashboard de Railway: https://railway.app/dashboard
2. Haz clic en el botón **"+ New"** (esquina superior derecha)
3. Selecciona **"Deploy from GitHub repo"**
4. Si es la primera vez, autoriza Railway para acceder a tu GitHub
5. Selecciona el repositorio **`getzumi.ai-backend`**
6. Railway comenzará a crear el proyecto

### **Paso 2: Agregar Base de Datos PostgreSQL**

1. En tu nuevo proyecto de Railway, haz clic en **"+ New"**
2. Selecciona **"Database"**
3. Elige **"Add PostgreSQL"**
4. Railway creará automáticamente:
   - Una instancia de PostgreSQL
   - Variables de entorno automáticas:
     - `DATABASE_URL`
     - `PGHOST`
     - `PGPORT`
     - `PGUSER`
     - `PGPASSWORD`
     - `PGDATABASE`

### **Paso 3: Vincular PostgreSQL al Servicio Backend**

1. Haz clic en tu servicio de backend (el que tiene el código de Next.js)
2. Ve a la pestaña **"Variables"**
3. Railway debería haber vinculado automáticamente `DATABASE_URL`
4. Si no está vinculada, agrégala manualmente:
   - Click en **"+ New Variable"**
   - Selecciona **"Add Reference"**
   - Elige `DATABASE_URL` del servicio PostgreSQL

### **Paso 4: Configurar Variables de Entorno**

En la pestaña **"Variables"** de tu servicio backend, agrega las siguientes variables:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=fkCrDmm0H2eKQeMmk6OD3Ng04oF1PrwoXDq7ASepAvk=
APIYI_API_KEY=sk-irzIV3x9QcKbeQ7TB19b52856b30473fA71eB2A5E056Ae07
APIYI_BASE_URL=https://api.apiyi.com
CARTESIA_API_KEY=sk_car_DF2jL94PBgWAav4B2ifidr
NEXT_PUBLIC_BASE_URL=https://tu-proyecto.up.railway.app
```

**Cómo agregar cada variable:**
1. Click en **"+ New Variable"**
2. Escribe el nombre (ej: `JWT_SECRET`)
3. Pega el valor
4. Click en **"Add"**

### **Paso 5: Configurar el Dominio**

1. Ve a la pestaña **"Settings"** de tu servicio backend
2. Baja hasta la sección **"Domains"**
3. Railway te asigna un dominio automático: `https://[nombre-aleatorio].up.railway.app`
4. Copia este dominio
5. Vuelve a **"Variables"** y actualiza `NEXT_PUBLIC_BASE_URL` con tu dominio real

**Para dominio personalizado (opcional):**
1. En **"Domains"**, click en **"Custom Domain"**
2. Ingresa tu dominio (ej: `api.getzumi.ai`)
3. Configura los registros DNS según las instrucciones de Railway

### **Paso 6: Verificar Configuración de Build**

1. Ve a **"Settings"** de tu servicio backend
2. Verifica que los comandos sean:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
3. Railway detecta automáticamente que es Next.js, pero si no:
   - Click en **"Build Command"** y escribe: `npm run build`
   - Click en **"Start Command"** y escribe: `npm start`

### **Paso 7: Desplegar**

Railway desplegará automáticamente cuando:
- Hagas push a tu rama principal en GitHub
- O manualmente desde el dashboard

**Para desplegar manualmente:**
1. Ve a la pestaña **"Deployments"**
2. Click en **"Deploy"** (si está disponible)
3. O haz un commit y push a tu repositorio:
   ```bash
   git add .
   git commit -m "Configurar PostgreSQL con Prisma"
   git push origin main
   ```

### **Paso 8: Monitorear el Despliegue**

1. En la pestaña **"Deployments"**, verás el progreso en tiempo real
2. Los logs mostrarán:
   ```
   Installing dependencies...
   Running postinstall: prisma generate
   Building application...
   Running build: prisma generate && prisma db push && next build
   ```
3. **Importante**: `prisma db push` creará automáticamente las tablas en PostgreSQL
4. El despliegue toma aproximadamente 2-5 minutos

### **Paso 9: Verificar el Despliegue**

1. Una vez completado, verás **"Success"** en verde
2. Accede a tu URL: `https://tu-proyecto.up.railway.app`
3. Prueba los endpoints:
   - `GET /api/health` (si tienes uno)
   - `POST /api/auth/signup` para crear un usuario
   - `POST /api/auth/signin` para autenticarte

### **Paso 10: Verificar la Base de Datos**

**Desde Railway:**
1. Click en el servicio **PostgreSQL**
2. Ve a la pestaña **"Data"**
3. Deberías ver las tablas creadas:
   - `User`
   - `Video`
   - `Image`
   - `Audio`
   - `Text`

**Desde tu terminal (opcional):**
```bash
# Conectarte a la base de datos de Railway
railway link
railway run npx prisma studio
```

## 🔄 Flujo de Trabajo Continuo

Una vez configurado, el flujo es simple:

1. **Desarrolla localmente**:
   ```bash
   npm run dev
   ```

2. **Haz commit de tus cambios**:
   ```bash
   git add .
   git commit -m "Nueva funcionalidad"
   git push origin main
   ```

3. **Railway despliega automáticamente** 🚀

## 📊 Monitoreo y Logs

### Ver Logs en Tiempo Real
1. Ve a **"Deployments"**
2. Click en el despliegue activo
3. Los logs se actualizan en tiempo real

### Métricas
1. Ve a **"Metrics"** en tu servicio
2. Verás:
   - Uso de CPU
   - Uso de memoria
   - Ancho de banda
   - Requests por segundo

### Reiniciar el Servicio
1. Ve a **"Settings"**
2. Baja hasta **"Danger Zone"**
3. Click en **"Restart"**

## 💰 Costos

- **Crédito gratuito**: $5 USD/mes
- **Después del crédito**: Pago por uso
  - CPU: ~$0.000463/min
  - RAM: ~$0.000231/GB/min
  - PostgreSQL: Incluido en el plan

**Estimación mensual** (uso moderado):
- Backend Next.js: ~$3-5 USD
- PostgreSQL: ~$2-3 USD
- **Total**: ~$5-8 USD/mes

## 🛠️ Troubleshooting

### Error: "DATABASE_URL not found"
- Verifica que la variable esté en **"Variables"**
- Asegúrate de que esté vinculada al servicio PostgreSQL

### Error: "Prisma generate failed"
- Verifica que `prisma` esté en `devDependencies` en `package.json`
- Revisa los logs de build para más detalles

### Error: "Build timeout"
- Railway tiene un timeout de 10 minutos
- Si tu build es muy largo, considera optimizar dependencias

### Las tablas no se crean
- Verifica que el comando `build` incluya `prisma db push`
- Revisa los logs para ver si hubo errores en la migración

## 📚 Recursos Adicionales

- [Documentación de Railway](https://docs.railway.app)
- [Railway + Next.js](https://docs.railway.app/guides/nextjs)
- [Railway + Prisma](https://docs.railway.app/guides/prisma)
- [Documentación de Prisma](https://www.prisma.io/docs)

## ✅ Checklist Final

Antes de considerar el despliegue completo, verifica:

- [ ] Proyecto creado en Railway
- [ ] PostgreSQL agregado y vinculado
- [ ] Todas las variables de entorno configuradas
- [ ] Dominio configurado (automático o personalizado)
- [ ] Build exitoso (sin errores)
- [ ] Tablas creadas en PostgreSQL
- [ ] Endpoints funcionando correctamente
- [ ] Logs sin errores críticos

---

## 🎉 ¡Listo!

Tu backend de getzumi.ai está ahora desplegado en Railway con PostgreSQL. Cada vez que hagas push a GitHub, Railway desplegará automáticamente los cambios.

**Próximos pasos:**
1. Conecta tu frontend a la URL de Railway
2. Configura un dominio personalizado
3. Monitorea el uso y los logs
4. ¡Empieza a generar contenido con IA! 🚀
