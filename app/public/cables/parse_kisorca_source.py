import re
import json

INPUT_FILE = './map-data-478.js'
ifa2_21 = 'IFA2000 CABLE 21 ROUTE 3'
ifa2_22 = 'IFA2000 CABLE 22 ROUTE 3'
ifa2_43 = 'IFA2000 CABLE 43 ROUTE 1'
ifa2_44 = 'IFA2000 CABLE 44 ROUTE 1'
nemo_link = 'NEMO LINK LTD'
north_sea_link = 'NORTH SEA LINK NORTH'
west_link_1 = 'WESTERN LINK ARDNEILL TO WIRRAL 1'
west_link_2 = 'WESTERN LINK ARDNEILL TO WIRRAL 2'



def get_kisorca_json(cablename: str):
    my_regex = fr"{re.escape(cablename)}"
    p = re.compile(my_regex)
    raw_coord_line = ""

    count = 0
    with open(INPUT_FILE, 'r') as f:

        for line in f:
            count += 1
            if re.findall(p, line):
                # print(count)

                with open(INPUT_FILE, 'r') as fh:
                    raw_coord_line = fh.readlines()[count - 3]
                    print(raw_coord_line)
    # Now write to a geojsonfile
    cable_clean = re.sub(r'^.*polyCoordinates\[\d\d\d\d\] = \[', '', raw_coord_line)
    # cable_clean = raw_coord_line.replace('    polyCoordinates[5007] = [', '')
    coords = cable_clean.split(', ')
    cablename_file = cablename.replace(" ", "")
    ListLong = []
    ListLat = []
    
    with open(f'./{cablename_file}.geojson', 'w') as cf:  # noqa: E501
        # Writing data to a file
        for coord in coords:
            # print(coord)
            split1_1 = coord.replace('new google.maps.LatLng', '')
            # print(split1_1)
            split_2 = split1_1.lstrip('(')
            split_3 = split_2.rstrip(')')
            # print(split_3)

            match = re.match(r'([0-9.-]+).+?([0-9.-]+)', split_3)
            lat = float(match.group(1))
            ListLat.append(lat)
            long = float(match.group(2))
            ListLong.append(long)
            # cf.write(f'[ {long}, {lat} ],' + '\n')

        coords = [  [lon, lat] 
                    for lon, lat in zip(ListLong, ListLat) ]
        # print(coords)

        geo_json = {"type": "Feature",
                    'properties': {},
                    "geometry": {
                        "type": "LineString", 
                        "coordinates" : [ coords]}}
        json.dump(geo_json, cf)



for cablename in [ifa2_21, ifa2_22, ifa2_43, ifa2_44,nemo_link,north_sea_link,west_link_1,west_link_2]:
    get_kisorca_json(cablename=cablename)
