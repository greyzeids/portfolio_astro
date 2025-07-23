import * as THREE from "three";
import * as CANNON from "cannon-es";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import Navball from "./navball.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// --- Configuración Esencial ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
);
camera.position.z = 10;

// --- Optimización: Object Pooling para proyectiles ---
class ProjectilePool {
    constructor(maxSize = 50) {
        this.pool = [];
        this.activeProjectiles = [];
        this.maxSize = maxSize;
        this.texture = null;
        this.material = null;
        this.geometry = null;

        // Crear textura una sola vez
        this.texture = this.createEnergyBlastTexture();
        this.material = new THREE.SpriteMaterial({
            map: this.texture,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
        });
        this.geometry = new THREE.BufferGeometry();

        // Pre-crear objetos del pool
        for (let i = 0; i < maxSize; i++) {
            const visual = new THREE.Sprite(this.material.clone());
            const shape = new CANNON.Sphere(0.2);
            const body = new CANNON.Body({
                mass: 0.1,
                shape: shape,
                linearDamping: 0,
            });

            this.pool.push({ visual, body, active: false });
        }
    }

    createEnergyBlastTexture() {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext("2d");
        const gradient = context.createRadialGradient(
            canvas.width / 2,
            canvas.height / 2,
            0,
            canvas.width / 2,
            canvas.height / 2,
            canvas.width / 2
        );
        gradient.addColorStop(0.0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.2, "rgba(191, 255, 0, 1)");
        gradient.addColorStop(0.4, "rgba(64, 224, 208, 1)");
        gradient.addColorStop(1.0, "rgba(64, 224, 208, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        return new THREE.CanvasTexture(canvas);
    }

    get() {
        const projectile = this.pool.find((p) => !p.active);
        if (projectile) {
            projectile.active = true;
            this.activeProjectiles.push(projectile);
            return projectile;
        }
        return null;
    }

    release(projectile) {
        projectile.active = false;
        const index = this.activeProjectiles.indexOf(projectile);
        if (index > -1) {
            this.activeProjectiles.splice(index, 1);
        }
        if (projectile.visual.parent) {
            scene.remove(projectile.visual);
        }
        if (world.bodies.includes(projectile.body)) {
            world.removeBody(projectile.body);
        }
    }

    update() {
        // Limpiar proyectiles inactivos
        this.activeProjectiles = this.activeProjectiles.filter((projectile) => {
            if (projectile.active) {
                projectile.visual.position.copy(projectile.body.position);
                projectile.visual.quaternion.copy(projectile.body.quaternion);
                return true;
            }
            return false;
        });
    }
}

// --- Optimización: Frustum Culling ---
const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();

// --- Optimización: Geometrías y materiales compartidos ---
const sharedGeometries = {
    starGeometry: null,
    vortexGeometry: null,
};

const sharedMaterials = {
    starMaterial: null,
    vortexMaterial: null,
};

const keysPressed = {};
window.addEventListener("keydown", (event) => {
    keysPressed[event.code] = true;
});
window.addEventListener("keyup", (event) => {
    keysPressed[event.code] = false;
});
window.addEventListener("wheel", (event) => {
    cameraZoomLevel += event.deltaY * ZOOM_SENSITIVITY;
    cameraZoomLevel = THREE.MathUtils.clamp(
        cameraZoomLevel,
        MIN_ZOOM,
        MAX_ZOOM
    );
});

// --- Optimización: Renderer con configuración mejorada ---
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#bg"),
    antialias: false, // Desactivar antialiasing para mejor rendimiento
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limitar pixel ratio
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false; // Desactivar sombras si no las usas
renderer.autoClear = true;

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// --- Optimización: Bloom más eficiente ---
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.4, // Reducir strength
    0.3, // Reducir radius
    0.9 // Aumentar threshold
);
composer.addPass(bloomPass);

const world = new CANNON.World();
world.gravity.set(0, 0, 0);
const defaultMaterial = new CANNON.Material("default");
const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    { friction: 0.2, restitution: 0.1 }
);
world.addContactMaterial(defaultContactMaterial);

// --- Límites de la esfera de juego ---
const GAME_SPHERE_RADIUS = 600; // Reducido un 25%

function createGameBoundaries() {
    // Crear una esfera de colisión invisible como límite
    const boundaryShape = new CANNON.Sphere(GAME_SPHERE_RADIUS);
    const boundaryBody = new CANNON.Body({
        mass: 0, // Cuerpo estático
        shape: boundaryShape,
        material: defaultMaterial,
        collisionResponse: false, // No afecta la física, solo detecta colisiones
    });

    // Crear material de contacto específico para el límite
    const boundaryContactMaterial = new CANNON.ContactMaterial(
        defaultMaterial,
        defaultMaterial,
        {
            friction: 0.1,
            restitution: 0.8, // Rebote alto para efecto de "rebote" en los límites
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 3,
        }
    );
    world.addContactMaterial(boundaryContactMaterial);

    world.addBody(boundaryBody);

    console.log(
        `Límite esférico creado con radio ${GAME_SPHERE_RADIUS} unidades.`
    );

    // Opcional: Crear una esfera visual para debug (comentada por defecto)
    // const boundaryGeometry = new THREE.SphereGeometry(GAME_SPHERE_RADIUS, 32, 24);
    // const boundaryMaterial = new THREE.MeshBasicMaterial({
    //     color: 0xff0000,
    //     wireframe: true,
    //     transparent: true,
    //     opacity: 0.1
    // });
    // const boundaryMesh = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    // scene.add(boundaryMesh);
}

// --- Optimización: Luces más eficientes ---
// --- Luces mejoradas pero menos azuladas ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.38); // Blanco neutro
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xe0eaff, 2.2); // Mantener luz principal fría
directionalLight.position.set(10, 20, 15);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.bias = -0.0005;
scene.add(directionalLight);

// Luz de relleno cálida
const fillLight = new THREE.DirectionalLight(0xfff2cc, 0.5); // Blanco cálido
fillLight.position.set(-15, 10, 10);
scene.add(fillLight);

// Luz de fondo gris neutro
const backLight = new THREE.DirectionalLight(0x333333, 0.3);
backLight.position.set(0, -20, -20);
scene.add(backLight);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const loader = new GLTFLoader();
const clock = new THREE.Clock();

// --- Optimización: Pool de proyectiles ---
const projectilePool = new ProjectilePool(30);

// --- Variables para los satélites ---
let starLayers = [];
let poleVortexes = [];
let player = { visual: null, body: null, gimbal: null };
let techPlanet = null; // Variable para el planeta del tech-stack

// --- Variables para los objetos flotantes ---
const FLOATING_MODELS = [
    { name: "satellite", path: "/models/satellite.glb" },
    { name: "asteroid", path: "/models/asteroid.glb" },
    { name: "alien_ovni", path: "/models/alien_ovni.glb" },
    { name: "alien_jetpack", path: "/models/alien_jetpack.glb" },
    {
        name: "space_station",
        path: "/models/space_station.glb",
        outlineScale: 0.1,
    }, // Forzar halo pequeño
    { name: "astronaut", path: "/models/astronaut.glb" },
    { name: "spaceship", path: "/models/spaceship.glb" },
];
const FLOATING_INSTANCES = 3;
const floatingObjects = [];
const floatingModelsLoaded = {};

