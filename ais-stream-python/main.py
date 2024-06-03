import asyncio
import websockets
import pymongo
import json
from datetime import datetime, timedelta
from bson import json_util

from azure.eventhub import EventData, TransportType
from azure.eventhub.aio import EventHubProducerClient
from azure.identity.aio import DefaultAzureCredential
import logging
import os
import time
logging.basicConfig(level=logging.DEBUG)

AISSTREAM_API_KEY = "f36779b711561eabb581a50bc7db94722b60bbbf"
MONGODB_CONNECTION_STRING = "mongodb://root:root@localhost:27778/?directConnection=true&authMechanism=DEFAULT"
AIS_SERVER_HOST = "aisstream.io"
dbclient = pymongo.MongoClient(MONGODB_CONNECTION_STRING)
geodb = dbclient['geoglify']
allcoords_col = geodb['realtime']
# create a set to store ships
ships = set()
shipsDict = {}
coordsDict = {}

EVENT_HUB_FULLY_QUALIFIED_NAMESPACE = "mesh-uks-stream-ehns-01.servicebus.windows.net"
# EVENT_HUB_NAME = "aisstream.io"
EVENT_HUB_NAME = "aisstream.io"


credential = DefaultAzureCredential()
print(os.environ)

def merge_and_update(dict_1, dict_2):
    result = dict_1 | dict_2
    return result


def decodeStreamMessage(message) -> dict:
    now = datetime.now()
    message_type = message["MessageType"]
    expire_at = now + timedelta(minutes=30)
    utc_str = str(message['MetaData']['time_utc'])
    date_format = '%Y-%m-%d %H:%M:%S.%f000 %z %Z'
    # utc = datetime.strptime(utc_str,date_format).date()
    ship = {
        'immsi': int(message['MetaData']['MMSI']),
        'mmsi': str(message['MetaData']['MMSI']),
        'lon': message['MetaData']['longitude'],
        'lat': message['MetaData']['latitude'],
        'shipname': message['MetaData']['ShipName'].strip(),
        'utc': utc_str,
        'expire_at': expire_at,
        'ais_server_host': AIS_SERVER_HOST,
        'location': {'type': "Point",
                     'coordinates': [message['MetaData']['longitude'], message['MetaData']['latitude']]}
    }

    # use some defaults:
    ship['cargo'] = 0
    ship['coordcount'] = 0

    if message_type == "ShipStaticData":
        dimA = message['Message']['ShipStaticData']['Dimension']['A']
        dimB = message['Message']['ShipStaticData']['Dimension']['B']
        dimC = message['Message']['ShipStaticData']['Dimension']['C']
        dimD = message['Message']['ShipStaticData']['Dimension']['D']
        destination = message['Message']['ShipStaticData']['Destination'].strip()
        cargo = message['Message']['ShipStaticData']['Type']
        callsign  = message['Message']['ShipStaticData']['CallSign'].strip()
        draught = message['Message']['ShipStaticData']['MaximumStaticDraught']
        imo = message['Message']['ShipStaticData']['ImoNumber']
        ship['dimA'] = dimA
        ship['dimB'] = dimB
        ship['dimC'] = dimC
        ship['dimD'] = dimD
        ship['destination'] = destination
        ship['cargo'] = cargo
        ship['callsign'] = callsign
        ship['draught'] = draught
        ship['imo'] = imo

    if message_type == "PositionReport":
        cog = message['Message']['PositionReport']['Cog']
        sog = message['Message']['PositionReport']['Sog']
        hdg = message['Message']['PositionReport']['TrueHeading']
        ship['cog'] = cog
        ship['sog'] = sog
        ship['hdg'] = hdg


    if message_type == "StandardClassBPositionReport":
        cog = message['Message']['StandardClassBPositionReport']['Cog']
        sog = message['Message']['StandardClassBPositionReport']['Sog']
        hdg = message['Message']['StandardClassBPositionReport']['TrueHeading']
        ship['cog'] = cog
        ship['sog'] = sog
        ship['hdg'] = hdg
    
    return ship

