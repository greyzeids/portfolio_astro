// Configuración para el Lazy Loading de Three.js
export const LazyLoadingConfig = {
    // Tiempo de delay antes de iniciar la carga (ms)
    INITIAL_DELAY: 100,

    // Tiempo de transición para ocultar el loading (ms)
    TRANSITION_DELAY: 500,

    // Mensajes de carga personalizables
    LOADING_MESSAGES: {
        INITIAL: "Cargando experiencia 3D...",
        LIBRARIES: "Cargando librerías 3D...",
        SCENE: "Inicializando escena...",
        CONTROLS: "Configurando controles...",
        READY: "¡Listo para explorar!",
        ERROR: "Error al cargar la experiencia 3D",
    },

    // Progreso de carga (porcentajes)
    PROGRESS_STEPS: {
        LIBRARIES: 10,
        SCENE: 30,
        CONTROLS: 70,
        READY: 100,
    },

    // Configuración de estilos
    STYLES: {
        LOADING_BG:
            "linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)",
        PRIMARY_COLOR: "#00d4ff",
        SECONDARY_COLOR: "#64e6ff",
        ERROR_COLOR: "#ff4444",
    },

    // Configuración de rendimiento
    PERFORMANCE: {
        // Tamaño máximo del pool de proyectiles
        MAX_PROJECTILES: 50,
        // Límite de FPS
        MAX_FPS: 60,
        // Calidad de renderizado (0.5 - 2.0)
        PIXEL_RATIO_LIMIT: 2.0,
    },
};

// Función para obtener configuración según el dispositivo
export function getDeviceConfig() {
    const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
    const isLowEnd = navigator.hardwareConcurrency <= 4;

    if (isMobile || isLowEnd) {
        return {
            ...LazyLoadingConfig,
            PERFORMANCE: {
                ...LazyLoadingConfig.PERFORMANCE,
                MAX_PROJECTILES: 25,
                PIXEL_RATIO_LIMIT: 1.0,
            },
        };
    }

    return LazyLoadingConfig;
}

// Función para detectar conexión lenta
export function isSlowConnection() {
    if ("connection" in navigator) {
        const connection = navigator.connection;
        return (
            connection.effectiveType === "slow-2g" ||
            connection.effectiveType === "2g" ||
            connection.effectiveType === "3g"
        );
    }
    return false;
}

// Función para optimizar carga según conexión
export function getOptimizedConfig() {
    const deviceConfig = getDeviceConfig();
    const slowConnection = isSlowConnection();

    if (slowConnection) {
        return {
            ...deviceConfig,
            PERFORMANCE: {
                ...deviceConfig.PERFORMANCE,
                MAX_PROJECTILES: 15,
                PIXEL_RATIO_LIMIT: 0.75,
            },
        };
    }

    return deviceConfig;
}
