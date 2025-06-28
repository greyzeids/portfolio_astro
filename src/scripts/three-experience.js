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

// ... (El resto de listeners de teclado y rueda del ratón no cambian) ...
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

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#bg"),
    antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// renderer.toneMapping = THREE.NoToneMapping;

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.6, // strength: La fuerza del resplandor
    0.5, // radius: El radio del resplandor
    0.8 // threshold: Qué tan brillante debe ser un píxel para empezar a brillar
);
composer.addPass(bloomPass);

// ... (La configuración de CANNON y las luces no cambia) ...
const world = new CANNON.World();
world.gravity.set(0, 0, 0);
const defaultMaterial = new CANNON.Material("default");
const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    { friction: 0.2, restitution: 0.1 }
);
world.addContactMaterial(defaultContactMaterial);
const ambientLight = new THREE.AmbientLight(0x203040, 0.25);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

const loader = new GLTFLoader();
const clock = new THREE.Clock();

// --- ¡NUEVO! Array para guardar nuestras capas de estrellas ---
let starLayers = [];

let player = { visual: null, body: null, gimbal: null };

// ... (El resto de constantes, variables y elementos del DOM no cambian) ...
const MOVE_SPEED = 50,
    BOOST_MULTIPLIER = 3,
    ROTATION_SPEED = 2.5,
    ROLL_SPEED = 2,
    CAMERA_SMOOTH_SPEED = 0.04,
    CAMERA_LOOK_AT_SMOOTH_SPEED = 0.07,
    PHYSICS_INTERPOLATION_FACTOR = 0.3,
    TILT_AMOUNT = 0.25,
    BANK_AMOUNT = 0.5,
    VISUAL_SMOOTHING = 0.05,
    RETICLE_DISTANCE = 150;
const projectiles = [],
    FIRE_RATE = 200;
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
const laserSound = new Audio("/sounds/plasma_gun.mp3");
laserSound.volume = 0.2;
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
    // --- ¡NUEVO! Llamamos a la función que crea las capas de estrellas ---
    createStarLayers();

    navball.init();

    // ... (El resto de la función para cargar el modelo no cambia) ...
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
            linearDamping: 0.3,
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
    textureLoader.load(
        "/textures/galaxy_background.jpg", // Tu imagen de alta calidad
        (texture) => {
            const skySphereGeo = new THREE.SphereGeometry(1000, 60, 40);

            // Usamos un material estándar para tener más control
            const skySphereMat = new THREE.MeshStandardMaterial({
                map: texture,
                side: THREE.BackSide,
                emissive: 0xffffff, // Hacemos que la textura brille
                emissiveIntensity: 0.1, // Controlamos cuánto brilla
                emissiveMap: texture, // Hacemos que solo las partes con textura brillen
                roughness: 1, // Sin reflejos especulares
                metalness: 0, // No metálico
            });

            const skySphere = new THREE.Mesh(skySphereGeo, skySphereMat);
            scene.add(skySphere);
            console.log("Skysphere con material emisivo creada.");
        }
    );
}

// ========================================================================
// ¡NUEVA FUNCIÓN MEJORADA! - Crea capas de estrellas para efecto parallax
// ========================================================================
function createStarLayers() {
    const layerConfigs = [
        { count: 1500, size: 0.25, distance: 300 }, // Capa lejana
        { count: 1000, size: 0.4, distance: 200 }, // Capa media
        { count: 500, size: 0.6, distance: 100 }, // Capa cercana
    ];

    layerConfigs.forEach((config) => {
        const starVertices = [];
        for (let i = 0; i < config.count; i++) {
            const x = THREE.MathUtils.randFloatSpread(config.distance * 2);
            const y = THREE.MathUtils.randFloatSpread(config.distance * 2);
            const z = THREE.MathUtils.randFloatSpread(config.distance * 2);
            starVertices.push(x, y, z);
        }

        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(starVertices, 3)
        );

        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: config.size,
            sizeAttenuation: true, // El tamaño de la partícula cambia con la distancia
            transparent: true,
            blending: THREE.AdditiveBlending, // Efecto de brillo bonito al superponerse
        });

        const stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(stars);
        starLayers.push(stars); // Guardamos la capa para animarla
    });
    console.log(
        `${layerConfigs.length} capas de estrellas creadas para efecto parallax.`
    );
}

