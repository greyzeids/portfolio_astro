import * as THREE from "three";
import * as CANNON from "cannon-es";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class TechStackEffect {
    constructor(scene, world, camera, renderer) {
        this.scene = scene;
        this.world = world;
        this.camera = camera;
        this.renderer = renderer;

        // Configuración
        this.techLogoUrls = [
            "/models/tech-logos/react.glb",
            "/models/tech-logos/html5.glb",
            "/models/tech-logos/css3.glb",
        ];
        this.loadedTechLogoAssets = [];
        this.areTechLogosLoaded = false;
        this.isTransitioning = false;
        this.objectsData = [];
        this.currentDisplayMode = "default";

        // Configuración física
        this.defaultMaterial = new CANNON.Material("default");
        this.defaultContactMaterial = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: 0.2,
                restitution: 0.1,
            }
        );
        this.world.addContactMaterial(this.defaultContactMaterial);
        this.world.defaultContactMaterial = this.defaultContactMaterial;

        // Configuración de animación
        this.centerOfAttraction = new CANNON.Vec3(0, 0, 0);
        this.attractionStrength = 30;
        this.idealRestingDistance = 2.8;
        this.minAttractionDistance = 1.2;

        // Vectores reutilizables
        this._cannonVec3_1 = new CANNON.Vec3();
        this._cannonVec3_2 = new CANNON.Vec3();

        // Mouse interaction
        this.mousePositionWorld = new THREE.Vector3();
        this.raycaster = new THREE.Raycaster();
        this.planeForMouseIntersection = new THREE.Plane(
            new THREE.Vector3(0, 0, 1),
            0
        );

        this.setupMouseInteraction();
    }

    setupMouseInteraction() {
        window.addEventListener("mousemove", (event) => {
            const mousePositionNormalized = new THREE.Vector2();
            mousePositionNormalized.x =
                (event.clientX / window.innerWidth) * 2 - 1;
            mousePositionNormalized.y =
                -(event.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(mousePositionNormalized, this.camera);
            const intersects = this.raycaster.ray.intersectPlane(
                this.planeForMouseIntersection,
                this.mousePositionWorld
            );
            if (!intersects) {
                this.mousePositionWorld.set(0, 0, -Infinity);
            }
        });

        window.addEventListener("mouseout", () => {
            this.mousePositionWorld.set(0, 0, -Infinity);
        });
    }

    loadModel(url) {
        const loader = new GLTFLoader();
        return new Promise((resolve, reject) => {
            loader.load(url, (data) => resolve(data.scene), undefined, reject);
        });
    }

    async preloadTechLogos() {
        if (this.areTechLogosLoaded) return Promise.resolve();

        console.log("🔄 Precargando logos de tecnología...");
        console.log("URLs a cargar:", this.techLogoUrls);

        try {
            const loadedScenes = await Promise.all(
                this.techLogoUrls.map((url) => this.loadModel(url))
            );
            this.loadedTechLogoAssets.push(...loadedScenes);
            this.areTechLogosLoaded = true;
            console.log(
                "✅ Todos los logos de tecnología han sido cargados:",
                loadedScenes.length
            );
        } catch (error) {
            console.error(
                "❌ Fallo al cargar uno o más modelos de logos.",
                error
            );
            throw error;
        }
    }

    explodeAndRemoveObjects() {
        console.log("Iniciando explosión de objetos...");

        this.objectsData.forEach((obj) => {
            const body = obj.body;
            const forceMagnitude = 12 + Math.random() * 10;
            const angularForce = 6;

            const direction = new CANNON.Vec3().copy(body.position);
            if (direction.lengthSquared() < 0.0001) {
                direction.set(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                );
            }
            direction.normalize();

            body.angularVelocity.set(
                (Math.random() - 0.5) * angularForce,
                (Math.random() - 0.5) * angularForce,
                (Math.random() - 0.5) * angularForce
            );
            body.applyImpulse(direction.scale(forceMagnitude), body.position);
        });

        setTimeout(() => {
            console.log(
                "Eliminando objetos y preparando la creación de logos..."
            );
            this.objectsData.forEach((obj) => {
                this.world.removeBody(obj.body);
                this.scene.remove(obj.visual);
            });
            this.objectsData.length = 0;
            this.spawnTechLogos();
            setTimeout(() => {
                this.isTransitioning = false;
            }, 500);
        }, 1800);
    }

    spawnTechLogos() {
        console.log(
            "🔄 Creando instancias de logos de tecnología en un layout de grilla..."
        );
        const numberOfColumns = 5;
        const spacingX = 2.0;
        const spacingY = 2.0;
        const normalizedLogoSize = 1.5;
        const numberOfLogos = this.loadedTechLogoAssets.length;

        console.log("📊 Número de logos disponibles:", numberOfLogos);

        if (numberOfLogos === 0) {
            console.warn("⚠️ No hay logos cargados para mostrar");
            return;
        }

        const numberOfRows = Math.ceil(numberOfLogos / numberOfColumns);
        const gridWidth =
            (Math.min(numberOfLogos, numberOfColumns) - 1) * spacingX;
        const gridHeight = (numberOfRows - 1) * spacingY;
        const spawnRadius = 30;

        this.loadedTechLogoAssets.forEach((logoAssetScene, i) => {
            const visual = new THREE.Group();
            const logoModelInstance = logoAssetScene.clone();
            this.normalizeAndCenterModel(logoModelInstance, normalizedLogoSize);
            visual.add(logoModelInstance);
            this.scene.add(visual);

            const col = i % numberOfColumns;
            const row = Math.floor(i / numberOfColumns);
            const targetX = col * spacingX - gridWidth / 2;
            const targetY = -(row * spacingY) + gridHeight / 2;
            const targetZ = 0;
            const targetPosition = new CANNON.Vec3(targetX, targetY, targetZ);

            const randomDirection = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            );

            const initialPosition = randomDirection
                .normalize()
                .multiplyScalar(spawnRadius);
            visual.position.copy(initialPosition);

            const initialPositionCannon = new CANNON.Vec3(
                initialPosition.x,
                initialPosition.y,
                initialPosition.z
            );

            const logoShape = new CANNON.Sphere(normalizedLogoSize / 2);
            const body = new CANNON.Body({
                mass: 1,
                shape: logoShape,
                position: initialPositionCannon,
                fixedRotation: true,
                angularDamping: 0.8,
                linearDamping: 0.85,
                material: this.defaultMaterial,
            });
            this.world.addBody(body);
            this.objectsData.push({ visual, body, targetPosition });
        });

        console.log(
            "✅ Logos creados y añadidos a la escena:",
            this.objectsData.length
        );
    }

    spawnTechLogosAround(center, radius = 4) {
        // Elimina logos previos
        this.objectsData.forEach((obj) => {
            this.world.removeBody(obj.body);
            this.scene.remove(obj.visual);
        });
        this.objectsData.length = 0;
        const normalizedLogoSize = 1.5;
        const numberOfLogos = this.loadedTechLogoAssets.length;
        if (numberOfLogos === 0) return;
        for (let i = 0; i < numberOfLogos; i++) {
            const angle = (i / numberOfLogos) * Math.PI * 2;
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            const z = center.z;
            const visual = new THREE.Group();
            const logoModelInstance = this.loadedTechLogoAssets[i].clone();
            this.normalizeAndCenterModel(logoModelInstance, normalizedLogoSize);
            visual.add(logoModelInstance);
            visual.position.set(x, y, z);
            this.scene.add(visual);
            // Cuerpo físico (opcional, para interacción)
            const logoShape = new CANNON.Sphere(normalizedLogoSize / 2);
            const body = new CANNON.Body({
                mass: 1,
                shape: logoShape,
                position: new CANNON.Vec3(x, y, z),
                fixedRotation: true,
                angularDamping: 0.8,
                linearDamping: 0.85,
                material: this.defaultMaterial,
            });
            this.world.addBody(body);
            this.objectsData.push({ visual, body });
        }
    }

    normalizeAndCenterModel(model, targetSize) {
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = maxDim === 0 ? 1 : targetSize / maxDim;
        model.position.sub(center);
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);
        model.position.multiplyScalar(scaleFactor);
    }

    async switchToTechLogos() {
        if (this.currentDisplayMode === "tech_logos" || this.isTransitioning)
            return;
        this.isTransitioning = true;
        await this.preloadTechLogos();
        this.currentDisplayMode = "tech_logos";

        // Si no hay objetos existentes, crear los logos directamente
        if (this.objectsData.length === 0) {
            this.spawnTechLogos();
            setTimeout(() => {
                this.isTransitioning = false;
            }, 500);
        } else {
            this.explodeAndRemoveObjects();
        }
    }

    switchToDefault() {
        if (this.currentDisplayMode === "default" || this.isTransitioning)
            return;
        this.isTransitioning = true;
        this.currentDisplayMode = "default";
        this.objectsData.forEach((obj) => {
            this.world.removeBody(obj.body);
            this.scene.remove(obj.visual);
        });
        this.objectsData.length = 0;
        setTimeout(() => {
            this.isTransitioning = false;
        }, 500);
    }

    update(deltaTime) {
        for (const obj of this.objectsData) {
            const visual = obj.visual;
            const body = obj.body;

            if (body && visual) {
                if (!this.isTransitioning) {
                    if (
                        this.currentDisplayMode === "tech_logos" &&
                        obj.targetPosition
                    ) {
                        obj.targetPosition.vsub(
                            body.position,
                            this._cannonVec3_1
                        );
                        const forceMagnitude = this._cannonVec3_1.length() * 4;
                        this._cannonVec3_1.normalize();
                        this._cannonVec3_1.scale(
                            forceMagnitude,
                            this._cannonVec3_1
                        );
                        body.applyForce(this._cannonVec3_1, body.position);
                    } else {
                        this.centerOfAttraction.vsub(
                            body.position,
                            this._cannonVec3_1
                        );
                        const distanceToCenter = this._cannonVec3_1.length();
                        let forceMagnitude = 0;

                        if (distanceToCenter > this.idealRestingDistance) {
                            forceMagnitude =
                                this.attractionStrength *
                                (distanceToCenter - this.idealRestingDistance) *
                                0.25;
                        } else if (
                            distanceToCenter < this.minAttractionDistance &&
                            distanceToCenter > 0.05
                        ) {
                            forceMagnitude =
                                -this.attractionStrength *
                                (this.minAttractionDistance -
                                    distanceToCenter) *
                                0.35;
                        }

                        if (Math.abs(forceMagnitude) > 0.0001) {
                            this._cannonVec3_1.normalize();
                            this._cannonVec3_1.scale(
                                forceMagnitude,
                                this._cannonVec3_1
                            );
                            body.applyForce(this._cannonVec3_1, body.position);
                        }
                    }

                    // Mouse repulsion
                    if (this.mousePositionWorld.lengthSq() > 0.001) {
                        const mouseRepulsionStrength = 10;
                        const influenceRadius = 0.8;
                        const _cannonMousePos = new CANNON.Vec3(
                            this.mousePositionWorld.x,
                            this.mousePositionWorld.y,
                            body.position.z
                        );
                        body.position.vsub(_cannonMousePos, this._cannonVec3_2);
                        const distanceToMouse = this._cannonVec3_2.length();

                        if (
                            distanceToMouse < influenceRadius &&
                            distanceToMouse > 0.01
                        ) {
                            const repulsionMagnitude =
                                mouseRepulsionStrength *
                                (1 - distanceToMouse / influenceRadius);
                            this._cannonVec3_2.normalize();
                            this._cannonVec3_2.scale(
                                repulsionMagnitude,
                                this._cannonVec3_2
                            );
                            body.applyForce(this._cannonVec3_2, body.position);
                        }
                    }
                }

                visual.position.copy(body.position);
                visual.quaternion.copy(body.quaternion);

                if (this.currentDisplayMode === "tech_logos") {
                    visual.lookAt(this.camera.position);
                }
            }
        }
    }

    // Método para configurar URLs personalizadas
    setTechLogoUrls(urls) {
        this.techLogoUrls = urls;
        this.areTechLogosLoaded = false;
        this.loadedTechLogoAssets = [];
    }

    // Método para limpiar recursos
    dispose() {
        this.objectsData.forEach((obj) => {
            this.world.removeBody(obj.body);
            this.scene.remove(obj.visual);
        });
        this.objectsData.length = 0;
        this.loadedTechLogoAssets.length = 0;
        this.areTechLogosLoaded = false;
    }
}
