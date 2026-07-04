# 🎓 ZENTO LEARNING - Setup & Deployment Guide

**Ingeniero Lead**: Sistema de aprendizaje gamificado para niños de 1-3 grado
**Status**: ✅ Ready for Production (v1.0)

---

## 📋 Requisitos Previos

- ✅ Cuenta Firebase (Realtime Database)
- ✅ Hosting (Netlify, Firebase Hosting, GitHub Pages, o tu servidor)
- ✅ Navegador moderno (Chrome, Safari, Firefox)
- ✅ Dispositivos móvil/tablet recomendados

---

## 🚀 SETUP PASO A PASO

### 1️⃣ Configurar Firebase Realtime Database

1. Abre [Firebase Console](https://console.firebase.google.com)
2. Crea proyecto nuevo: `app-aprende-3b50a` (o usa uno existente)
3. Ve a **Realtime Database** → **Crear base de datos**
4. Selecciona **Región**: `us-central1` (o la más cercana)
5. Elige **Modo de prueba** para empezar
6. Copia la URL de tu base: `https://YOUR-PROJECT-default-rtdb.firebaseio.com/`
7. Reemplaza en `js/firebase.js` línea 5:
   ```javascript
   databaseURL: "https://YOUR-PROJECT-default-rtdb.firebaseio.com",
   ```

### 2️⃣ Configurar Reglas de Seguridad Firebase

En **Realtime Database** → **Rules**:

```json
{
  "rules": {
    "admin": {
      ".read": false,
      ".write": "auth.uid === 'admin'",
      "credentials": {
        ".read": false,
        ".write": "root.child('admin').child('credentials').exists()"
      }
    },
    "users": {
      "$uid": {
        ".read": "auth.uid === $uid || auth.uid === 'admin'",
        ".write": "auth.uid === $uid || auth.uid === 'admin'",
        ".validate": "newData.hasChildren(['username','role','stats','progress'])"
      }
    },
    "sessions": {
      "$uid": {
        ".write": "auth.uid === $uid"
      }
    },
    "leaderboard": {
      ".read": true,
      "$uid": {
        ".write": "auth.uid === $uid"
      }
    }
  }
}
```

### 3️⃣ Inicializar Data Admin

Una vez desplegado, accede a `https://tu-app.com` y loguéate con:
- **Usuario**: `admin`
- **Contraseña**: `admin`

Esto creará automáticamente el nodo `/admin/credentials` en Firebase.

### 4️⃣ Desplegar la App

**OPCIÓN A: Firebase Hosting (Recomendado)**

```bash
# Instala Firebase CLI
npm install -g firebase-tools

# Autentícate
firebase login

# Configura tu proyecto
firebase init hosting

# Selecciona el directorio público: ./zento/

# Deploy
firebase deploy --only hosting
```

Tu app estará en: `https://YOUR-PROJECT.web.app`

**OPCIÓN B: Netlify**

```bash
# Arrastra la carpeta 'zento/' a https://app.netlify.com
# O usa CLI:
npm install -g netlify-cli
netlify deploy --prod --dir zento
```

**OPCIÓN C: GitHub Pages**

```bash
# Sube la carpeta zento/ a GitHub
# Ve a Settings → Pages
# Selecciona rama 'main' y carpeta '/zento'
# Publica automáticamente
```

---

## 👥 Crear Primer Usuario (Estudiante)

### Via Admin Panel:

1. Loguéate como `admin` / `admin`
2. Ve a pestaña **👥 Usuarios**
3. Click **➕ Crear nuevo usuario**
4. Completa:
   - **Nombre**: `elena` (o el que quieras)
   - **Grado**: Selecciona `2.° grado`
5. Click **Crear**
6. El usuario verá tutorial completo al primer login

### Estructura de datos creado:

```
users/
  elena/
    username: "elena"
    role: "student"
    grade: 2
    avatar: "zento"
    hasSeenOnboarding: false
    stats: { gems: 0, stars: 0, lives: 5, streak: 0 }
    progress: { math: { island1: "locked", ... }, reading: { ... } }
```

---

## 🎮 Flujo de Uso

### Primer Login (Estudiante Nuevo):

```
Login → Onboarding (6 fases) → Home (Mapa) → Seleccionar Isla → Juego
```

### Flujo de Lección:

```
Isla → Intro (explicación) → Juego Educativo (3-5 min) 
  → Práctica (3 preguntas) → Jefe Final (sin ayudas)
    → ✓ Completado → Rewards (Gemas + Estrellas)
```

### Admin Panel:

```
Hoy (métricas) → Progreso (islas) → Alertas → Retos (asignar)
  → Usuarios (crear/editar/eliminar)
```

---

## 🎮 Mini-juegos Implementados

### Matemáticas:

✅ **Isla 1**: Alimenta al Monstruo (suma 1 dígito, drag-drop)
✅ **Isla 2A**: Torres de Bloques (base 10 Montessori, 2 dígitos)
✅ **Isla 2B**: Lanzadera Espacial (reagrupación con animación)
⏳ **Isla 3-4**: Próximamente

### Lectura:

✅ **Isla 1**: Burbujas de Sonido (fonética vocales con Web Speech)
⏳ **Isla 2-4**: Próximamente

---

## 📊 Base de Datos - Estructura

### Paths principales:

```
/admin/
  ├── credentials/ → { username, password }
  └── alerts/ → { uid, type, message, detail, read, timestamp }

/users/
  ├── {uid}/
  │   ├── username, role, grade, avatar
  │   ├── stats/ → { gems, stars, lives, streak, lastPlayedDate }
  │   ├── progress/ → { math: {...}, reading: {...} }
  │   ├── challenges/ → { {date}: { name, setAt } }
  │   ├── hasSeenOnboarding
  │   └── online, lastSeen

/sessions/
  ├── {uid}/
  │   ├── {date}/
  │   │   └── [...] → { world, island, bossScore, gems, stars }

/leaderboard/
  └── {uid} → { username, totalStars, totalGems }
```

---

## 🔐 Credenciales Iniciales

### Admin Account:
- **Usuario**: `admin`
- **Contraseña**: `admin`
- **Recomendación**: Cambiar después del primer login (feature próxima)

---

## 🌍 Lenguajes Soportados

- ✅ Español (Guatemala/Latinoamérica) - Predeterminado
- ✅ Inglés

Toggle en **Login** y en **Home** (arriba derecha)

---

## 📱 Progressive Web App (PWA)

### Características:

✅ Instalable en Android (Add to Home Screen)
✅ Instalable en iOS (Share → Add to Home Screen)
✅ Funciona sin internet (cache offline)
✅ Notificaciones push (implementadas en backend)
✅ Soporte para tablets y teléfonos

### Para instalar:

1. Abre en Chrome/Safari
2. Click en menú (⋮) → "Instalar app"
3. La app aparecerá en tu pantalla de inicio

---

## 🐛 Troubleshooting

### Firebase no conecta

```javascript
// Verifica que en js/firebase.js esté la URL correcta:
databaseURL: "https://YOUR-PROJECT-default-rtdb.firebaseio.com",

// Y que las Rules permitan lectura/escritura en Testing
```

### Login no funciona

```
1. Verifica que /admin/credentials exista en Firebase
2. Admin panel → Usuarios → Revisa si hay datos
3. Console del navegador (F12) → Check de errores
```

### Juego se freezea

```
1. Abre DevTools (F12) → Console
2. Busca errores JavaScript
3. Reinicia la app (CTRL+R o pull-to-refresh en móvil)
```

---

## 📈 Próximas Fases

### v1.1 (Próximo):
- ✍️ Cambiar contraseña admin
- 🎨 Editor de avatares personalizados
- 🏪 Tienda de recompensas (canjear gemas por avatares)

### v2.0:
- 📚 Más mini-juegos (Isla 3, 4, Reading 2-4)
- 🏆 Leaderboard global
- 👨‍👩‍👧 Soporte multi-usuario (familia)
- 📊 Reportes avanzados para padres/maestros
- 🎵 Audio/efectos de sonido

---

## 💡 Tips para Maestros

1. **Crear estudiantes en batch**: Usa admin panel para añadir toda la clase
2. **Monitorear progreso**: Panel "Hoy" muestra actividad en tiempo real
3. **Asignar retos**: Cada noche, asigna reto personalizado para el día siguiente
4. **Mantener racha**: Los estudiantes pierden vidas pero se recargan al día siguiente
5. **Refuerzo**: Las alertas te avisan si un estudiante está en dificultad

---

## 📞 Soporte

- **Documentación**: Ver README.md
- **Issues**: Reporta en GitHub
- **Firebase**: Consulta [docs.firebase.google.com](https://docs.firebase.google.com)

---

**Made with ❤️ for Learning**
Zento Learning © 2026
