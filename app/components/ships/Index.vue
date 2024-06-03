<template>
  <v-btn class="position-absolute font-weight-bold text-body-2 text--uppercase" style="top: 10px; left: 10px; z-index: 1000" size="small" :prepend-icon="serviceStatusIcon" @click="dialogOpened = true">
    <template v-slot:prepend>
      <v-icon :color="serviceStatusColor"></v-icon>
    </template>
    {{ serviceStatusText }}
  </v-btn>
</template>

<script>
  import { io } from "socket.io-client";
  import { IconLayer, TextLayer, GeoJsonLayer } from "@deck.gl/layers";
  import { CollisionFilterExtension } from "@deck.gl/extensions";
  import { MapboxOverlay } from "@deck.gl/mapbox";

  const ZOOM_AIS_THRESHOLD = 10;

  const shipjson = {"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[1.9192166666666668,51.37719666666667],[1.9188,51.37689666666667],[1.9167666666666667,51.375416666666666],[1.9143333333333332,51.373666666666665],[1.9114666666666666,51.37159],[1.9090333333333334,51.36983333333333],[1.9067666666666667,51.36801],[1.9049666666666667,51.36643],[1.9049666666666667,51.36643],[1.9045999999999998,51.36613],[1.9024500000000002,51.36416666666666],[1.9003333333333332,51.36225666666667],[1.8979166666666667,51.36005],[1.895815,51.35814666666667],[1.89375,51.35623333333333],[1.8920333333333335,51.35463],[1.8920333333333335,51.35463],[1.8916333333333335,51.35428],[1.88955,51.35236666666666],[1.8871833333333332,51.35016333333333],[1.8851483333333334,51.34825],[1.8830983333333333,51.34629666666667],[1.8810833333333332,51.344370000000005],[1.88015,51.34346666666667],[1.88015,51.34346666666667]]}}]};

  // create a new blob from geojson featurecollection
  const blob = new Blob([JSON.stringify(shipjson)], {
    type: "application/json"
  });
  // URL reference to the blob
  const url = URL.createObjectURL(blob);
  // create new geojson layer using the blob url

  export default {
    props: ["map"],

    data() {
      return {
        socket: null,
        serviceStatus: "connecting",
        messageBuffer: [],
        bufferInterval: null,
        aisLayer: null,
        legendLayer: null,
        aisGeoJSONLayer: null,
        overlay: new MapboxOverlay({
          layers: [],
          layerFilter: (filter) => {
            // Set up a zoom listener to re-render the layers when the zoom crosses the AIS threshold
            const layer = filter.layer;
            const zoom = filter.viewport.zoom;

            if (layer.id === "aislegend-layer") return zoom > ZOOM_AIS_THRESHOLD;

            if (layer.id === "aisgeojson-layer") return zoom > ZOOM_AIS_THRESHOLD;

            return true;
          },
        }),
        lastIntervalTimestamp: 0,
      };
    },

    beforeDestroy() {
      clearInterval(this.bufferInterval);
    },

    computed: {
      dialogOpened: {
        get() {
          return this.$store.state.ships.listOpened;
        },
        set(value) {
          this.$store.state.ships.listOpened = value;
        },
      },

      filteredShips() {
        return Object.freeze(this.$store.state.ships.list);
      },

      selected() {
        return this.$store.state.ships.selected;
      },

      serviceStatusIcon() {
        switch (this.serviceStatus) {
          case "offline":
            return "mdi-wifi-off";
          case "online":
            return "mdi-wifi";
          case "warning":
            return "mdi-wifi-strength-alert-outline";
          case "connecting":
            return "mdi-wifi-strength-1";
        }
      },
      serviceStatusColor() {
        switch (this.serviceStatus) {
          case "offline":
            return "red";
          case "online":
            return "green";
          case "warning":
            return "orange";
          case "connecting":
            return "blue";
        }
      },
      serviceStatusText() {
        switch (this.serviceStatus) {
          case "offline":
            return "Offline";
          case "online":
            return this.filteredShips.length + " ships";
          case "warning":
            return "Warning";
          case "connecting":
            return "Connecting";
        }
      },
    },

    methods: {
      onSocketConnect() {
        // Log when the socket is connected and set up the message event handler
        this.log("Socket connected");
        this.serviceStatus = "online";
        this.socket.on("message", this.onSocketMessage);
      },

      onSocketDisconnect() {
        // Log when the socket is disconnected and remove the message event handler
        this.log("Socket disconnected");
        this.serviceStatus = "offline";
        this.socket.off("message");
      },

      onSocketConnectError() {
        // Log when the socket connection fails
        this.log("Socket connection error");
        this.serviceStatus = "warning";
        if (!this.socket.active) {
          this.serviceStatus = "warning";
          this.socket.connect();
        }
      },

      onSocketMessage(...args) {
        // Add the received message to the buffer for later processing
        this.messageBuffer.push(args[0]);
      },

      async processMessageBatch() {
        // Process each message in the buffer and update ships data
        if (this.messageBuffer.length > 0) {
          this.$store.dispatch("ships/CREATE_OR_REPLACE", this.messageBuffer);
          this.messageBuffer = [];
        }
      },

      log(message) {
        // Log a formatted message with a timestamp
        console.info(`[${new Date()}] ${message}`);
      },

      render(now) {
        // Process the message buffer every second
        if (!this.lastIntervalTimestamp || now - this.lastIntervalTimestamp >= 1 * 1000) {
          // Process the message buffer every second
          this.processMessageBatch();

          // Update the timestamp to right now
          this.lastIntervalTimestamp = now;

          if (this.map.getZoom() > ZOOM_AIS_THRESHOLD) {
            // Get the visible features from the overlay
            let visibleFeatures = this.getVisibleFeatures();

            // Create a new GeoJsonLayer for the AIS data
            this.aisGeoJSONLayer = new GeoJsonLayer({
              id: "aisgeojson-layer",
              data: visibleFeatures.map((s) => s.geojson),
              pickable: true,
              filled: true,
              getFillColor: (f) => (f.properties._id == this.selected?._id ? [255, 234, 0, 255] : f.properties.color),
              lineJointRounded: true,
              lineCapRounded: true,
              autoHighlight: true,
              lineBillboard: true,
              getLineWidth: 0.5,
              getLineColor: [0, 0, 0, 125],
              highlightColor: [255, 234, 0, 255],
              onClick: ({ object }) => this.$store.dispatch("ships/SET_SELECTED", object.properties),
            });
            // Create a new TextLayer for the ship names
            this.legendLayer = new TextLayer({
              id: "aislegend-layer",
              data: visibleFeatures,

              fontFamily: "Monaco, monospace",
              fontSettings: {
                sdf: true,
                fontSize: 128,
                buffer: 20,
                radius: 64,
              },
              fontWeight: "bold",
              getAngle: 0,
              getBackgroundColor: [255, 255, 255, 255],
              getColor: [0, 0, 0],
              getPosition: (f) => f.location.coordinates,
              getSize: 16,
              getText: (f) => (!!f.shipname ? f.shipname.trim() : "N/A"),
              getTextAnchor: "middle",
              getColor: [0, 0, 0],
              outlineColor: [211, 211, 211, 255],
              outlineWidth: 10,
              getTextAnchor: "start",
              getPixelOffset: [15, 0],
              pickable: true,
            });
          } else {
            // Clear the layers if the zoom is below the threshold
            this.aisGeoJSONLayer = null;
            this.legendLayer = null;
          }

          // Create a new IconLayer for the AIS data
          this.aisLayer = new IconLayer({
            id: "ais-layer",
            data: this.filteredShips,
            billboard: false,
            autoHighlight: true,
            highlightColor: [255, 234, 0],
            getIcon: (f) => ({
              url: f.icon,
              width: f.width,
              height: f.height,
              mask: true,
            }),
            getPosition: (f) => f.location.coordinates,
            getAngle: (f) => 360 - f.hdg,
            getSize: (f) => (this.map.getZoom() < ZOOM_AIS_THRESHOLD ? f.size : 5),
            getColor: (f) => (f._id == this.selected?._id ? [255, 234, 0, 255] : f.color),
            getCollisionPriority: (f) => f.priority,
            extensions: [new CollisionFilterExtension()],
            collisionGroup: "visualization",
            pickable: true,
            onClick: ({ object }) => this.$store.dispatch("ships/SET_SELECTED", object),
          });


          // Update the layers in the overlay
          this.overlay.setProps({
            layers: [this.aisLayer, this.aisGeoJSONLayer, this.legendLayer],
          });
        }

        requestAnimationFrame(this.render.bind(this));
      },

      // Get the visible features from the overlay
      getVisibleFeatures() {
        return this.overlay
          .pickObjects({
            x: 0,
            y: 0,
            width: this.overlay._deck.width,
            height: this.overlay._deck.height,
            layerIds: ["ais-layer"],
          })
          .map((f) => f.object);
      },
    },

    async mounted() {
      // Add the overlay to the map
      this.map.addControl(this.overlay);

      // Fetch the ships data and draw the layers
      await this.$store.dispatch("ships/FETCH");

      // Set up the socket connection
      this.socket = io(this.$config.public.REALTIME_URL);
      this.socket.on("connect", this.onSocketConnect);
      this.socket.on("disconnect", this.onSocketDisconnect);
      this.socket.on("connect_error", this.onSocketDisconnect);

      // Render the layers
      window.requestAnimationFrame(this.render.bind(this));
    },
  };
</script>
