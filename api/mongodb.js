// Description: MongoDB operations for Geoglify API.
const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
const { logSuccess, logError, logWarning } = require("./utils");

// MongoDB Connection String
const MONGODB_CONNECTION_STRING = process.env.MONGODB_CONNECTION_STRING || "mongodb://root:root@localhost:27778/?directConnection=true&authMechanism=DEFAULT";
const mongoClient = new MongoClient(MONGODB_CONNECTION_STRING);

// Connect to MongoDB with retry
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

// Get the list of ships
async function getAISShips() {
  const results = await mongoClient
    .db("geoglify")
    .collection("realtime")
    .find(
      {
        // $and: [
        //   { lat: { $exists: true, $ne: null, $ne: 0 } }, // lat exists and is not null nor zero
        //   { lon: { $exists: true, $ne: null, $ne: 0 } }, // lon exists and is not null nor zero
        // ],
      },
      {
        projection: {
          _id: 1,
          mmsi: 1,
          shipname: 1,
          cargo: 1,
          hdg: 1,
          location: 1,
          utc: 1,
          lat: 1,
          lon: 1,
          dimA: 1,
          dimB: 1,
          dimC: 1,
          dimD: 1,
          length: 1,
          width: 1,
          destination: 1,
          coordcount: 1,
          coords: 1,
        },
      }
    )
    .toArray();

  return results;
}

// Search for ships
async function searchAISShips(page, itemsPerPage, searchText) {
  let filter = {
    // $and: [
    //   { lat: { $exists: true, $ne: null, $ne: 0 } }, // lat exists and is not null nor zero
    //   { lon: { $exists: true, $ne: null, $ne: 0 } }, // lon exists and is not null nor zero
    // ],
  };

  if (searchText) {
    filter.$or = [{ mmsi: { $regex: searchText, $options: "i" } }, { shipname: { $regex: searchText, $options: "i" } }, { imo: { $regex: searchText, $options: "i" } }];
  }

  let ships = await mongoClient
    .db("geoglify")
    .collection("realtime")
    .find(filter, {
      projection: {
        _id: 1,
        mmsi: 1,
        shipname: 1,
        cargo: 1,
        hdg: 1,
        location: 1,
        utc: 1,
        lat: 1,
        lon: 1,
        dimA: 1,
        dimB: 1,
        dimC: 1,
        dimD: 1,
        length: 1,
        width: 1,
        destination: 1,
        coordcount: 1,
        coords: 1,
      },
    })
    .skip((page - 1) * itemsPerPage)
    .limit(itemsPerPage)
    .toArray();

  let count = await mongoClient.db("geoglify").collection("realtime").countDocuments(filter);

  return { items: ships, total: count };
}

// Get a ship by ID
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
          lat: 1,
          lon: 1,
          destination: 1,
          coordcount: 1,
          coords: 1,
        },
      }
    );
}

// Get the list of layers
async function getLayers() {
  const result = await mongoClient.db("geoglify").collection("layers").find().toArray();
  return result;
}

// Insert a new layer
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
  searchAISShips,
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
