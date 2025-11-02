# 🔧 Solución: Error "Invalid Configuration" en Dominios de Vercel

## ✅ Pasos para Resolver

### Paso 1: Verificar que el proyecto está desplegado correctamente

**ANTES** de configurar dominios personalizados, asegúrate de que:

1. El proyecto está desplegado correctamente
2. Funciona con la URL de Vercel (tipo: `https://fitplan-ai-xyz.vercel.app`)
3. No hay errores en el deployment

**Si el proyecto NO está desplegado aún o tiene errores**, primero resuelve eso.

---

### Paso 2: Remover los dominios con error (temporalmente)

1. En Vercel, ve a tu proyecto
2. Ve a **Settings** → **Domains**
3. Para cada dominio con error (`fitplan-ai.com` y `www.fitplan-ai.com`):
   - Haz clic en **"..."** (tres puntos)
   - Selecciona **"Remove"** o **"Delete"**
   - Confirma la eliminación

**Esto es temporal** - los agregaremos de nuevo correctamente.

---

### Paso 3: Configurar DNS correctamente

Antes de agregar los dominios de nuevo, necesitas configurar los registros DNS en tu proveedor de dominio (GoDaddy, Namecheap, etc.).

#### Para `www.fitplan-ai.com`:

Agrega un registro **CNAME**:
- **Tipo:** CNAME
- **Nombre/Host:** `www`
- **Valor/Target:** `cname.vercel-dns.com`
- **TTL:** 3600 (o Auto)

#### Para `fitplan-ai.com` (dominio raíz):

Tienes dos opciones:

**Opción A: Redirección (Recomendada)**
- Agrega un registro **CNAME** o **ALIAS** apuntando a `www.fitplan-ai.com`
- Esto redirige el dominio raíz al subdominio www

**Opción B: Registro A**
- Vercel te dará direcciones IP específicas
- Agrega registros **A** con esas IPs (generalmente 4 direcciones IP)

---

### Paso 4: Agregar el dominio en Vercel (solo www primero)

1. En Vercel, ve a **Settings** → **Domains**
2. Haz clic en **"Add"**
3. Ingresa solo: `www.fitplan-ai.com`
4. Haz clic en **"Add"**

**NO agregues `fitplan-ai.com` todavía.**

---

### Paso 5: Verificar el DNS

Después de agregar el dominio, Vercel verificará los registros DNS. Esto puede tomar:

- **Mínimo:** 5-10 minutos
- **Máximo:** 24-48 horas (generalmente es más rápido)

Para verificar el estado:
1. Ve a **Settings** → **Domains**
2. Verás el estado del dominio:
   - 🔴 **Invalid Configuration** = DNS no configurado o incorrecto
   - 🟡 **Pending** = DNS configurado, esperando verificación
   - 🟢 **Valid** = Todo correcto, dominio funcionando

**Puedes verificar tus DNS desde la terminal:**
```bash
# Verificar CNAME de www
dig www.fitplan-ai.com CNAME

# Debería mostrar algo como:
# www.fitplan-ai.com. 3600 IN CNAME cname.vercel-dns.com.
```

---

### Paso 6: Una vez que www esté funcionando

Una vez que `www.fitplan-ai.com` esté en estado **Valid** (verde):

1. Ve a **Settings** → **Domains**
2. Haz clic en **"Add"**
3. Agrega: `fitplan-ai.com`
4. Vercel configurará automáticamente la redirección a `www.fitplan-ai.com`

---

## 🔍 Verificación de DNS - Comandos Útiles

Si quieres verificar que tus DNS están configurados correctamente:

```bash
# Verificar CNAME de www
nslookup www.fitplan-ai.com

# Verificar registros A del dominio raíz
nslookup fitplan-ai.com

# Ver todos los registros
dig fitplan-ai.com ANY
```

---

## ⚠️ Problemas Comunes

### "Invalid Configuration" persiste después de configurar DNS

**Posibles causas:**
1. Los DNS aún no se han propagado (espera 10-30 minutos)
2. Registro DNS incorrecto (verifica que apunta a `cname.vercel-dns.com`)
3. TTL muy alto (cambia a 3600 o Auto)
4. Cache de DNS (espera más tiempo o limpia cache)

**Solución:**
1. Espera 30-60 minutos después de configurar DNS
2. Haz clic en **"Refresh"** en Vercel
3. Verifica que los registros DNS están correctos en tu proveedor de dominio
4. Si persiste, contacta el soporte de tu proveedor de dominio

### El dominio no se verifica después de 24 horas

**Solución:**
1. Verifica que los registros DNS están correctos (usa los comandos arriba)
2. Asegúrate de que no hay firewall bloqueando la verificación
3. Contacta el soporte de Vercel con:
   - Tu dominio
   - Capturas de pantalla de tus registros DNS
   - El error específico que ves

### "308 Redirect" está funcionando pero muestra error

Si ves que `fitplan-ai.com` redirige a `www.fitplan-ai.com` (308) pero ambos muestran error, el problema es que `www.fitplan-ai.com` no está configurado correctamente.

**Solución:**
1. Asegúrate de que `www.fitplan-ai.com` esté configurado primero
2. Verifica que el CNAME de www está correcto
3. Espera a que `www` esté en estado "Valid" antes de agregar el dominio raíz

---

## 📝 Checklist Final

Antes de reportar un problema, verifica:

- [ ] El proyecto está desplegado correctamente en Vercel
- [ ] Funciona con la URL de Vercel (sin dominio personalizado)
- [ ] Los registros DNS están configurados correctamente
- [ ] Esperaste al menos 30 minutos después de configurar DNS
- [ ] Hiciste clic en "Refresh" en Vercel
- [ ] Verificaste los registros DNS con `dig` o `nslookup`

---

## 🆘 Si Nada Funciona

1. **Remueve TODOS los dominios** de Vercel temporalmente
2. **Asegúrate de que el proyecto funciona** con la URL de Vercel
3. **Configura solo `www.fitplan-ai.com` primero**
4. **Espera a que esté validado completamente**
5. **Luego agrega `fitplan-ai.com`**

Si después de seguir todos estos pasos el problema persiste, contacta el soporte de Vercel con detalles específicos del error.