const MOVE_SPEED = 50,
    BOOST_MULTIPLIER = 3,
    ROTATION_SPEED = 2.5,
    ROLL_SPEED = 2,
    CAMERA_SMOOTH_SPEED = 0.04,
    CAMERA_LOOK_AT_SMOOTH_SPEED = 0.07,
    PHYSICS_INTERPOLATION_FACTOR = 0.15, // Reducido para suavizar más
    TILT_FORWARD_AMOUNT = 1.5,
    TILT_BACKWARD_AMOUNT = 0.25,
    BANK_AMOUNT = 0.5,
    VISUAL_SMOOTHING = 0.05,
    RETICLE_DISTANCE = 150,
    FIRE_RATE = 200, // Tiempo entre disparos en milisegundos
    LATERAL_DAMPING = 0.6, // Nuevo: damping específico para movimiento lateral
    CENTER_RETURN_FORCE = 3; // Reducido: fuerza más suave para volver al centro

let lastFireTime = 0;
let cameraZoomLevel = 2,
    MIN_ZOOM = 1,
    MAX_ZOOM = 25,
    ZOOM_SENSITIVITY = 0.005;
let cameraLookAtTarget = new THREE.Vector3(),
    targetPosition = new THREE.Vector3(),
    targetQuaternion = new THREE.Quaternion(),
    originalLinearDamping;

const crosshair = document.getElementById("crosshair-container"),
    speedIndicator = document.getElementById("speed-indicator"),
    altitudeIndicator = document.getElementById("altitude-indicator");

// --- Optimización: Audio con mejor gestión ---
const laserSound = new Audio("/sounds/plasma_gun.mp3");
laserSound.volume = 0.2;
laserSound.preload = "auto";

// --- Sonido de motor permanente ---
const ENGINE_VOLUME_NORMAL = 0.2;
const ENGINE_VOLUME_NITRO = 0.3;
const ENGINE_FADE_SPEED = 0.05;

const engineSound = new Audio("/sounds/engine.wav");
engineSound.loop = true;
engineSound.volume = 0; // Arranca en silencio
engineSound.preload = "auto";
let engineTargetVolume = 0; // Arranca en silencio
let engineShouldPlay = false;

// --- Sonido de nitro ---
const NITRO_VOLUME = 0.7; // <--- Modifica aquí el volumen máximo del nitro
const NITRO_FADE_SPEED = 0.05; // <--- Modifica aquí la velocidad del fade del nitro
const nitroSound = new Audio("/sounds/nitro.wav");
nitroSound.loop = true;
nitroSound.volume = 0;
nitroSound.preload = "auto";
let nitroTargetVolume = 0;
let nitroShouldPlay = false;

function updateEnginePlayback() {
    // Si alguna de las teclas WASD está presionada
    if (
        keysPressed["KeyW"] ||
        keysPressed["KeyA"] ||
        keysPressed["KeyS"] ||
        keysPressed["KeyD"]
    ) {
        if (!engineShouldPlay) {
            engineShouldPlay = true;
            engineSound.currentTime = 0;
            engineSound.play().catch(() => {});
        }
        engineTargetVolume = ENGINE_VOLUME_NORMAL;
    } else {
        if (engineShouldPlay) {
            engineShouldPlay = false;
            engineTargetVolume = 0;
        }
    }
}

window.addEventListener("keydown", (event) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        updateEnginePlayback();
    }
    if (
        (event.code === "ShiftLeft" || event.code === "ShiftRight") &&
        engineShouldPlay
    ) {
        if (!nitroShouldPlay) {
            nitroShouldPlay = true;
            nitroSound.currentTime = 0;
            nitroSound.play().catch(() => {});
        }
        nitroTargetVolume = NITRO_VOLUME;
    }
});
window.addEventListener("keyup", (event) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        updateEnginePlayback();
    }
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        nitroTargetVolume = 0;
        nitroShouldPlay = false;
    }
});

// Fade suave en el loop de animación principal para motor y nitro
function fadeEngineAndNitroVolume() {
    // Motor
    if (Math.abs(engineSound.volume - engineTargetVolume) > 0.01) {
        engineSound.volume +=
            (engineTargetVolume - engineSound.volume) * ENGINE_FADE_SPEED;
    } else {
        engineSound.volume = engineTargetVolume;
        if (engineSound.volume === 0 && !engineShouldPlay) {
            engineSound.pause();
            engineSound.currentTime = 0;
        }
    }
    // Nitro
    if (Math.abs(nitroSound.volume - nitroTargetVolume) > 0.01) {
        nitroSound.volume +=
            (nitroTargetVolume - nitroSound.volume) * NITRO_FADE_SPEED;
    } else {
        nitroSound.volume = nitroTargetVolume;
        if (nitroSound.volume === 0 && !nitroShouldPlay) {
            nitroSound.pause();
            nitroSound.currentTime = 0;
        }
    }
    requestAnimationFrame(fadeEngineAndNitroVolume);
}
fadeEngineAndNitroVolume();

function mapRange(value, in_min, in_max, out_min, out_max) {
    return (
        ((value - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min
    );
}

function loadPlayerModel() {
    return new Promise((resolve, reject) => {
        loader.load(
            "/models/mecha.glb",
            (gltf) => {
                console.log("Modelo de jugador cargado.");
                // --- Optimización: Optimizar geometrías del modelo ---
                gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                        child.geometry.computeBoundingSphere();
                        child.geometry.computeBoundingBox();
                        child.frustumCulled = true;
                    }
                });
                resolve(gltf.scene);
            },
            undefined,
            (error) => {
                console.error("Error cargando el modelo del jugador.", error);
                reject(error);
            }
        );
    });
}

async function loadFloatingModel(path, outlineScaleOverride, modelName) {
    return new Promise((resolve, reject) => {
        loader.load(
            path,
            (gltf) => {
                gltf.scene.traverse((child) => {
                    if (child.isMesh && !child.isOutline) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            child.material.emissive = new THREE.Color(0x222233);
                            child.material.emissiveIntensity = 0.45;
                        }
                        // (Eliminado: creación de outlineMesh para halo blanco)
                    }
                });
                resolve(gltf.scene);
            },
            undefined,
            (error) => {
                console.error(`Error cargando el modelo: ${path}`, error);
                reject(error);
            }
        );
    });
}

