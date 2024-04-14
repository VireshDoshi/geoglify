const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
const { logSuccess, logError, logWarning } = require("./utils");
const turf = require("@turf/turf");

const MONGODB_CONNECTION_STRING = process.env.MONGODB_CONNECTION_STRING || "mongodb://root:root@localhost:27778/?directConnection=true&authMechanism=DEFAULT";
const mongoClient = new MongoClient(MONGODB_CONNECTION_STRING);

async function connectToMongoDBWithRetry() {
  return new Promise((resolve) => {
    const connect = async () => {
      try {
        logWarning("Connecting to MongoDB...");
        await mongoClient.connect();
        logSuccess("MongoDB Connected");
        resolve();
      } catch (err) {
        logError("Failed to connect to MongoDB, retrying...");
        setTimeout(connect, 5000);
      }
    };

    connect();
  });
}

async function getAISShips(limit) {
  const results = await mongoClient
    .db("geoglify")
    .collection("realtime")
    .find({}, { projection: { _id: 1, mmsi: 1, shipname: 1, cargo: 1, hdg: 1, location: 1, utc: 1 } })
    .limit(limit)
    .toArray();

  return results.filter((ship) => ship && ship.location && ship.location.coordinates && !isEqual(ship.location.coordinates, [0, 0]) && !isEqual(ship.location.coordinates, [null, null])).map((ship) => processShipData(ship));
}

