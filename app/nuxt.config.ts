// https://nuxt.com/docs/api/configuration/nuxt-config
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

export default defineNuxtConfig({
  devtools: { enabled: true },
  build: {
    transpile: ["vuetify"],
  },
  experimental: {
    watcher: "chokidar",
  },
  nitro: {
    devProxy: {
      "/_api": {
        target: "http://localhost:8081",
        changeOrigin: true,
        prependPath: true,
      },
    },
  },
  css: ["maplibre-gl/dist/maplibre-gl.css", "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css", , "maplibre-gl-basemaps/lib/basemaps.css"],
  runtimeConfig: {
    public: {
      API_URL: process.env.API_URL || "http://localhost:8081",
      REALTIME_URL: process.env.REALTIME_URL || "http://localhost:8080",
      MAPBOX_TOKEN: process.env.MAPBOX_TOKEN,
      OPENWEATHERMAP_API_KEY: process.env.OPENWEATHERMAP_API_KEY,
    },
  },
  modules: [
    "nuxt3-vuex-module",
    "nuxt-gtag",
    "nuxt-svgo",
    "@nuxtjs/google-fonts",
    (_options, nuxt) => {
      nuxt.hooks.hook("vite:extendConfig", (config) => {
        // @ts-expect-error
        config.plugins.push(vuetify({ autoImport: true }));
      });
    },
  ],
  svgo: {
    autoImportPath: "../../../node_modules/circle-flags/flags/",
  },
  ssr: false,
  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
  },
  googleFonts: {
    families: {
      Nunito: {
        // weights
        wght: "200..1000",
        ital: "200..1000",
      },
    },
  },
});