async function createFloatingObjects() {
    // Cargar todos los modelos una vez
    for (const model of FLOATING_MODELS) {
        floatingModelsLoaded[model.name] = await loadFloatingModel(
            model.path,
            model.outlineScale,
            model.name
        );
    }
    // Crear instancias flotantes
    for (const model of FLOATING_MODELS) {
        // Si es un asteroide, crear algunos en cadena y otros sueltos
        if (model.name === "asteroid") {
            // Número de cadenas aleatorio entre 2 y 4
            const numCadenas = 2 + Math.floor(Math.random() * 3);
            for (let c = 0; c < numCadenas; c++) {
                // Longitud de la cadena aleatoria entre 4 y 6
                const longitudCadena = 4 + Math.floor(Math.random() * 3);
                // Posición base aleatoria, pero lejos del centro
                const minR = 350; // Nuevo: radio mínimo para evitar el centro
                const maxR = GAME_SPHERE_RADIUS;
                let r = minR + Math.random() * (maxR - minR);
                let phi = Math.acos(2 * Math.random() - 1);
                let theta = 2 * Math.PI * Math.random();
                let basePos = new THREE.Vector3(
                    r * Math.sin(phi) * Math.cos(theta),
                    r * Math.sin(phi) * Math.sin(theta),
                    r * Math.cos(phi)
                );
                // Dirección aleatoria para la cadena
                let dir = new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                ).normalize();
                // Separación entre asteroides
                let separacion = 18 + Math.random() * 10;
                for (let j = 0; j < longitudCadena; j++) {
                    const base = floatingModelsLoaded[model.name].clone();
                    // Posición alineada
                    let pos = basePos
                        .clone()
                        .add(dir.clone().multiplyScalar(j * separacion));
                    base.position.copy(pos);
                    // Escala y rotación aleatoria
                    let scale = 0.7 + Math.random() * 0.4;
                    base.scale.set(scale, scale, scale);
                    base.rotation.y = Math.random() * Math.PI * 2;
                    // Movimiento orbital individual
                    floatingObjects.push({
                        mesh: base,
                        basePos: pos.clone(),
                        orbitRadius: 10 + Math.random() * 30,
                        orbitSpeed: 0.06 + Math.random() * 0.16,
                        orbitAngle: Math.random() * Math.PI * 2,
                        orbitAxis: new THREE.Vector3(
                            Math.random(),
                            Math.random(),
                            Math.random()
                        ).normalize(),
                        rotSpeed: 0.15 + Math.random() * 0.35,
                    });
                    scene.add(base);
                }
            }
            // El resto de asteroides sueltos
            for (let i = 0; i < FLOATING_INSTANCES; i++) {
                const base = floatingModelsLoaded[model.name].clone();
                // Posición aleatoria en toda la esfera de juego, pero lejos del centro
                const minR = 350; // Nuevo: radio mínimo para evitar el centro
                const maxR = GAME_SPHERE_RADIUS;
                const minDistance = 120;
                let position, r, phi, theta;
                let attempts = 0;
                do {
                    r = minR + Math.random() * (maxR - minR);
                    phi = Math.acos(2 * Math.random() - 1);
                    theta = 2 * Math.PI * Math.random();
                    position = new THREE.Vector3(
                        r * Math.sin(phi) * Math.cos(theta),
                        r * Math.sin(phi) * Math.sin(theta),
                        r * Math.cos(phi)
                    );
                    attempts++;
                } while (
                    floatingObjects.some(
                        (obj) =>
                            obj.mesh.position.distanceTo(position) < minDistance
                    ) &&
                    attempts < 20
                );
                base.position.copy(position);
                let scale = 0.7 + Math.random() * 0.4;
                base.scale.set(scale, scale, scale);
                base.rotation.y = Math.random() * Math.PI * 2;
                floatingObjects.push({
                    mesh: base,
                    basePos: base.position.clone(),
                    orbitRadius: 10 + Math.random() * 30,
                    orbitSpeed: 0.06 + Math.random() * 0.16,
                    orbitAngle: Math.random() * Math.PI * 2,
                    orbitAxis: new THREE.Vector3(
                        Math.random(),
                        Math.random(),
                        Math.random()
                    ).normalize(),
                    rotSpeed: 0.15 + Math.random() * 0.35,
                });
                scene.add(base);
            }
        } else {
            // Resto de modelos flotantes (no asteroides)
            for (let i = 0; i < FLOATING_INSTANCES; i++) {
                const base = floatingModelsLoaded[model.name].clone();
                // Posición aleatoria en toda la esfera de juego, pero con separación mínima
                const minR = 0;
                const maxR = GAME_SPHERE_RADIUS;
                const minDistance = 120;
                let position, r, phi, theta;
                let attempts = 0;
                do {
                    r = minR + Math.random() * (maxR - minR);
                    phi = Math.acos(2 * Math.random() - 1);
                    theta = 2 * Math.PI * Math.random();
                    position = new THREE.Vector3(
                        r * Math.sin(phi) * Math.cos(theta),
                        r * Math.sin(phi) * Math.sin(theta),
                        r * Math.cos(phi)
                    );
                    attempts++;
                } while (
                    floatingObjects.some(
                        (obj) =>
                            obj.mesh.position.distanceTo(position) < minDistance
                    ) &&
                    attempts < 20
                );
                base.position.copy(position);
                let scale = 0.7 + Math.random() * 0.4;
                if (model.name === "space_station") {
                    scale *= 3;
                }
                if (model.name === "alien_ovni") {
                    scale *= 10;
                }
                if (model.name === "alien_jetpack") {
                    scale *= 10 * 0.67; // 10x y luego reducir un 33%
                }
                base.scale.set(scale, scale, scale);
                base.rotation.y = Math.random() * Math.PI * 2;
                floatingObjects.push({
                    mesh: base,
                    basePos: base.position.clone(),
                    orbitRadius: 10 + Math.random() * 30,
                    orbitSpeed: 0.06 + Math.random() * 0.16,
                    orbitAngle: Math.random() * Math.PI * 2,
                    orbitAxis: new THREE.Vector3(
                        Math.random(),
                        Math.random(),
                        Math.random()
                    ).normalize(),
                    rotSpeed: 0.15 + Math.random() * 0.35,
                });
                scene.add(base);
            }
        }
    }
}

function loadTechPlanet() {
    return new Promise((resolve, reject) => {
        loader.load(
            "/models/planets/tech_planet.glb",
            (gltf) => {
                console.log("Planeta del tech-stack cargado.");
                // Eliminar el planeta anterior si existe
                if (techPlanet && techPlanet.parent) {
                    techPlanet.parent.remove(techPlanet);
                }
                techPlanet = gltf.scene;
                // Posición aleatoria dentro de la esfera de movimiento del mecha
                const minR = 100; // Puedes ajustar el mínimo si quieres que nunca esté muy cerca del centro
                const maxR = GAME_SPHERE_RADIUS - 20; // Margen de seguridad
                const r = minR + Math.random() * (maxR - minR);
                const phi = Math.acos(2 * Math.random() - 1); // Ángulo polar
                const theta = 2 * Math.PI * Math.random(); // Ángulo azimutal
                const x = r * Math.sin(phi) * Math.cos(theta);
                const y = r * Math.sin(phi) * Math.sin(theta);
                const z = r * Math.cos(phi);
                techPlanet.position.set(x, y, z);
                techPlanet.scale.set(9, 9, 9); // x10 más grande
                // Optimizar el modelo
                let boundingSphere = null;
                techPlanet.traverse((child) => {
                    if (child.isMesh) {
                        child.geometry.computeBoundingSphere();
                        child.geometry.computeBoundingBox();
                        child.frustumCulled = true;
                        if (
                            !boundingSphere ||
                            child.geometry.boundingSphere.radius >
                                boundingSphere.radius
                        ) {
                            boundingSphere =
                                child.geometry.boundingSphere.clone();
                            boundingSphere.applyMatrix4(child.matrixWorld);
                        }
                    }
                });
                scene.add(techPlanet);
                // --- Crear cuerpo físico para el planeta ---
                if (boundingSphere) {
                    let planetRadius = boundingSphere.radius * 1.3; // Aumentar un 30%
                    if (techPlanet.body) {
                        world.removeBody(techPlanet.body);
                    }
                    const planetShape = new CANNON.Sphere(planetRadius);
                    techPlanet.body = new CANNON.Body({
                        mass: 0, // Estático
                        shape: planetShape,
                        position: new CANNON.Vec3(x, y, z),
                    });
                    world.addBody(techPlanet.body);
                    console.log(
                        `Cuerpo físico del planeta creado (radio: ${planetRadius.toFixed(
                            2
                        )})`
                    );
                }
                console.log(
                    "Planeta del tech-stack añadido a la escena en posición:",
                    techPlanet.position
                );
                resolve(techPlanet);
            },
            undefined,
            (error) => {
                console.error(
                    "Error cargando el planeta del tech-stack.",
                    error
                );
                reject(error);
            }
        );
    });
}

