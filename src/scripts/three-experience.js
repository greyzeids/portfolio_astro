import * as THREE from "three";
import * as CANNON from "cannon-es";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// --- Configuración Esencial de Three.js ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 10;

const keysPressed = {};
window.addEventListener("keydown", (event) => {
    keysPressed[event.code] = true;
});
window.addEventListener("keyup", (event) => {
    keysPressed[event.code] = false;
});

// --- EVENT LISTENER PARA EL ZOOM CON LA RUEDA DEL RATÓN ---
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
renderer.setClearColor(0x000033);

// --- Configuración del Mundo Físico (Cannon-es) ---
const world = new CANNON.World();
world.gravity.set(0, 0, 0);
const defaultMaterial = new CANNON.Material("default");
const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 0.2,
        restitution: 0.1,
    }
);
world.addContactMaterial(defaultContactMaterial);

// --- Iluminación ---
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

const loader = new GLTFLoader();
const clock = new THREE.Clock();

let player = {
    visual: null,
    body: null,
    gimbal: null,
};

// --- CONSTANTES Y VARIABLES ---
const MOVE_SPEED = 50;
const BOOST_MULTIPLIER = 3;
const ROTATION_SPEED = 2.5;
const ROLL_SPEED = 2;
const CAMERA_SMOOTH_SPEED = 0.04;
const CAMERA_LOOK_AT_SMOOTH_SPEED = 0.07;
const PHYSICS_INTERPOLATION_FACTOR = 0.3;
const TILT_AMOUNT = 0.25;
const BANK_AMOUNT = 0.5;
const VISUAL_SMOOTHING = 0.05;
const RETICLE_DISTANCE = 150;
const projectiles = [];
const FIRE_RATE = 200;
let lastFireTime = 0;

// --- Variables para el Zoom ---
let cameraZoomLevel = 2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 25;
const ZOOM_SENSITIVITY = 0.005;

let cameraLookAtTarget = new THREE.Vector3();
const targetPosition = new THREE.Vector3();
const targetQuaternion = new THREE.Quaternion();
let originalLinearDamping;

// --- Elementos del DOM cacheados ---
const crosshair = document.getElementById("crosshair-container");

const laserSound = new Audio("/sounds/plasma_gun.mp3");
laserSound.volume = 0.2;

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

async function initializeScene() {
    console.log("Inicializando escena...");
    createStarfield();

    try {
        const modelScene = await loadPlayerModel();

        player.visual = new THREE.Group();
        player.gimbal = new THREE.Group();
        player.visual.add(player.gimbal);
        player.gimbal.add(modelScene);

        player.visual.scale.set(0.5, 0.5, 0.5);
        player.visual.rotation.y = Math.PI;
        scene.add(player.visual);

        // const axesHelper = new THREE.AxesHelper(5);
        // player.visual.add(axesHelper);

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

function createStarfield() {
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = THREE.MathUtils.randFloatSpread(2000);
        const y = THREE.MathUtils.randFloatSpread(2000);
        const z = THREE.MathUtils.randFloatSpread(2000);
        starVertices.push(x, y, z);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(starVertices, 3)
    );
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.5,
        sizeAttenuation: false,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    console.log("Campo de estrellas creado.");
}

// AÑADE ESTA NUEVA FUNCIÓN A TU CÓDIGO

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

    // --- AQUÍ ESTÁ LA MAGIA DEL COLOR ---
    // El degradado va desde el centro (0.0) hacia afuera (1.0)
    gradient.addColorStop(0.0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.2, "rgba(191, 255, 0, 1)");
    gradient.addColorStop(0.4, "rgba(64, 224, 208, 1)");
    gradient.addColorStop(1.0, "rgba(64, 224, 208, 0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return new THREE.CanvasTexture(canvas);
}

function fireProjectile() {
    console.log("¡Fuego!");

    const soundClone = laserSound.cloneNode();
    soundClone.volume = laserSound.volume;
    soundClone.play();
    // ---------------------------------------------

    // --- 1. Apariencia del Proyectil (Three.js) - Usando el Sprite ---
    const projectileTexture = createEnergyBlastTexture();
    const projectileMaterial = new THREE.SpriteMaterial({
        map: projectileTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
    });
    const projectileVisual = new THREE.Sprite(projectileMaterial);
    projectileVisual.scale.set(1, 1, 1);

    // --- 2. Cuerpo Físico del Proyectil (Cannon-es) ---
    const projectileShape = new CANNON.Sphere(0.2);
    const projectileBody = new CANNON.Body({
        mass: 0.1,
        shape: projectileShape,
        linearDamping: 0,
    });

    // --- El resto de la función es igual ---
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

    if (deltaTime > 0) {
        world.step(1 / 60, deltaTime, 3);
    }

    if (player.body) {
        const currentMoveSpeed = keysPressed["ShiftLeft"]
            ? MOVE_SPEED * BOOST_MULTIPLIER
            : MOVE_SPEED;

        // --- MOVIMIENTO DE TRASLACIÓN (WASD + Espacio/Ctrl/X/Enter) ---
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

        // --- MOVIMIENTO DE ROTACIÓN (Flechas + Q/E) - CON LÍMITE DE PITCH ---

        // 1. Obtenemos el vector "hacia adelante" de la nave
        const forwardVector = player.body.quaternion.vmult(
            new CANNON.Vec3(0, 0, 1)
        );
        // 2. Definimos el vector "arriba" del mundo
        const worldUp = new CANNON.Vec3(0, 1, 0);
        // 3. Calculamos cómo de vertical es la orientación
        const dot = forwardVector.dot(worldUp);

        const localAngularVelocity = new CANNON.Vec3(0, 0, 0);

        // Pitch (con límite para evitar el salto de la cámara)
        if (keysPressed["ArrowUp"]) {
            if (dot < 0.98) localAngularVelocity.x = -ROTATION_SPEED;
        } else if (keysPressed["ArrowDown"]) {
            if (dot > -0.98) localAngularVelocity.x = ROTATION_SPEED;
        }

        // Yaw (Giro)
        if (keysPressed["ArrowLeft"]) localAngularVelocity.y = ROTATION_SPEED;
        else if (keysPressed["ArrowRight"])
            localAngularVelocity.y = -ROTATION_SPEED;

        // Roll (Rotación)
        if (keysPressed["KeyQ"]) localAngularVelocity.z = -ROLL_SPEED;
        else if (keysPressed["KeyE"]) localAngularVelocity.z = ROLL_SPEED;

        // Aplicamos la velocidad angular calculada
        const worldAngularVelocity =
            player.body.quaternion.vmult(localAngularVelocity);
        player.body.angularVelocity.copy(worldAngularVelocity);
    }

    // Sincronización entre física y visual
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
    }

    // Animación cosmética del gimbal
    if (player.gimbal) {
        let targetTilt = 0;
        if (keysPressed["KeyW"]) {
            targetTilt = TILT_AMOUNT;
        } else if (keysPressed["KeyX"] || keysPressed["KeyS"]) {
            targetTilt = -TILT_AMOUNT;
        }

        let targetBank = 0;
        // CORREGIDO: La animación de banqueo responde a las teclas de rotación (flechas)
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

    // Lógica de la cámara
    if (player.visual) {
        // CORREGIDO: El offset en Y y el signo del zoom estaban mal en tu código
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

    renderer.render(scene, camera);
}

initializeScene();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
});
