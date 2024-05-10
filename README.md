# AIS Realtime Demo

This is a POC to show how realtime streaming AIS ( vessel data) can be mapped. It is based on the back of Geoglify which is created by [https://github.com/leoneljdias](https://github.com/leoneljdias).


![alt text](docs/demo.png "Demo")


## how does this differ from the original?

I have stripped out all the elements that deem either ot not work or not needed. E.g the Terrestrial strem `ais_decoder` isn't needed. Nor was the extra components around `llama` which appears to be work in progress. 

## What is interesting about this demo:
1. The monogodb just holds a limited amount of realtime data for unique vessels. This is good because, you will never run out of disk space!
2. The ais stream is free to use
3. The POC is quick and easy to spin up
4. Easy to visualise data

## Prerequisites

Make sure you have the following installed on your system:

- Docker
- Ensure that you have sudo access ( double check this)

## Try this at home
1. Clone this Repository
```bash 
    git clone https://github.com/VireshDoshi/geoglify
    cd geogligy
```
2. Start Geoglify using Docker Compose:

```bash
   docker-compose up -d
```

3. Verify that Geoglify is running:

   - Open your browser and navigate to [http://localhost:3000](http://localhost:3000)
   - Ensure to click on the search to see that a list of vessels appears.
   - Click on a vessel to see information 

4. Navigate to the API to ensure it is up and running 
   - Open your browser and navigate to [http://localhost:8081/ships](http://localhost:8081/ships)

5. Verify the app api route is setup correct by navigating to 
   - Open a browser window and navigate to [http://localhost:3000/api/ships] (http://localhost:3000/api/ships)


## Cables data
Cables shown in  yellow have been added using data provided freely by[https://kis-orca.org/](https://kis-orca.org/)

To generate new cable data. use the Python script as follows
1. download the raw source kis-orca map data file [https://kis-orca.org/wp-content/themes/kisorca/js/map-data/map-data-478.js](https://kis-orca.org/wp-content/themes/kisorca/js/map-data/map-data-478.js) and save it to the `cables/` folder
2. Add the name of the cable to the `parse_kisorca_source.py` python script and execute it to generate the geojson linestring data.
3. goto this file and add the cable data
`app/components/map/Index.vue`

## Under the Docker hood
1. To view just the ais-stream logs
    ```bash
    $ docker compose logs ais-stream -f
    * replace ais-stream with another service accordinlgy
    ```
2. To view all running services 
   ```bash 
   $ docker compose ps
   ```
3. To close down the instances
   ```bash
   $ docker compose down
   ```
4. To rebuild all images without cache 
   ```bash
   $ docker compose build --no-cache
   ```

## Local app development with a working backend 
Follow these steps to do some local app development while keeping the backend services up and running
1. Start up the Demo by following the steps above
2. Now stop just the app docker container
    ```bash
    $ docker compose stop app
    ```
3. Goto this file `app/nuxt.config.ts` and change the entry from `host.docker.internal` to `localhost`
4. go into the app folder and run
    ```bash
    $ brew install node
    $ npm install
    $ npm run dev
    ```
5. Check `http://localhost:3000` to see that the app is running. 
6. Now app code changes can be seen without needing to rebuild the docker images.

## Connect to the running mongodb to run queries using CLI
Mongodb is where we store the realtime vessel data which is presented on the app frontend via the api. We use `mongosh`
1. find out the mongodb containerid and jump into it
    ```bash
    $ docker ps
    $ docker exec -it 40613f20cf21 bash
    ```
2. lets now connect to the database cli
    ```bash
    mongosh "mongodb://root:root@127.0.0.1:27778/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.5"
    ```
## mongo useful cli commands
   ```bash
    show databases
    use geoglify
    db.realtime.find()
    db.realtime.find({'cargo': 30})
    db.realtime.find({'mmsi': '209351000'})
    db.realtime.countDocuments({'cargo': 30})
   ```

## License

This project is licensed under the [MIT License](LICENSE) - see the file for details.

Take a look at our code and explore the vast world of Geoglify! We look forward to community contributions and making this project a go-to resource for maritime data analysis and planning in the industry.


