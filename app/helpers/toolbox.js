// Import MapboxDraw for drawing functionalities and MeasuresControl for measuring functionalities
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import MeasuresControl from "~/helpers/measures";

// Import configurations from a local module
import configs from "~/helpers/configs";

// Define the Toolbox class
export default class Toolbox {
  constructor(options) {
    this.options = options;

    // Add custom classes for MapboxDraw controls
    MapboxDraw.constants.classes.CONTROL_BASE = "maplibregl-ctrl";
    MapboxDraw.constants.classes.CONTROL_PREFIX = "maplibregl-ctrl-";
    MapboxDraw.constants.classes.CONTROL_GROUP = "maplibregl-ctrl-group";

    // Initialize the mode as none
    this.mode = "none";
  }

  // Method called when adding the Toolbox to the map
  onAdd(map) {
    this._map = map;
    this._initControl(); // Initialize the control UI
    return this._container;
  }

  // Initialize the control UI
  _initControl() {
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl mapboxgl-ctrl maplibregl-measures maplibregl-ctrl-group mapboxgl-ctrl-group";

    // Initialize the MeasuresControl
    this.measures = new MeasuresControl();

    // Initialize the MapboxDraw control
    this.draw = new MapboxDraw({
      displayControlsDefault: false,
      styles: configs.getMapDrawStyles(),
      modes: MapboxDraw.modes,
      controls: {
        point: true,
        line_string: true,
        polygon: true,
        trash: true,
        combine_features: false,
        uncombine_features: false,
      },
    });

    // Initialize buttons for switching between modes
    this.initMeasuresBtn();
    this.initDrawBtn();
    this.initExportBtn();
  }

  // Initialize the button for switching to the measures mode
  initMeasuresBtn() {
    let btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Measures";
    btn.className = "measures_control";

    // Toggle between modes when the button is clicked
    btn.addEventListener("click", () => {
      this.mode = this.mode == "measures" ? "none" : "measures";
      this._setControl(this.mode);
    });

    this._container.appendChild(btn);
  }

  // Initialize the button for switching to the draw mode
  initDrawBtn() {
    let btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Draw";
    btn.className = "draw_control";

    // Toggle between modes when the button is clicked
    btn.addEventListener("click", () => {
      this.mode = this.mode == "draw" ? "none" : "draw";
      this._setControl(this.mode);
    });

    this._container.appendChild(btn);
  }

  initExportBtn() {
    let btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Export";
    btn.className = "export_control";

    // Toggle between modes when the button is clicked
    btn.addEventListener("click", () => {
      let blob = this._map.getCanvas().toDataURL('image/png');
      this.saveAs(blob, 'geoglify.png');
    });

    this._container.appendChild(btn);
  }

  // Method called when removing the Toolbox from the map
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }

  // Set the active control based on the mode
  _setControl(mode) {
    switch (mode) {
      case "draw":
        if (this._map.hasControl(this.measures)) {
          this._map.removeControl(this.measures);
        }

        this._map.addControl(this.draw, "top-right");
        document.querySelector(".draw_control").style.backgroundColor = "#ccc";
        document.querySelector(".measures_control").disabled = true;
        break;

      case "measures":
        if (this._map.hasControl(this.draw)) {
          this._map.removeControl(this.draw);
        }

        this._map.addControl(this.measures, "top-right");
        document.querySelector(".measures_control").style.backgroundColor = "#ccc";
        document.querySelector(".draw_control").disabled = true;
        break;

      case "none":
        if (this._map.hasControl(this.draw)) {
          this._map.removeControl(this.draw);
        }

        if (this._map.hasControl(this.measures)) {
          this._map.removeControl(this.measures);
        }

        document.querySelector(".draw_control").style.backgroundColor = "white";
        document.querySelector(".measures_control").style.backgroundColor = "white";

        document.querySelector(".draw_control").disabled = false;
        document.querySelector(".measures_control").disabled = false;

        break;
    }
  }

  saveAs(uri, filename) {
    var link = document.createElement("a");

    if (typeof link.download === "string") {
      link.href = uri;
      link.download = filename;

      //Firefox requires the link to be in the body
      document.body.appendChild(link);

      //simulate click
      link.click();

      //remove the link when done
      document.body.removeChild(link);
    } else {
      window.open(uri);
    }
  }
}
