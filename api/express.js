const express = require("express");
const http = require("http");
const cors = require("cors");
const { getAISShips, getAISShip, searchAISShips, getLayers, insertLayer, getLayerById, updateLayer, deleteLayer, getFeaturesByLayerId, insertFeature, updateLayerStyle, getWmsLayers, insertWmsLayer, getWmsLayerById, updateWmsLayer, deleteWmsLayer, getAISCoords } = require("./mongodb");

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: "100mb" }));
app.use(cors());

// Default route
app.get("/", (_, res) => {
  res.json("Geoglify API");
});

app.get("/ships", async (_, res) => {
  const ships = await getAISShips();
  res.json(ships);
});

app.get("/ship/:id", async (req, res) => {
  const _id = req.params.id;
  const ais_ship = await getAISShip(_id);
  res.json(ais_ship);
});

app.post("/ships/search", async (req, res) => {
  const page = parseInt(req.body.page) || 1;
  const itemsPerPage = parseInt(req.body.itemsPerPage) || 20;
  const searchText = req.body.searchText || "";
  const ships = await searchAISShips(page, itemsPerPage, searchText);
  res.json(ships);
});


// Layers Routes
app.get("/layers", async (_, res) => {
  const layers = await getLayers();
  res.json(layers);
});

app.post("/layers", async (req, res) => {
  const { code, name, description, type, features } = req.body;

  // Inserting the new layer
  const newLayer = { code, name, description, type };

  // Add default style to the new layer
  newLayer.style = {
    radius: 6, // Default radius
    lineWidth: 5, // Default border size
    fillColor: "#DF950D", // Default fill color
    lineColor: "#000000ff", // Default Line Color
    dashArray: "0,0", // Default dash array
    fillPattern: "none", // Default fill pattern
    fillPatternScale: 100, // Default fill pattern scale
    fillPatternOffset: [0, 0], // Default fill pattern offset
  };

  const insertedLayer = await insertLayer(newLayer);

  // If layer insertion is successful, add features to the features table
  if (insertedLayer) {
    // Inserting features with associated layer_id
    await Promise.all(
      features.map(async (feature) => {
        return await insertFeature(insertedLayer._id, feature);
      })
    );
    newLayer.features = features;
    res.json(newLayer);
  } else {
    res.status(500).json({ error: "Failed to insert layer" });
  }
});

app.get("/layers/:id", async (req, res) => {
  const layerId = req.params.id;
  const layer = await getLayerById(layerId);
  res.json(layer);
});

app.put("/layers/:id", async (req, res) => {
  const layerId = req.params.id;
  const { code, name, description, type, features } = req.body;

  const updatedLayer = await updateLayer(layerId, {
    code,
    name,
    description,
    type,
  });

  // Clear all features for the layer and insert the new ones only if features are present in the request and has a length greater than 0
  if (updatedLayer && features && features.length > 0) {
    await deleteFeaturesByLayerId(layerId);
    await Promise.all(
      features.map(async (feature) => {
        return await insertFeature(layerId, feature);
      })
    );
    updatedLayer.features = features;
  }
  res.json(updatedLayer);
});

app.delete("/layers/:id", async (req, res) => {
  const layerId = req.params.id;
  const result = await deleteLayer(layerId);
  res.json(result);
});

app.get("/layers/:layerId/features", async (req, res) => {
  const layerId = req.params.layerId;
  const features = await getFeaturesByLayerId(layerId);
  res.json(features);
});

app.put("/layers/:id/style", async (req, res) => {
  const layerId = req.params.id;
  const newStyle = req.body;
  const result = await updateLayerStyle(layerId, newStyle);
  res.json(result);
});

// WMS Layers Routes
app.get("/wmslayers", async (_, res) => {
  const layers = await getWmsLayers();
  res.json(layers);
});

app.post("/wmslayers", async (req, res) => {
  const { code, name, description, url, layers } = req.body;
  const newLayer = { code, name, description, url, layers };
  const insertedLayer = await insertWmsLayer(newLayer);
  res.json(insertedLayer);
});

app.get("/wmslayers/:id", async (req, res) => {
  const layerId = req.params.id;
  const layer = await getWmsLayerById(layerId);
  res.json(layer);
});

app.put("/wmslayers/:id", async (req, res) => {
  const layerId = req.params.id;
  const { code, name, description, url, layers } = req.body;
  const updatedLayer = await updateWmsLayer(layerId, {
    code,
    name,
    description,
    url,
    layers,
  });
  res.json(updatedLayer);
});

app.delete("/wmslayers/:id", async (req, res) => {
  const layerId = req.params.id;
  const result = await deleteWmsLayer(layerId);
  res.json(result);
});

app.get("/coords/:mmsi", async (req, res) => {
  const mmsi = req.params.mmsi;
  const ais_ship_coords = await getAISCoords(mmsi);
  res.json(ais_ship_coords);
});

module.exports = { app, server };
