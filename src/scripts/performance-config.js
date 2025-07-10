// Configuración de optimización de rendimiento
export const PerformanceConfig = {
    // Configuraciones generales
    general: {
        enableAdaptiveQuality: true,
        targetFPS: 60,
        maxFPS: 120,
        enableStats: true,
        enableMemoryMonitoring: true,
    },

    // Configuraciones del renderer
    renderer: {
        antialias: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
        alpha: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        logarithmicDepthBuffer: false,
        maxPixelRatio: 2.0,
    },

    // Configuraciones de calidad por nivel
    qualityLevels: {
        low: {
            name: "Baja",
            pixelRatio: 0.5,
            antialias: false,
            bloomStrength: 0.2,
            bloomRadius: 0.2,
            bloomThreshold: 0.95,
            starCount: 0.3,
            maxProjectiles: 10,
            enableShadows: false,
            enablePostProcessing: false,
            geometrySegments: 0.5,
            textureQuality: 0.5,
        },
        medium: {
            name: "Media",
            pixelRatio: 0.75,
            antialias: false,
            bloomStrength: 0.3,
            bloomRadius: 0.25,
            bloomThreshold: 0.9,
            starCount: 0.6,
            maxProjectiles: 20,
            enableShadows: false,
            enablePostProcessing: true,
            geometrySegments: 0.75,
            textureQuality: 0.75,
        },
        high: {
            name: "Alta",
            pixelRatio: 1.0,
            antialias: false,
            bloomStrength: 0.4,
            bloomRadius: 0.3,
            bloomThreshold: 0.85,
            starCount: 1.0,
            maxProjectiles: 30,
            enableShadows: false,
            enablePostProcessing: true,
            geometrySegments: 1.0,
            textureQuality: 1.0,
        },
    },

    // Configuraciones de física
    physics: {
        enableInterpolation: true,
        interpolationFactor: 0.3,
        maxSubSteps: 3,
        fixedTimeStep: 1 / 60,
        enableDebug: false,
    },

    // Configuraciones de audio
    audio: {
        enableSpatialAudio: false,
        maxConcurrentSounds: 5,
        preloadAudio: true,
        audioFormat: "mp3",
    },

    // Configuraciones de culling
    culling: {
        enableFrustumCulling: true,
        enableOcclusionCulling: false,
        cullingDistance: 1000,
        updateInterval: 1000, // ms
    },

    // Configuraciones de memoria
    memory: {
        enableObjectPooling: true,
        maxPoolSize: 50,
        enableTextureCompression: true,
        textureCompressionQuality: 0.8,
        enableGeometryOptimization: true,
        cleanupInterval: 30000, // ms
    },

    // Configuraciones de LOD (Level of Detail)
    lod: {
        enableLOD: true,
        distances: [50, 100, 200],
        qualityReduction: 0.3,
    },

    // Configuraciones de texturas
    textures: {
        generateMipmaps: false,
        minFilter: "LinearFilter",
        magFilter: "LinearFilter",
        format: "RGBFormat",
        type: "UnsignedByteType",
        compression: "JPEG",
        maxSize: 2048,
    },

    // Configuraciones de geometrías
    geometries: {
        enableBoundingBox: true,
        enableBoundingSphere: true,
        optimizeOnLoad: true,
        mergeVertices: true,
    },

    // Configuraciones de materiales
    materials: {
        precision: "mediump",
        enableShadows: false,
        enableFog: false,
        enableTransparency: true,
    },

    // Configuraciones de luces
    lights: {
        maxLights: 4,
        enableShadows: false,
        shadowMapSize: 1024,
        shadowBias: -0.0001,
    },

    // Configuraciones de partículas
    particles: {
        maxParticles: 1000,
        enableGPU: false,
        batchSize: 100,
    },

    // Configuraciones de post-procesamiento
    postProcessing: {
        enableBloom: true,
        enableFXAA: false,
        enableSSAO: false,
        enableDOF: false,
        enableMotionBlur: false,
    },

    // Configuraciones de debug
    debug: {
        enableStats: false,
        enableWireframe: false,
        enableBoundingBoxes: false,
        enableNormals: false,
        enableAxes: false,
    },
};

// Funciones de utilidad para la configuración
export const ConfigUtils = {
    // Obtener configuración por nivel de calidad
    getQualityConfig(level) {
        return (
            PerformanceConfig.qualityLevels[level] ||
            PerformanceConfig.qualityLevels.medium
        );
    },

    // Aplicar configuración al renderer
    applyRendererConfig(renderer, config) {
        renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, config.pixelRatio)
        );
        renderer.shadowMap.enabled = config.enableShadows;

        if (config.enableShadows) {
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.shadowMap.size = PerformanceConfig.lights.shadowMapSize;
        }
    },

    // Aplicar configuración de bloom
    applyBloomConfig(bloomPass, config) {
        bloomPass.strength = config.bloomStrength;
        bloomPass.radius = config.bloomRadius;
        bloomPass.threshold = config.bloomThreshold;
    },

    // Verificar si el dispositivo es móvil
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
    },

    // Verificar capacidades del dispositivo
    getDeviceCapabilities() {
        const canvas = document.createElement("canvas");
        const gl =
            canvas.getContext("webgl") ||
            canvas.getContext("experimental-webgl");

        if (!gl) {
            return {
                webgl: false,
                maxTextureSize: 0,
                maxAnisotropy: 0,
            };
        }

        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const maxAnisotropy =
            gl.getParameter(gl.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1;

        return {
            webgl: true,
            maxTextureSize: maxTextureSize,
            maxAnisotropy: maxAnisotropy,
            isMobile: this.isMobile(),
        };
    },

    // Obtener configuración optimizada para el dispositivo
    getOptimizedConfig() {
        const capabilities = this.getDeviceCapabilities();

        if (!capabilities.webgl) {
            return PerformanceConfig.qualityLevels.low;
        }

        if (capabilities.isMobile) {
            return PerformanceConfig.qualityLevels.low;
        }

        // Ajustar según las capacidades del dispositivo
        if (capabilities.maxTextureSize < 2048) {
            const config = { ...PerformanceConfig.qualityLevels.medium };
            config.textureQuality = 0.5;
            return config;
        }

        return PerformanceConfig.qualityLevels.high;
    },
};
