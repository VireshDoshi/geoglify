// Import necessary libraries
const { MongoClient } = require("mongodb");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

// Configurations
const MONGODB_CONNECTION_STRING = process.env.MONGODB_CONNECTION_STRING || "mongodb://root:root@localhost:27778/?directConnection=true&authMechanism=DEFAULT";

// MongoDB client
const mongoClient = new MongoClient(MONGODB_CONNECTION_STRING);

// Socket CORS origin
const NUMBER_OF_EMITS = process.env.NUMBER_OF_EMITS || 25;
const TIMEOUT_LOOP = process.env.TIMEOUT_LOOP || 500;

// Create an Express app and an HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origins: "*" },
});

// Create a route to handle the root URL
let messages = new Map();
const messageQueue = [];
let dispatchTimeout = null;

app.use(cors());

server.listen(8080, () => {
  logSuccess("Server running on port 8080");
});

// Logging function for information messages
function logInfo(message) {
  console.info(
    `\x1b[33m[${new Date().toLocaleString("en-GB", {
      timeZone: "UTC",
    })}]\x1b[0m ${message}`
  );
}

// Logging function for error messages
function logError(message) {
  console.error(
    `\x1b[31m[${new Date().toLocaleString("en-GB", {
      timeZone: "UTC",
    })}]\x1b[0m ${message}`
  );
}

// Logging function for success messages
function logSuccess(message) {
  console.info(
    `\x1b[32m[${new Date().toLocaleString("en-GB", {
      timeZone: "UTC",
    })}]\x1b[0m ${message}`
  );
}

// Logging function for warning messages
function logWarning(message) {
  console.info(
    `\x1b[90m[${new Date().toLocaleString("en-GB", {
      timeZone: "UTC",
    })}]\x1b[0m ${message}`
  );
}

// Function to connect to MongoDB with retry mechanism
async function connectToMongoDBWithRetry() {
  try {
    logWarning("Connecting to MongoDB...");
    await mongoClient.connect();
    logSuccess("MongoDB Connected");
    startApplication();
  } catch (err) {
    logError("Failed to connect to MongoDB, retrying...");
    setTimeout(connectToMongoDBWithRetry, 5000);
  }
}

// Define the run function
async function startApplication() {
  try {
    // Connect to the "geoglify" database and the "realtime" collection
    const database = mongoClient.db("geoglify");
    const realtimeMessagesCollection = database.collection("realtime");

    io.on("connection", (socket) => {
      logSuccess(`Client connected: \x1b[32m${socket.id}\x1b[0m`);
      socket.on("disconnect", () => logError(`Client disconnected: \x1b[31m${socket.id}\x1b[0m`));
    });

    const options = { fullDocument: "updateLookup" };
    const changeStream = realtimeMessagesCollection.watch([], options);

    // Listen for changes on the "realtime" collection
    changeStream.on("change", async (change) => {
      let ship = change.fullDocument;

      // Check if the ship object is valid
      if (!ship || !ship?.location) return;

      let message = {
        _id: ship._id,
        mmsi: ship.mmsi,
        shipname: ship.shipname,
        cargo: ship.cargo,
        hdg: ship.hdg,
        location: ship.location,
        utc: ship.utc,
        dimA: ship.dimA,
        dimB: ship.dimB,
        dimC: ship.dimC,
        dimD: ship.dimD,
        length: ship.length,
        width: ship.width,
        destination: ship.destination,
        is_trawler: ship.is_trawler,
      };

      messages.set(message.mmsi, message);

      if (message && !messageQueue.includes(message.mmsi)) {
        messageQueue.push(message.mmsi);
      }
    });

    startDispatchLoop();
  } catch (error) {
    logError("Error running the application: " + error);
    await client.close();
  }
}

// Define the startDispatchLoop function
async function startDispatchLoop() {
  if (dispatchTimeout) {
    clearTimeout(dispatchTimeout);
  }

  let currentLength = messageQueue.length;
  let chunk = messageQueue.splice(0, NUMBER_OF_EMITS);

  logInfo(`Dispatching \x1b[32m${chunk.length}\x1b[0m. Remaining: \x1b[31m${currentLength - chunk.length}\x1b[0m`);

  // Dispatch the messages
  for (let i = 0; i < chunk.length; i++) {
    let key = chunk[i];
    let message = messages.get(key);
    if (!message) continue;
    await emitMessage(message);
    messages.delete(key);
  }

  // Schedule the next dispatch loop
  dispatchTimeout = setTimeout(startDispatchLoop.bind(this), TIMEOUT_LOOP);
}

// Define the emitMessage function
function emitMessage(msg) {
  return new Promise((resolve) => {
    io.sockets.emit("message", msg, () => {
      resolve();
    });
  });
}

// Start the application
connectToMongoDBWithRetry();