const navball = new Navball();

// --- Utilidad para extraer un Trimesh de un modelo Three.js ---
function createTrimeshFromModel(model) {
    // Unir todos los vértices y caras de las mallas hijas
    let vertices = [];
    let indices = [];
    let offset = 0;
    model.traverse((child) => {
        if (
            child.isMesh &&
            child.geometry &&
            child.geometry.attributes.position
        ) {
            const pos = child.geometry.attributes.position;
            const index = child.geometry.index;
            // Añadir vértices
            for (let i = 0; i < pos.count; i++) {
                vertices.push(pos.getX(i), pos.getY(i), pos.getZ(i));
            }
            // Añadir índices
            if (index) {
                for (let i = 0; i < index.count; i++) {
                    indices.push(index.getX(i) + offset);
                }
            } else {
                // Si no hay índice, usar orden secuencial
                for (let i = 0; i < pos.count; i++) {
                    indices.push(offset + i);
                }
            }
            offset += pos.count;
        }
    });
    if (vertices.length === 0 || indices.length === 0) {
        console.warn("No se pudo crear Trimesh: modelo sin geometría válida");
        return null;
    }
    return new CANNON.Trimesh(
        Float32Array.from(vertices),
        Uint16Array.from(indices)
    );
}

async function initializeScene() {
    console.log("Inicializando escena...");

    createGalacticBackground();
    createStarLayers();
    createGameBoundaries(); // Crear límites de la esfera de juego

    navball.init();

    try {
        const modelScene = await loadPlayerModel();
        const planetScene = await loadTechPlanet(); // Cargar el planeta
        // --- Cargar y crear objetos flotantes ---
        await createFloatingObjects();

        player.visual = new THREE.Group();
        player.gimbal = new THREE.Group();
        player.visual.add(player.gimbal);
        player.gimbal.add(modelScene);
        player.visual.scale.set(0.5, 0.5, 0.5);
        player.visual.rotation.y = Math.PI;
        scene.add(player.visual);

        // --- Calcular boundingSphere del mecha para el hitbox ---
        let boundingSphereMecha = null;
        modelScene.traverse((child) => {
            if (child.isMesh) {
                if (!child.geometry.boundingSphere)
                    child.geometry.computeBoundingSphere();
                if (child.geometry.boundingSphere) {
                    // Tomar la esfera más grande encontrada
                    if (
                        !boundingSphereMecha ||
                        child.geometry.boundingSphere.radius >
                            boundingSphereMecha.radius
                    ) {
                        boundingSphereMecha =
                            child.geometry.boundingSphere.clone();
                        boundingSphereMecha.applyMatrix4(child.matrixWorld);
                    }
                }
            }
        });
        let mechaRadius = 0.8; // Valor por defecto
        if (boundingSphereMecha) {
            mechaRadius = boundingSphereMecha.radius * player.visual.scale.x;
        }
        const playerShape = new CANNON.Sphere(mechaRadius);
        const initialCannonQuaternion = new CANNON.Quaternion();
        initialCannonQuaternion.setFromEuler(
            player.visual.rotation.x,
            player.visual.rotation.y,
            player.visual.rotation.z
        );
        player.body = new CANNON.Body({
            mass: 5,
            shape: playerShape,
            position: new CANNON.Vec3(0, 0, 0),
            quaternion: initialCannonQuaternion,
            linearDamping: 0.5, // Aumentado para más suavidad
            angularDamping: 0.8,
        });
        world.addBody(player.body);
        cameraLookAtTarget.copy(player.visual.position);
        originalLinearDamping = player.body.linearDamping;
        console.log(
            `Jugador creado en la escena y en el mundo físico (colisión: esfera, radio: ${mechaRadius.toFixed(
                2
            )})`
        );
        // --- Ajustar hitbox de modelos flotantes al tamaño real ---
        for (const obj of floatingObjects) {
            let boundingSphere = null;
            obj.mesh.traverse((child) => {
                if (child.isMesh) {
                    if (!child.geometry.boundingSphere)
                        child.geometry.computeBoundingSphere();
                    if (child.geometry.boundingSphere) {
                        if (
                            !boundingSphere ||
                            child.geometry.boundingSphere.radius >
                                boundingSphere.radius
                        ) {
                            boundingSphere =
                                child.geometry.boundingSphere.clone();
                            boundingSphere.applyMatrix4(child.matrixWorld);
                        }
                    }
                }
            });
            obj.collisionRadius = boundingSphere ? boundingSphere.radius : 1.0;
        }
        animate();
    } catch (error) {
        console.error("No se pudo inicializar la escena.", error);
    }
}

function createGalacticBackground() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load("/textures/galaxy_background.jpg", (texture) => {
        // --- Optimización: Geometría más eficiente ---
        const skySphereGeo = new THREE.SphereGeometry(1000, 32, 24); // Reducir segmentos

        const skySphereMat = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.BackSide,
            emissive: 0xffffff,
            emissiveIntensity: 0.1,
            emissiveMap: texture,
            roughness: 1,
            metalness: 0,
        });

        const skySphere = new THREE.Mesh(skySphereGeo, skySphereMat);
        skySphere.frustumCulled = false; // No cullear el skybox
        scene.add(skySphere);
        console.log("Skysphere optimizada creada.");
    });
}

// --- Añadir variables para el efecto de parpadeo de estrellas ---
let twinkleStarIndices = [];
let twinkleStarTimers = [];
const TWINKLE_PERCENTAGE = 0.25; // Solo el 25% de las estrellas lejanas pueden parpadear
const TWINKLE_COUNT = Math.floor(1200 * TWINKLE_PERCENTAGE); // 1200 es el número de estrellas lejanas
const TWINKLE_MIN = 0.3; // Opacidad mínima
const TWINKLE_MAX = 1.0; // Opacidad máxima
const TWINKLE_SPEED = 1.5; // Velocidad de parpadeo
const FLASH_INTERVAL = 3.5; // Segundos entre flashes fuertes
let flashTimer = 0;
let flashStarIndex = -1;
let flashDuration = 0.5; // Duración del flash fuerte
let flashElapsed = 0;

