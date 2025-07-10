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
const GAME_SPHERE_RADIUS = 800; // Radio de la esfera de juego (menor que el skybox)

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
const ambientLight = new THREE.AmbientLight(0x203040, 0.25);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5); // Reducir intensidad
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

const loader = new GLTFLoader();
const clock = new THREE.Clock();

// --- Optimización: Pool de proyectiles ---
const projectilePool = new ProjectilePool(30);

let starLayers = [];
let poleVortexes = [];
let player = { visual: null, body: null, gimbal: null };

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

const navball = new Navball();

async function initializeScene() {
    console.log("Inicializando escena...");

    createGalacticBackground();
    createStarLayers();
    createPoleVortexes();
    createGameBoundaries(); // Crear límites de la esfera de juego

    navball.init();

    try {
        const modelScene = await loadPlayerModel();
        player.visual = new THREE.Group();
        player.gimbal = new THREE.Group();
        player.visual.add(player.gimbal);
        player.gimbal.add(modelScene);
        player.visual.scale.set(0.5, 0.5, 0.5);
        player.visual.rotation.y = Math.PI;
        scene.add(player.visual);

        const playerShape = new CANNON.Sphere(0.8);
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
        console.log("Jugador creado en la escena y en el mundo físico.");
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
        });

        const stars = new THREE.Points(
            layerGeometry,
            sharedMaterials.starMaterial
        );
        stars.frustumCulled = false; // Las estrellas siempre visibles
        scene.add(stars);
        starLayers.push(stars);
    });
    console.log(
        `${layerConfigs.length} capas de estrellas optimizadas creadas.`
    );
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

    const soundClone = laserSound.cloneNode();
    soundClone.volume = laserSound.volume;
    soundClone.play();

    projectile.visual.scale.set(1, 1, 1);
    projectile.body.quaternion.copy(player.body.quaternion);

    const startPosition = player.body.position.clone();
    const forward = player.body.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
    startPosition.vadd(forward.scale(1.5), startPosition);
    projectile.body.position.copy(startPosition);

    const projectileSpeed = 150;
    projectile.body.velocity = forward.scale(projectileSpeed);

    scene.add(projectile.visual);
    world.addBody(projectile.body);

    // Limpiar después de 3 segundos
    setTimeout(() => {
        projectilePool.release(projectile);
    }, 3000);
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

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

    poleVortexes.forEach((vortex) => {
        vortex.rotation.z += 0.005;
    });

    // --- Optimización: Actualizar pool de proyectiles ---
    projectilePool.update();

    if (player.body) {
        // --- Verificar límites de la esfera de juego ---
        const distanceFromCenter = player.body.position.length();
        if (distanceFromCenter > GAME_SPHERE_RADIUS - 2) {
            // Empujar hacia el centro si está muy cerca del límite
            const pushDirection = player.body.position.clone();
            pushDirection.normalize();
            pushDirection.scale(-150, pushDirection); // Fuerza hacia el centro (aumentada de 50 a 150)
            player.body.applyForce(pushDirection, CANNON.Vec3.ZERO);
        }

        const currentMoveSpeed = keysPressed["ShiftLeft"]
            ? MOVE_SPEED * BOOST_MULTIPLIER
            : MOVE_SPEED;

        // --- Optimización: Reducir creación de objetos ---
        const forwardForce = new CANNON.Vec3(0, 0, currentMoveSpeed);
        const leftForce = new CANNON.Vec3(currentMoveSpeed, 0, 0);
        const rightForce = new CANNON.Vec3(-currentMoveSpeed, 0, 0);
        const upForce = new CANNON.Vec3(0, currentMoveSpeed, 0);
        const downForce = new CANNON.Vec3(0, -currentMoveSpeed, 0);
        const backwardForce = new CANNON.Vec3(0, 0, -MOVE_SPEED / 2);

        if (keysPressed["KeyW"]) {
            player.body.applyLocalForce(forwardForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["KeyS"]) {
            player.body.linearDamping = 0.95;
        } else {
            player.body.linearDamping = originalLinearDamping;
        }
        // --- Suavizado específico para movimiento lateral ---
        if (keysPressed["KeyA"]) {
            player.body.applyLocalForce(leftForce, CANNON.Vec3.ZERO);
            // Aplicar damping específico para movimiento lateral
            const lateralVelocity = player.body.velocity.x;
            if (Math.abs(lateralVelocity) > 0.1) {
                const dampingForce = new CANNON.Vec3(
                    -lateralVelocity * LATERAL_DAMPING,
                    0,
                    0
                );
                player.body.applyForce(dampingForce, CANNON.Vec3.ZERO);
            }
        } else if (keysPressed["KeyD"]) {
            player.body.applyLocalForce(rightForce, CANNON.Vec3.ZERO);
            // Aplicar damping específico para movimiento lateral
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
            // Cuando no se presionan A ni D, aplicar fuerza suave hacia el centro
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
        if (keysPressed["Space"]) {
            player.body.applyLocalForce(upForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["ControlLeft"]) {
            player.body.applyLocalForce(downForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["KeyX"]) {
            player.body.applyLocalForce(backwardForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["Enter"] && Date.now() - lastFireTime > FIRE_RATE) {
            fireProjectile();
            lastFireTime = Date.now();
        }

        const forwardVector = player.body.quaternion.vmult(
            new CANNON.Vec3(0, 0, 1)
        );
        const worldUp = new CANNON.Vec3(0, 1, 0);
        const dot = forwardVector.dot(worldUp);
        const localAngularVelocity = new CANNON.Vec3(0, 0, 0);

        if (keysPressed["ArrowUp"]) {
            if (dot < 0.9) localAngularVelocity.x = -ROTATION_SPEED;
        } else if (keysPressed["ArrowDown"]) {
            if (dot > -0.9) localAngularVelocity.x = ROTATION_SPEED;
        }
        if (keysPressed["ArrowLeft"]) localAngularVelocity.y = ROTATION_SPEED;
        else if (keysPressed["ArrowRight"])
            localAngularVelocity.y = -ROTATION_SPEED;
        if (keysPressed["KeyQ"]) localAngularVelocity.z = -ROLL_SPEED;
        else if (keysPressed["KeyE"]) localAngularVelocity.z = ROLL_SPEED;

        const worldAngularVelocity =
            player.body.quaternion.vmult(localAngularVelocity);
        player.body.angularVelocity.copy(worldAngularVelocity);

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
        } else if (keysPressed["KeyX"] || keysPressed["KeyS"]) {
            targetTilt = -TILT_BACKWARD_AMOUNT;
        }
        let targetBank = 0;
        if (keysPressed["ArrowLeft"]) {
            targetBank = BANK_AMOUNT;
        } else if (keysPressed["ArrowRight"]) {
            targetBank = -BANK_AMOUNT;
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

    if (player.visual && crosshair) {
        const reticleTargetPosition = new THREE.Vector3(
            0,
            0,
            -RETICLE_DISTANCE
        );
        player.visual.localToWorld(reticleTargetPosition);
        reticleTargetPosition.project(camera);
        const x = (reticleTargetPosition.x * 0.5 + 0.5) * window.innerWidth;
        const y = (reticleTargetPosition.y * -0.5 + 0.5) * window.innerHeight;
        crosshair.style.transform = `translate(-50%, -50%)`;
        crosshair.style.left = `${x}px`;
        crosshair.style.top = `${y}px`;
    }

    composer.render();
    navball.render();
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
