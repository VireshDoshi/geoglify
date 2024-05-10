const { log } = require("console");
const { MongoClient } = require("mongodb");
const net = require("net");
const WebSocket = require("ws");
const AisDecode = require("ggencoder").AisDecode;
const session = {};


// Configurations
const MONGODB_CONNECTION_STRING = process.env.MONGODB_CONNECTION_STRING || "mongodb://root:root@localhost:27778/?directConnection=true&authMechanism=DEFAULT";
const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY || "f36779b711561eabb581a50bc7db94722b60bbbf";
const AIS_SERVER_HOST = process.env.AIS_SERVER_HOST || "aisstream.io"

// MongoDB client
const mongoClient = new MongoClient(MONGODB_CONNECTION_STRING);

// Variables to store AIS messages and ships list
let aisMessageBuffer = [];
let aisMessageDB = new Map();
// aim to store all coords per mmsi
let aisCoordsDB = new Map();
let isIndexCreated = false;
let isProcessing = false;


// Logging function for information messages
function logInfo(message) {
  console.info(`\x1b[33m[${new Date().toLocaleString("en-GB", { timeZone: "UTC" })}]\x1b[0m ${message}`
  );
}

// Logging function for error messages
function logError(message) {
  console.error(`\x1b[31m[${new Date().toLocaleString("en-GB", { timeZone: "UTC" })}]\x1b[0m ${message}`
  );
}

// Logging function for success messages
function logSuccess(message) {
  console.info(`\x1b[32m[${new Date().toLocaleString("en-GB", { timeZone: "UTC" })}]\x1b[0m ${message}`
  );
}

// Loggin function for warning messages
function logWarning(message) {
  console.info(`\x1b[90m[${new Date().toLocaleString("en-GB", { timeZone: "UTC" })}]\x1b[0m ${message}`
  );
}

// Function to connect to MongoDB with retry mechanism
async function connectToMongoDBWithRetry() {
  try {
    logWarning("Connecting to MongoDB...");
    await mongoClient.connect();
    logSuccess("MongoDB Connected");
  } catch (err) {
    logError("Failed to connect to MongoDB, retrying...");
    setTimeout(connectToMongoDBWithRetry, 5000);
  }
}

// Main processing function
async function startProcessing() {
  const database = mongoClient.db("geoglify");
  const realtimeMessagesCollection = database.collection("realtime");
  const streamMessagesCollection = database.collection("stream");  

  // Function to process and save messages in the database
  async function processAndSaveMessages() {
    if (!isProcessing && aisMessageBuffer.length > 0) {
      isProcessing = true;

      const bulkOperations = [];

      const bufferSize = Math.min(aisMessageBuffer.length, 200);

      for (let i = 0; i < bufferSize; i++) {
        const mmsi = aisMessageBuffer[i];
        const message = aisMessageDB.get(mmsi);

        delete message._id;

        // Iterate through each attribute and delete if empty or null
        for (const key in message) {
          if (message.hasOwnProperty(key) && (message[key] === null || message[key] === undefined || message[key] === '')) {
              delete message[key];
          }
        }

        bulkOperations.push({
          updateOne: {
            filter: { mmsi: mmsi },
            update: { $set: message },
            upsert: true,
          },
        });
      }

      try {
        logInfo(
          `Inserting or Updating ${bulkOperations.length} operations into the realtime collection...`
        );
        await realtimeMessagesCollection.bulkWrite(bulkOperations, {
          ordered: false,
        });
        aisMessageBuffer.splice(0, bufferSize);
        logInfo(`Remaining in aisMessageBuffer: ${aisMessageBuffer.length}`);
      } catch (error) {
        logError("Error while processing bulk operations");
      }

      isProcessing = false;
    } else {
      logError("No messages to process or already processing...");
    }
  }

  // Set interval to process and save messages every 5 seconds
  setInterval(processAndSaveMessages, 5000);

  // Create an index for expire_at field if not already created
  if (!isIndexCreated) {
    realtimeMessagesCollection.createIndex(
      { expire_at: 1 },
      { expireAfterSeconds: 0 }
    );
    isIndexCreated = true;
  }
}