// --- Modificar createStarLayers para inicializar estrellas parpadeantes ---
function createStarLayers() {
    const layerConfigs = [
        { count: 1200, size: 0.25, distance: 900 }, // Estrellas lejanas
        { count: 800, size: 0.4, distance: 600 }, // Estrellas medias
        { count: 400, size: 0.6, distance: 300 }, // Estrellas cercanas
    ];

    // --- Optimización: Crear geometría compartida para estrellas ---
    const starVertices = [];
    layerConfigs.forEach((config) => {
        for (let i = 0; i < config.count; i++) {
            // Distribuir estrellas en una esfera completa
            const phi = Math.acos(2 * Math.random() - 1); // Ángulo polar
            const theta = 2 * Math.PI * Math.random(); // Ángulo azimutal
            const radius = config.distance + Math.random() * 100; // Radio con variación

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            starVertices.push(x, y, z);
        }
    });

    sharedGeometries.starGeometry = new THREE.BufferGeometry();
    sharedGeometries.starGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(starVertices, 3)
    );

    layerConfigs.forEach((config, index) => {
        const startIndex = layerConfigs
            .slice(0, index)
            .reduce((sum, cfg) => sum + cfg.count, 0);
        const endIndex = startIndex + config.count;

        // Crear geometría específica para esta capa
        const layerGeometry = new THREE.BufferGeometry();
        const layerVertices = starVertices.slice(startIndex * 3, endIndex * 3);
        layerGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(layerVertices, 3)
        );

        sharedMaterials.starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: config.size,
            sizeAttenuation: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            opacity: 1.0,
            depthWrite: false,
        });

        const stars = new THREE.Points(
            layerGeometry,
            sharedMaterials.starMaterial.clone()
        );
        stars.frustumCulled = false; // Las estrellas siempre visibles
        scene.add(stars);
        starLayers.push(stars);
    });
    console.log(
        `${layerConfigs.length} capas de estrellas optimizadas creadas.`
    );

    // --- Inicializar estrellas parpadeantes solo en la capa más lejana ---
    const farStars = starLayers[0];
    const farCount = layerConfigs[0].count;
    twinkleStarIndices = [];
    twinkleStarTimers = [];
    // Solo el 50% de las estrellas lejanas pueden parpadear
    const twinklePool = [];
    for (let i = 0; i < farCount; i++) twinklePool.push(i);
    for (let i = 0; i < TWINKLE_COUNT; i++) {
        const idx = twinklePool.splice(
            Math.floor(Math.random() * twinklePool.length),
            1
        )[0];
        twinkleStarIndices.push(idx);
        twinkleStarTimers.push(Math.random() * Math.PI * 2);
    }
    // Inicializar flash
    flashTimer = 0;
    flashStarIndex = -1;
    flashElapsed = 0;
}

function createPoleVortexes() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load("/textures/vortex.png", (texture) => {
        // --- Optimización: Geometría compartida ---
        sharedGeometries.vortexGeometry = new THREE.PlaneGeometry(
            450,
            450,
            1,
            1
        );

        sharedMaterials.vortexMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            blending: THREE.NormalBlending,
            transparent: true,
            depthWrite: false,
        });

        // Vórtice del Polo Norte
        const northVortex = new THREE.Mesh(
            sharedGeometries.vortexGeometry,
            sharedMaterials.vortexMaterial
        );
        northVortex.position.set(0, 700, 0);
        northVortex.rotation.x = Math.PI / 2;
        northVortex.frustumCulled = false; // Siempre visible
        scene.add(northVortex);
        poleVortexes.push(northVortex);

        // Vórtice del Polo Sur
        const southVortex = new THREE.Mesh(
            sharedGeometries.vortexGeometry,
            sharedMaterials.vortexMaterial
        );
        southVortex.position.set(0, -700, 0);
        southVortex.rotation.x = -Math.PI / 2;
        southVortex.frustumCulled = false; // Siempre visible
        scene.add(southVortex);
        poleVortexes.push(southVortex);

        console.log("Vórtices polares optimizados creados.");
    });
}

function fireProjectile() {
    const projectile = projectilePool.get();
    if (!projectile) return; // Pool lleno

    const laser = new Audio("/sounds/plasma_gun.mp3");
    laser.volume = 0.2;
    laser.currentTime = 0;
    laser.play();

    projectile.visual.scale.set(1, 1, 1);

    // --- NUEVO: Disparar hacia donde apunta la mira/cursor ---
    // 1. Obtener posición de la mira/cursor en NDC
    const ndcX = (mouseScreenX / window.innerWidth) * 2 - 1;
    const ndcY = -(mouseScreenY / window.innerHeight) * 2 + 1;
    // 2. Crear un Raycaster desde la cámara
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    // 3. Dirección en el mundo
    const direction = raycaster.ray.direction.clone().normalize();
    // 4. Posición inicial del proyectil (ligeramente delante del jugador)
    const startPosition = player.body.position.clone();
    const offset = new CANNON.Vec3(direction.x, direction.y, direction.z).scale(
        1.5
    );
    startPosition.vadd(offset, startPosition);
    projectile.body.position.copy(startPosition);
    // 5. Velocidad del proyectil en esa dirección
    const projectileSpeed = 150;
    projectile.body.velocity = new CANNON.Vec3(
        direction.x,
        direction.y,
        direction.z
    ).scale(projectileSpeed);
    // 6. Orientación visual del proyectil
    const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        direction
    );
    projectile.visual.quaternion.copy(quat);

    scene.add(projectile.visual);
    world.addBody(projectile.body);

    // Limpiar después de 3 segundos
    setTimeout(() => {
        projectilePool.release(projectile);
    }, 3000);
}

// --- Añadir función para comprobar colisión de esferas ---
function checkSphereCollision(pos, radius, objects) {
    for (const obj of objects) {
        if (!obj.mesh) continue;
        const objRadius = obj.collisionRadius || 1.0;
        // Calcular centro del modelo
        let center = new THREE.Vector3();
        let found = false;
        obj.mesh.traverse((child) => {
            if (
                child.isMesh &&
                child.geometry &&
                child.geometry.boundingSphere
            ) {
                const sphere = child.geometry.boundingSphere.clone();
                sphere.applyMatrix4(child.matrixWorld);
                center.copy(sphere.center);
                found = true;
            }
        });
        if (!found) center.copy(obj.mesh.position);
        const dist = pos.distanceTo(center);
        if (dist < radius + objRadius + 0.1) {
            return { collided: true, object: obj };
        }
    }
    return { collided: false };
}

// --- Añadir función para comprobar colisión con techPlanet ---
function checkTechPlanetCollision(pos, radius) {
    if (!techPlanet) return { collided: false };
    let boundingSphere = null;
    techPlanet.traverse((child) => {
        if (child.isMesh && child.geometry && child.geometry.boundingSphere) {
            boundingSphere = child.geometry.boundingSphere.clone();
            boundingSphere.applyMatrix4(child.matrixWorld);
        }
    });
    if (boundingSphere) {
        const dist = pos.distanceTo(boundingSphere.center);
        if (dist < radius + boundingSphere.radius) {
            return { collided: true, boundingSphere };
        }
    }
    return { collided: false };
}