async def connect_ais_stream():

    async with websockets.connect(f"wss://stream.{AIS_SERVER_HOST}/v0/stream") as websocket:
        subscribe_message = {"APIKey": AISSTREAM_API_KEY, "BoundingBoxes": [[[51.177847, 0.972709],[50.858204, 1.857687 ]],[[51.447100, 1.176615],[51.161960,3.220736]]]}
        subscribe_message_json = json.dumps(subscribe_message)
        await websocket.send(subscribe_message_json)

        isIndexCreated = False

        async for message_json in websocket:
            message = json.loads(message_json)
            # print(message)

            # if message_type == "PositionReport":
                # the message parameter contains a key of the message type which contains the message itself
                # ais_message = message['Message']['PositionReport']
                # MMSI = ais_message['UserID']
                # nowutctime = datetime.now(timezone.utc)
                # print(f"[{nowutctime}] ShipId: {ais_message['UserID']} Latitude: {ais_message['Latitude']} Longitude: {ais_message['Longitude']}")
                # mydict = { "mmsi": str(MMSI), "lat": ais_message['Latitude'], "lon": ais_message['Longitude'], "nowutctime": nowutctime }
            ship = decodeStreamMessage(message=message)
            print(ship)
            # print(ship['immsi'])
            ships.add(ship['immsi'])
            # print(f'size of shipsset={len(ships)}')
            # print(ships)
            if ship['immsi'] not in shipsDict.keys():
                # add the ship object to the master shipslist
                print("add the ship to the ship objects list")
                shipsDict[ship['immsi']] = ship
                coordsDict[ship['immsi']] = [[message['MetaData']['longitude'], message['MetaData']['latitude']]]

            else:
                print("skip adding this ship the to master ship objects list")
                print("update existing ship any latest details")
                existingShip = shipsDict.get(ship['immsi'])
                print(f'existing ship record size = {len(existingShip)} and the new ship record is {len(ship)}')
                ship = merge_and_update(existingShip, ship)
                print(f'merged ship record size  = {len(ship)} ')
                shipsDict[ship['immsi']] = ship
                if [[message['MetaData']['longitude'], message['MetaData']['latitude']]] not in coordsDict[ship['immsi']]:
                    coordsDict[ship['immsi']].append([message['MetaData']['longitude'], message['MetaData']['latitude']])
                
            print(f'{ship['immsi']}')
            ship['coords'] = coordsDict[ship['immsi']]
            print(f'size of coordsDict {len(coordsDict[ship['immsi']])}')
            # save the number of coords for that ship
            ship['coordcount'] = len(coordsDict[ship['immsi']])
            print(coordsDict[ship['immsi']])
            print(f'size of shipsDict={len(shipsDict)}, size of the shipsset={len(ships)}')

            # ship_json = json.dumps(shipsDict.get(ship['immsi']), default=json_util.default )#, sort_keys=True, indent=4)
            # if ship['cargo'] == 30:
            
            x = allcoords_col.update_one({'immsi': ship['immsi']}, {"$set": ship}, upsert=True)
            
            if not isIndexCreated:
                allcoords_col.create_index( 'expire_at', expireAfterSeconds=0)
                isIndexCreated = True

async def run():
    # Create a producer client to send messages to the event hub.
    # Specify a credential that has correct role assigned to access
    # event hubs namespace and the event hub name.
    producer = EventHubProducerClient(
        fully_qualified_namespace=EVENT_HUB_FULLY_QUALIFIED_NAMESPACE,
        eventhub_name=EVENT_HUB_NAME,
        credential=credential,
        transport_type=TransportType.AmqpOverWebsocket,
        logging_enable=True
    )
    to_send_message_cnt = 500
    bytes_per_message = 256

    async with producer:
        event_data_batch = await producer.create_batch()
        for i in range(to_send_message_cnt):
            event_data = EventData('D' * bytes_per_message)
            try:
                event_data_batch.add(event_data)
            except ValueError:
                await producer.send_batch(event_data_batch)
                event_data_batch = await producer.create_batch()
                event_data_batch.add(event_data)
        if len(event_data_batch) > 0:
            await producer.send_batch(event_data_batch)

if __name__ == "__main__":
    asyncio.run(connect_ais_stream())
    # start_time = time.time()
    # asyncio.run(run())
    # print("Send messages in {} seconds.".format(time.time() - start_time))