// Map Editor - Visual GTFS route creation
class MapEditor {
  constructor(gtfsEditor) {
    this.gtfsEditor = gtfsEditor;
    this.map = null;
    this.currentRoute = null;
    this.currentTrip = null;
    this.routeStops = [];
    this.routeShape = null;
    this.drawnItems = new L.FeatureGroup();
    this.isCreatingTrip = false;
    this.stopCounter = 1;
    this.routeCounter = 1;
    this.tripCounter = 1;
    this.workflow = "route"; // 'route', 'trip'

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    document
      .getElementById("tableViewBtn")
      .addEventListener("click", () => this.switchToTableView());
    document
      .getElementById("mapViewBtn")
      .addEventListener("click", () => this.switchToMapView());

    // Route creation listeners
    document
      .getElementById("createRouteBtn")
      .addEventListener("click", () => this.createNewRoute());
    document
      .getElementById("selectExistingRouteBtn")
      .addEventListener("click", () => this.showExistingRoutes());
    document
      .getElementById("selectRouteBtn")
      .addEventListener("click", () => this.selectExistingRoute());
    document
      .getElementById("cancelSelectBtn")
      .addEventListener("click", () => this.cancelRouteSelection());

    // Trip creation listeners
    document
      .getElementById("startTripBtn")
      .addEventListener("click", () => this.startNewTrip());
    document
      .getElementById("finishTripBtn")
      .addEventListener("click", () => this.finishTrip());
    document
      .getElementById("clearTripBtn")
      .addEventListener("click", () => this.clearCurrentTrip());
    document
      .getElementById("backToRouteBtn")
      .addEventListener("click", () => this.backToRouteCreation());

    // Location and coordinate listeners
    document
      .getElementById("searchLocationBtn")
      .addEventListener("click", () => this.searchLocation());
    document
      .getElementById("addStopByCoordBtn")
      .addEventListener("click", () => this.addStopByCoordinates());

    // Timing method listener
    document
      .getElementById("timingMethodSelect")
      .addEventListener("change", () => this.handleTimingMethodChange());

    // Calendar method listener
    document
      .getElementById("calendarMethodSelect")
      .addEventListener("change", () => this.handleCalendarMethodChange());

    // Color input synchronization
    document
      .getElementById("routeColorInput")
      .addEventListener("change", () => this.syncColorFromPicker());
    document
      .getElementById("routeColorHex")
      .addEventListener("input", () => this.syncColorFromHex());
    document
      .getElementById("routeTextColorInput")
      .addEventListener("change", () => this.syncTextColorFromPicker());
    document
      .getElementById("routeTextColorHex")
      .addEventListener("input", () => this.syncTextColorFromHex());

    // Trip info update listeners
    document
      .getElementById("tripHeadsignInput")
      .addEventListener("input", () => this.updateTripInputs());
    document
      .getElementById("directionSelect")
      .addEventListener("change", () => this.updateTripInputs());

    // Stops list toggle listener
    document
      .getElementById("stopsListToggle")
      .addEventListener("click", () => this.toggleStopsList());

    // Panel collapse listener
    document
      .getElementById("collapseRouteInfo")
      .addEventListener("click", () => this.togglePanelCollapse());

    // Enter key support for location search
    document
      .getElementById("locationSearchInput")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.searchLocation();
        }
      });

    // Info panel controls
    document
      .getElementById("closeRouteInfo")
      .addEventListener("click", () => this.hideInfoPanel());

    // Initialize contrast ratio calculation
    this.updateContrastRatio();
  }

  showInfoPanel() {
    document.getElementById("floatingRouteInfo").style.display = "block";
  }

  hideInfoPanel() {
    document.getElementById("floatingRouteInfo").style.display = "none";
  }

  switchToTableView() {
    document.getElementById("tableView").style.display = "block";
    document.getElementById("mapView").style.display = "none";
    document.getElementById("tableViewBtn").classList.add("active");
    document.getElementById("mapViewBtn").classList.remove("active");
  }

  switchToMapView() {
    document.getElementById("tableView").style.display = "none";
    document.getElementById("mapView").style.display = "block";
    document.getElementById("tableViewBtn").classList.remove("active");
    document.getElementById("mapViewBtn").classList.add("active");

    // Use multiple timeouts to ensure proper initialization
    setTimeout(() => {
      if (!this.map) {
        this.initializeMap();
      } else {
        // Force container to re-measure
        const container = document.getElementById("mapContainer");
        if (container) {
          container.style.width = "";
          container.style.height = "";
        }
        // Refresh map size in case container changed
        this.map.invalidateSize(true);
      }
    }, 100);

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize(true);
        this.loadExistingData();
      }
    }, 300);
  }

  initializeMap() {
    console.log("Initializing map...");

    // Check if container exists and has dimensions
    const container = document.getElementById("mapContainer");
    if (!container) {
      console.error("Map container not found");
      return;
    }

    console.log(
      "Container dimensions:",
      container.offsetWidth,
      "x",
      container.offsetHeight
    );

    try {
      // Hide loading indicator and initialize map
      const loadingElement = document.getElementById("mapLoading");
      if (loadingElement) {
        loadingElement.style.display = "none";
      }

      // Initialize map centered on a default location (can be changed)
      this.map = L.map("mapContainer").setView([40.7128, -74.006], 12); // NYC default
      console.log("Map object created");

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(this.map);
      console.log("Tiles added");
    } catch (error) {
      console.error("Error initializing map:", error);
      // Show error message in place of loading indicator
      const loadingElement = document.getElementById("mapLoading");
      if (loadingElement) {
        loadingElement.innerHTML = `
                    <div style="text-align: center; color: #d32f2f;">
                        <h4>Map failed to load</h4>
                        <p>Please check your internet connection and refresh the page.</p>
                        <p>Error: ${error.message}</p>
                    </div>
                `;
      }
      return;
    }

    // Add drawn items layer
    this.map.addLayer(this.drawnItems);

    // Initialize drawing controls
    const drawControl = new L.Control.Draw({
      position: "topright",
      draw: {
        polyline: {
          shapeOptions: {
            color: this.currentRoute
              ? `#${this.currentRoute.color}`
              : "#4caf50",
            weight: 4,
            opacity: 0.8,
          },
        },
        polygon: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: this.drawnItems,
        remove: true,
      },
    });
    this.map.addControl(drawControl);

    // Handle map events
    this.map.on("click", (e) => this.handleMapClick(e));
    this.map.on(L.Draw.Event.CREATED, (e) => this.handleDrawCreated(e));
    this.map.on(L.Draw.Event.EDITED, (e) => this.handleDrawEdited(e));
    this.map.on(L.Draw.Event.DELETED, (e) => this.handleDrawDeleted(e));

    // Force map to resize multiple times to ensure proper sizing
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize(true);
        console.log("Map size invalidated (first pass)");
      }
    }, 500);

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize(true);
        console.log("Map size invalidated (second pass)");
      }
    }, 1000);

    // Try to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          this.map.setView([lat, lng], 13);
          console.log("Location set to user position:", lat, lng);
        },
        (error) => {
          console.log("Geolocation error:", error.message);
        }
      );
    }

    console.log("Map initialization completed");
  }

  handleMapClick(e) {
    if (!this.isCreatingTrip) return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // Check timing method
    const timingMethod = document.getElementById("timingMethodSelect").value;

    if (timingMethod === "manual") {
      this.promptForStopTime(lat, lng);
    } else {
      this.addStop(lat, lng);
    }
  }

  promptForStopTime(lat, lng) {
    // Create a modal-like prompt for time input
    const arrivalTime = prompt("Enter arrival time (HH:MM):");
    if (!arrivalTime) return;

    // Validate time format
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(arrivalTime)) {
      alert("Please enter time in HH:MM format (e.g., 08:30)");
      return;
    }

    const departureTime = prompt(
      "Enter departure time (HH:MM) or press Cancel to use arrival time:",
      arrivalTime
    );

    const customTimes = {
      arrival: arrivalTime,
      departure: departureTime || arrivalTime,
    };

    this.addStop(lat, lng, null, customTimes);
  }

  handleDrawCreated(e) {
    const layer = e.layer;

    if (e.layerType === "polyline") {
      // This is a route shape
      if (this.routeShape) {
        this.drawnItems.removeLayer(this.routeShape);
      }

      // Update the line color to match route color
      const routeColor = this.currentRoute
        ? `#${this.currentRoute.color}`
        : "#4caf50";
      layer.setStyle({
        color: routeColor,
        weight: 4,
        opacity: 0.8,
      });

      this.routeShape = layer;
      this.drawnItems.addLayer(layer);
      this.updateRouteInfo();
    }
  }

  handleDrawEdited() {
    this.updateRouteInfo();
  }

  handleDrawDeleted(e) {
    if (this.routeShape && e.layers.hasLayer(this.routeShape)) {
      this.routeShape = null;
    }
    this.updateRouteInfo();
  }

  createNewRoute() {
    const routeName = document.getElementById("routeNameInput").value.trim();
    const routeLongName = document
      .getElementById("routeLongNameInput")
      .value.trim();

    if (!routeName) {
      alert("Please enter a route short name");
      return;
    }

    const routeColor = document.getElementById("routeColorInput").value;
    const routeTextColor = document.getElementById("routeTextColorInput").value;

    this.currentRoute = {
      id: `route_${this.routeCounter++}`,
      name: routeName,
      longName: routeLongName || `${routeName} Line`, // Use provided long name or generate default
      type: document.getElementById("routeTypeSelect").value,
      color: routeColor.substring(1), // Remove # for GTFS format
      textColor: routeTextColor.substring(1), // Remove # for GTFS format
      isNew: true,
    };

    this.showTripSection();
  }

  showExistingRoutes() {
    const parser = this.gtfsEditor.parser;
    const routes = parser.getFileData("routes.txt");
    const select = document.getElementById("existingRouteSelect");

    // Clear existing options
    select.innerHTML = '<option value="">Choose a route...</option>';

    routes.forEach((route) => {
      const option = document.createElement("option");
      option.value = route.route_id;
      option.textContent = `${
        route.route_short_name || route.route_long_name
      } (${this.getRouteTypeName(route.route_type)})`;
      select.appendChild(option);
    });

    document.getElementById("routeSection").style.display = "none";
    document.getElementById("routeSelectSection").style.display = "block";
  }

  selectExistingRoute() {
    const routeId = document.getElementById("existingRouteSelect").value;
    if (!routeId) {
      alert("Please select a route");
      return;
    }

    const parser = this.gtfsEditor.parser;
    const routes = parser.getFileData("routes.txt");
    const selectedRoute = routes.find((r) => r.route_id === routeId);

    if (selectedRoute) {
      this.currentRoute = {
        id: selectedRoute.route_id,
        name: selectedRoute.route_short_name || selectedRoute.route_long_name,
        longName:
          selectedRoute.route_long_name || selectedRoute.route_short_name,
        type: selectedRoute.route_type,
        color: selectedRoute.route_color || "4caf50",
        isNew: false,
      };

      this.showTripSection();
    }
  }

  cancelRouteSelection() {
    document.getElementById("routeSection").style.display = "block";
    document.getElementById("routeSelectSection").style.display = "none";
  }

  showTripSection() {
    document.getElementById("routeSection").style.display = "none";
    document.getElementById("routeSelectSection").style.display = "none";
    document.getElementById("tripSection").style.display = "block";

    // Update route info display with more details
    const routeStatus = this.currentRoute.isNew
      ? "(New Route)"
      : "(Existing Route)";
    const routeColor = this.currentRoute.color
      ? `#${this.currentRoute.color}`
      : "#4caf50";

    // Update route banner styling
    const banner = document.querySelector(".current-route-banner");
    if (banner) {
      banner.style.borderLeftColor = routeColor;
    }

    // Update route information
    document.getElementById("currentRouteName").innerHTML = `
            <span style="color: ${routeColor}; font-weight: bold;">${this.currentRoute.name}</span> 
            <small style="color: #666;">${routeStatus}</small>
        `;
    document.getElementById("currentRouteType").textContent =
      this.getRouteTypeName(this.currentRoute.type);
    document.getElementById("currentRouteId").textContent =
      this.currentRoute.id;

    // Initialize calendar UI
    this.handleCalendarMethodChange();
  }

  backToRouteCreation() {
    this.clearCurrentTrip();
    document.getElementById("routeSection").style.display = "block";
    document.getElementById("tripSection").style.display = "none";
    this.hideInfoPanel();
    this.currentRoute = null;
  }

  startNewTrip() {
    if (this.isCreatingTrip) {
      this.clearCurrentTrip();
    }

    const headsign = document.getElementById("tripHeadsignInput").value.trim();
    if (!headsign) {
      alert("Please enter a trip headsign");
      return;
    }

    // Validate service calendar selection is required
    const calendarMethod = document.getElementById(
      "calendarMethodSelect"
    ).value;
    if (!calendarMethod) {
      alert("Please select a service calendar option");
      return;
    }

    // Additional validation for existing service selection
    if (calendarMethod === "existing") {
      const selectedService = document.getElementById(
        "existingServiceSelect"
      ).value;
      if (!selectedService) {
        alert("Please select an existing service from the dropdown");
        return;
      }
    }

    // Additional validation for new service creation
    if (calendarMethod === "new") {
      const serviceName = document
        .getElementById("serviceNameInput")
        .value.trim();
      const startDate = document.getElementById("startDateInput").value;
      const endDate = document.getElementById("endDateInput").value;

      if (!serviceName) {
        alert("Please enter a service name");
        return;
      }
      if (!startDate || !endDate) {
        alert("Please set start and end dates for the new service");
        return;
      }

      // Check if at least one day is selected
      const daysSelected = [
        "mondayCheck",
        "tuesdayCheck",
        "wednesdayCheck",
        "thursdayCheck",
        "fridayCheck",
        "saturdayCheck",
        "sundayCheck",
      ].some((dayId) => document.getElementById(dayId).checked);

      if (!daysSelected) {
        alert(
          "Please select at least one day of operation for the new service"
        );
        return;
      }
    }

    this.isCreatingTrip = true;
    this.routeStops = [];
    this.currentTrip = {
      id: `trip_${this.currentRoute.id}_${this.tripCounter++}`,
      headsign: headsign,
      direction: document.getElementById("directionSelect").value,
      shortName: document.getElementById("tripShortNameInput").value.trim(),
    };

    document.getElementById("startTripBtn").disabled = true;
    document.getElementById("finishTripBtn").disabled = false;
    this.showInfoPanel();

    this.updateTripInfo();

    // Change cursor to crosshair
    document.getElementById("mapContainer").style.cursor = "crosshair";
  }

  searchLocation() {
    const query = document.getElementById("locationSearchInput").value.trim();
    if (!query) {
      alert("Please enter a location to search");
      return;
    }

    // Use Nominatim (OpenStreetMap) geocoding service
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&limit=1&addressdetails=1`;

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (data && data.length > 0) {
          const result = data[0];
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);

          // Only center map on the found location - no marker creation
          this.map.setView([lat, lng], 14);

          // Show a brief notification instead of a marker
          this.showLocationNotification(result.display_name, lat, lng);
        } else {
          alert("Location not found. Please try a different search term.");
        }
      })
      .catch((error) => {
        console.error("Geocoding error:", error);
        alert(
          "Error searching for location. Please check your internet connection."
        );
      });
  }

  showLocationNotification(displayName, lat, lng) {
    // Create a temporary notification overlay
    const notification = document.createElement("div");
    notification.className = "location-notification";
    notification.innerHTML = `
            <div class="notification-content">
                <h4>📍 Location Found</h4>
                <p><strong>${displayName}</strong></p>
                <p>Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</p>
                <small>Map centered on this location</small>
            </div>
        `;

    // Style the notification
    notification.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: white;
            border: 2px solid #4caf50;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            max-width: 300px;
            font-family: system-ui, -apple-system, sans-serif;
        `;

    // Add to map container
    this.map.getContainer().appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);

    // Add click to dismiss
    notification.addEventListener("click", () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }

  addStopByCoordinates() {
    const lat = parseFloat(document.getElementById("latInput").value);
    const lng = parseFloat(document.getElementById("lngInput").value);

    if (isNaN(lat) || isNaN(lng)) {
      alert("Please enter valid latitude and longitude values");
      return;
    }

    if (lat < -90 || lat > 90) {
      alert("Latitude must be between -90 and 90 degrees");
      return;
    }

    if (lng < -180 || lng > 180) {
      alert("Longitude must be between -180 and 180 degrees");
      return;
    }

    if (!this.isCreatingTrip) {
      alert("Please start creating a trip first");
      return;
    }

    // Check if manual timing is enabled and get times
    const timingMethod = document.getElementById("timingMethodSelect").value;
    let customTimes = null;

    if (timingMethod === "manual") {
      const arrivalTime = document.getElementById("coordArrivalInput").value;
      const departureTime = document.getElementById(
        "coordDepartureInput"
      ).value;

      if (!arrivalTime) {
        alert("Please enter arrival time for manual timing mode");
        return;
      }

      customTimes = {
        arrival: arrivalTime,
        departure: departureTime || arrivalTime,
      };
    }

    // Add the stop at the specified coordinates
    this.addStop(lat, lng, null, customTimes);

    // Clear the input fields
    document.getElementById("latInput").value = "";
    document.getElementById("lngInput").value = "";
    document.getElementById("coordArrivalInput").value = "";
    document.getElementById("coordDepartureInput").value = "";

    // Pan to the new stop
    this.map.setView([lat, lng], Math.max(this.map.getZoom(), 15));
  }

  handleTimingMethodChange() {
    const method = document.getElementById("timingMethodSelect").value;
    const autoInputs = document.getElementById("autoTimingInputs");
    const manualInputs = document.getElementById("manualTimingInputs");
    const coordTimeInputs = document.getElementById("coordTimeInputs");

    if (method === "auto") {
      autoInputs.style.display = "block";
      manualInputs.style.display = "none";
      coordTimeInputs.style.display = "none";
    } else {
      autoInputs.style.display = "none";
      manualInputs.style.display = "block";
      coordTimeInputs.style.display = "block";
    }
  }

  handleCalendarMethodChange() {
    const method = document.getElementById("calendarMethodSelect").value;
    const existingInputs = document.getElementById("existingCalendarInputs");
    const newInputs = document.getElementById("newCalendarInputs");

    if (method === "existing") {
      existingInputs.style.display = "block";
      newInputs.style.display = "none";
      this.populateExistingServices();
    } else if (method === "new") {
      existingInputs.style.display = "none";
      newInputs.style.display = "block";
      this.setDefaultDates();
    } else {
      // For 'none' or empty selection, hide both input sections
      existingInputs.style.display = "none";
      newInputs.style.display = "none";
    }
  }

  populateExistingServices() {
    const parser = this.gtfsEditor.parser;
    const existingServices = parser.getFileData("calendar.txt") || [];
    const select = document.getElementById("existingServiceSelect");

    // Clear existing options except the first one
    select.innerHTML = '<option value="">Choose a service...</option>';

    existingServices.forEach((service) => {
      const option = document.createElement("option");
      option.value = service.service_id;
      option.textContent = `${service.service_id} (${this.getServiceDaysText(
        service
      )})`;
      select.appendChild(option);
    });
  }

  getServiceDaysText(service) {
    const days = [];
    if (service.monday === "1") days.push("Mon");
    if (service.tuesday === "1") days.push("Tue");
    if (service.wednesday === "1") days.push("Wed");
    if (service.thursday === "1") days.push("Thu");
    if (service.friday === "1") days.push("Fri");
    if (service.saturday === "1") days.push("Sat");
    if (service.sunday === "1") days.push("Sun");
    return days.join(", ");
  }

  setDefaultDates() {
    const today = new Date();
    const nextYear = new Date(
      today.getFullYear() + 1,
      today.getMonth(),
      today.getDate()
    );

    document.getElementById("startDateInput").value = today
      .toISOString()
      .split("T")[0];
    document.getElementById("endDateInput").value = nextYear
      .toISOString()
      .split("T")[0];
  }

  syncColorFromPicker() {
    const colorPicker = document.getElementById("routeColorInput");
    const hexInput = document.getElementById("routeColorHex");
    hexInput.value = colorPicker.value.toUpperCase();
  }

  syncColorFromHex() {
    const colorPicker = document.getElementById("routeColorInput");
    const hexInput = document.getElementById("routeColorHex");
    let hexValue = hexInput.value.trim();

    // Add # if missing
    if (hexValue && !hexValue.startsWith("#")) {
      hexValue = "#" + hexValue;
      hexInput.value = hexValue;
    }

    // Validate hex color format
    if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
      colorPicker.value = hexValue;
      hexInput.style.borderColor = "#ddd";
      this.updateContrastRatio();
    } else if (hexValue.length > 1) {
      // Invalid format, show red border
      hexInput.style.borderColor = "#f44336";
    }
  }

  syncTextColorFromPicker() {
    const colorPicker = document.getElementById("routeTextColorInput");
    const hexInput = document.getElementById("routeTextColorHex");
    hexInput.value = colorPicker.value.toUpperCase();
    this.updateContrastRatio();
  }

  syncTextColorFromHex() {
    const colorPicker = document.getElementById("routeTextColorInput");
    const hexInput = document.getElementById("routeTextColorHex");
    let hexValue = hexInput.value.trim();

    // Add # if missing
    if (hexValue && !hexValue.startsWith("#")) {
      hexValue = "#" + hexValue;
      hexInput.value = hexValue;
    }

    // Validate hex color format
    if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
      colorPicker.value = hexValue;
      hexInput.style.borderColor = "#ddd";
      this.updateContrastRatio();
    } else if (hexValue.length > 1) {
      // Invalid format, show red border
      hexInput.style.borderColor = "#f44336";
    }
  }

  updateContrastRatio() {
    const bgColorElement = document.getElementById("routeColorHex");
    const textColorElement = document.getElementById("routeTextColorHex");

    if (!bgColorElement || !textColorElement) {
      return; // Elements don't exist yet
    }

    const bgColor = bgColorElement.value;
    const textColor = textColorElement.value;

    if (
      !bgColor ||
      !textColor ||
      !bgColor.match(/^#[0-9A-Fa-f]{6}$/) ||
      !textColor.match(/^#[0-9A-Fa-f]{6}$/)
    ) {
      const ratioElement = document.getElementById("contrastRatio");
      const statusElement = document.getElementById("contrastStatus");
      if (ratioElement) ratioElement.textContent = "Contrast: -";
      if (statusElement) {
        statusElement.textContent = "";
        statusElement.className = "contrast-status";
      }
      return;
    }

    const ratio = this.calculateContrastRatio(bgColor, textColor);
    const ratioElement = document.getElementById("contrastRatio");
    const statusElement = document.getElementById("contrastStatus");

    if (ratioElement) {
      ratioElement.textContent = `Contrast: ${ratio.toFixed(2)}:1`;
    }

    if (statusElement) {
      statusElement.className = "contrast-status";

      if (ratio >= 7) {
        statusElement.textContent = "AAA";
        statusElement.classList.add("aaa");
      } else if (ratio >= 4.5) {
        statusElement.textContent = "AA";
        statusElement.classList.add("aa");
      } else if (ratio >= 3) {
        statusElement.textContent = "AA Large";
        statusElement.classList.add("aa");
      } else {
        statusElement.textContent = "Fail";
        statusElement.classList.add("fail");
      }
    }
  }

  calculateContrastRatio(color1, color2) {
    const lum1 = this.getLuminance(color1);
    const lum2 = this.getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  getLuminance(hexColor) {
    // Ensure we have a valid hex color
    if (!hexColor || !hexColor.startsWith("#") || hexColor.length !== 7) {
      return 0;
    }

    // Convert hex to RGB
    const r = parseInt(hexColor.substring(1, 3), 16) / 255;
    const g = parseInt(hexColor.substring(3, 5), 16) / 255;
    const b = parseInt(hexColor.substring(5, 7), 16) / 255;

    // Apply gamma correction
    const rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    // Calculate luminance
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  getOrCreateService() {
    const calendarMethod = document.getElementById(
      "calendarMethodSelect"
    ).value;
    const parser = this.gtfsEditor.parser;

    if (calendarMethod === "existing") {
      const selectedService = document.getElementById(
        "existingServiceSelect"
      ).value;
      if (selectedService) {
        return selectedService;
      } else {
        alert("Please select an existing service");
        return null;
      }
    } else if (calendarMethod === "new") {
      // Create new service
      const serviceName =
        document.getElementById("serviceNameInput").value.trim() ||
        "custom_service";
      const serviceId = `${serviceName}_${Date.now()}`;

      const startDate = document
        .getElementById("startDateInput")
        .value.replace(/-/g, "");
      const endDate = document
        .getElementById("endDateInput")
        .value.replace(/-/g, "");

      if (!startDate || !endDate) {
        alert("Please set start and end dates for the service");
        return null;
      }

      const serviceData = {
        service_id: serviceId,
        monday: document.getElementById("mondayCheck").checked ? "1" : "0",
        tuesday: document.getElementById("tuesdayCheck").checked ? "1" : "0",
        wednesday: document.getElementById("wednesdayCheck").checked
          ? "1"
          : "0",
        thursday: document.getElementById("thursdayCheck").checked ? "1" : "0",
        friday: document.getElementById("fridayCheck").checked ? "1" : "0",
        saturday: document.getElementById("saturdayCheck").checked ? "1" : "0",
        sunday: document.getElementById("sundayCheck").checked ? "1" : "0",
        start_date: startDate,
        end_date: endDate,
      };

      parser.addRow("calendar.txt", serviceData);
      return serviceId;
    } else if (calendarMethod === "none") {
      // Create a "no service" entry - all days set to 0
      const serviceId = `no_service_${Date.now()}`;
      const today = new Date();
      const nextYear = new Date(
        today.getFullYear() + 1,
        today.getMonth(),
        today.getDate()
      );

      const serviceData = {
        service_id: serviceId,
        monday: "0",
        tuesday: "0",
        wednesday: "0",
        thursday: "0",
        friday: "0",
        saturday: "0",
        sunday: "0",
        start_date: today.toISOString().split("T")[0].replace(/-/g, ""),
        end_date: nextYear.toISOString().split("T")[0].replace(/-/g, ""),
      };

      parser.addRow("calendar.txt", serviceData);
      return serviceId;
    } else {
      alert("Please select a service calendar option");
      return null;
    }
  }

  addStop(lat, lng, existingStop = null, customTimes = null) {
    const stopId = existingStop
      ? existingStop.stop_id
      : `stop_${this.stopCounter++}`;
    const stopName = existingStop
      ? existingStop.stop_name
      : `Stop ${this.routeStops.length + 1}`;

    const stop = {
      stop_id: stopId,
      stop_name: stopName,
      stop_lat: lat.toFixed(6),
      stop_lon: lng.toFixed(6),
      stop_sequence: this.routeStops.length + 1,
    };

    // Add timing information based on method
    const timingMethod =
      document.getElementById("timingMethodSelect")?.value || "auto";
    if (timingMethod === "manual" && customTimes) {
      stop.arrival_time = this.convertToGTFSTime(customTimes.arrival);
      stop.departure_time = this.convertToGTFSTime(customTimes.departure);
    } else if (timingMethod === "auto") {
      // Auto-calculate times based on interval
      const defaultInterval = parseInt(
        document.getElementById("defaultStopIntervalInput")?.value || 2
      );
      const startTime =
        document.getElementById("tripStartTimeInput")?.value || "08:00";
      const calculatedTime = this.calculateStopTime(
        startTime,
        (stop.stop_sequence - 1) * defaultInterval
      );
      const gtfsTime = this.convertToGTFSTime(calculatedTime);
      
      // For new stops, just use calculated time (validation will happen after stop is added)
      stop.arrival_time = gtfsTime;
      stop.departure_time = gtfsTime;
    }

    // Update previous stops to show as "previous" (muted)
    this.routeStops.forEach((prevStop) => {
      if (prevStop.marker) {
        prevStop.marker.setStyle({
          radius: 6,
          fillColor: "#9e9e9e",
          color: "white",
          weight: 2,
          opacity: 0.7,
          fillOpacity: 0.7,
        });
      }
    });

    // Create marker for current stop with emphasis
    const marker = L.circleMarker([lat, lng], {
      radius: 10,
      fillColor: "#ff5722",
      color: "white",
      weight: 3,
      opacity: 1,
      fillOpacity: 0.9,
    }).addTo(this.map);

    // Add permanent label above the marker
    const label = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'stop-label',
        html: `<div class="stop-label-text">${stopName}</div>`,
        iconSize: [120, 20],
        iconAnchor: [60, 30] // Position label above marker
      })
    }).addTo(this.map);

    // Add pulsing effect to current stop
    const pulseInterval = setInterval(() => {
      if (marker._map && this.isCreatingTrip) {
        const currentRadius = marker.getRadius();
        marker.setRadius(currentRadius === 10 ? 12 : 10);
      } else {
        clearInterval(pulseInterval);
      }
    }, 1000);

    // Create popup for editing stop details
    const popupContent = this.createStopPopup(stop, marker);
    marker.bindPopup(popupContent);

    stop.marker = marker;
    stop.label = label;
    stop.pulseInterval = pulseInterval;
    this.routeStops.push(stop);

    // After adding the stop, validate and fix any time conflicts
    this.validateAndFixStopTimes(stop.stop_id);

    this.updateRouteInfo();

    // Connect stops with a line if we have more than one
    if (this.routeStops.length > 1) {
      this.updateRouteLine();
    }

    this.updateTripInfo();
  }

  createStopPopup(stop) {
    const div = document.createElement("div");
    div.className = "stop-popup";

    // Calculate default times based on sequence and interval
    const defaultInterval = parseInt(
      document.getElementById("defaultStopIntervalInput")?.value || 2
    );
    const startTime =
      document.getElementById("tripStartTimeInput")?.value || "08:00";
    const defaultArrivalTime = this.calculateStopTime(
      startTime,
      (stop.stop_sequence - 1) * defaultInterval
    );
    const defaultDepartureTime = defaultArrivalTime;

    div.innerHTML = `
            <h4>Edit Stop #${stop.stop_sequence}</h4>
            <div class="popup-field">
                <label>Stop Name:</label>
                <input type="text" id="stopName_${stop.stop_id}" value="${
      stop.stop_name
    }" placeholder="Stop Name">
            </div>
            <div class="popup-field">
                <label>Stop Code:</label>
                <input type="text" id="stopCode_${stop.stop_id}" value="${
      stop.stop_code || ""
    }" placeholder="Optional">
            </div>
            <div class="popup-field">
                <label>Stop Description:</label>
                <input type="text" id="stopDesc_${stop.stop_id}" value="${
      stop.stop_desc || ""
    }" placeholder="Optional">
            </div>
            <div class="popup-time-section">
                <h5>Schedule Times</h5>
                <div class="time-inputs">
                    <div class="time-field">
                        <label>Arrival Time:</label>
                        <input type="time" id="arrivalTime_${
                          stop.stop_id
                        }" value="${
      stop.arrival_time || defaultArrivalTime
    }" step="60">
                    </div>
                    <div class="time-field">
                        <label>Departure Time:</label>
                        <input type="time" id="departureTime_${
                          stop.stop_id
                        }" value="${
      stop.departure_time || defaultDepartureTime
    }" step="60">
                    </div>
                </div>
                <div class="time-helpers">
                    <button onclick="window.mapEditor.copyArrivalToDeparture('${
                      stop.stop_id
                    }')" class="time-helper-btn">Copy Arrival → Departure</button>
                    <button onclick="window.mapEditor.autoCalculateTimes('${
                      stop.stop_id
                    }')" class="time-helper-btn">Auto Calculate</button>
                </div>
            </div>
            <div class="popup-buttons">
                <button onclick="window.mapEditor.updateStop('${
                  stop.stop_id
                }')" class="update-btn">Update</button>
                <button onclick="window.mapEditor.removeStop('${
                  stop.stop_id
                }')" class="remove-btn">Remove</button>
            </div>
        `;
    return div;
  }

  updateStop(stopId) {
    const stop = this.routeStops.find((s) => s.stop_id === stopId);
    if (!stop) return;

    const nameInput = document.getElementById(`stopName_${stopId}`);
    const codeInput = document.getElementById(`stopCode_${stopId}`);
    const descInput = document.getElementById(`stopDesc_${stopId}`);
    const arrivalInput = document.getElementById(`arrivalTime_${stopId}`);
    const departureInput = document.getElementById(`departureTime_${stopId}`);

    if (nameInput) {
      stop.stop_name = nameInput.value.trim() || stop.stop_name;
    }
    if (codeInput) {
      stop.stop_code = codeInput.value.trim();
    }
    if (descInput) {
      stop.stop_desc = descInput.value.trim();
    }
    // Validate and update times
    let newArrivalTime = stop.arrival_time;
    let newDepartureTime = stop.departure_time;
    
    if (arrivalInput && arrivalInput.value) {
      newArrivalTime = this.convertToGTFSTime(arrivalInput.value);
    }
    if (departureInput && departureInput.value) {
      newDepartureTime = this.convertToGTFSTime(departureInput.value);
    }
    
    // Validate the new times
    const validation = this.validateStopTimes(stopId, newArrivalTime, newDepartureTime);
    if (!validation.valid) {
      alert(validation.message);
      return; // Don't update invalid times
    }
    
    // Save validated times
    stop.arrival_time = newArrivalTime;
    stop.departure_time = newDepartureTime;

    stop.marker.closePopup();
    this.updateTripInfo();
  }

  copyArrivalToDeparture(stopId) {
    const arrivalInput = document.getElementById(`arrivalTime_${stopId}`);
    const departureInput = document.getElementById(`departureTime_${stopId}`);

    if (arrivalInput && departureInput) {
      departureInput.value = arrivalInput.value;
    }
  }

  autoCalculateTimes(stopId) {
    const stop = this.routeStops.find((s) => s.stop_id === stopId);
    if (!stop) return;

    const defaultInterval = parseInt(
      document.getElementById("defaultStopIntervalInput")?.value || 2
    );
    const startTime =
      document.getElementById("tripStartTimeInput")?.value || "08:00";

    const calculatedTime = this.calculateStopTime(
      startTime,
      (stop.stop_sequence - 1) * defaultInterval
    );

    const arrivalInput = document.getElementById(`arrivalTime_${stopId}`);
    const departureInput = document.getElementById(`departureTime_${stopId}`);

    if (arrivalInput) arrivalInput.value = calculatedTime;
    if (departureInput) departureInput.value = calculatedTime;
  }

  calculateStopTime(startTime, minutesToAdd) {
    // Convert HH:MM to minutes
    const [hours, minutes] = startTime.split(":").map(Number);
    const totalStartMinutes = hours * 60 + minutes;

    // Add the minutes
    const totalMinutes = totalStartMinutes + minutesToAdd;

    // Convert back to HH:MM format
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;

    return `${newHours.toString().padStart(2, "0")}:${newMinutes
      .toString()
      .padStart(2, "0")}`;
  }

  convertToGTFSTime(timeString) {
    // Convert HH:MM to HH:MM:SS format for GTFS
    if (timeString && timeString.includes(":")) {
      const parts = timeString.split(":");
      if (parts.length === 2) {
        return `${parts[0]}:${parts[1]}:00`;
      }
    }
    return timeString + ":00" || "08:00:00";
  }

  removeStop(stopId) {
    const stopIndex = this.routeStops.findIndex((s) => s.stop_id === stopId);
    if (stopIndex === -1) return;

    const stop = this.routeStops[stopIndex];
    this.map.removeLayer(stop.marker);
    if (stop.label) {
      this.map.removeLayer(stop.label);
    }
    this.routeStops.splice(stopIndex, 1);

    // Update stop sequences
    this.routeStops.forEach((s, index) => {
      s.stop_sequence = index + 1;
    });

    this.updateRouteLine();
    this.updateTripInfo();
  }

  updateRouteLine() {
    // Remove existing route line
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
    }

    if (this.routeStops.length < 2) return;

    // Create line connecting all stops
    const latlngs = this.routeStops.map((stop) => [
      parseFloat(stop.stop_lat),
      parseFloat(stop.stop_lon),
    ]);

    const routeColor = this.currentRoute
      ? `#${this.currentRoute.color}`
      : "#4caf50";
    this.routeLine = L.polyline(latlngs, {
      color: routeColor,
      weight: 3,
      opacity: 0.6,
      dashArray: "5, 10",
    }).addTo(this.map);
  }

  updateTripInputs() {
    if (!this.currentTrip) return;
    
    // Update currentTrip object with current input values
    this.currentTrip.headsign = document.getElementById("tripHeadsignInput").value.trim();
    this.currentTrip.direction = document.getElementById("directionSelect").value;
    
    // Update the info panel display
    this.updateTripInfo();
  }

  updateTripInfo() {
    if (!this.currentTrip) return;

    document.getElementById("stopCount").textContent = this.routeStops.length;
    document.getElementById("currentHeadsign").textContent = 
      this.currentTrip.headsign || "-";
    document.getElementById("currentDirection").textContent =
      this.currentTrip.direction;

    let distance = 0;
    if (this.routeShape) {
      // Calculate distance from shape
      const latlngs = this.routeShape.getLatLngs();
      for (let i = 1; i < latlngs.length; i++) {
        distance += this.calculateDistance(latlngs[i - 1], latlngs[i]);
      }
    } else if (this.routeStops.length > 1) {
      // Calculate distance from stop-to-stop
      for (let i = 1; i < this.routeStops.length; i++) {
        const prev = this.routeStops[i - 1];
        const curr = this.routeStops[i];
        distance += this.calculateDistance(
          { lat: parseFloat(prev.stop_lat), lng: parseFloat(prev.stop_lon) },
          { lat: parseFloat(curr.stop_lat), lng: parseFloat(curr.stop_lon) }
        );
      }
    }

    document.getElementById("routeDistance").textContent = `${distance.toFixed(
      2
    )} km`;
    
    // Update stops list
    this.updateStopsList();
  }

  updateRouteInfo() {
    // Legacy method for compatibility
    this.updateTripInfo();
  }

  toggleStopsList() {
    const container = document.getElementById("stopsListContainer");
    const icon = document.getElementById("stopsToggleIcon");
    const stopsList = document.getElementById("stopsList");
    const emptyState = document.getElementById("stopsListEmpty");
    
    if (container.style.display === "none") {
      container.style.display = "block";
      icon.textContent = "▼";
    } else {
      container.style.display = "none";
      icon.textContent = "▶";
    }
  }

  updateStopsList() {
    const stopsList = document.getElementById("stopsList");
    const emptyState = document.getElementById("stopsListEmpty");
    
    if (this.routeStops.length === 0) {
      stopsList.style.display = "none";
      emptyState.style.display = "block";
      return;
    }
    
    emptyState.style.display = "none";
    stopsList.style.display = "block";
    stopsList.innerHTML = "";
    
    this.routeStops.forEach((stop, index) => {
      const li = document.createElement("li");
      
      const stopInfo = document.createElement("div");
      stopInfo.className = "stop-info";
      
      const stopNumber = document.createElement("span");
      stopNumber.textContent = `${index + 1}. `;
      stopNumber.style.fontWeight = "bold";
      
      const stopName = document.createElement("span");
      stopName.className = "stop-name-editable";
      stopName.textContent = stop.stop_name || `Stop ${stop.stop_sequence}`;
      stopName.setAttribute("data-stop-id", stop.stop_id);
      
      stopInfo.appendChild(stopNumber);
      stopInfo.appendChild(stopName);
      
      // Add tooltip functionality
      stopInfo.addEventListener("mouseenter", (e) => this.showStopTooltip(e, stop));
      stopInfo.addEventListener("mouseleave", () => this.hideStopTooltip());
      
      // Add click-to-edit functionality for stop name
      stopName.addEventListener("click", (e) => this.editStopName(e, stop));
      
      const stopTime = document.createElement("div");
      stopTime.className = "stop-time stop-time-editable";
      if (stop.arrival_time && stop.departure_time) {
        stopTime.textContent = `${this.formatGTFSTime(stop.arrival_time)} - ${this.formatGTFSTime(stop.departure_time)}`;
      } else {
        stopTime.textContent = "No times set";
      }
      stopTime.setAttribute("data-stop-id", stop.stop_id);
      
      // Add click-to-edit functionality for stop times
      stopTime.addEventListener("click", (e) => this.editStopTime(e, stop));
      
      li.appendChild(stopInfo);
      li.appendChild(stopTime);
      stopsList.appendChild(li);
    });
  }

  showStopTooltip(event, stop) {
    // Remove any existing tooltip first
    this.hideStopTooltip();
    
    const tooltip = document.createElement("div");
    tooltip.className = "stop-tooltip";
    tooltip.id = "stopTooltip";
    tooltip.innerHTML = `
      <strong>Lat:</strong> ${parseFloat(stop.stop_lat).toFixed(6)}<br>
      <strong>Lng:</strong> ${parseFloat(stop.stop_lon).toFixed(6)}<br>
      <strong>Sequence:</strong> ${stop.stop_sequence}
    `;
    
    document.body.appendChild(tooltip);
    
    const updatePosition = (e) => {
      if (tooltip.parentNode) { // Only update if tooltip still exists
        tooltip.style.left = (e.pageX + 10) + "px";
        tooltip.style.top = (e.pageY - 10) + "px";
      }
    };
    
    updatePosition(event);
    
    // Store the update function and target element for cleanup
    this.currentTooltipData = {
      updatePosition,
      target: event.target,
      tooltip
    };
    
    event.target.addEventListener("mousemove", updatePosition);
  }

  hideStopTooltip() {
    // Clean up event listener first
    if (this.currentTooltipData) {
      this.currentTooltipData.target.removeEventListener("mousemove", this.currentTooltipData.updatePosition);
      this.currentTooltipData = null;
    }
    
    // Remove tooltip element
    const tooltip = document.getElementById("stopTooltip");
    if (tooltip) {
      tooltip.remove();
    }
  }

  formatGTFSTime(gtfsTime) {
    if (!gtfsTime) return "";
    const parts = gtfsTime.split(":");
    const hours = parseInt(parts[0]);
    const minutes = parts[1];
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    const ampm = hours >= 12 ? "PM" : "AM";
    return `${displayHours}:${minutes} ${ampm}`;
  }

  togglePanelCollapse() {
    const content = document.getElementById("floatingWindowContent");
    const collapseBtn = document.getElementById("collapseRouteInfo");
    
    if (content.style.display === "none") {
      content.style.display = "block";
      collapseBtn.textContent = "−";
      collapseBtn.title = "Collapse Panel";
    } else {
      content.style.display = "none";
      collapseBtn.textContent = "+";
      collapseBtn.title = "Expand Panel";
    }
  }

  editStopName(event, stop) {
    event.stopPropagation();
    const span = event.target;
    const currentName = span.textContent;
    
    // Create input element
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentName;
    input.className = "stop-name-input";
    input.style.cssText = "background: white; border: 1px solid #4caf50; border-radius: 2px; padding: 2px 4px; font-size: 12px; width: 120px;";
    
    // Replace span with input
    span.parentNode.replaceChild(input, span);
    input.focus();
    input.select();
    
    const saveEdit = () => {
      const newName = input.value.trim() || `Stop ${stop.stop_sequence}`;
      stop.stop_name = newName;
      
      // Update the label on the map
      if (stop.label) {
        stop.label.setIcon(L.divIcon({
          className: 'stop-label',
          html: `<div class="stop-label-text">${newName}</div>`,
          iconSize: [120, 20],
          iconAnchor: [60, 30]
        }));
      }
      
      // Update the marker popup if it exists
      if (stop.marker && stop.marker.getPopup()) {
        const popupContent = stop.marker.getPopup().getContent();
        if (popupContent && popupContent.includes("Edit Stop")) {
          // Update popup will be handled by the popup update logic
        }
      }
      
      // Replace input with updated span
      const newSpan = document.createElement("span");
      newSpan.className = "stop-name-editable";
      newSpan.textContent = newName;
      newSpan.setAttribute("data-stop-id", stop.stop_id);
      newSpan.addEventListener("click", (e) => this.editStopName(e, stop));
      
      input.parentNode.replaceChild(newSpan, input);
    };
    
    // Use a flag to prevent double execution
    let editCompleted = false;
    
    const handleSave = () => {
      if (editCompleted) return;
      editCompleted = true;
      saveEdit();
    };
    
    input.addEventListener("blur", handleSave);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur(); // This will trigger the blur event and save
      }
    });
  }

  editStopTime(event, stop) {
    event.stopPropagation();
    const timeDiv = event.target;
    
    // Create input container
    const inputContainer = document.createElement("div");
    inputContainer.style.cssText = "display: flex; gap: 4px; align-items: center; flex-wrap: wrap;";
    
    // Create arrival time input
    const arrivalInput = document.createElement("input");
    arrivalInput.type = "time";
    arrivalInput.className = "stop-time-input";
    arrivalInput.style.cssText = "background: white; border: 1px solid #4caf50; border-radius: 2px; padding: 1px 3px; font-size: 10px; font-family: monospace; width: 60px;";
    
    // Create departure time input
    const departureInput = document.createElement("input");
    departureInput.type = "time";  
    departureInput.className = "stop-time-input";
    departureInput.style.cssText = "background: white; border: 1px solid #4caf50; border-radius: 2px; padding: 1px 3px; font-size: 10px; font-family: monospace; width: 60px;";
    
    // Set current values
    if (stop.arrival_time) {
      arrivalInput.value = this.convertGTFSTimeToHHMM(stop.arrival_time);
    }
    if (stop.departure_time) {
      departureInput.value = this.convertGTFSTimeToHHMM(stop.departure_time);
    }
    
    const dash = document.createElement("span");
    dash.textContent = "-";
    dash.style.fontSize = "10px";
    
    inputContainer.appendChild(arrivalInput);
    inputContainer.appendChild(dash);
    inputContainer.appendChild(departureInput);
    
    // Replace time div with inputs
    timeDiv.parentNode.replaceChild(inputContainer, timeDiv);
    arrivalInput.focus();
    
    const saveEdit = () => {
      let newArrivalTime = stop.arrival_time;
      let newDepartureTime = stop.departure_time;
      
      if (arrivalInput.value) {
        newArrivalTime = this.convertToGTFSTime(arrivalInput.value);
      }
      if (departureInput.value) {
        newDepartureTime = this.convertToGTFSTime(departureInput.value);
      }
      
      // Validate the new times
      const validation = this.validateStopTimes(stop.stop_id, newArrivalTime, newDepartureTime);
      if (!validation.valid) {
        alert(validation.message);
        // Keep the inputs open and focus back to the problematic input
        if (validation.message.includes("Departure time cannot be before arrival")) {
          departureInput.focus();
        } else if (validation.message.includes("Arrival time cannot be before")) {
          arrivalInput.focus();
        } else {
          arrivalInput.focus();
        }
        return; // Don't save invalid times
      }
      
      // Save the validated times
      stop.arrival_time = newArrivalTime;
      stop.departure_time = newDepartureTime;
      
      // Replace inputs with updated time div
      const newTimeDiv = document.createElement("div");
      newTimeDiv.className = "stop-time stop-time-editable";
      if (stop.arrival_time && stop.departure_time) {
        newTimeDiv.textContent = `${this.formatGTFSTime(stop.arrival_time)} - ${this.formatGTFSTime(stop.departure_time)}`;
      } else {
        newTimeDiv.textContent = "No times set";
      }
      newTimeDiv.setAttribute("data-stop-id", stop.stop_id);
      newTimeDiv.addEventListener("click", (e) => this.editStopTime(e, stop));
      
      inputContainer.parentNode.replaceChild(newTimeDiv, inputContainer);
    };
    
    // Use a flag to prevent double execution and timeout for blur events
    let editCompleted = false;
    let saveTimeout = null;
    
    const handleSave = () => {
      if (editCompleted) return;
      
      // Clear any existing timeout
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      // Set a short timeout to allow both inputs to blur before saving
      saveTimeout = setTimeout(() => {
        if (!editCompleted) {
          editCompleted = true;
          saveEdit();
        }
      }, 100);
    };
    
    const handleKeyPress = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        editCompleted = true;
        saveEdit();
      }
    };
    
    arrivalInput.addEventListener("blur", handleSave);
    departureInput.addEventListener("blur", handleSave);
    arrivalInput.addEventListener("keypress", handleKeyPress);
    departureInput.addEventListener("keypress", handleKeyPress);
  }

  convertGTFSTimeToHHMM(gtfsTime) {
    if (!gtfsTime) return "";
    const parts = gtfsTime.split(":");
    const hours = parseInt(parts[0]);
    const minutes = parts[1];
    // Handle 24+ hour format by converting to 00-23
    const displayHours = hours >= 24 ? hours - 24 : hours;
    return `${displayHours.toString().padStart(2, '0')}:${minutes}`;
  }

  // Convert GTFS time to minutes for comparison
  gtfsTimeToMinutes(gtfsTime) {
    if (!gtfsTime) return 0;
    const parts = gtfsTime.split(":");
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    return hours * 60 + minutes;
  }

  // Validate that stop times are in chronological order
  validateStopTimes(stopId, newArrivalTime, newDepartureTime) {
    const stop = this.routeStops.find(s => s.stop_id === stopId);
    if (!stop) return { valid: true };

    const stopIndex = this.routeStops.indexOf(stop);
    
    // Convert times to minutes for comparison
    const newArrivalMinutes = this.gtfsTimeToMinutes(newArrivalTime);
    const newDepartureMinutes = this.gtfsTimeToMinutes(newDepartureTime);
    
    // Check that departure is not before arrival for this stop
    if (newDepartureMinutes < newArrivalMinutes) {
      return {
        valid: false,
        message: "Departure time cannot be before arrival time for the same stop."
      };
    }
    
    // Check previous stop (if exists)
    if (stopIndex > 0) {
      const prevStop = this.routeStops[stopIndex - 1];
      if (prevStop.departure_time) {
        const prevDepartureMinutes = this.gtfsTimeToMinutes(prevStop.departure_time);
        if (newArrivalMinutes < prevDepartureMinutes) {
          return {
            valid: false,
            message: `Arrival time cannot be before the previous stop's departure time (${this.formatGTFSTime(prevStop.departure_time)}).`
          };
        }
      }
    }
    
    // Check next stop (if exists)
    if (stopIndex < this.routeStops.length - 1) {
      const nextStop = this.routeStops[stopIndex + 1];
      if (nextStop.arrival_time) {
        const nextArrivalMinutes = this.gtfsTimeToMinutes(nextStop.arrival_time);
        if (newDepartureMinutes > nextArrivalMinutes) {
          return {
            valid: false,
            message: `Departure time cannot be after the next stop's arrival time (${this.formatGTFSTime(nextStop.arrival_time)}).`
          };
        }
      }
    }
    
    // Check for duplicate times with other stops
    for (let i = 0; i < this.routeStops.length; i++) {
      if (i === stopIndex) continue; // Skip current stop
      
      const otherStop = this.routeStops[i];
      if (otherStop.arrival_time && otherStop.departure_time) {
        const otherArrival = this.gtfsTimeToMinutes(otherStop.arrival_time);
        const otherDeparture = this.gtfsTimeToMinutes(otherStop.departure_time);
        
        // Check for exact time duplicates
        if (newArrivalMinutes === otherArrival || newArrivalMinutes === otherDeparture ||
            newDepartureMinutes === otherArrival || newDepartureMinutes === otherDeparture) {
          return {
            valid: false,
            message: `Stop times cannot be identical to another stop's times.`
          };
        }
      }
    }
    
    return { valid: true };
  }

  // Find the next available time that doesn't conflict with existing stops
  findNextAvailableTime(startTime) {
    let timeMinutes = this.gtfsTimeToMinutes(startTime);
    const existingTimes = this.routeStops
      .filter(s => s.arrival_time && s.departure_time)
      .flatMap(s => [
        this.gtfsTimeToMinutes(s.arrival_time),
        this.gtfsTimeToMinutes(s.departure_time)
      ])
      .sort((a, b) => a - b);
    
    // Find a gap of at least 1 minute
    while (existingTimes.includes(timeMinutes)) {
      timeMinutes += 1;
    }
    
    // Convert back to GTFS time format
    const hours = Math.floor(timeMinutes / 60);
    const minutes = timeMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  }

  // Validate and automatically fix any time conflicts for a specific stop
  validateAndFixStopTimes(stopId) {
    const stop = this.routeStops.find(s => s.stop_id === stopId);
    if (!stop || !stop.arrival_time || !stop.departure_time) return;

    const validation = this.validateStopTimes(stopId, stop.arrival_time, stop.departure_time);
    if (!validation.valid) {
      // Auto-fix by finding the next available time
      const newTime = this.findNextAvailableTime(stop.arrival_time);
      stop.arrival_time = newTime;
      stop.departure_time = newTime;
    }
  }

  calculateDistance(latlng1, latlng2) {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(latlng2.lat - latlng1.lat);
    const dLon = this.toRad(latlng2.lng - latlng1.lng);
    const lat1 = this.toRad(latlng1.lat);
    const lat2 = this.toRad(latlng2.lat);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  toRad(value) {
    return (value * Math.PI) / 180;
  }

  finishTrip() {
    if (this.routeStops.length < 2) {
      alert("A trip must have at least 2 stops");
      return;
    }

    // Finalize all stops to show as completed (green)
    this.routeStops.forEach((stop) => {
      if (stop.marker) {
        // Clear pulse intervals
        if (stop.pulseInterval) {
          clearInterval(stop.pulseInterval);
        }
        // Set final completed style
        stop.marker.setStyle({
          radius: 8,
          fillColor: "#4caf50",
          color: "white",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        });
      }
    });

    // Generate GTFS data from the visual trip
    this.generateGTFSFromTrip();

    // Reset UI for creating another trip on the same route
    this.isCreatingTrip = false;
    document.getElementById("startTripBtn").disabled = false;
    document.getElementById("finishTripBtn").disabled = true;
    document.getElementById("mapContainer").style.cursor = "";

    // Clear trip stops and shape for next trip
    this.clearTripData();

    // Clear trip inputs
    document.getElementById("tripHeadsignInput").value = "";
    document.getElementById("tripShortNameInput").value = "";
    document.getElementById("tripStartTimeInput").value = "08:00";
    document.getElementById("defaultStopIntervalInput").value = "2";

    alert(
      `Trip "${this.currentTrip.headsign}" on route "${this.currentRoute.name}" created successfully!\n\nYou can now create another trip on the same route or switch to table view to see the data.`
    );

    this.currentTrip = null;
  }

  generateGTFSFromTrip() {
    const parser = this.gtfsEditor.parser;

    // 1. Add Agency (if doesn't exist)
    let agencyData = parser.getFileData("agency.txt");
    if (agencyData.length === 0) {
      parser.addRow("agency.txt", {
        agency_id: "agency_1",
        agency_name: "Transit Agency",
        agency_url: "https://example.com",
        agency_timezone: "America/New_York",
      });
    }

    // 2. Add Route (if new)
    if (this.currentRoute.isNew) {
      const routeData = {
        route_id: this.currentRoute.id,
        route_short_name: this.currentRoute.name,
        route_long_name: this.currentRoute.longName,
        route_type: this.currentRoute.type,
        route_color: this.currentRoute.color,
        agency_id: "agency_1",
      };

      // Add text color if provided
      if (this.currentRoute.textColor) {
        routeData.route_text_color = this.currentRoute.textColor;
      }

      parser.addRow("routes.txt", routeData);
      // Mark route as no longer new after adding it
      this.currentRoute.isNew = false;
    }

    // 3. Add Stops (check for duplicates)
    this.routeStops.forEach((stop) => {
      const existingStops = parser.getFileData("stops.txt");
      const existingStop = existingStops.find(
        (s) => s.stop_id === stop.stop_id
      );

      if (!existingStop) {
        parser.addRow("stops.txt", {
          stop_id: stop.stop_id,
          stop_name: stop.stop_name,
          stop_code: stop.stop_code || "",
          stop_desc: stop.stop_desc || "",
          stop_lat: stop.stop_lat,
          stop_lon: stop.stop_lon,
        });
      }
    });

    // 4. Handle Service Calendar
    const serviceId = this.getOrCreateService();
    if (!serviceId) {
      return; // Exit if service creation failed
    }

    // 5. Add Trip
    const tripData = {
      route_id: this.currentRoute.id,
      service_id: serviceId,
      trip_id: this.currentTrip.id,
      trip_headsign: this.currentTrip.headsign,
      direction_id: this.currentTrip.direction,
    };

    if (this.currentTrip.shortName) {
      tripData.trip_short_name = this.currentTrip.shortName;
    }

    parser.addRow("trips.txt", tripData);

    // 6. Add Stop Times (use custom times if available)
    this.routeStops.forEach((stop, index) => {
      const arrivalTime = stop.arrival_time || this.generateDefaultTime(index);
      const departureTime = stop.departure_time || arrivalTime;

      parser.addRow("stop_times.txt", {
        trip_id: this.currentTrip.id,
        arrival_time: arrivalTime,
        departure_time: departureTime,
        stop_id: stop.stop_id,
        stop_sequence: stop.stop_sequence,
      });
    });

    // 7. Add Shape (if drawn)
    if (this.routeShape) {
      const shapeId = `shape_${this.currentTrip.id}`;
      const latlngs = this.routeShape.getLatLngs();

      // Update trip with shape_id
      const trips = parser.getFileData("trips.txt");
      const trip = trips.find((t) => t.trip_id === this.currentTrip.id);
      if (trip) {
        trip.shape_id = shapeId;
      }

      // Add shape points
      latlngs.forEach((latlng, index) => {
        parser.addRow("shapes.txt", {
          shape_id: shapeId,
          shape_pt_lat: latlng.lat.toFixed(6),
          shape_pt_lon: latlng.lng.toFixed(6),
          shape_pt_sequence: index + 1,
        });
      });
    }
  }

  addMinutesToTime(timeStr, minutes) {
    const [hours, mins, secs] = timeStr.split(":").map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;

    return `${newHours.toString().padStart(2, "0")}:${newMins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  generateDefaultTime(stopIndex) {
    const startTime =
      document.getElementById("tripStartTimeInput")?.value || "08:00";
    const interval = parseInt(
      document.getElementById("defaultStopIntervalInput")?.value || 2
    );

    return this.convertToGTFSTime(
      this.calculateStopTime(startTime, stopIndex * interval)
    );
  }

  clearCurrentTrip() {
    this.clearTripData();

    // Reset state
    this.currentTrip = null;
    this.isCreatingTrip = false;

    // Reset UI
    document.getElementById("startTripBtn").disabled = false;
    document.getElementById("finishTripBtn").disabled = true;
    this.hideInfoPanel();
    document.getElementById("mapContainer").style.cursor = "";

    // Clear trip inputs
    document.getElementById("tripHeadsignInput").value = "";
    document.getElementById("tripShortNameInput").value = "";
  }

  clearTripData() {
    // Remove all stops
    this.routeStops.forEach((stop) => {
      if (stop.marker) {
        this.map.removeLayer(stop.marker);
      }
      if (stop.label) {
        this.map.removeLayer(stop.label);
      }
      // Clear pulse intervals
      if (stop.pulseInterval) {
        clearInterval(stop.pulseInterval);
      }
    });

    // Remove route line
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }

    // Remove shape
    if (this.routeShape) {
      this.drawnItems.removeLayer(this.routeShape);
      this.routeShape = null;
    }

    // Reset stops array
    this.routeStops = [];
  }

  clearCurrentRoute() {
    // Legacy method - redirect to trip clearing
    this.clearCurrentTrip();
  }

  loadExistingData() {
    if (!this.map) return;

    // Clear existing markers and shapes
    this.map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker && layer !== this.drawnItems) {
        this.map.removeLayer(layer);
      }
      if (
        layer instanceof L.Polyline &&
        layer !== this.drawnItems &&
        !layer._isBaseLayer
      ) {
        this.map.removeLayer(layer);
      }
      if (layer instanceof L.Marker && layer !== this.drawnItems) {
        this.map.removeLayer(layer);
      }
    });

    // Clear existing references
    if (this.existingStopMarkers) {
      this.existingStopMarkers.clear();
    }
    if (this.existingShapes) {
      this.existingShapes.clear();
    }

    const parser = this.gtfsEditor.parser;

    // Load existing stops from GTFS data
    const stops = parser.getFileData("stops.txt");

    stops.forEach((stop) => {
      if (stop.stop_lat && stop.stop_lon) {
        const lat = parseFloat(stop.stop_lat);
        const lng = parseFloat(stop.stop_lon);

        if (!isNaN(lat) && !isNaN(lng)) {
          // Create draggable marker for existing stops
          const marker = L.marker([lat, lng], {
            draggable: true,
            icon: L.divIcon({
              className: "existing-stop-marker",
              html: '<div class="stop-marker-content"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
          }).addTo(this.map);

          // Store reference to stop data
          marker.stopData = stop;

          // Handle drag events
          marker.on("dragend", (e) => this.handleStopDrag(e, stop));

          // Create editable popup
          const popupContent = this.createExistingStopPopup(stop);
          marker.bindPopup(popupContent);

          // Store marker reference for updates
          if (!this.existingStopMarkers) {
            this.existingStopMarkers = new Map();
          }
          this.existingStopMarkers.set(stop.stop_id, marker);
        }
      }
    });

    // Load and visualize shapes
    this.loadGTFSShapes();

    // Auto-fit map to show all data
    const allLayers = [];

    if (stops.length > 0) {
      const validStops = stops.filter(
        (s) =>
          s.stop_lat &&
          s.stop_lon &&
          !isNaN(parseFloat(s.stop_lat)) &&
          !isNaN(parseFloat(s.stop_lon))
      );

      validStops.forEach((stop) => {
        allLayers.push(
          L.marker([parseFloat(stop.stop_lat), parseFloat(stop.stop_lon)])
        );
      });
    }

    if (allLayers.length > 0) {
      const group = new L.featureGroup(allLayers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  loadGTFSShapes() {
    const parser = this.gtfsEditor.parser;
    const shapes = parser.getFileData("shapes.txt");
    const routes = parser.getFileData("routes.txt");
    const trips = parser.getFileData("trips.txt");

    if (shapes.length === 0) return;

    // Group shapes by shape_id
    const shapeGroups = {};
    shapes.forEach((shape) => {
      if (!shapeGroups[shape.shape_id]) {
        shapeGroups[shape.shape_id] = [];
      }
      shapeGroups[shape.shape_id].push({
        lat: parseFloat(shape.shape_pt_lat),
        lng: parseFloat(shape.shape_pt_lon),
        sequence: parseInt(shape.shape_pt_sequence),
        dist: parseFloat(shape.shape_dist_traveled || 0),
      });
    });

    // Create route color mapping
    const routeColors = {};
    const defaultColors = [
      "#4caf50",
      "#2196f3",
      "#ff9800",
      "#e91e63",
      "#9c27b0",
      "#00bcd4",
      "#8bc34a",
      "#ffc107",
    ];
    let colorIndex = 0;

    routes.forEach((route) => {
      if (route.route_color && route.route_color.length === 6) {
        // Use the route color from GTFS
        routeColors[route.route_id] = "#" + route.route_color;
      } else {
        // Use default color
        routeColors[route.route_id] =
          defaultColors[colorIndex % defaultColors.length];
        colorIndex++;
      }
    });

    // Draw each shape
    Object.keys(shapeGroups).forEach((shapeId) => {
      const shapePoints = shapeGroups[shapeId];

      // Sort by sequence
      shapePoints.sort((a, b) => a.sequence - b.sequence);

      // Filter out invalid points
      const validPoints = shapePoints.filter(
        (p) => !isNaN(p.lat) && !isNaN(p.lng)
      );

      if (validPoints.length < 2) return;

      // Find associated route for color
      const associatedTrip = trips.find((trip) => trip.shape_id === shapeId);
      const routeId = associatedTrip ? associatedTrip.route_id : null;
      const route = routeId ? routes.find((r) => r.route_id === routeId) : null;

      const color = routeColors[routeId] || "#4caf50";
      const routeName = route
        ? route.route_short_name || route.route_long_name
        : "Unknown Route";

      // Create editable polyline
      const latlngs = validPoints.map((p) => [p.lat, p.lng]);
      const polyline = L.polyline(latlngs, {
        color: color,
        weight: 4,
        opacity: 0.7,
      }).addTo(this.map);

      // Make shape editable
      polyline.shapeId = shapeId;
      polyline.shapePoints = validPoints;

      // Enable editing
      polyline.on("click", () => this.enableShapeEditing(polyline));

      // Add popup to shape
      polyline.bindPopup(`
                <div class="shape-popup">
                    <h4>${routeName}</h4>
                    <p><strong>Shape ID:</strong> ${shapeId}</p>
                    <p><strong>Points:</strong> ${validPoints.length}</p>
                    <p><strong>Route Type:</strong> ${this.getRouteTypeName(
                      route?.route_type
                    )}</p>
                    <div class="shape-actions">
                        <button onclick="window.mapEditor.enableShapeEditing(window.mapEditor.findShapePolyline('${shapeId}'))" class="edit-btn">Edit Shape</button>
                        <button onclick="window.mapEditor.deleteShape('${shapeId}')" class="remove-btn">Delete Shape</button>
                    </div>
                </div>
            `);

      // Store shape for later reference
      if (!this.existingShapes) {
        this.existingShapes = new Map();
      }
      this.existingShapes.set(shapeId, polyline);
    });
  }

  getRouteTypeName(routeType) {
    const types = {
      0: "Tram/Light Rail",
      1: "Subway/Metro",
      2: "Rail",
      3: "Bus",
      4: "Ferry",
      5: "Cable Tram",
      6: "Aerial Lift",
      7: "Funicular",
    };
    return types[routeType] || "Unknown";
  }

  handleStopDrag(e, stop) {
    const marker = e.target;
    const newLatLng = marker.getLatLng();

    // Update the stop data
    stop.stop_lat = newLatLng.lat.toFixed(6);
    stop.stop_lon = newLatLng.lng.toFixed(6);

    // Update the popup content to reflect new coordinates
    const popupContent = this.createExistingStopPopup(stop);
    marker.setPopupContent(popupContent);

    // Mark as modified
    if (!this.modifiedStops) {
      this.modifiedStops = new Set();
    }
    this.modifiedStops.add(stop.stop_id);

    console.log(
      `Stop ${stop.stop_id} moved to ${stop.stop_lat}, ${stop.stop_lon}`
    );
  }

  createExistingStopPopup(stop) {
    const div = document.createElement("div");
    div.className = "stop-popup existing-stop-popup";
    div.innerHTML = `
            <h4>Edit Stop: ${stop.stop_name}</h4>
            <div class="popup-field">
                <label>Stop Name:</label>
                <input type="text" id="existingStopName_${
                  stop.stop_id
                }" value="${stop.stop_name}" placeholder="Stop Name">
            </div>
            <div class="popup-field">
                <label>Stop Code:</label>
                <input type="text" id="existingStopCode_${
                  stop.stop_id
                }" value="${stop.stop_code || ""}" placeholder="Optional">
            </div>
            <div class="popup-field">
                <label>Stop Description:</label>
                <input type="text" id="existingStopDesc_${
                  stop.stop_id
                }" value="${stop.stop_desc || ""}" placeholder="Optional">
            </div>
            <div class="popup-field">
                <label>Coordinates:</label>
                <div class="coord-display">
                    <span>Lat: ${stop.stop_lat}, Lng: ${stop.stop_lon}</span>
                    <small>(Drag marker to move)</small>
                </div>
            </div>
            <div class="popup-buttons">
                <button onclick="window.mapEditor.updateExistingStop('${
                  stop.stop_id
                }')" class="update-btn">Save</button>
                <button onclick="window.mapEditor.cancelExistingStopEdit('${
                  stop.stop_id
                }')" class="cancel-btn">Cancel</button>
                <button onclick="window.mapEditor.deleteExistingStop('${
                  stop.stop_id
                }')" class="remove-btn">Delete</button>
            </div>
        `;
    return div;
  }

  updateExistingStop(stopId) {
    const parser = this.gtfsEditor.parser;
    const stops = parser.getFileData("stops.txt");
    const stop = stops.find((s) => s.stop_id === stopId);

    if (!stop) return;

    const nameInput = document.getElementById(`existingStopName_${stopId}`);
    const codeInput = document.getElementById(`existingStopCode_${stopId}`);
    const descInput = document.getElementById(`existingStopDesc_${stopId}`);

    if (nameInput) {
      stop.stop_name = nameInput.value.trim() || stop.stop_name;
    }
    if (codeInput) {
      stop.stop_code = codeInput.value.trim();
    }
    if (descInput) {
      stop.stop_desc = descInput.value.trim();
    }

    // Mark as modified
    if (!this.modifiedStops) {
      this.modifiedStops = new Set();
    }
    this.modifiedStops.add(stopId);

    // Close popup and update marker
    const marker = this.existingStopMarkers.get(stopId);
    if (marker) {
      marker.closePopup();
      // Update popup content for next time
      const popupContent = this.createExistingStopPopup(stop);
      marker.setPopupContent(popupContent);
    }

    console.log(`Stop ${stopId} updated`);
  }

  cancelExistingStopEdit(stopId) {
    // Close popup without saving changes
    const marker = this.existingStopMarkers.get(stopId);
    if (marker) {
      marker.closePopup();
    }

    console.log(`Stop ${stopId} edit cancelled`);
  }

  deleteExistingStop(stopId) {
    if (
      !confirm(
        "Are you sure you want to delete this stop? This cannot be undone."
      )
    ) {
      return;
    }

    const parser = this.gtfsEditor.parser;
    const stops = parser.getFileData("stops.txt");
    const stopIndex = stops.findIndex((s) => s.stop_id === stopId);

    if (stopIndex !== -1) {
      // Remove from data
      stops.splice(stopIndex, 1);

      // Remove marker from map
      const marker = this.existingStopMarkers.get(stopId);
      if (marker) {
        this.map.removeLayer(marker);
        this.existingStopMarkers.delete(stopId);
      }

      // Also remove from stop_times if it exists there
      const stopTimes = parser.getFileData("stop_times.txt");
      for (let i = stopTimes.length - 1; i >= 0; i--) {
        if (stopTimes[i].stop_id === stopId) {
          stopTimes.splice(i, 1);
        }
      }

      console.log(`Stop ${stopId} deleted`);
    }
  }

  enableShapeEditing(polyline) {
    if (!polyline || !polyline.shapeId) return;

    // Create edit layer if it doesn't exist
    if (!this.editLayer) {
      this.editLayer = new L.FeatureGroup().addTo(this.map);
    }

    // Remove original polyline from map
    this.map.removeLayer(polyline);

    // Create editable version
    const editablePolyline = L.polyline(polyline.getLatLngs(), {
      color: polyline.options.color,
      weight: 4,
      opacity: 0.8,
    }).addTo(this.editLayer);

    // Store reference data
    editablePolyline.shapeId = polyline.shapeId;
    editablePolyline.originalPolyline = polyline;

    // Enable editing
    editablePolyline.editing.enable();

    // Add control buttons
    this.showShapeEditControls(editablePolyline);

    console.log(`Shape ${polyline.shapeId} is now editable`);
  }

  showShapeEditControls(editablePolyline) {
    // Create floating control panel
    const controlDiv = L.DomUtil.create("div", "shape-edit-controls");
    controlDiv.innerHTML = `
            <div class="edit-control-panel">
                <h5>Editing Shape: ${editablePolyline.shapeId}</h5>
                <button onclick="window.mapEditor.saveShapeEdits('${editablePolyline.shapeId}')" class="save-btn">Save Changes</button>
                <button onclick="window.mapEditor.cancelShapeEdits('${editablePolyline.shapeId}')" class="cancel-btn">Cancel</button>
                <p><small>Click and drag points to edit the shape</small></p>
            </div>
        `;

    // Position it in top-left
    controlDiv.style.position = "absolute";
    controlDiv.style.top = "10px";
    controlDiv.style.left = "10px";
    controlDiv.style.zIndex = "1000";

    // Add to map container
    this.map.getContainer().appendChild(controlDiv);

    // Store reference for cleanup
    this.currentEditControl = controlDiv;
  }

  saveShapeEdits(shapeId) {
    const editablePolyline = this.findEditableShape(shapeId);
    if (!editablePolyline) return;

    // Get the updated coordinates
    const newLatLngs = editablePolyline.getLatLngs();

    // Update the GTFS shape data
    this.updateShapeInGTFS(shapeId, newLatLngs);

    // Clean up editing interface
    this.finishShapeEdit(editablePolyline, true);

    console.log(`Shape ${shapeId} saved with ${newLatLngs.length} points`);
  }

  cancelShapeEdits(shapeId) {
    const editablePolyline = this.findEditableShape(shapeId);
    if (!editablePolyline) return;

    // Clean up editing interface without saving
    this.finishShapeEdit(editablePolyline, false);

    console.log(`Shape ${shapeId} edit cancelled`);
  }

  finishShapeEdit(editablePolyline, saved) {
    // Remove editable version
    if (this.editLayer && this.editLayer.hasLayer(editablePolyline)) {
      this.editLayer.removeLayer(editablePolyline);
    }

    // Restore original polyline (updated if saved)
    if (saved) {
      // Update original polyline with new coordinates
      const originalPolyline = editablePolyline.originalPolyline;
      originalPolyline.setLatLngs(editablePolyline.getLatLngs());
    }

    // Add original back to map
    editablePolyline.originalPolyline.addTo(this.map);

    // Clean up control panel
    if (this.currentEditControl) {
      this.currentEditControl.remove();
      this.currentEditControl = null;
    }
  }

  updateShapeInGTFS(shapeId, newLatLngs) {
    const parser = this.gtfsEditor.parser;
    const shapes = parser.getFileData("shapes.txt");

    // Remove old shape points
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (shapes[i].shape_id === shapeId) {
        shapes.splice(i, 1);
      }
    }

    // Add new shape points
    newLatLngs.forEach((latlng, index) => {
      shapes.push({
        shape_id: shapeId,
        shape_pt_lat: latlng.lat.toFixed(6),
        shape_pt_lon: latlng.lng.toFixed(6),
        shape_pt_sequence: index + 1,
        shape_dist_traveled: "", // Could calculate this if needed
      });
    });

    // Mark as modified
    if (!this.modifiedShapes) {
      this.modifiedShapes = new Set();
    }
    this.modifiedShapes.add(shapeId);
  }

  findEditableShape(shapeId) {
    if (!this.editLayer) return null;

    let foundShape = null;
    this.editLayer.eachLayer((layer) => {
      if (layer.shapeId === shapeId) {
        foundShape = layer;
      }
    });
    return foundShape;
  }

  findShapePolyline(shapeId) {
    return this.existingShapes ? this.existingShapes.get(shapeId) : null;
  }

  deleteShape(shapeId) {
    if (
      !confirm(
        "Are you sure you want to delete this shape? This cannot be undone."
      )
    ) {
      return;
    }

    const parser = this.gtfsEditor.parser;
    const shapes = parser.getFileData("shapes.txt");

    // Remove all points for this shape
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (shapes[i].shape_id === shapeId) {
        shapes.splice(i, 1);
      }
    }

    // Remove from map
    const polyline = this.existingShapes.get(shapeId);
    if (polyline) {
      this.map.removeLayer(polyline);
      this.existingShapes.delete(shapeId);
    }

    // Remove shape_id references from trips
    const trips = parser.getFileData("trips.txt");
    trips.forEach((trip) => {
      if (trip.shape_id === shapeId) {
        delete trip.shape_id;
      }
    });

    console.log(`Shape ${shapeId} deleted`);
  }
}

// Global reference for popup callbacks
let mapEditor;