// --- Animación planetaria ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // --- Animar objetos flotantes ---
    floatingObjects.forEach((obj) => {
        // Movimiento orbital suave alrededor de su base
        obj.orbitAngle += obj.orbitSpeed * deltaTime;
        const axis = obj.orbitAxis;
        const q = new THREE.Quaternion().setFromAxisAngle(axis, obj.orbitAngle);
        const offset = new THREE.Vector3(obj.orbitRadius, 0, 0).applyQuaternion(
            q
        );
        obj.mesh.position.copy(obj.basePos).add(offset);
        // Rotación propia
        obj.mesh.rotation.y += obj.rotSpeed * deltaTime;
    });

    // --- NUEVO: Rotar el planeta del tech-stack lentamente ---
    if (techPlanet) {
        techPlanet.rotation.y += 0.12 * deltaTime; // velocidad lenta
        techPlanet.rotation.x += 0.02 * deltaTime; // leve inclinación
    }

    // --- NUEVO: Ejecutar animación de viaje si está activa ---
    if (window.TRAVEL_ANIMATION) {
        window.TRAVEL_ANIMATION(deltaTime);
    }

    // --- Optimización: Frustum culling ---
    projScreenMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    if (deltaTime > 0) {
        world.step(1 / 60, deltaTime, 3);
    }

    // --- Optimización: Animaciones más eficientes ---
    starLayers.forEach((layer, index) => {
        const rotationSpeed = 0.01 * (index + 1) * deltaTime;
        layer.rotation.y -= rotationSpeed * 0.1;
        layer.rotation.x -= rotationSpeed * 0.05;
    });

    // --- Optimización: Actualizar pool de proyectiles ---
    projectilePool.update();

    if (player.body) {
        // --- NUEVO: Desactivar controles durante viaje automático ---
        if (window.PLAYER_CONTROLS_DISABLED) {
            // Saltar todo el procesamiento de controles si están desactivados
        } else {
            // --- Verificar límites de la esfera de juego ---
            const distanceFromCenter = player.body.position.length();
            if (distanceFromCenter > GAME_SPHERE_RADIUS - 2) {
                // Empujar hacia el centro si está muy cerca del límite
                const pushDirection = player.body.position.clone();
                pushDirection.normalize();
                pushDirection.scale(-150, pushDirection); // Fuerza hacia el centro (aumentada de 50 a 150)
                player.body.applyForce(pushDirection, CANNON.Vec3.ZERO);
            }

            // --- Lógica de colisión suave antes de aplicar fuerzas ---
            const mechaRadius = 0.8 * player.visual.scale.x;
            const directions = [
                {
                    key: "KeyW",
                    vec: new THREE.Vector3(0, 0, -1),
                    force: new CANNON.Vec3(0, 0, MOVE_SPEED),
                },
                {
                    key: "KeyA",
                    vec: new THREE.Vector3(-1, 0, 0),
                    force: new CANNON.Vec3(MOVE_SPEED, 0, 0),
                },
                {
                    key: "KeyD",
                    vec: new THREE.Vector3(1, 0, 0),
                    force: new CANNON.Vec3(-MOVE_SPEED, 0, 0),
                },
                {
                    key: "Space",
                    vec: new THREE.Vector3(0, 1, 0),
                    force: new CANNON.Vec3(0, MOVE_SPEED, 0),
                },
                {
                    key: "ControlLeft",
                    vec: new THREE.Vector3(0, -1, 0),
                    force: new CANNON.Vec3(0, -MOVE_SPEED, 0),
                },
                // --- Intercambio: ahora S es atrás lento, X es atrás rápido ---
            ];
            const moveStep = MOVE_SPEED * deltaTime * 0.5;
            // --- BOOST: Si Shift está presionado, multiplicar la velocidad ---
            const boostActive =
                keysPressed["ShiftLeft"] || keysPressed["ShiftRight"];
            const currentMoveSpeed = boostActive
                ? MOVE_SPEED * BOOST_MULTIPLIER
                : MOVE_SPEED;
            const boostedMoveStep = currentMoveSpeed * deltaTime * 0.5;
            for (const dir of directions) {
                if (keysPressed[dir.key]) {
                    const q = new THREE.Quaternion();
                    player.visual.getWorldQuaternion(q);
                    const localDir = dir.vec
                        .clone()
                        .applyQuaternion(q)
                        .normalize();
                    const tentativePos = new THREE.Vector3(
                        player.body.position.x,
                        player.body.position.y,
                        player.body.position.z
                    ).add(localDir.clone().multiplyScalar(boostedMoveStep));
                    const col1 = checkSphereCollision(
                        tentativePos,
                        mechaRadius,
                        floatingObjects
                    );
                    const col2 = checkTechPlanetCollision(
                        tentativePos,
                        mechaRadius
                    );
                    if (!(col1.collided || col2.collided)) {
                        // --- BOOST: aplicar fuerza aumentada si Shift está activo ---
                        const force = boostActive
                            ? dir.force.scale(BOOST_MULTIPLIER)
                            : dir.force;
                        player.body.applyLocalForce(force, CANNON.Vec3.ZERO);
                    }
                }
            }
            // Movimiento hacia atrás y damping lateral
            // --- Intercambio: ahora X es el que aplica damping fuerte (antes era S) ---
            if (keysPressed["KeyX"]) {
                player.body.linearDamping = 0.95;
            } else {
                player.body.linearDamping = originalLinearDamping;
            }
            // Lateral damping para A/D
            if (keysPressed["KeyA"] || keysPressed["KeyD"]) {
                const lateralVelocity = player.body.velocity.x;
                if (Math.abs(lateralVelocity) > 0.1) {
                    const dampingForce = new CANNON.Vec3(
                        -lateralVelocity * LATERAL_DAMPING,
                        0,
                        0
                    );
                    player.body.applyForce(dampingForce, CANNON.Vec3.ZERO);
                }
            } else {
                const lateralVelocity = player.body.velocity.x;
                if (Math.abs(lateralVelocity) > 0.5) {
                    const returnForce = new CANNON.Vec3(
                        -lateralVelocity * CENTER_RETURN_FORCE,
                        0,
                        0
                    );
                    player.body.applyForce(returnForce, CANNON.Vec3.ZERO);
                }
            }
            // --- Intercambio: ahora S es atrás lento, X es atrás rápido ---
            if (keysPressed["KeyS"]) {
                player.body.applyLocalForce(
                    new CANNON.Vec3(0, 0, -MOVE_SPEED / 2),
                    CANNON.Vec3.ZERO
                );
            }
            // Disparo
            if (keysPressed["Enter"] && Date.now() - lastFireTime > FIRE_RATE) {
                fireProjectile();
                lastFireTime = Date.now();
            }
            // Permitir disparar con el click izquierdo del ratón
            if (
                keysPressed["MouseLeft"] &&
                Date.now() - lastFireTime > FIRE_RATE
            ) {
                fireProjectile();
                lastFireTime = Date.now();
            }
            // --- Control de rotación por mouse FPS ---
            if (isMouseInitialized) {
                // Construir quaternion a partir de mouseYaw y mousePitch
                const q = new THREE.Quaternion();
                q.setFromEuler(new THREE.Euler(mousePitch, mouseYaw, 0, "YXZ"));
                player.body.quaternion.copy(q);
            }
            // --- Lógica de teclado de rotación (sigue funcionando, pero el mouse tiene prioridad)
            // Si quieres que ambos sumen, puedes combinar los valores en vez de sobrescribir
        }

        if (speedIndicator && altitudeIndicator) {
            const currentSpeed = player.body.velocity.length();
            const maxSpeed = MOVE_SPEED * 1.5;
            const speedPosition = mapRange(currentSpeed, 0, maxSpeed, 280, 0);
            speedIndicator.style.top = `${Math.max(
                0,
                Math.min(280, speedPosition)
            )}px`;

            const currentAltitude = player.body.position.y;
            const maxAltitude = 100;
            const altitudePosition = mapRange(
                currentAltitude,
                -maxAltitude,
                maxAltitude,
                280,
                0
            );
            altitudeIndicator.style.top = `${Math.max(
                0,
                Math.min(280, altitudePosition)
            )}px`;
        }
    }

    if (player.visual && player.body) {
        targetPosition.copy(player.body.position);
        targetQuaternion.copy(player.body.quaternion);

        // --- Interpolación mejorada con suavizado específico para movimiento lateral ---
        const currentLateralVelocity = Math.abs(player.body.velocity.x);
        const lateralInterpolationFactor =
            currentLateralVelocity > 1
                ? PHYSICS_INTERPOLATION_FACTOR * 0.8 // Más suave cuando hay movimiento lateral
                : PHYSICS_INTERPOLATION_FACTOR;

        player.visual.position.lerp(targetPosition, lateralInterpolationFactor);
        player.visual.quaternion.slerp(
            targetQuaternion,
            PHYSICS_INTERPOLATION_FACTOR
        );
        navball.update(player.visual.quaternion);
    }

    if (player.gimbal) {
        let targetTilt = 0;
        if (keysPressed["KeyW"]) {
            targetTilt = TILT_FORWARD_AMOUNT;
        } else if (keysPressed["KeyS"] || keysPressed["KeyX"]) {
            targetTilt = -TILT_BACKWARD_AMOUNT;
        }
        let targetBank = 0;
        if (keysPressed["KeyQ"]) {
            targetBank = -BANK_AMOUNT;
        } else if (keysPressed["KeyE"]) {
            targetBank = BANK_AMOUNT;
        }
        player.gimbal.rotation.x = THREE.MathUtils.lerp(
            player.gimbal.rotation.x,
            targetTilt,
            VISUAL_SMOOTHING
        );
        player.gimbal.rotation.z = THREE.MathUtils.lerp(
            player.gimbal.rotation.z,
            targetBank,
            VISUAL_SMOOTHING
        );
    }

    if (player.visual) {
        const cameraOffset = new THREE.Vector3(0, 0, -cameraZoomLevel);
        cameraOffset.applyQuaternion(player.visual.quaternion);
        const targetCameraPosition = player.visual.position
            .clone()
            .add(cameraOffset);
        camera.position.lerp(targetCameraPosition, CAMERA_SMOOTH_SPEED);
        cameraLookAtTarget.lerp(
            player.visual.position,
            CAMERA_LOOK_AT_SMOOTH_SPEED
        );
        camera.lookAt(cameraLookAtTarget);
    }

    // --- Apuntar el mecha hacia donde está la mira (puntero libre) ---
    if (player.body && camera) {
        // Convertir la posición del mouse en un rayo en el mundo 3D
        const mouseNDC = new THREE.Vector2(
            (mouseScreenX / window.innerWidth) * 2 - 1,
            -(mouseScreenY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouseNDC, camera);
        // Apuntar a un punto lejano en la dirección del rayo
        const targetPoint = raycaster.ray.origin
            .clone()
            .add(
                raycaster.ray.direction.clone().multiplyScalar(RETICLE_DISTANCE)
            );
        // Calcular la rotación necesaria para mirar a ese punto
        const mechaPos = player.body.position;
        const lookDir = new THREE.Vector3(
            targetPoint.x - mechaPos.x,
            targetPoint.y - mechaPos.y,
            targetPoint.z - mechaPos.z
        ).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            lookDir
        );
        // Interpolar hacia la rotación objetivo para un giro más rápido pero suave
        const ROTATE_TO_RETICLE_SPEED = 0.25; // Aumenta este valor para girar aún más rápido (0.0-1.0)
        player.body.quaternion.slerp(quat, ROTATE_TO_RETICLE_SPEED);
    }

    // --- Elimina el bloque que actualiza la mira visual según la orientación del jugador en el bucle de animación ---
    // if (player.visual && crosshair) {
    //     const reticleTargetPosition = new THREE.Vector3(
    //         0,
    //         0,
    //         -RETICLE_DISTANCE
    //     );
    //     player.visual.localToWorld(reticleTargetPosition);
    //     reticleTargetPosition.project(camera);
    //     const x = (reticleTargetPosition.x * 0.5 + 0.5) * window.innerWidth;
    //     const y = (reticleTargetPosition.y * -0.5 + 0.5) * window.innerHeight;
    //     crosshair.style.transform = `translate(-50%, -50%)`;
    //     crosshair.style.left = `${x}px`;
    //     crosshair.style.top = `${y}px`;
    // }

    composer.render();
    navball.render();

    // --- Efecto de parpadeo y brillo en las estrellas lejanas ---
    if (starLayers.length > 0) {
        const farStars = starLayers[0];
        const positions = farStars.geometry.getAttribute("position");
        let sizes = farStars.geometry.getAttribute("size");
        if (!sizes) {
            // Crear atributo de tamaño si no existe
            const arr = new Float32Array(positions.count);
            arr.fill(farStars.material.size);
            sizes = new THREE.BufferAttribute(arr, 1);
            farStars.geometry.setAttribute("size", sizes);
        }
        // --- Parpadeo normal ---
        for (let i = 0; i < TWINKLE_COUNT; i++) {
            const idx = twinkleStarIndices[i];
            twinkleStarTimers[i] +=
                deltaTime * TWINKLE_SPEED * (0.7 + Math.random() * 0.6);
            // Parpadeo suave seno
            let twinkle =
                TWINKLE_MIN +
                (TWINKLE_MAX - TWINKLE_MIN) *
                    (0.5 + 0.5 * Math.sin(twinkleStarTimers[i]));
            let baseSize = farStars.material.size;
            // --- Flash fuerte ---
            if (idx === flashStarIndex && flashElapsed > 0) {
                // Brillo mucho más intenso
                twinkle = 1.0;
                baseSize = farStars.material.size * 2.5;
            }
            sizes.setX(idx, baseSize * (0.8 + 0.7 * twinkle));
        }
        sizes.needsUpdate = true;
        // Simular parpadeo global cambiando la opacidad del material levemente
        farStars.material.opacity = 0.85 + 0.15 * Math.sin(elapsedTime * 0.3);
        // --- Lógica de flash fuerte aleatorio ---
        flashTimer += deltaTime;
        if (flashElapsed > 0) {
            flashElapsed -= deltaTime;
            if (flashElapsed <= 0) {
                flashStarIndex = -1;
            }
        }
        if (flashTimer > FLASH_INTERVAL) {
            flashTimer = 0;
            flashElapsed = flashDuration;
            // Elegir una estrella aleatoria del grupo de parpadeo
            flashStarIndex =
                twinkleStarIndices[Math.floor(Math.random() * TWINKLE_COUNT)];
        }
    }
}

