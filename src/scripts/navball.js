import * as THREE from "three";

/**
 * Clase para gestionar la brújula 3D (Navball) de forma independiente.
 */
class Navball {
    /**
     * @param {THREE.Color} [targetColor] - El color al que se cambiará la textura verde.
     */
    constructor(targetColor = new THREE.Color(0x00f6ff)) {
        // Cian por defecto
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.navballMesh = null;
        this.targetColor = targetColor;
    }

    /**
     * Inicializa la escena, cámara, renderer y la esfera de la brújula.
     */
    init() {
        // 1. Apuntar al canvas de la brújula en el HTML
        const compassCanvas = document.querySelector("#compass-canvas");
        if (!compassCanvas) {
            console.error("Error: No se encontró el elemento #compass-canvas.");
            return;
        }

        // 2. Crear una escena y cámara dedicadas
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000); // Aspecto 1:1 (cuadrado)
        this.camera.position.z = 2; // Acercar la cámara a la esfera

        // 3. Crear un renderer dedicado para este canvas
        this.renderer = new THREE.WebGLRenderer({
            canvas: compassCanvas,
            alpha: true, // Fondo transparente
            antialias: true,
        });
        this.renderer.setSize(150, 150);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // 4. Cargar la textura original y pasarla a la función de recoloreado
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load("/textures/navball.png", (texture) => {
            // Cuando la textura se carga, la procesamos
            const recoloredTexture = this._recolorTexture(texture);

            // 5. Crear la esfera con la NUEVA textura modificada
            const geometry = new THREE.SphereGeometry(1, 32, 32);
            const material = new THREE.MeshBasicMaterial({
                map: recoloredTexture,
            });

            this.navballMesh = new THREE.Mesh(geometry, material);
            this.navballMesh.rotation.y = Math.PI; // Ajustar la rotación inicial

            this.scene.add(this.navballMesh);
            console.log("Navball inicializada con color personalizado.");
        });
    }

    /**
     * Procesa una textura, cambiando los píxeles verdes al color objetivo.
     * @param {THREE.Texture} originalTexture - La textura original cargada.
     * @returns {THREE.CanvasTexture} - Una nueva textura basada en un canvas recoloreado.
     * @private
     */
    _recolorTexture(originalTexture) {
        const image = originalTexture.image;

        // Crear un canvas en memoria
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);

        // Obtener los datos de todos los píxeles (un array largo de [R,G,B,A, R,G,B,A, ...])
        const imageData = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );
        const data = imageData.data;

        // Recorrer cada píxel (avanzando de 4 en 4 en el array)
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Condición para detectar el verde (componente verde dominante y alto)
            if (g > 150 && g > r + b) {
                // Reemplazar el píxel con nuestro color objetivo
                data[i] = this.targetColor.r * 255; // El color de Three.js va de 0 a 1
                data[i + 1] = this.targetColor.g * 255;
                data[i + 2] = this.targetColor.b * 255;
            }
        }

        // Poner los datos de píxeles modificados de vuelta en el canvas
        context.putImageData(imageData, 0, 0);

        // Devolver una nueva textura basada en nuestro canvas modificado
        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Actualiza la rotación de la esfera de la brújula.
     * @param {THREE.Quaternion} playerQuaternion - El cuaternión de rotación del jugador.
     */
    update(playerQuaternion) {
        if (this.navballMesh) {
            this.navballMesh.quaternion.copy(playerQuaternion).invert();
        }
    }

    /**
     * Renderiza la escena de la brújula. Se debe llamar en cada frame del bucle principal.
     */
    render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Exportamos la clase para poder importarla en otros archivos
export default Navball;
