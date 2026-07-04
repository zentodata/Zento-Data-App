# 🎓 Zento Learning

**Plataforma educativa gamificada para aprender Matemáticas y Lectura jugando** 
*Educational platform for kids grades 1-3 to learn Math and Reading through games*

---

## 📦 Descripción del Proyecto

Zento Learning es una **Progressive Web App (PWA)** interactiva que enseña:
- ✅ **Matemáticas** (sumas de 1 a 4 dígitos con visualización base 10)
- ✅ **Lectura** (fonética, formación de palabras, comprensión)
- ✅ **Gamificación** (vidas, gemas, estrellas, racha de días)
- ✅ **Multi-idioma** (Español e Inglés)
- ✅ **Admin Panel** (crear usuarios, asignar retos, monitorear progreso)

**Objetivo**: Que los niños aprendan sin sentir que es tarea, usando mecánicas de juego probadas (Duolingo-style).

---

## 🏗️ Arquitectura Técnica

### Stack:
```
Frontend:     Vanilla JS (sin frameworks para máximo rendimiento)
Styling:      CSS3 + Design Tokens (variables CSS personalizadas)
Backend:      Firebase Realtime Database
Auth:         Email/Password simple (admin fallback)
PWA:          Service Worker + Manifest
Deployment:   Firebase Hosting / Netlify / GitHub Pages
```

### Estructura de Carpetas:

```
zento/
├── index.html              ← Shell PWA principal
├── manifest.json           ← Configuración PWA
├── sw.js                   ← Service Worker (cache offline)
├── SETUP.md                ← Guía de setup (lee esto primero)
│
├── styles/
│   └── main.css            ← Design system completo (tokens, animaciones)
│
├── js/
│   ├── firebase.js         ← Conexión a Realtime DB
│   ├── state.js            ← Estado global + i18n (ES/EN)
│   ├── auth.js             ← Autenticación (admin/admin)
│   ├── router.js           ← SPA router con hash
│   ├── ui.js               ← Utilidades (Toast, Modal, Particles, SVG)
│   └── app.js              ← Pantallas: Splash, Login, Home, World, Admin
│
├── screens/
│   ├── educational-games.js ← Onboarding + mini-juegos educativos
│   └── lesson.js           ← Motor de lecciones (phases: intro→game→practice→boss)
│
└── assets/icons/
    ├── icon.svg            ← Logo animado
    ├── icon-192.png        ← Para PWA
    └── icon-512.png        ← Para PWA
```

---

## 🎮 Flujo de la Aplicación

### 1️⃣ Splash → Login → Onboarding (si es nuevo)

```
[Splash 2s] → [Login] → [Onboarding 6 fases] → [Home]
```

El **Onboarding** explica:
- Qué es Zento Learning
- Los dos mundos (Matemáticas & Lectura)
- Sistema de vidas (5 inicial, se recargan mañana)
- Recompensas (Gemas 💎 y Estrellas ⭐)
- Motivación final

### 2️⃣ Home (Mapa de Mundos)

```
┌─────────────────────────────────────┐
│ Hola, {nombre} 👋                   │
├─────────────────────────────────────┤
│ [HUD: Gemas | Estrellas | Vidas]   │
│ [Racha: 7 días 🔥]                 │
├─────────────────────────────────────┤
│ ┌─────────────┐  ┌─────────────┐   │
│ │ 🧮 Mundo    │  │ 🔤 Mundo    │   │
│ │ Matemático  │  │ Letras      │   │
│ │ 45% ▓▓▓░░░░ │  │ 68% ▓▓▓▓░░░ │   │
│ └─────────────┘  └─────────────┘   │
│                                     │
│ [Reto del día: 3 sumas de centenas]│
│ [Boton: Empezar]                   │
└─────────────────────────────────────┘
```

### 3️⃣ World (Mapa de Islas Secuencial)

```
Cada isla se desbloquea una por una:

COMPLETO ✓   Isla 1: Unidades
             ↓ (línea conectora)
EN PROGRESO ● Isla 2A: Decenas sin llevar → 42%
             ↓
BLOQUEADO 🔒 Isla 2B: Reagrupación
             ↓
BLOQUEADO 🔒 Isla 3: Centenas
             ↓
BLOQUEADO 🔒 Isla 4: Millares
```

### 4️⃣ Lesson (Flujo de Lección)