// --- Función principal de inicialización ---
async function initThreeExperience() {
    try {
        console.log("🎮 Inicializando experiencia 3D...");
        await initializeScene();

        // --- Optimización: Debounce para resize ---
        let resizeTimeout;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                composer.setSize(window.innerWidth, window.innerHeight);
            }, 100);
        });

        console.log("✅ Experiencia 3D inicializada correctamente");
        return true;
    } catch (error) {
        console.error("❌ Error inicializando experiencia 3D:", error);
        throw error;
    }
}

// --- Exportar la función para lazy loading ---
export default initThreeExperience;

// --- Inicialización automática para compatibilidad ---
// Solo se ejecuta si no se está usando lazy loading
if (typeof window !== "undefined" && !window.THREE_LAZY_LOADING) {
    initThreeExperience();
}

// --- NUEVO: Animación automática del mecha hacia el planeta del tech-stack ---

/**
 * Obtiene la posición actual del planeta del tech-stack.
 * @returns {THREE.Vector3} Posición del planeta o posición por defecto si no está cargado.
 */
window.getTechPlanetPosition = function () {
    if (techPlanet) {
        return {
            x: techPlanet.position.x,
            y: techPlanet.position.y,
            z: techPlanet.position.z,
        };
    }
    // Posición por defecto si el planeta no está cargado
    return { x: 20, y: 0, z: -30 };
};

/**
 * Mueve el mecha automáticamente hasta la posición del planeta del tech-stack.
 * @param {THREE.Vector3} planetPosition - Posición destino del planeta.
 * @param {Function} onArrive - Callback a ejecutar al llegar.
 */