function isEqual(arr1, arr2) {
  return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

async function getAISShip(shipId) {
  return await mongoClient
    .db("geoglify")
    .collection("realtime")
    .findOne(
      { _id: new ObjectId(shipId) },
      {
        projection: {
          _id: 1,
          mmsi: 1,
          aistype: 1,
          callsign: 1,
          cargo: 1,
          channel: 1,
          class: 1,
          dimA: 1,
          dimB: 1,
          dimC: 1,
          dimD: 1,
          length: 1,
          utc: 1,
          width: 1,
          cog: 1,
          hdg: 1,
          sog: 1,
          shipname: 1,
        },
      }
    );
}

function processShipData(ship) {
  try {
    const [x, y] = ship.location.coordinates;
    const hdg = ship?.hdg; // Heading of the ship

    let geojson;

    if (!hdg || hdg === 511) {
      const length = ship?.dimA + ship?.dimB || ship.length || 20; // Length of the ship
      const width = ship?.dimC + ship?.dimD || ship.width || 20; // Width of the ship

      // Draw a circle if hdg is null or 511
      const radius = Math.max(width, length) / 2;
      geojson = turf.circle([x, y], radius, { units: "meters" });
    } else {
      const length = ship?.dimA + ship?.dimB || ship.length || 50; // Length of the ship
      const width = ship?.dimC + ship?.dimD || ship.width || 20; // Width of the ship

      // Calculate the offsets in degrees
      const xOffsetA = ship?.dimA || length / 2;
      100;
      const xOffsetB = -(ship?.dimB || length / 2);
      const yOffsetC = -(ship?.dimC || width / 2);
      const yOffsetD = ship?.dimD || width / 2;

      const yOffsetAux = xOffsetA - 10;

      // Create a polygon with a "beak" and rotate it according to the heading
      const polygon = turf.polygon([
        [
          [yOffsetC, xOffsetB],
          [yOffsetC, yOffsetAux],
          [(yOffsetC + yOffsetD) / 2, xOffsetA],
          [yOffsetD, yOffsetAux],
          [yOffsetD, xOffsetB],
          [yOffsetC, xOffsetB],
        ],
      ]);

      geojson = turf.toWgs84(polygon);

      let distance = turf.rhumbDistance([0, 0], ship.location.coordinates, { units: "meters" });
      let bearing = turf.rhumbBearing([0, 0], ship.location.coordinates);

      geojson = turf.transformTranslate(geojson, distance, bearing, { units: "meters" });
      geojson = turf.transformRotate(geojson, turf.bearingToAzimuth(hdg), { pivot: ship.location.coordinates });
    }

    var options = { tolerance: 0.000001, highQuality: true };
    var simplified = turf.simplify(geojson, options);

    let result = {
      type: "Feature",
      properties: { _id: ship._id, mmsi: ship.mmsi, shipname: ship.shipname, cargo: ship.cargo, hdg: ship.hdg, utc: ship.utc },
      geometry: simplified.geometry,
    };

    return { _id: ship._id, location: ship.location, geojson: result };
  } catch (error) {
    return;
  }
}

async function getLayers() {
  const result = await mongoClient.db("geoglify").collection("layers").find().toArray();
  return result;
}

async function insertLayer(layer) {
  const result = await mongoClient.db("geoglify").collection("layers").insertOne(layer);

  const insertedId = result.insertedId;

  const insertedLayer = await mongoClient.db("geoglify").collection("layers").findOne({ _id: insertedId });

  return insertedLayer;
}

async function getLayerById(layerId) {
  const result = await mongoClient
    .db("geoglify")
    .collection("layers")
    .findOne({ _id: new ObjectId(layerId) });
  return result;
}

async function updateLayer(layerId, updatedLayer) {
  await mongoClient
    .db("geoglify")
    .collection("layers")
    .updateOne({ _id: new ObjectId(layerId) }, { $set: updatedLayer });

  const result = await mongoClient
    .db("geoglify")
    .collection("layers")
    .findOne({ _id: new ObjectId(layerId) });

  return result;
}

async function deleteLayer(layerId) {
  const result = await mongoClient
    .db("geoglify")
    .collection("layers")
    .deleteOne({ _id: new ObjectId(layerId) });
  return result.deletedCount;
}

async function getFeaturesByLayerId(layerId) {
  const result = await mongoClient
    .db("geoglify")
    .collection("features")
    .find({ layer_id: new ObjectId(layerId) })
    .toArray();
  return result;
}

async function insertFeature(layerId, feature) {
  feature.layer_id = layerId;
  const result = await mongoClient.db("geoglify").collection("features").insertOne(feature);
  return result;
}

async function updateLayerStyle(layerId, newStyle) {
  const result = await mongoClient
    .db("geoglify")
    .collection("layers")
    .updateOne({ _id: new ObjectId(layerId) }, { $set: { style: newStyle } });
  return result.modifiedCount;
}

async function getWmsLayers() {
  const result = await mongoClient.db("geoglify").collection("wmslayers").find().toArray();
  return result;
}

async function insertWmsLayer(layer) {
  const result = await mongoClient.db("geoglify").collection("wmslayers").insertOne(layer);

  const insertedId = result.insertedId;

  const insertedLayer = await mongoClient.db("geoglify").collection("wmslayers").findOne({ _id: insertedId });

  return insertedLayer;
}

async function getWmsLayerById(layerId) {
  const result = await mongoClient
    .db("geoglify")
    .collection("wmslayers")
    .findOne({ _id: new ObjectId(layerId) });
  return result;
}

async function updateWmsLayer(layerId, updatedLayer) {
  await mongoClient
    .db("geoglify")
    .collection("wmslayers")
    .updateOne({ _id: new ObjectId(layerId) }, { $set: updatedLayer });

  const result = await mongoClient
    .db("geoglify")
    .collection("wmslayers")
    .findOne({ _id: new ObjectId(layerId) });

  return result;
}

async function deleteWmsLayer(layerId) {
  const result = await mongoClient
    .db("geoglify")
    .collection("wmslayers")
    .deleteOne({ _id: new ObjectId(layerId) });
  return result.deletedCount;
}

module.exports = {
  connectToMongoDBWithRetry,
  getAISShips,
  getAISShip,
  getLayers,
  insertLayer,
  getLayerById,
  updateLayer,
  deleteLayer,
  getFeaturesByLayerId,
  insertFeature,
  updateLayerStyle,
  getWmsLayers,
  insertWmsLayer,
  getWmsLayerById,
  updateWmsLayer,
  deleteWmsLayer,
};