```
┌─ INTRO ─────────────────────┐
│ "¿Listo para jugar?"        │
│ Muestra: +15 gemas, +3 stars│
│ [Botón: ¡Jugar!]            │
└─────────────────────────────┘
         ↓
┌─ GAME (3-5 min) ────────────┐
│ 🐲 Alimenta al Monstruo     │
│ [Drag & drop frutas] (actual)│
│ O:                           │
│ 🏗️ Torres de Bloques        │
│ [Visualización base 10]     │
└─────────────────────────────┘
         ↓
┌─ PRACTICE (3 preguntas) ────┐
│ ✏️ Preguntas con AYUDA       │
│ (botón "💡 Necesito ayuda")  │
│ Pierde vida si falla 2x      │
└─────────────────────────────┘
         ↓
┌─ BOSS (sin ayudas) ─────────┐
│ ⚔️ Jefe Final               │
│ {N} preguntas sin pistas     │
│ Necesita 66% para pasar      │
│ Si falla → vuelve a intentar │
└─────────────────────────────┘
         ↓
┌─ COMPLETE ──────────────────┐
│ 🎉 ¡Increíble!              │
│ ┌────────┐  ┌────────┐      │
│ │ +15 💎 │  │ +3 ⭐  │      │
│ └────────┘  └────────┘      │
│ Resultado: 4/4 ✓            │
│ [Botón: Continuar]          │
└─────────────────────────────┘
```

### 5️⃣ Admin Panel (Para Maestros)

```
[📋 Hoy] [📊 Progreso] [🔔 Alertas] [🎯 Retos] [👥 Usuarios]

Tab: HOY
  ✓ Meta cumplida (verde/amarillo/rojo)
  Métrica rápida: Racha, Gemas, Estrellas, Precisión
  Calendario semanal con rayas de actividad

Tab: PROGRESO
  🧮 Mundo Matemático
    ✓ Isla 1 | ✓ Isla 2A | ● Isla 2B (42%)
  🔤 Mundo Letras
    ✓ Isla 1 | ✓ Isla 2 | ● Isla 3 (68%)

Tab: ALERTAS
  🔴 CRÍTICO: "Dificultad con reagrupación"
  🟡 CUIDADO: "Palabras con sílabas trabadas"
  🟢 BIEN: "Domina sumas de 1 dígito"

Tab: RETOS
  [Seleccionar usuario ▼]
  [Botón: 3 sumas de centenas sin ayuda]
  [Botón: Modo contrarreloj: 10 sumas en 5 min]
  ✓ Reto asignado para mañana

Tab: USUARIOS
  [Botón: ➕ Crear nuevo usuario]
  
  [Elena] Visto: 21 jun | 💎 340 | ⭐ 1,280 | 🔥 7
  [Opción: ✏️ Editar | 🗑️ Eliminar]
  
  [Juan] Visto: 19 jun | 💎 0 | ⭐ 0 | 🔥 0
```

---

## 🎮 Mini-juegos Educativos

### ✅ IMPLEMENTADOS:

#### 1. 🐲 **Alimenta al Monstruo** (Isla 1 Matemáticas)
- **Objetivo**: Suma de números de 1 dígito (3+2)
- **Mecánica**: Drag & drop de frutas (iOS/Android compatible)
- **Progresión**: 5 problemas → avanza si acierta todos
- **Enseña**: Relación visual entre cantidad y número
- **Duración**: 3 min

#### 2. 🔊 **Burbujas de Sonido** (Isla 1 Lectura)
- **Objetivo**: Identificación de vocales por sonido fonético
- **Mecánica**: Toca burbuja con sonido, elige la vocal correcta
- **Progresión**: A-E-I-O-U (5 rounds)
- **Enseña**: Fonética pura (sin nombres de letras)
- **Soporte**: Web Speech API (voz real)
- **Duración**: 3-4 min

#### 3. 🏗️ **Torres de Bloques** (Isla 2A Matemáticas)
- **Objetivo**: Sumas de 2 dígitos sin reagrupación
- **Mecánica**: Visualización Montessori (barras de 10 + unitarios)
- **Representación**: 12 + 13 = 2 barras + 3 bloques + 1 barra + 3 bloques
- **Progresión**: 4 problemas
- **Enseña**: Base 10, descomposición de números
- **Duración**: 4-5 min

#### 4. 🚀 **Lanzadera Espacial** (Isla 2B Matemáticas)
- **Objetivo**: Sumas CON reagrupación
- **Mecánica**: Cuando unidades ≥10, se fusionan en decena (animación)
- **Progresión**: 4 problemas de reagrupación
- **Enseña**: Por qué "llevamos" una decena
- **Duración**: 5 min

### ⏳ PRÓXIMAS (v1.1+):