// ... (Las funciones createEnergyBlastTexture y fireProjectile no cambian) ...
function createEnergyBlastTexture() {
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
function fireProjectile() {
    const soundClone = laserSound.cloneNode();
    soundClone.volume = laserSound.volume;
    soundClone.play();
    const projectileTexture = createEnergyBlastTexture();
    const projectileMaterial = new THREE.SpriteMaterial({
        map: projectileTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
    });
    const projectileVisual = new THREE.Sprite(projectileMaterial);
    projectileVisual.scale.set(1, 1, 1);
    const projectileShape = new CANNON.Sphere(0.2);
    const projectileBody = new CANNON.Body({
        mass: 0.1,
        shape: projectileShape,
        linearDamping: 0,
    });
    projectileBody.quaternion.copy(player.body.quaternion);
    const startPosition = player.body.position.clone();
    const forward = player.body.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
    startPosition.vadd(forward.scale(1.5), startPosition);
    projectileBody.position.copy(startPosition);
    const projectileSpeed = 150;
    projectileBody.velocity = forward.scale(projectileSpeed);
    scene.add(projectileVisual);
    world.addBody(projectileBody);
    projectiles.push({ visual: projectileVisual, body: projectileBody });
    setTimeout(() => {
        if (projectileVisual.parent) scene.remove(projectileVisual);
        world.removeBody(projectileBody);
        const index = projectiles.findIndex((p) => p.body === projectileBody);
        if (index > -1) projectiles.splice(index, 1);
    }, 3000);
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    if (deltaTime > 0) {
        world.step(1 / 60, deltaTime, 3);
    }

    // Hacemos que roten lentamente a diferentes velocidades para simular movimiento
    starLayers.forEach((layer, index) => {
        // La velocidad de rotación depende de la capa (índice)
        const rotationSpeed = 0.01 * (index + 1) * deltaTime;
        layer.rotation.y -= rotationSpeed * 0.1; // Rotación sutil
        layer.rotation.x -= rotationSpeed * 0.05;
    });

    // ... (El resto del bucle de animación para el jugador, HUD, cámara, etc., no cambia) ...
    if (player.body) {
        const currentMoveSpeed = keysPressed["ShiftLeft"]
            ? MOVE_SPEED * BOOST_MULTIPLIER
            : MOVE_SPEED;
        if (keysPressed["KeyW"]) {
            const forwardForce = new CANNON.Vec3(0, 0, currentMoveSpeed);
            player.body.applyLocalForce(forwardForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["KeyS"]) {
            player.body.linearDamping = 0.95;
        } else {
            player.body.linearDamping = originalLinearDamping;
        }
        if (keysPressed["KeyA"]) {
            const leftForce = new CANNON.Vec3(currentMoveSpeed, 0, 0);
            player.body.applyLocalForce(leftForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["KeyD"]) {
            const rightForce = new CANNON.Vec3(-currentMoveSpeed, 0, 0);
            player.body.applyLocalForce(rightForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["Space"]) {
            const upForce = new CANNON.Vec3(0, currentMoveSpeed, 0);
            player.body.applyLocalForce(upForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["ControlLeft"]) {
            const downForce = new CANNON.Vec3(0, -currentMoveSpeed, 0);
            player.body.applyLocalForce(downForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["KeyX"]) {
            const backwardForce = new CANNON.Vec3(0, 0, -MOVE_SPEED / 2);
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
            if (dot < 0.7) localAngularVelocity.x = -ROTATION_SPEED;
        } else if (keysPressed["ArrowDown"]) {
            if (dot > -0.7) localAngularVelocity.x = ROTATION_SPEED;
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
        player.visual.position.lerp(
            targetPosition,
            PHYSICS_INTERPOLATION_FACTOR
        );
        player.visual.quaternion.slerp(
            targetQuaternion,
            PHYSICS_INTERPOLATION_FACTOR
        );
        navball.update(player.visual.quaternion);
    }
    if (player.gimbal) {
        let targetTilt = 0;
        if (keysPressed["KeyW"]) {
            targetTilt = TILT_AMOUNT;
        } else if (keysPressed["KeyX"] || keysPressed["KeyS"]) {
            targetTilt = -TILT_AMOUNT;
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
    for (const projectile of projectiles) {
        projectile.visual.position.copy(projectile.body.position);
        projectile.visual.quaternion.copy(projectile.body.quaternion);
    }

    composer.render();
    navball.render();
}

initializeScene();

window.addEventListener("resize", () => {
    // ... las líneas para la cámara y el renderer no cambian ...
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // ¡NUEVO! Actualiza el tamaño del composer
    composer.setSize(window.innerWidth, window.innerHeight);
});
