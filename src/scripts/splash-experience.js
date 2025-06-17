import * as THREE from "three";

// --- Configuración básica ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#splash-canvas"),
    alpha: true, // ¡Importante para que el fondo CSS sea visible!
    antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// --- Creación del Botón 3D ---
const buttonGroup = new THREE.Group();

// 1. Geometría del contorno (como en la imagen)
const boxGeometry = new THREE.BoxGeometry(2.5, 1, 0.2);
const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 2,
});
const boxOutline = new THREE.LineSegments(edgesGeometry, lineMaterial);

// 2. Geometría de las "cintas de peligro" animadas
const boxOutline2 = boxOutline.clone();
boxOutline2.scale.set(1.1, 1.1, 1.1); // Un poco más grande
buttonGroup.add(boxOutline, boxOutline2);

// 3. Texto "START" usando un CanvasTexture (eficiente)
// const textCanvas = document.createElement("canvas");
// const context = textCanvas.getContext("2d");
// textCanvas.width = 256;
// textCanvas.height = 128;
// context.font = "Bold 40px sans-serif";
// context.fillStyle = "white";
// context.textAlign = "center";
// context.textBaseline = "middle";
// context.fillText("START", textCanvas.width / 2, textCanvas.height / 2);

// const textTexture = new THREE.CanvasTexture(textCanvas);
// const textMaterial = new THREE.MeshBasicMaterial({
//     map: textTexture,
//     transparent: true,
// });
// const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), textMaterial);

// buttonGroup.add(textPlane);

// Rotación inicial en perspectiva
buttonGroup.rotation.x = -0.4;
buttonGroup.rotation.y = -0.3;

scene.add(buttonGroup);

// --- Interacción con el Ratón ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isHovering = false;

window.addEventListener("mousemove", (event) => {
    // Normalizar coordenadas del ratón (-1 a +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("click", () => {
    if (isHovering) {
        // Lanzamos un evento global que el script de Astro puede escuchar
        window.dispatchEvent(new Event("startExperience"));
    }
});

// --- Bucle de Animación ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Animación de las cintas (muy lenta)
    boxOutline.position.x = Math.sin(elapsedTime * 0.2) * 0.05;
    boxOutline2.position.x = -Math.sin(elapsedTime * 0.2) * 0.05;

    // Raycasting para detectar el hover
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(buttonGroup.children);

    if (intersects.length > 0) {
        if (!isHovering) {
            isHovering = true;
            // Efecto al hacer hover: escala ligeramente y cambia el cursor
            buttonGroup.scale.set(1.1, 1.1, 1.1);
            document.body.style.cursor = "pointer";
        }
    } else {
        if (isHovering) {
            isHovering = false;
            // Vuelve al estado normal
            buttonGroup.scale.set(1, 1, 1);
            document.body.style.cursor = "default";
        }
    }

    // Suave interpolación (lerp) para seguir al ratón sutilmente
    buttonGroup.rotation.y = THREE.MathUtils.lerp(
        buttonGroup.rotation.y,
        -0.3 + mouse.x * 0.2,
        0.05
    );
    buttonGroup.rotation.x = THREE.MathUtils.lerp(
        buttonGroup.rotation.x,
        -0.4 - mouse.y * 0.2,
        0.05
    );

    renderer.render(scene, camera);
}

animate();

// --- Ajuste de Ventana ---
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
});