#### 5. 🚂 **Tren Silábico** (Isla 2 Lectura)
- Consonante + Vocal = Sílaba sonora
- Combinar sílabas para formar palabras

#### 6. 🐟 **Pesca de Letras** (Isla 3 Lectura)
- Deletrear palabras cogiendo letras en orden
- Validar con imagen de referencia

#### 7. 📖 **Cuentacuentos Interactivo** (Isla 4 Lectura)
- Leer texto con palabras clickeables para audio
- Preguntas de comprensión tipo trivia

#### 8. 🏭 **Fábrica de Juguetes** (Isla 3-4 Matemáticas)
- Contexto: empacar juguetes (suma de 3-4 dígitos)
- Operaciones en columnas

---

## 📊 Sistema de Progreso

### Estados de Isla:

```javascript
"locked"      // No se puede acceder (islas previas no completadas)
"inProgress"  // Actualmente en juego (15-42%)
"completed"   // Jefe final vencido (✓)
```

### Recompensas:

```javascript
// Por completar isla:
gemsReward:   15    // Zafiros (moneda rara)
starsReward:  3     // Estrellas (abundantes)

// Extras:
streak:       +1 día si juega hoy
lives:        se recargan a las 00:00
```

### Vidas:

```javascript
Inicio: 5 ❤️
Pérdida: -1 por pregunta fallida en BOSS
Recarga: Automática a las 00:00 (reset a 5)
```

---

## 🔐 Sistema de Usuarios

### Admin:

```javascript
{
  uid: "admin",
  username: "admin",
  password: "admin",      // Cambiar después de primer login
  role: "admin",
  avatar: "admin"
}
```

### Estudiante (Nuevo):

```javascript
{
  uid: "elena",
  username: "elena",
  role: "student",
  grade: 2,
  avatar: "zento",
  hasSeenOnboarding: false,  // Verá tutorial al primer login
  createdAt: 1624963200000,
  stats: {
    gems: 0,
    stars: 0,
    lives: 5,
    streak: 0,
    maxStreak: 0,
    totalXP: 0,
    lastPlayedDate: null
  },
  progress: {
    math: {
      island1: "locked",
      island2a: "locked",
      island2b: "locked",
      island3: "locked",
      island4: "locked"
    },
    reading: {
      island1: "locked",
      island2: "locked",
      island3: "locked",
      island4: "locked"
    }
  }
}
```

### Desafíos (Asignados por Admin):

```javascript
users/{uid}/challenges/
  2026-06-24: {
    name: "3 sumas de centenas sin ayuda",
    setAt: 1624963200000
  }
```

---

## 🎨 Design System

### Colores Primarios:

```css
--z-purple:        #6C63FF  /* Primario matemáticas *)
--z-teal:          #00BFA5  /* Primario lectura *)
--z-amber:         #FFB300  /* Advertencias, retos *)
--z-coral:         #FF6B6B  /* Errores *)
--z-green:         #4CAF50  /* Éxito *)
```

### Animaciones Clave:

```css
--z-ease:       cubic-bezier(.34,1.56,.64,1)     /* Bouncy *)
--z-ease-out:   cubic-bezier(.22,1,.36,1)        /* Smooth exit *)

.pop-in        → Elementos entran a escala
.bounce        → Efecto infinito flotante
.celebrate     → Rotación + escala (victoria)
.shake         → Error visual
.shimmer       → Loading shimmer
```

### Tipografía:

```css
Display: "Nunito" 800-900 weight (títulos, números)
Body:    "Nunito Sans" 400-600 weight (párrafos)
```

---

## 🌍 Multilenguaje

### Idiomas soportados:

- ✅ **Español** (es-GT, es-MX, es-ES)
- ✅ **Inglés** (en-US)

### Cambiar idioma:

Usuario puede cambiar en:
1. **Login** (toggle ES/EN arriba derecha)
2. **Home** (botones ES/EN junto a Admin)

Cambio persiste en `localStorage`:
```javascript
localStorage.setItem('zento_lang', 'es');
localStorage.setItem('zento_lang', 'en');
```

---

## 📱 PWA - Progressive Web App

### Características:

✅ **Instalable**
- Android: Add to Home Screen (automático)
- iOS: Share → Add to Home Screen

✅ **Offline First**
- Service Worker cachea assets estáticos
- Firebase Realtime DB se sincroniza cuando hay conexión

✅ **Responsive**
- Optimizada para 320px (teléfono) hasta 1024px (tablet)
- Orientación portrait y landscape

✅ **Web Speech API**
- Pronunciación de letras/palabras
- Fallback a texto si no disponible

---

## 🔧 Desarrollo Local