window.movePlayerToTechPlanet = function (planetPosition, onArrive) {
    if (!player.body || !player.visual) return;

    const travelDuration = 5.0; // duración del viaje en segundos (más lento)
    let travelTime = 0;
    let isTraveling = true;

    // Guardar estado original
    const startPosition = new THREE.Vector3(
        player.body.position.x,
        player.body.position.y,
        player.body.position.z
    );
    const endPosition = new THREE.Vector3(
        planetPosition.x,
        planetPosition.y,
        planetPosition.z
    );
    // Calcular puntos de control para una curva Bézier cúbica espectacular
    const p0 = startPosition.clone();
    const p3 = endPosition.clone();
    // Punto de control 1: un poco delante del mecha, con desviación lateral
    const dir = endPosition.clone().sub(startPosition).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const lateral = right.multiplyScalar(
        (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 12)
    );
    const p1 = startPosition
        .clone()
        .add(dir.clone().multiplyScalar(30))
        .add(lateral);
    // Punto de control 2: cerca del planeta, con otra desviación
    const right2 = new THREE.Vector3().crossVectors(dir, up).normalize();
    const lateral2 = right2.multiplyScalar(
        (Math.random() > 0.5 ? 1 : -1) * (12 + Math.random() * 10)
    );
    const p2 = endPosition
        .clone()
        .add(dir.clone().multiplyScalar(-30))
        .add(lateral2);
    // Guardar estado de cámara para lag
    let cameraLagPos = null;

    // Desactivar controles y física durante el viaje
    window.PLAYER_CONTROLS_DISABLED = true;
    player.body.linearDamping = 1.0;
    player.body.angularDamping = 1.0;
    player.body.velocity.set(0, 0, 0);
    player.body.angularVelocity.set(0, 0, 0);

    // Guardar posición y zoom inicial de la cámara
    const cameraFixed = camera.position.clone();
    const cameraFixedZ = camera.position.z;

    // Guardar offset de cámara respecto al mecha
    const cameraOffset = new THREE.Vector3(0, 4, 12); // 12 detrás, 4 arriba

    // Función de interpolación que se ejecutará en cada frame
    window.TRAVEL_ANIMATION = function (deltaTime) {
        if (!isTraveling || !player.body) return;
        travelTime += deltaTime;
        // Aceleración/desaceleración tipo shoot em up
        const t = Math.min(travelTime / travelDuration, 1.0);
        const easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        // Bézier cúbica
        const bezier = p0
            .clone()
            .multiplyScalar(Math.pow(1 - easedT, 3))
            .add(
                p1.clone().multiplyScalar(3 * Math.pow(1 - easedT, 2) * easedT)
            )
            .add(
                p2
                    .clone()
                    .multiplyScalar(3 * (1 - easedT) * Math.pow(easedT, 2))
            )
            .add(p3.clone().multiplyScalar(Math.pow(easedT, 3)));
        player.body.position.copy(bezier);
        // Dirección tangente a la curva (para cámara y mecha)
        const direction = p3.clone().sub(bezier).normalize();
        // Banking dinámico
        const bezierDeriv = p1
            .clone()
            .sub(p0)
            .multiplyScalar(3 * Math.pow(1 - easedT, 2))
            .add(
                p2
                    .clone()
                    .sub(p1)
                    .multiplyScalar(6 * (1 - easedT) * easedT)
            )
            .add(
                p3
                    .clone()
                    .sub(p2)
                    .multiplyScalar(3 * Math.pow(easedT, 2))
            );
        const banking = Math.atan2(bezierDeriv.x, bezierDeriv.z) * 0.7;
        // Rotar el mecha para mirar y hacer banking
        if (player.visual) {
            const quaternion = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                direction
            );
            player.visual.quaternion.slerp(quaternion, 0.18);
            player.visual.rotation.z = banking;
        }
        // Cámara siempre detrás y arriba del mecha, mirando al mecha (o un poco delante)
        const camDistance = 14;
        const camHeight = 4;
        // Offset en el sistema local del mecha
        const camOffsetLocal = new THREE.Vector3(0, camHeight, -camDistance);
        const camOffsetWorld = camOffsetLocal.applyQuaternion(
            player.visual.quaternion
        );
        const camTarget = bezier.clone().add(camOffsetWorld);
        camera.position.copy(camTarget);
        // Mirar un poco delante del mecha para dar sensación de velocidad
        const lookAhead = bezier
            .clone()
            .add(direction.clone().multiplyScalar(8));
        camera.lookAt(lookAhead);
        // Verificar si llegó
        if (t >= 1.0) {
            window.PLAYER_CONTROLS_DISABLED = false;
            window.TRAVEL_ANIMATION = null;
            player.body.linearDamping = 0.5;
            player.body.angularDamping = 0.8;
            isTraveling = false;
            if (typeof onArrive === "function") onArrive();
        }
    };
};

/**
 * Devuelve una posición enfrente del planeta a una distancia dada.
 * @param {number} distance - Distancia desde el centro del planeta.
 * @returns {{x:number, y:number, z:number}}
 */
window.getTechPlanetFrontPosition = function (distance = 8) {
    if (!techPlanet) return { x: 0, y: 0, z: 0 };
    // Vector desde el centro de la escena al planeta
    const planetPos = techPlanet.position.clone();
    const dir = planetPos.clone().normalize();
    // Posición a 'distance' unidades antes de llegar al planeta
    const frontPos = planetPos.clone().addScaledVector(dir, -distance);
    return { x: frontPos.x, y: frontPos.y, z: frontPos.z };
};

// --- Variables para control de mouse FPS ---
let mouseYaw = 0; // Rotación horizontal acumulada
let mousePitch = 0; // Rotación vertical acumulada
const PITCH_LIMIT = Math.PI / 2 - 0.1; // Límite para evitar volteretas
const MOUSE_SENSITIVITY = 0.0025; // Ajusta la sensibilidad aquí
let isMouseInitialized = false;

// --- Variables para control de puntero libre ---
let mouseScreenX = window.innerWidth / 2;
let mouseScreenY = window.innerHeight / 2;

window.addEventListener("mousemove", (event) => {
    // Solo si el canvas está visible
    const canvas = document.getElementById("bg");
    if (!canvas || canvas.style.display === "none") return;
    mouseScreenX = event.clientX;
    mouseScreenY = event.clientY;
    // --- NUEVO: Actualizar la posición de la mira visual ---
    const crosshair = document.getElementById("crosshair-container");
    if (crosshair) {
        crosshair.style.transform = `translate(-50%, -50%)`;
        crosshair.style.left = `${mouseScreenX}px`;
        crosshair.style.top = `${mouseScreenY}px`;
    }
});

document.addEventListener("mousedown", (event) => {
    if (event.button === 2 && Date.now() - lastFireTime > FIRE_RATE) {
        fireProjectile();
        lastFireTime = Date.now();
    }
});

function onMouseMove(event) {
    // Solo si el canvas está visible
    const canvas = document.getElementById("bg");
    if (!canvas || canvas.style.display === "none") return;
    // Inicializar valores al primer movimiento
    if (!isMouseInitialized && player.visual) {
        // Obtener rotación inicial del mecha
        const euler = new THREE.Euler().setFromQuaternion(
            player.visual.quaternion,
            "YXZ"
        );
        mouseYaw = euler.y;
        mousePitch = euler.x;
        isMouseInitialized = true;
    }
    // Movimiento relativo
    mouseYaw -= event.movementX * MOUSE_SENSITIVITY;
    mousePitch += event.movementY * MOUSE_SENSITIVITY; // <--- Invertido aquí
    // Limitar el pitch
    mousePitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, mousePitch));
}
window.addEventListener("mousemove", onMouseMove);
