# Portafolio Interactivo 3D - Miquel Carnot Luna

Este es mi portafolio personal, reinventado como una experiencia web interactiva. En lugar de un fondo estático, he desarrollado un microsimulador espacial utilizando **Three.js** y **cannon-es**, que puedes pilotar directamente desde la página de inicio.

El proyecto está construido sobre **Astro** para garantizar un rendimiento web óptimo en las páginas de contenido, mientras se ofrece una experiencia rica y dinámica en la página principal.

## 🌐 Demo en Vivo

Puedes experimentar la versión desplegada aquí: **[portfolio-eta-nine.vercel.app](https://portfolio-astro-eta-nine.vercel.app/)**

## ✨ Características Principales

-   **Navegación 3D Interactiva**: Controla una nave espacial con 6 grados de libertad (6-DoF) usando el teclado. Muévete, acelera, frena y explora el entorno.

-   **Fondo Dinámico**: Un campo de estrellas generado proceduralmente que da una sensación de inmensidad y movimiento.

-   **Físicas Realistas**: Implementación de `cannon-es` para gestionar el movimiento de la nave y los proyectiles, incluyendo damping y fuerzas.

-   **Rendimiento Optimizado**: Construido con Astro, que envía cero JavaScript por defecto a las páginas estáticas, asegurando tiempos de carga ultrarrápidos. La escena 3D se carga como una "isla de interactividad".

-   **Diseño Transparente y Moderno**: Una interfaz de usuario limpia y superpuesta que no interfiere con la experiencia 3D, junto con efectos sutiles como el "glitch" en la navegación.

## 🛠️ Tecnologías Utilizadas

-   **Framework**: [Astro](https://astro.build/)
-   **Renderizado 3D**: [Three.js](https://threejs.org/)
-   **Motor de Físicas**: [cannon-es](https://github.com/pmndrs/cannon-es)
-   **Lenguaje**: TypeScript y JavaScript
-   **Estilos**: CSS puro
-   **Despliegue**: [Vercel](https://vercel.com/)

## 🚀 Cómo Empezar

Si quieres ejecutar este proyecto en tu máquina local, sigue estos pasos.

### Prerrequisitos

-   [Node.js](https://nodejs.org/) (versión 18.0 o superior)
-   Un gestor de paquetes como `npm`, `pnpm` o `yarn`.

### Instalación

1.  Clona el repositorio:

    ```bash
    git clone [https://github.com/greyzeids/portfolio-astro.git](https://github.com/greyzeids/portfolio-astro.git)
    ```

2.  Navega a la carpeta del proyecto:

    ```bash
    cd portfolio-astro
    ```

3.  Instala las dependencias:
    ```bash
    npm install
    ```

### Comandos del Proyecto

Todos los comandos se ejecutan desde la raíz del proyecto:

| Comando           | Acción                                                    |
| :---------------- | :-------------------------------------------------------- |
| `npm run dev`     | Inicia el servidor de desarrollo en `localhost:4321`.     |
| `npm run build`   | Compila el sitio para producción en la carpeta `./dist/`. |
| `npm run preview` | Previsualiza el build de producción localmente.           |

## 📦 Despliegue

El proyecto está configurado para despliegue continuo en Vercel. Cualquier `push` a la rama `main` iniciará automáticamente un nuevo build y despliegue.

## 🔮 Posibles Mejoras Futuras

-   [ ] Añadir enemigos o asteroides con los que interactuar.
-   [ ] Implementar un sistema de puntuación o misiones simples.
-   [ ] Optimizar la carga de modelos 3D y texturas.
-   [ ] Desarrollar las páginas de contenido (`Proyectos`, `Sobre mí`, etc.).
-   [ ] Refinar los efectos de sonido y añadir música de fondo.

## 👤 Contacto

-   **GitHub**: [@greyzeids](https://github.com/greyzeids)
-   **LinkedIn**: [Miquel Carnot](https://www.linkedin.com/
