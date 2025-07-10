// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
    image: {
        // Configuración para optimización de imágenes
        service: {
            entrypoint: "astro/assets/services/sharp",
        },
    },
});