// Function to connect to AIS stream with retry mechanism
async function connectToAisStreamWithRetry() {
  try {

    logWarning("Connecting to AIS stream...\n");
    const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

    // WebSocket event handlers
    socket.onopen = function (_) {
      logInfo("Connected to AIS stream");
      let subscriptionMessage = {
        Apikey: AISSTREAM_API_KEY,
        BoundingBoxes: [
          // IFA 
          [
            [51.177847, 0.972709],
            [50.858204,1.857687 ]
          ],
          // NEMO
          [
            [51.447100,1.176615],
            [51.161960,3.220736]
          ]
        ],
      };
      socket.send(JSON.stringify(subscriptionMessage));
    };

    socket.onclose = function (_) {
      logError("WebSocket Closed, retrying...");
      setTimeout(connectToAisStreamWithRetry, 5000);
    };

    socket.onmessage = async (event) => {
      let aisMessage = JSON.parse(event.data);
      // logInfo("Received data from AIS stream! " + aisMessage.MetaData.MMSI + JSON.stringify(aisMessage) , aisMessage);
      processAisMessage(aisMessage);
    };

    startProcessing();
    
  } catch (err) {
    logError("Failed to connect to AIS stream, retrying...");
    setTimeout(connectToAisStreamWithRetry, 5000);
  }
}

// Function to process AIS and NMEA messages
function processAisMessage(message) {
  message = decodeStreamMessage(message);
  aisMessageDB.set(message.mmsi, message);
  // save just the coordinates to a map
  if(aisCoordsDB.has(message.mmsi)){
    aisCoordsDB.get(message.mmsi).push(message.lon, message.lat)  
  }else{
    aisCoordsDB.set(message.mmsi, [message.lon, message.lat])
  }
  locations = aisCoordsDB.get(message.mmsi);
  logInfo(locations.length);

  if (!aisMessageBuffer.includes(message.mmsi))
    aisMessageBuffer.push(message.mmsi);
}

function decodeStreamMessage(message) {
  let now = new Date();
  message.expire_at = new Date(now.getTime() + 30 * 60 * 1000); // Set expiration time to 30 minutes in the future

  logSuccess("Decoded AIS message MMSI: \x1b[32m" + message.MetaData.MMSI + "\n\x1b[0m");
  
  let ship = {
    immsi: parseInt(message.MetaData.MMSI),
    mmsi: message.MetaData.MMSI.toString(),
    shipname: message.MetaData.ShipName.trim(),
    utc: new Date(message.MetaData.time_utc),
    lon: message.MetaData.longitude,
    lat: message.MetaData.latitude,
    location: {
      type: "Point",
      coordinates: [message.MetaData.longitude, message.MetaData.latitude],
    },
    ais_server_host: AIS_SERVER_HOST,
    cog: message?.Message?.PositionReport?.Cog || message?.Message?.StandardClassBPositionReport?.Cog,
    sog: message?.Message?.PositionReport?.Sog || message?.Message?.StandardClassBPositionReport?.Sog,
    hdg: message?.Message?.PositionReport?.TrueHeading || message?.Message?.StandardClassBPositionReport?.TrueHeading,
    dimA: message?.Message?.ShipStaticData?.Dimension?.A,
    dimB: message?.Message?.ShipStaticData?.Dimension?.B,
    dimC: message?.Message?.ShipStaticData?.Dimension?.C,
    dimD: message?.Message?.ShipStaticData?.Dimension?.D,
    imo: message?.Message?.ShipStaticData?.ImoNumber,
    destination: message?.Message?.ShipStaticData?.Destination,
    cargo: message?.Message?.ShipStaticData?.Type,
    callsign: message?.Message?.ShipStaticData?.CallSign,
    draught: message?.Message?.ShipStaticData?.MaximumStaticDraught,
    imo: message?.Message?.ShipStaticData?.ImoNumber,
    expire_at: new Date(now.getTime() + 30 * 60 * 1000), // Set expiration time to 30 minutes in the future
  };

  let etaObj = message?.Message?.ShipStaticData?.Eta;
  let eta = etaObj
    ? new Date(
        etaObj.Year ?? new Date().getFullYear(),
        etaObj.Month,
        etaObj.Day,
        etaObj.Hour,
        etaObj.Minute
      )
    : null;

  ship.eta = eta;
  ship.is_trawler = ship.cargo == 30 ? 1 : 0
  // logSuccess("mmsi: \x1b[32m" + ship.immsi + "-----[" + message.MetaData.longitude + "," +  message.MetaData.latitude + "]\n\x1b[0m");


  return ship;
}

// Start the process by connecting to MongoDB and AIS stream
connectToMongoDBWithRetry();
connectToAisStreamWithRetry();