### Para desarrolladores:

```bash
# 1. Clonar o descomprimir
unzip zento-learning-v1.zip
cd zento

# 2. Servir localmente (simular HTTPS)
python -m http.server 8000
# O
npx http-server

# 3. Abrir
http://localhost:8000

# 4. Cambiar URL Firebase en js/firebase.js
databaseURL: "https://YOUR-PROJECT-default-rtdb.firebaseio.com",
```

### Testing:

```javascript
// En Console del navegador:
State.get('user')           // Ver usuario actual
State.get('stats')          // Ver stats
State.get('progress')       // Ver progreso
DB.get('users/admin')       // Leer datos Firebase
Router.go('home')           // Navegar
```

---

## 🚀 Deployment Checklist

- [ ] ✅ Firebase Realtime DB creada
- [ ] ✅ URL Firebase en `js/firebase.js`
- [ ] ✅ Rules de seguridad configuradas
- [ ] ✅ PWA manifest.json actualizado
- [ ] ✅ Service Worker cacheando assets
- [ ] ✅ Admin credentials iniciales creadas
- [ ] ✅ Primer usuario de prueba (estudiante) creado
- [ ] ✅ Tested en móvil (iOS + Android)
- [ ] ✅ Tested en desktop (Chrome, Safari, Firefox)
- [ ] ✅ Offline functionality probada

---

## 📚 Documentación Técnica

### Firebase Security Rules:
Ver `SETUP.md` → Sección "Configurar Reglas de Seguridad"

### Estructura API:
```javascript
// Write
DB.set(path, data)        → Crea/sobrescribe
DB.update(path, data)     → Mezcla (merge)
DB.push(path, data)       → Auto-key

// Read
DB.get(path)              → Promise<data>
DB.on(path, callback)     → Listener realtime
```

### Router:
```javascript
Router.register('page-name', (params) => {
  const el = document.createElement('div');
  el.className = 'screen';
  return el;
});

Router.go('page-name', { param1: 'value' });
```

---

## 🎓 Educational Methodology

### Basado en:

✅ **Constructivismo**: El niño construye conocimiento mediante manipulación de objetos
✅ **Montessori**: Bloques base 10 para visualizar números
✅ **Gamificación**: Recompensas frecuentes, progreso visible
✅ **Microaprendizaje**: Lecciones de 3-5 minutos, no más
✅ **Spaced Repetition**: Práctica con hints, luego validación sin ayudas

### Currículo 1-3 Grado:

**Matemáticas**:
- Unidades (1 dígito)
- Decenas sin llevar (2 dígitos)
- Decenas CON reagrupación (2 dígitos)
- Centenas (3 dígitos)
- Millares (4 dígitos)

**Lectura**:
- Vocales (fonética)
- Consonantes (sílabas)
- Palabras (formación)
- Comprensión (trivia)

---

## 💡 Consejos para Maestros

1. **Crear clase**: 
   - Panel Admin → Usuarios → Crear 25+ estudiantes en minutos

2. **Motivar racha**:
   - Los niños juegan más si ven "racha de X días 🔥"
   - Reasigna el mismo reto si no lo completa

3. **Monitorear problemas**:
   - Tab "Alertas" te muestra dificultades automáticamente
   - Cuando un niño falla 2x el jefe final → sugerencia de refuerzo manual

4. **Retos personalizados**:
   - Tab "Retos" → asigna reto diferente por estudiante para mañana
   - Bloquea tienda hasta que lo completen

5. **Usar en clase**:
   - 5 min al inicio o cierre de clase
   - Los niños avanzan a su ritmo (no hay competencia pública)

---

## 📞 Soporte Técnico

### Problemas comunes:

| Problema | Solución |
|----------|----------|
| Firebase no conecta | Verifica URL en `js/firebase.js` y Rules |
| Login no funciona | Comprueba `/admin/credentials` existe en DB |
| Juego freezeado | F12 → Console, busca errores, reload |
| Progreso no guarda | Verifica internet, mira Network tab (F12) |
| PWA no instala | Asegurate HTTPS (excepto localhost) |

### Para reportar bugs:

1. Abre Console (F12)
2. Copia el error
3. Incluye:
   - Navegador y versión
   - Dispositivo (móvil/desktop)
   - Pasos para reproducir

---

## 📄 Licencia

Zento Learning © 2026 - Uso educativo permitido
No comercial sin autorización

---

**¿Preguntas?** Consulta `SETUP.md` para deployment
**¿Sugerencias?** Reporta en GitHub issues

---

Desarrollado por el equipo de Ingeniería de Zento Learning 🚀
