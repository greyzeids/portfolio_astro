Portafolio Interactivo 3D - Miquel Carnot Luna

Este es mi portafolio personal, reinventado como una experiencia web interactiva. En lugar de un fondo estático, he desarrollado un microsimulador espacial utilizando Three.js y cannon-es, que puedes pilotar directamente desde la página de inicio.
El proyecto está construido sobre Astro para garantizar un rendimiento web óptimo en las páginas de contenido, mientras se ofrece una experiencia rica y dinámica en la página principal.

🌐 Demo en Vivo
Puedes experimentar la versión desplegada aquí: portfolio-astro-ruby.vercel.app

✨ Características Principales

Navegación 3D Interactiva: Controla una nave espacial con 6 grados de libertad (6-DoF) usando el teclado. Muévete, acelera, frena y explora el entorno.
Fondo Dinámico: Un campo de estrellas generado proceduralmente que da una sensación de inmensidad y movimiento.
Físicas Realistas: Implementación de cannon-es para gestionar el movimiento de la nave y los proyectiles, incluyendo damping y fuerzas.
Rendimiento Optimizado: Construido con Astro, que envía cero JavaScript por defecto a las páginas estáticas, asegurando tiempos de carga ultrarrápidos. La escena 3D se carga como una "isla de interactividad".
Diseño Transparente y Moderno: Una interfaz de usuario limpia y superpuesta que no interfiere con la experiencia 3D, junto con efectos sutiles como el "glitch" en la navegación.

🛠️ Tecnologías Utilizadas
Framework: Astro
Renderizado 3D: Three.js
Motor de Físicas: cannon-es
Lenguaje: TypeScript y JavaScript
Estilos: CSS puro
Despliegue: Vercel

🚀 Cómo Empezar
Si quieres ejecutar este proyecto en tu máquina local, sigue estos pasos.

Prerrequisitos
Node.js (versión 18.0 o superior)
Un gestor de paquetes como npm, pnpm o yarn.

Instalación
Clona el repositorio:
git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git


Navega a la carpeta del proyecto:
cd TU_REPOSITORIO


Instala las dependencias:
npm install


Comandos del Proyecto
Todos los comandos se ejecutan desde la raíz del proyecto:
Comando
Acción
npm run dev
Inicia el servidor de desarrollo en localhost:4321.
npm run build
Compila el sitio para producción en la carpeta ./dist/.
npm run preview
Previsualiza el build de producción localmente.

📁 Estructura del Proyecto
El proyecto sigue la estructura estándar de Astro para una organización clara y mantenible.
/
├── public/              # Assets estáticos (modelos 3D, sonidos, iconos)
├── src/
│   ├── components/      # Componentes reutilizables (.astro)
│   │   └── ThreeCanvas.astro
│   ├── layouts/         # Plantillas de página
│   │   └── Layout.astro
│   ├── pages/           # Rutas y páginas del sitio
│   │   └── index.astro
│   ├── scripts/         # Lógica de JavaScript del lado del cliente
│   │   └── three-experience.js
│   └── styles/          # Estilos globales
│       └── global.css
└── package.json


📦 Despliegue
El proyecto está configurado para despliegue continuo en Vercel. Cualquier push a la rama main iniciará automáticamente un nuevo build y despliegue.

🔮 Posibles Mejoras Futuras
[ ] Añadir enemigos o asteroides con los que interactuar.
[ ] Implementar un sistema de puntuación o misiones simples.
[ ] Optimizar la carga de modelos 3D y texturas.
[ ] Desarrollar las páginas de contenido (Proyectos, Sobre mí, etc.).
[ ] Refinar los efectos de sonido y añadir música de fondo.

👤 Contacto
GitHub: @greyzeids
LinkedIn: Miquel Carnot
