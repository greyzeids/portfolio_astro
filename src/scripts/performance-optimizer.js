// Módulo de optimización de rendimiento para Three.js
export class PerformanceOptimizer {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 60;
        this.targetFps = 60;
        this.qualityLevel = "high"; // 'low', 'medium', 'high'
        this.adaptiveQuality = true;

        // Configuraciones de calidad
        this.qualitySettings = {
            low: {
                pixelRatio: 0.5,
                antialias: false,
                bloomStrength: 0.2,
                bloomRadius: 0.2,
                starCount: 0.3,
                shadowMap: false,
                maxProjectiles: 10,
            },
            medium: {
                pixelRatio: 0.75,
                antialias: false,
                bloomStrength: 0.3,
                bloomRadius: 0.25,
                starCount: 0.6,
                shadowMap: false,
                maxProjectiles: 20,
            },
            high: {
                pixelRatio: 1.0,
                antialias: false,
                bloomStrength: 0.4,
                bloomRadius: 0.3,
                starCount: 1.0,
                shadowMap: false,
                maxProjectiles: 30,
            },
        };
    }

    // Monitoreo de FPS
    updateFPS() {
        this.frameCount++;
        const currentTime = performance.now();

        if (currentTime - this.lastTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastTime = currentTime;

            // Ajuste adaptativo de calidad
            if (this.adaptiveQuality) {
                this.adjustQuality();
            }
        }
    }

    // Ajuste automático de calidad basado en FPS
    adjustQuality() {
        if (this.fps < 30 && this.qualityLevel !== "low") {
            this.setQualityLevel("low");
        } else if (this.fps < 45 && this.qualityLevel === "high") {
            this.setQualityLevel("medium");
        } else if (this.fps > 55 && this.qualityLevel === "low") {
            this.setQualityLevel("medium");
        } else if (this.fps > 55 && this.qualityLevel === "medium") {
            this.setQualityLevel("high");
        }
    }

    // Establecer nivel de calidad manualmente
    setQualityLevel(level) {
        if (this.qualitySettings[level]) {
            this.qualityLevel = level;
            console.log(`Calidad ajustada a: ${level}`);
            return this.qualitySettings[level];
        }
        return null;
    }

    // Obtener configuración actual
    getCurrentSettings() {
        return this.qualitySettings[this.qualityLevel];
    }

    // Optimización de geometrías
    optimizeGeometry(geometry) {
        if (geometry.attributes.position) {
            geometry.computeBoundingSphere();
            geometry.computeBoundingBox();
        }

        // Disposal de geometrías no utilizadas
        geometry.dispose();
    }

    // Optimización de materiales
    optimizeMaterial(material) {
        // Configuraciones para mejor rendimiento
        material.precision = "mediump";
        material.needsUpdate = true;
    }

    // LOD (Level of Detail) para objetos
    createLOD(object, distances = [50, 100, 200]) {
        const lod = new THREE.LOD();

        // Crear diferentes niveles de detalle
        distances.forEach((distance, index) => {
            const clone = object.clone();

            // Reducir complejidad para niveles más lejanos
            if (index > 0) {
                clone.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        // Simplificar geometría para niveles más lejanos
                        const simplifiedGeometry = this.simplifyGeometry(
                            child.geometry,
                            1 - index * 0.3
                        );
                        child.geometry.dispose();
                        child.geometry = simplifiedGeometry;
                    }
                });
            }

            lod.addLevel(clone, distance);
        });

        return lod;
    }

    // Simplificar geometría
    simplifyGeometry(geometry, quality = 0.5) {
        // Implementación básica de simplificación
        // En un caso real, usarías THREE.SimplifyModifier
        return geometry;
    }

    // Culling avanzado
    setupCulling(camera, scene) {
        const frustum = new THREE.Frustum();
        const projScreenMatrix = new THREE.Matrix4();

        return () => {
            projScreenMatrix.multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse
            );
            frustum.setFromProjectionMatrix(projScreenMatrix);

            scene.traverse((object) => {
                if (object.isMesh && object.geometry) {
                    const boundingSphere = object.geometry.boundingSphere;
                    if (boundingSphere) {
                        object.visible = frustum.containsSphere(boundingSphere);
                    }
                }
            });
        };
    }

    // Gestión de memoria
    disposeObject(object) {
        if (object.geometry) {
            object.geometry.dispose();
        }

        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach((material) =>
                    this.disposeMaterial(material)
                );
            } else {
                this.disposeMaterial(object.material);
            }
        }

        if (object.texture) {
            object.texture.dispose();
        }
    }

    disposeMaterial(material) {
        Object.keys(material).forEach((prop) => {
            if (!material[prop]) return;
            if (material[prop].isTexture) {
                material[prop].dispose();
            }
        });
        material.dispose();
    }

    // Pool de objetos optimizado
    createObjectPool(createFunction, maxSize = 50) {
        const pool = [];
        const active = [];

        return {
            get: () => {
                let object = pool.pop();
                if (!object) {
                    object = createFunction();
                }
                active.push(object);
                return object;
            },

            release: (object) => {
                const index = active.indexOf(object);
                if (index > -1) {
                    active.splice(index, 1);
                    if (pool.length < maxSize) {
                        pool.push(object);
                    } else {
                        this.disposeObject(object);
                    }
                }
            },

            clear: () => {
                active.forEach((object) => this.disposeObject(object));
                pool.forEach((object) => this.disposeObject(object));
                active.length = 0;
                pool.length = 0;
            },
        };
    }

    // Optimización de texturas
    optimizeTexture(texture) {
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.format = THREE.RGBFormat;
        texture.type = THREE.UnsignedByteType;
    }

    // Compresión de texturas
    async compressTexture(texture, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            canvas.width = texture.image.width;
            canvas.height = texture.image.height;

            ctx.drawImage(texture.image, 0, 0);

            canvas.toBlob(
                (blob) => {
                    const url = URL.createObjectURL(blob);
                    const newTexture = new THREE.TextureLoader().load(url);
                    this.optimizeTexture(newTexture);
                    resolve(newTexture);
                },
                "image/jpeg",
                quality
            );
        });
    }

    // Estadísticas de rendimiento
    getStats() {
        return {
            fps: this.fps,
            qualityLevel: this.qualityLevel,
            memory: performance.memory
                ? {
                      used: performance.memory.usedJSHeapSize,
                      total: performance.memory.totalJSHeapSize,
                      limit: performance.memory.jsHeapSizeLimit,
                  }
                : null,
        };
    }

    // Limpieza de memoria
    cleanup() {
        // Forzar garbage collection si está disponible
        if (window.gc) {
            window.gc();
        }
    }
}

// Utilidades de optimización
export const OptimizationUtils = {
    // Throttle para funciones costosas
    throttle(func, limit) {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    },

    // Debounce para eventos frecuentes
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Interpolación suave
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    },

    // Clamp de valores
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
};
