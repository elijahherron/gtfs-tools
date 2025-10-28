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
    this.serviceCounter = 1;
    this.workflow = "route"; // 'route', 'trip'

    // Initialize event listeners
    this.initializeEventListeners();
  }

  // Return next available numeric suffix for trip IDs for a given route
  getNextTripSequence(routeId) {
    try {
      if (!this.gtfsEditor || !this.gtfsEditor.parser)
        return this.tripCounter++;
      const trips = this.gtfsEditor.parser.getFileData
        ? this.gtfsEditor.parser.getFileData("trips.txt") || []
        : [];
      // Look for trip ids of form trip_<routeId>_N and extract N
      const prefix = `trip_${routeId}_`;
      let maxN = 0;
      trips.forEach((t) => {
        const id = t.trip_id || "";
        if (id.startsWith(prefix)) {
          const parts = id.split("_");
          const n = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(n) && n > maxN) maxN = n;
        }
      });
      // Also consider trips currently in-memory for this map editor
      (this.currentTrip ? [this.currentTrip] : [])
        .concat(
          this.gtfsEditor
            ? this.gtfsEditor.parser.getFileData
              ? this.gtfsEditor.parser.getFileData("trips.txt") || []
              : []
            : []
        )
        .forEach((t) => {
          const id = t && t.trip_id ? t.trip_id : null;
          if (id && id.startsWith(prefix)) {
            const parts = id.split("_");
            const n = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(n) && n > maxN) maxN = n;
          }
        });

      return maxN + 1;
    } catch (err) {
      console.warn(
        "getNextTripSequence failed, falling back to tripCounter",
        err
      );
      return this.tripCounter++;
    }
  }

  // Return next numeric suffix for route IDs (global across feed)
  getNextRouteSequence() {
    try {
      if (!this.gtfsEditor || !this.gtfsEditor.parser)
        return this.routeCounter++;
      const routes = this.gtfsEditor.parser.getFileData
        ? this.gtfsEditor.parser.getFileData("routes.txt") || []
        : [];
      let maxN = 0;
      routes.forEach((r) => {
        const id = r.route_id || "";
        const m = id.match(/^route_(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > maxN) maxN = n;
        }
      });
      // Also consider in-memory currentRoute
      if (this.currentRoute && this.currentRoute.id) {
        const m = this.currentRoute.id.match(/^route_(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > maxN) maxN = n;
        }
      }
      return maxN + 1;
    } catch (err) {
      console.warn(
        "getNextRouteSequence failed, falling back to routeCounter",
        err
      );
      return this.routeCounter++;
    }
  }

  // Return next numeric suffix for stop IDs (global across feed)
  getNextStopSequence() {
    try {
      if (!this.gtfsEditor || !this.gtfsEditor.parser)
        return this.stopCounter++;
      const stops = this.gtfsEditor.parser.getFileData
        ? this.gtfsEditor.parser.getFileData("stops.txt") || []
        : [];
      let maxN = 0;
      stops.forEach((s) => {
        const id = s.stop_id || "";
        const m = id.match(/^stop_(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > maxN) maxN = n;
        }
      });
      // Also scan in-memory routeStops for any generated ids
      (this.routeStops || []).forEach((s) => {
        const id = s && s.stop_id ? s.stop_id : "";
        const m = id.match(/^stop_(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > maxN) maxN = n;
        }
      });
      const next = maxN + 1;
      console.debug("getNextStopSequence: next=", next, "maxFound=", maxN);
      return next;
    } catch (err) {
      console.warn(
        "getNextStopSequence failed, falling back to stopCounter",
        err
      );
      return this.stopCounter++;
    }
  }

  finishTrip() {
    // Validate that we have the minimum required data
    if (!this.currentTrip) {
      alert("No active trip to finish");
      return;
    }

    if (!this.currentRoute) {
      alert("No route associated with this trip");
      return;
    }

    if (this.routeStops.length === 0) {
      alert("Please add at least one stop to the trip");
      return;
    }

    // Update currentTrip with latest form values before saving
    this.currentTrip.headsign = document.getElementById("tripHeadsignInput").value.trim();
    this.currentTrip.direction = document.getElementById("directionSelect").value;
    this.currentTrip.shortName = document.getElementById("tripShortNameInput").value.trim();
    this.currentTrip.wheelchairAccessible = document.getElementById("wheelchairAccessibleSelect").value;

    // Save the trip to GTFS data
    try {
      this.generateGTFSFromTrip();

      // Show success message
      this.showMapMessage(
        `Trip "${this.currentTrip.headsign}" saved successfully!`,
        "success"
      );

      // Update the editor's file display to show the new data
      if (this.gtfsEditor && this.gtfsEditor.currentFile) {
        this.gtfsEditor.updateFileTabs();
        this.gtfsEditor.displayFileContent(this.gtfsEditor.currentFile);
      }

      // Refresh existing trips list
      this.updateExistingTripsDisplay();

      // Update the table view if it's visible
      this.populateCreateTableView();

      // Clear the current trip but keep the route for creating another trip
      // Clear frequencies since the trip is finished and saved
      this.clearCurrentTrip(true);

      // Re-enable trip creation
      document.getElementById("startTripBtn").disabled = false;
      document.getElementById("finishTripBtn").disabled = true;

      console.log("Trip finished and saved successfully");
    } catch (error) {
      console.error("Error finishing trip:", error);
      alert(`Error saving trip: ${error.message}`);
    }
  }

  initializeEventListeners() {
    const get = (id) => document.getElementById(id);

    const safeOn = (id, type, handler, options) => {
      const el = get(id);
      if (el) {
        el.addEventListener(type, handler, options || false);
      } else {
        console.warn(
          `MapEditor: element #${id} not found, skipping ${type} listener`
        );
      }
    };

    // Delegate view toggle clicks from visible view buttons (data-view="table"/"map")
    document.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest(".view-btn[data-view]");
      if (!btn) return;
      // Ignore clicks on disabled view buttons
      if (btn.classList.contains("disabled") || btn.disabled) return;
      // Only handle clicks for buttons that are visible in the DOM
      const rects = btn.getClientRects();
      if (!rects || rects.length === 0) return;
      const view = btn.getAttribute("data-view");
      if (view === "table") this.switchToTableView();
      if (view === "map") this.switchToMapView();
    });

    // Route creation listeners
    safeOn("createRouteBtn", "click", () => this.createNewRoute());
    safeOn("selectExistingRouteBtn", "click", () => this.showExistingRoutes());
    safeOn("selectRouteBtn", "click", () => this.selectExistingRoute());
    safeOn("cancelSelectBtn", "click", () => this.cancelRouteSelection());

    // Trip creation listeners
    safeOn("startTripBtn", "click", () => this.startNewTrip());
    safeOn("finishTripBtn", "click", () => this.finishTrip());
    safeOn("clearTripBtn", "click", () => this.clearCurrentTrip(true));
    safeOn("backToRouteBtn", "click", () => this.backToRouteCreation());

    // Location and coordinate listeners
    safeOn("searchLocationBtn", "click", () => this.searchLocation());
    safeOn("addStopByCoordBtn", "click", () => this.addStopByCoordinates());

    // Timing method listener
    safeOn("timingMethodSelect", "change", () =>
      this.handleTimingMethodChange()
    );

    // Calendar method listener
    safeOn("calendarMethodSelect", "change", () =>
      this.handleCalendarMethodChange()
    );

    // Color input synchronization
    safeOn("routeColorInput", "change", () => this.syncColorFromPicker());
    safeOn("routeColorHex", "input", () => this.syncColorFromHex());
    safeOn("routeTextColorInput", "change", () =>
      this.syncTextColorFromPicker()
    );
    safeOn("routeTextColorHex", "input", () => this.syncTextColorFromHex());

    // Trip info update listeners
    safeOn("tripHeadsignInput", "input", () => this.updateTripInputs());
    safeOn("directionSelect", "change", () => this.updateTripInputs());

    // Stops list toggle listener
    safeOn("stopsListToggle", "click", () => this.toggleStopsList());

    // Trip creation method listeners
    safeOn("tripCreationMethodSelect", "change", () =>
      this.handleTripCreationMethodChange()
    );
    safeOn("loadTripDataBtn", "click", () => this.loadTripData());
    safeOn("copyFromTripSelect", "change", () =>
      this.handleCopyTripSelectChange()
    );

    // Sidebar collapse listener
    safeOn("collapseSidebarBtn", "click", () => this.toggleSidebarCollapse());
    // Route info panel close button (floating)
    safeOn("routeInfoCloseBtn", "click", () => this.hideInfoPanel());

    // Mode selection listeners
    safeOn("modeCreateRouteBtn", "click", () => this.showCreateRouteMode());
    safeOn("modeEditRouteBtn", "click", () => this.showEditRouteMode());
    safeOn("modeCreateTripBtn", "click", () => this.showCreateTripMode());
    safeOn("modeFeedInfoBtn", "click", () => this.showFeedInfoMode());

    // Back to menu listeners
    safeOn("backToMenuFromRouteBtn", "click", () => this.showModeSelection());
    safeOn("backToMenuFromEditBtn", "click", () => this.showModeSelection());
    safeOn("backToMenuFromCreateTripBtn", "click", () =>
      this.showModeSelection()
    );
    safeOn("backToMenuFromFeedInfoBtn", "click", () =>
      this.showModeSelection()
    );

    // Edit route listeners
    safeOn("editRouteSelect", "change", () => this.handleEditRouteSelect());
    safeOn("saveRouteEditsBtn", "click", () => this.saveRouteEdits());

    // Trips manager listeners
    safeOn("createTripRouteSelect", "change", () =>
      this.handleTripsManagerRouteSelect()
    );
    safeOn("createNewTripBtn", "click", () => this.createNewTripOnRoute());

    // Feed info listeners
    safeOn("saveFeedInfoBtn", "click", () => this.saveFeedInfo());

    // Enter key support for location search
    const locInput = get("locationSearchInput");
    if (locInput) {
      locInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.searchLocation();
        }
      });
    } else {
      console.warn(
        "MapEditor: element #locationSearchInput not found, skipping keypress handler"
      );
    }

    // Note: Sidebar is permanent in Build section, no close button needed

    // Initialize contrast ratio calculation
    try {
      this.updateContrastRatio();
    } catch (err) {
      console.warn("MapEditor: updateContrastRatio failed:", err);
    }
  }

  showInfoPanel() {
    // Show active content in sidebar, hide placeholder
    const placeholder = document.getElementById("sidebarPlaceholder");
    const activeContent = document.getElementById("sidebarActiveContent");

    if (placeholder && activeContent) {
      placeholder.style.display = "none";
      activeContent.style.display = "flex";
    } else {
      console.warn(
        "MapEditor: sidebar elements not found when showing info panel"
      );
    }

    try {
      this.refreshExistingTripsVisibility();
    } catch (err) {
      console.warn("MapEditor: refreshExistingTripsVisibility failed:", err);
    }

    // If the UI uses the floating sidebar overlay, open it and show the map toggle
    try {
      const routeInfoSidebar = document.getElementById("routeInfoSidebar");
      const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
      const buildLayout = document.querySelector(".build-layout");

      if (routeInfoSidebar && routeInfoSidebar.classList.contains("floating")) {
        routeInfoSidebar.classList.remove("collapsed");
        routeInfoSidebar.classList.add("open");
        if (toggleSidebarBtn)
          toggleSidebarBtn.classList.add("visible", "shifted");
        // show close button inside panel
        const routeClose = document.getElementById("routeInfoCloseBtn");
        if (routeClose) routeClose.style.display = "inline-flex";
        if (buildLayout) buildLayout.classList.add("sidebar-floating");
      }
    } catch (err) {
      console.warn("MapEditor: failed to open floating sidebar", err);
    }
  }

  hideInfoPanel() {
    // Show placeholder in sidebar, hide active content
    const placeholder = document.getElementById("sidebarPlaceholder");
    const activeContent = document.getElementById("sidebarActiveContent");

    if (placeholder && activeContent) {
      placeholder.style.display = "block";
      activeContent.style.display = "none";
    } else {
      console.warn(
        "MapEditor: sidebar elements not found when hiding info panel"
      );
    }

    // If floating sidebar is used, collapse it and hide toggle & overlay
    try {
      const routeInfoSidebar = document.getElementById("routeInfoSidebar");
      const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");

      if (routeInfoSidebar && routeInfoSidebar.classList.contains("floating")) {
        routeInfoSidebar.classList.add("collapsed");
        routeInfoSidebar.classList.remove("open");
        if (toggleSidebarBtn)
          toggleSidebarBtn.classList.remove("shifted", "visible");
        // hide the internal close button
        const routeClose = document.getElementById("routeInfoCloseBtn");
        if (routeClose) routeClose.style.display = "none";
      }
    } catch (err) {
      console.warn("MapEditor: failed to collapse floating sidebar", err);
    }
  }

  refreshExistingTripsVisibility() {
    if (!this.currentRoute || !this.gtfsEditor) return;

    const existingTripsSection = document.getElementById(
      "existingTripsSection"
    );
    const tripsList = document.getElementById("existingTripsList");
    const emptyState = document.getElementById("tripsListEmpty");

    // Return early if required elements are not found
    if (!existingTripsSection || !tripsList || !emptyState) {
      console.warn("Existing trips section elements not found in DOM");
      return;
    }

    // Get existing trips for this route
    const trips = this.getExistingTripsForRoute(this.currentRoute.id);

    if (trips.length > 0) {
      existingTripsSection.style.display = "block";
      emptyState.style.display = "none";

      // Clear existing trip items
      const existingItems = tripsList.querySelectorAll(".trip-item");
      existingItems.forEach((item) => item.remove());

      // Add trip items
      trips.forEach((trip) => {
        const tripItem = this.createTripItem(trip);
        tripsList.appendChild(tripItem);
      });
    } else {
      existingTripsSection.style.display = "none";
    }
  }

  getExistingTripsForRoute(routeId) {
    if (!this.gtfsEditor || !this.gtfsEditor.parser) return [];

    const tripsData = this.gtfsEditor.parser.getFileData("trips.txt") || [];
    return tripsData.filter((trip) => trip.route_id === routeId);
  }

  createTripItem(trip) {
    const tripItem = document.createElement("div");
    tripItem.className = "trip-item";

    const direction = trip.direction_id === "0" ? "Dir 0" : "Dir 1";
    const stops = this.getStopCountForTrip(trip.trip_id);

    // Check if trip has frequencies
    const hasFrequencies =
      this.gtfsEditor &&
      this.gtfsEditor.parser.tripUsesFrequencies(trip.trip_id);
    const frequencyCount = hasFrequencies
      ? this.gtfsEditor.parser.getFrequenciesForTrip(trip.trip_id).length
      : 0;
    const frequencyText = hasFrequencies
      ? ` • ${frequencyCount} freq periods`
      : "";

    tripItem.innerHTML = `
      <div class="trip-info">
        <div class="trip-name">${trip.trip_headsign || trip.trip_id}</div>
        <div class="trip-details">${direction} • ${stops} stops${frequencyText}</div>
      </div>
      <div class="trip-actions">
        <button class="edit-trip-btn" onclick="window.mapEditor.editExistingTrip('${
          trip.trip_id
        }')">
          Edit
        </button>
        <button class="frequencies-btn" onclick="window.mapEditor.manageFrequencies('${
          trip.trip_id
        }')"
                title="Manage frequency-based service">
          ${hasFrequencies ? "🕐 Edit" : "🕐 Add"} Freq
        </button>
      </div>
    `;

    return tripItem;
  }

  getStopCountForTrip(tripId) {
    if (!this.gtfsEditor || !this.gtfsEditor.parser) return 0;

    const stopTimesData =
      this.gtfsEditor.parser.getFileData("stop_times.txt") || [];
    const tripStops = stopTimesData.filter((st) => st.trip_id === tripId);
    return tripStops.length;
  }

  editExistingTrip(tripId) {
    if (this.isCreatingTrip) {
      if (
        !confirm(
          "You are currently creating a trip. Do you want to discard the current trip and edit the selected one?"
        )
      ) {
        return;
      }
      this.clearCurrentTrip(true);
    }

    this.loadTripForEditing(tripId);
  }

  loadTripForEditing(tripId) {
    if (!this.gtfsEditor || !this.gtfsEditor.parser) {
      alert("No GTFS data available");
      return;
    }

    const parser = this.gtfsEditor.parser;

    // Get trip data
    const tripsData = parser.getFileData("trips.txt") || [];
    const trip = tripsData.find((t) => t.trip_id === tripId);

    if (!trip) {
      alert("Trip not found");
      return;
    }

    // Get stop times for this trip
    const stopTimesData = parser.getFileData("stop_times.txt") || [];
    const tripStopTimes = stopTimesData
      .filter((st) => st.trip_id === tripId)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

    if (tripStopTimes.length === 0) {
      alert("No stops found for this trip");
      return;
    }

    // Get stops data
    const stopsData = parser.getFileData("stops.txt") || [];

    // Get shape data if exists
    const shapesData = parser.getFileData("shapes.txt") || [];
    const tripShape = trip.shape_id
      ? shapesData.filter((s) => s.shape_id === trip.shape_id)
      : [];

    // Clear any existing trip data
    this.clearTripData();

    // Load the route for this trip
    const routesData = parser.getFileData("routes.txt") || [];
    const route = routesData.find((r) => r.route_id === trip.route_id);

    if (route) {
      this.currentRoute = {
        id: route.route_id,
        name: route.route_short_name || route.route_long_name,
        longName: route.route_long_name || route.route_short_name,
        type: route.route_type,
        color: route.route_color || "4caf50",
        textColor: route.route_text_color || "ffffff",
        isNew: false,
      };
    }

    // Set up editing mode
    this.isCreatingTrip = true;
    this.currentTrip = {
      id: trip.trip_id,
      headsign: trip.trip_headsign,
      direction: trip.direction_id,
      shortName: trip.trip_short_name || "",
      wheelchairAccessible: trip.wheelchair_accessible || "",
      isEditing: true,
    };

    // Populate route form fields
    if (route) {
      document.getElementById("routeNameInput").value = route.route_short_name || "";
      document.getElementById("routeLongNameInput").value = route.route_long_name || "";
      document.getElementById("routeTypeSelect").value = route.route_type || "3";

      const routeColor = route.route_color || "4caf50";
      const routeTextColor = route.route_text_color || "ffffff";

      document.getElementById("routeColorInput").value = `#${routeColor}`;
      document.getElementById("routeColorHex").value = `#${routeColor}`;
      document.getElementById("routeTextColorInput").value = `#${routeTextColor}`;
      document.getElementById("routeTextColorHex").value = `#${routeTextColor}`;
    }

    // Populate trip form fields
    document.getElementById("tripHeadsignInput").value =
      trip.trip_headsign || "";
    document.getElementById("directionSelect").value = trip.direction_id || "0";
    document.getElementById("tripShortNameInput").value =
      trip.trip_short_name || "";
    document.getElementById("wheelchairAccessibleSelect").value =
      trip.wheelchair_accessible || "";

    // Populate service calendar
    if (trip.service_id) {
      const calendarData = parser.getFileData("calendar.txt") || [];
      const serviceExists = calendarData.some((s) => s.service_id === trip.service_id);

      if (serviceExists) {
        document.getElementById("calendarMethodSelect").value = "existing";
        this.handleCalendarMethodChange();

        // Wait for calendar inputs to be shown, then populate
        setTimeout(() => {
          const existingServiceSelect = document.getElementById("existingServiceSelect");
          if (existingServiceSelect) {
            existingServiceSelect.value = trip.service_id;
          }
        }, 100);
      }
    }

    // Set timing method based on stop times data
    const hasCustomTimes = tripStopTimes.some(
      (st) => st.arrival_time && st.departure_time
    );
    document.getElementById("timingMethodSelect").value = hasCustomTimes
      ? "manual"
      : "auto";
    this.handleTimingMethodChange();

    // Recreate stops on map
    this.routeStops = [];
    tripStopTimes.forEach((stopTime, index) => {
      const stopData = stopsData.find((s) => s.stop_id === stopTime.stop_id);
      if (stopData) {
        const seq = parseInt(stopTime.stop_sequence) || index + 1;
        const stop = {
          stop_id: stopData.stop_id,
          stop_name: stopData.stop_name || `Stop ${index + 1}`,
          stop_code: stopData.stop_code || "",
          stop_desc: stopData.stop_desc || "",
          stop_lat: parseFloat(stopData.stop_lat),
          stop_lon: parseFloat(stopData.stop_lon),
          stop_sequence: seq,
          sequence: seq,
          arrival_time: stopTime.arrival_time,
          departure_time: stopTime.departure_time,
        };

        // Create marker for the stop
        const marker = L.circleMarker([stop.stop_lat, stop.stop_lon], {
          radius: 8,
          fillColor: "#4caf50",
          color: "white",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(this.map);

        // Make stop draggable
        this.makeStopDraggable(marker, stop);

        // Add stop name label
        const label = L.divIcon({
          html: `<div class="stop-label">${stop.stop_name}</div>`,
          className: "stop-label-container",
          iconSize: [null, null],
          iconAnchor: [0, -5],
        });
        const labelMarker = L.marker([stop.stop_lat, stop.stop_lon], {
          icon: label,
        }).addTo(this.map);

        stop.marker = marker;
        stop.label = labelMarker;
        this.routeStops.push(stop);
      }
    });

    // Don't recreate route line - shapes handle route visualization now

    // Recreate shape if exists
    if (tripShape.length > 0) {
      this.currentTripShapePoints = tripShape
        .sort(
          (a, b) =>
            parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence)
        )
        .map((point) => [
          parseFloat(point.shape_pt_lat),
          parseFloat(point.shape_pt_lon),
        ]);

      if (this.currentTripShapePoints.length > 0) {
        const routeColor = this.currentRoute
          ? `#${this.currentRoute.color}`
          : "#4caf50";
        this.currentTripShape = L.polyline(this.currentTripShapePoints, {
          color: routeColor,
          weight: 4,
          opacity: 0.8,
        }).addTo(this.map);

        this.makeShapeEditable(this.currentTripShape);
      }
    } else {
      // Initialize empty shape for editing
      this.initializeTripShape();
    }

    // Hide route section when editing (user is editing trip, not route)
    // Show only the trip section
    document.getElementById("routeSection").style.display = "none";
    document.getElementById("tripSection").style.display = "block";

    // Set up UI state
    document.getElementById("startTripBtn").disabled = true;
    document.getElementById("finishTripBtn").disabled = false;
    const mapContainer = document.getElementById("mapContainer");
    if (mapContainer) {
      mapContainer.style.cursor = "crosshair";
    }

    // Update trip info display
    this.updateTripInfo();

    // Show the working on route panel with trip info
    this.updateRouteInfo();
    this.showInfoPanel();

    // Check if trip has frequencies and populate them
    if (this.gtfsEditor && this.gtfsEditor.parser) {
      const hasFrequencies = this.gtfsEditor.parser.tripUsesFrequencies(tripId);
      if (hasFrequencies) {
        const frequencies = this.gtfsEditor.parser.getFrequenciesForTrip(tripId);
        if (frequencies && frequencies.length > 0) {
          // Enable frequency toggle
          document.getElementById("useFrequenciesToggle").checked = true;
          this.gtfsEditor.toggleFrequencies(true);

          // Populate frequency periods in gtfs-editor
          this.gtfsEditor.currentFrequencyPeriods = frequencies.map((freq) => ({
            start_time: freq.start_time,
            end_time: freq.end_time,
            headway_secs: freq.headway_secs,
            exact_times: freq.exact_times || "0",
          }));

          // Refresh frequency display
          this.gtfsEditor.updateFrequencyDisplay();
        }
      }
    }

    // Show map message
    this.showMapMessage(
      `Editing trip: ${trip.trip_headsign}. Click to add shape nodes, Shift+click to add stops.`,
      "info"
    );

    // Zoom to fit all stops
    if (this.routeStops.length > 0) {
      const group = new L.featureGroup(
        this.routeStops.map((stop) => stop.marker)
      );
      this.map.fitBounds(group.getBounds().pad(0.1));
    }

    console.log(
      `Loaded trip ${tripId} for editing with ${this.routeStops.length} stops`
    );
  }

  switchToTableView() {
    const tableView = document.getElementById("tableView"); // Import section
    const mapView = document.getElementById("mapView"); // Create section map
    const createTableView = document.getElementById("createTableView"); // Create section table
    const tableBtnSelectors = Array.from(
      document.querySelectorAll('.view-btn[data-view="table"]')
    );
    const mapBtnSelectors = Array.from(
      document.querySelectorAll('.view-btn[data-view="map"]')
    );

    // Import section: show table view
    if (tableView) tableView.style.display = "block";

    // Create section: show table view, hide map view
    if (mapView) mapView.style.display = "none";
    if (createTableView) {
      createTableView.style.display = "block";
      // Populate create table view if we have data
      this.populateCreateTableView();
    }

    // Activate all visible table buttons and deactivate visible map buttons
    tableBtnSelectors.forEach((b) => {
      if (b.offsetParent !== null) b.classList.add("active");
      else b.classList.remove("active");
    });
    mapBtnSelectors.forEach((b) => {
      if (b.offsetParent !== null) b.classList.remove("active");
    });

    // Enable file tabs in table view
    const fileTabs = document.getElementById("fileTabs");
    if (fileTabs) {
      fileTabs.classList.remove("disabled");
    }

    // Enable create file tabs
    const createFileTabs = document.getElementById("createFileTabs");
    if (createFileTabs) {
      createFileTabs.classList.remove("disabled");
    }
  }

  switchToMapView() {
    const tableView = document.getElementById("tableView"); // Import section table
    const mapView = document.getElementById("mapView"); // Create section map
    const createTableView = document.getElementById("createTableView"); // Create section table
    const editorMapView = document.getElementById("editorMapView"); // Import section map
    const editorMapContainer = document.getElementById("editorMapContainer");
    const tableBtnSelectors = Array.from(
      document.querySelectorAll('.view-btn[data-view="table"]')
    );
    const mapBtnSelectors = Array.from(
      document.querySelectorAll('.view-btn[data-view="map"]')
    );

    // Import section: hide table, show map
    if (tableView) tableView.style.display = "none";
    if (editorMapView && editorMapContainer) {
      editorMapView.style.display = "block";
    }

    // Create section: hide table, show map
    if (createTableView) createTableView.style.display = "none";
    if (mapView) mapView.style.display = "block";

    // Deactivate visible table buttons and activate visible map buttons
    tableBtnSelectors.forEach((b) => {
      if (b.offsetParent !== null) b.classList.remove("active");
    });
    mapBtnSelectors.forEach((b) => {
      if (b.offsetParent !== null) b.classList.add("active");
    });

    // Disable file tabs in map view
    const fileTabs = document.getElementById("fileTabs");
    if (fileTabs) {
      fileTabs.classList.add("disabled");
    }

    // Use multiple timeouts to ensure proper initialization
    setTimeout(() => {
      // If editorMapContainer is visible, initialize map there, otherwise use default mapContainer
      const targetContainerId =
        editorMapContainer && editorMapContainer.offsetParent !== null
          ? "editorMapContainer"
          : "mapContainer";
      if (!this.map) {
        this.initializeMap(targetContainerId);
      } else {
        // If map exists but in a different container, recreate it
        try {
          if (
            this.map._container &&
            this.map._container.id !== targetContainerId
          ) {
            this.map.remove();
            this.initializeMap(targetContainerId);
          } else {
            // Force container to re-measure
            const container = document.getElementById(targetContainerId);
            if (container) {
              container.style.width = "";
              container.style.height = "";
            }
            this.map.invalidateSize(true);
          }
        } catch (err) {
          console.warn("Error ensuring map target container:", err);
        }
      }
    }, 100);

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize(true);
      }
    }, 300);
  }

  // initializeMap implementation moved earlier to support containerId parameter

  async handleMapClick(e) {
    if (!this.isCreatingTrip) return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const noShapes =
      document.getElementById("noShapesToggle")?.checked || false;

    // Check if shift key was held down
    if (e.originalEvent && e.originalEvent.shiftKey) {
      // Prevent default shift-click behavior (like zoom box)
      if (e.originalEvent.preventDefault) {
        e.originalEvent.preventDefault();
      }
      if (e.originalEvent.stopPropagation) {
        e.originalEvent.stopPropagation();
      }

      // Shift+click = add stop (and extend shape to that stop if shapes enabled)
      const timingMethod = document.getElementById("timingMethodSelect").value;

      if (timingMethod === "manual") {
        await this.promptForStopTime(lat, lng, !noShapes);
      } else {
        await this.addStop(lat, lng, !noShapes);
      }
    } else {
      // Normal click behavior depends on whether we have stops yet
      if (this.routeStops.length === 0) {
        // First click = add first stop (and start shape if enabled)
        const timingMethod =
          document.getElementById("timingMethodSelect").value;

        if (timingMethod === "manual") {
          await this.promptForStopTime(lat, lng, !noShapes, true);
        } else {
          await this.addStop(lat, lng, !noShapes, true);
        }
      } else {
        // Subsequent normal clicks = add shape node (only if shapes enabled)
        if (!noShapes) {
          this.addShapeNode(lat, lng);
        }
      }
    }
  }

  async promptForStopTime(lat, lng, extendShape = false, isFirstStop = false) {
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

    await this.addStop(lat, lng, extendShape, customTimes, isFirstStop);
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

      // Make the shape immediately editable
      this.makeShapeEditable(layer);

      // Show success message
      this.showMapMessage(
        "Route shape created! You can drag the visible nodes to edit the shape",
        "success"
      );

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

    if (!routeName && !routeLongName) {
      alert("Please enter either a route short name or route long name");
      return;
    }

    const routeColor = document.getElementById("routeColorInput").value;
    const routeTextColor = document.getElementById("routeTextColorInput").value;

    // Clear any existing trip data before creating new route
    this.clearTripData();
    this.routeStops = []; // Ensure stops array is empty

    this.currentRoute = {
      id: `route_${this.getNextRouteSequence()}`,
      name: routeName,
      longName: routeLongName || `${routeName} Line`, // Use provided long name or generate default
      type: document.getElementById("routeTypeSelect").value,
      color: routeColor.substring(1), // Remove # for GTFS format
      textColor: routeTextColor.substring(1), // Remove # for GTFS format
      isNew: true,
    };

    // Enable shape drawing for the new route
    this.enableRouteShapeDrawing();

    this.showTripSection();

    // Update mode button states since we now have a route
    this.updateModeButtonStates();
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
      // Clear any existing trip data before selecting route
      this.clearTripData();
      this.routeStops = []; // Ensure stops array is empty

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

    // Clear trip info display (reset to default values)
    document.getElementById("stopCount").textContent = "0";
    document.getElementById("currentHeadsign").textContent = "-";
    document.getElementById("currentDirection").textContent = "-";
    document.getElementById("routeDistance").textContent = "0 km";

    // Clear stops list display immediately
    const stopsList = document.getElementById("stopsList");
    const stopsListEmpty = document.getElementById("stopsListEmpty");
    if (stopsList && stopsListEmpty) {
      stopsList.style.display = "none";
      stopsList.innerHTML = "";
      stopsListEmpty.style.display = "block";
    }

    // Update trip section route indicator
    const routeIndicator = document.getElementById("currentRouteIndicator");
    if (routeIndicator) {
      routeIndicator.innerHTML = `for Route Short Name: <span style="background: #e3f2fd; padding: 2px 6px; border-radius: 3px; font-weight: bold; color: #1976d2;">${this.currentRoute.name}</span>`;
    }

    // Initialize calendar UI
    this.handleCalendarMethodChange();

    // Populate existing trips for copying
    this.populateCopyTripSelector();

    // Show the route info panel
    this.showInfoPanel();

    // Update existing trips display
    this.refreshExistingTripsVisibility();

    // NOTE: DO NOT call updateRouteInfo() or updateTripInfo() here!
    // They will populate stops list from this.routeStops which may contain stale data
  }

  backToRouteCreation() {
    this.clearCurrentTrip(true);
    document.getElementById("routeSection").style.display = "block";
    document.getElementById("tripSection").style.display = "none";
    this.hideInfoPanel();
    this.currentRoute = null;
  }

  startNewTrip() {
    // Validate inputs BEFORE clearing existing trip data
    const headsign = document.getElementById("tripHeadsignInput").value.trim();
    if (!headsign) {
      alert("Please enter a trip headsign");
      return;
    }

    // Store form values before clearing
    const direction = document.getElementById("directionSelect").value;
    const shortName = document
      .getElementById("tripShortNameInput")
      .value.trim();

    // Always clear any existing trip data (whether in progress or finished)
    // Don't clear frequencies - they were configured before starting the trip
    this.clearCurrentTrip(false);

    // Force clear the stops array and map - call clearTripData BEFORE emptying array
    this.clearTripData();
    this.routeStops = [];

    // Restore form values after clearing
    document.getElementById("tripHeadsignInput").value = headsign;
    document.getElementById("directionSelect").value = direction;
    document.getElementById("tripShortNameInput").value = shortName;

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
    const nextSeq = this.getNextTripSequence(this.currentRoute.id);
    this.currentTrip = {
      id: `trip_${this.currentRoute.id}_${nextSeq}`,
      headsign: headsign,
      direction: document.getElementById("directionSelect").value,
      shortName: document.getElementById("tripShortNameInput").value.trim(),
      wheelchairAccessible: document.getElementById("wheelchairAccessibleSelect").value,
    };

    document.getElementById("startTripBtn").disabled = true;
    document.getElementById("finishTripBtn").disabled = false;
    this.showInfoPanel();

    // Hide existing trips section when creating a new trip
    const existingTripsSection = document.getElementById(
      "existingTripsSection"
    );
    if (existingTripsSection) {
      existingTripsSection.style.display = "none";
    }

    // Manually set all trip info display values without calling updateTripInfo() to avoid repopulating stops
    document.getElementById("stopCount").textContent = "0";
    document.getElementById("currentHeadsign").textContent = headsign;
    document.getElementById("currentDirection").textContent =
      document.getElementById("directionSelect").value;
    document.getElementById("routeDistance").textContent = "0 km";

    // Force clear and show empty stops list
    const stopsList = document.getElementById("stopsList");
    const stopsListEmpty = document.getElementById("stopsListEmpty");
    if (stopsList && stopsListEmpty) {
      stopsList.style.display = "none";
      stopsList.innerHTML = "";
      stopsListEmpty.style.display = "block";
    }

    // Refresh existing stops visibility when starting a new trip
    if (this.gtfsEditor) {
      this.gtfsEditor.refreshExistingStopsVisibility();
    }

    // Initialize trip shape automatically
    this.initializeTripShape();

    // Change cursor to crosshair
    const mapContainer = document.getElementById("mapContainer");
    if (mapContainer) {
      mapContainer.style.cursor = "crosshair";
    }
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

  async reverseGeocode(lat, lng) {
    // Use Nominatim (OpenStreetMap) reverse geocoding service
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "GTFS-Editor/1.0",
        },
      });
      const data = await response.json();

      if (data && data.address) {
        const address = data.address;

        // Try to build a street intersection or street name
        // Priority: road/street intersection or single street name
        const road =
          address.road || address.street || address.pedestrian || address.path;
        const amenity = address.amenity;
        const building = address.building;

        // If we have a road name, use it
        if (road) {
          // Try to get cross street from nearby features
          // For now, we'll just use the single street name
          // You could enhance this by doing multiple reverse geocodes at nearby points
          return road;
        }

        // Fallback to other location identifiers
        if (amenity) return amenity;
        if (building) return building;
        if (address.suburb) return address.suburb;
        if (address.neighbourhood) return address.neighbourhood;
        if (address.city) return address.city;

        return null; // No suitable name found
      }

      return null;
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return null; // Return null on error, will fallback to "Stop N"
    }
  }

  async addStopByCoordinates() {
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
    const noShapes =
      document.getElementById("noShapesToggle")?.checked || false;
    const isFirst = this.routeStops.length === 0;
    await this.addStop(lat, lng, !noShapes, customTimes, isFirst);

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
      // Generate simple service ID (e.g., "weekday_1", "weekend_2", etc.)
      const serviceId = `${serviceName}_${this.serviceCounter || 1}`;
      this.serviceCounter = (this.serviceCounter || 1) + 1;

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
      // Generate simple "no service" ID
      const serviceId = `no_service_${this.serviceCounter || 1}`;
      this.serviceCounter = (this.serviceCounter || 1) + 1;
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

  addExistingStop(lat, lng, existingStopData) {
    // Handle shape creation/extension if enabled
    const noShapes =
      document.getElementById("noShapesToggle")?.checked || false;
    const isFirst = this.routeStops.length === 0;

    if (!noShapes) {
      if (isFirst) {
        // Initialize shape for first stop
        this.initializeTripShape();
        this.addShapeNode(lat, lng);
      } else {
        // Extend shape to this stop location
        this.addShapeNode(lat, lng);
      }
    }

    const stop = {
      stop_id: existingStopData.stop_id,
      stop_name: existingStopData.stop_name || existingStopData.stop_id,
      stop_code: existingStopData.stop_code || "",
      stop_desc: existingStopData.stop_desc || "",
      stop_lat: lat.toFixed(6),
      stop_lon: lng.toFixed(6),
      stop_sequence: this.routeStops.length + 1,
      sequence: this.routeStops.length + 1,
    };

    // Add timing information for existing stops
    this.addTimingToStop(stop, null);

    // Continue with the rest of the stop creation logic
    this.createStopMarkerAndFinalize(stop);
  }

  async addStop(
    lat,
    lng,
    extendShape = false,
    customTimes = null,
    isFirstStop = false
  ) {
    const stopId = `stop_${this.getNextStopSequence()}`;
    let stopName = `Stop ${this.routeStops.length + 1}`;

    // Check if street-based naming is enabled
    const useStreetNames =
      document.getElementById("useStreetNamesToggle")?.checked || false;

    if (useStreetNames) {
      // Try to get street name from reverse geocoding
      const streetName = await this.reverseGeocode(lat, lng);
      if (streetName) {
        stopName = streetName;
      }
      // If reverse geocoding fails or returns null, keep default "Stop N" name
    }

    // Handle shape creation/extension if enabled
    if (extendShape) {
      if (isFirstStop) {
        // Initialize shape for first stop
        this.initializeTripShape();
        this.addShapeNode(lat, lng);
      } else {
        // Extend shape to this stop location
        this.addShapeNode(lat, lng);
      }
    }

    const stop = {
      stop_id: stopId,
      stop_name: stopName,
      stop_lat: lat.toFixed(6),
      stop_lon: lng.toFixed(6),
      stop_sequence: this.routeStops.length + 1,
    };
    console.debug("addStop: created stop", stopId, stopName, {
      routeStopsLen: this.routeStops.length,
    });

    // Add timing information
    this.addTimingToStop(stop, customTimes);

    // Continue with marker creation
    this.createStopMarkerAndFinalize(stop);
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

    // Helper function to escape HTML attributes
    const escapeHtml = (text) => {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML.replace(/"/g, "&quot;");
    };

    div.innerHTML = `
            <h4>Edit Stop #${stop.stop_sequence}</h4>
            <div class="popup-field">
                <label>Stop Name:</label>
                <input type="text" id="stopName_${escapeHtml(
                  stop.stop_id
                )}" value="${escapeHtml(
      stop.stop_name
    )}" placeholder="Stop Name">
            </div>
            <div class="popup-field">
                <label>Stop Code:</label>
                <input type="text" id="stopCode_${escapeHtml(
                  stop.stop_id
                )}" value="${escapeHtml(
      stop.stop_code || ""
    )}" placeholder="Optional">
            </div>
            <div class="popup-field">
                <label>Stop Description:</label>
                <input type="text" id="stopDesc_${escapeHtml(
                  stop.stop_id
                )}" value="${escapeHtml(
      stop.stop_desc || ""
    )}" placeholder="Optional">
            </div>
            <div class="popup-field">
                <label>Wheelchair Boarding:</label>
                <select id="wheelchairBoarding_${escapeHtml(stop.stop_id)}">
                    <option value="" ${
      !stop.wheelchair_boarding || stop.wheelchair_boarding === ""
        ? "selected"
        : ""
    }>No information</option>
                    <option value="1" ${
      stop.wheelchair_boarding === "1" ? "selected" : ""
    }>Accessible</option>
                    <option value="2" ${
      stop.wheelchair_boarding === "2" ? "selected" : ""
    }>Not accessible</option>
                </select>
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
    const wheelchairBoardingInput = document.getElementById(`wheelchairBoarding_${stopId}`);
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
    if (wheelchairBoardingInput) {
      stop.wheelchair_boarding = wheelchairBoardingInput.value;
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
    const validation = this.validateStopTimes(
      stopId,
      newArrivalTime,
      newDepartureTime
    );
    if (!validation.valid) {
      alert(validation.message);
      return; // Don't update invalid times
    }

    // Save validated times
    stop.arrival_time = newArrivalTime;
    stop.departure_time = newDepartureTime;

    stop.marker.closePopup();
    // Update UI
    this.updateTripInfo();

    // Persist stop name/code/desc changes to parser gtfsData if the stop exists
    try {
      if (this.gtfsEditor && this.gtfsEditor.parser) {
        const parser = this.gtfsEditor.parser;
        const stopsData = parser.getFileData("stops.txt");
        if (Array.isArray(stopsData)) {
          const si = stopsData.findIndex((s) => s.stop_id === stop.stop_id);
          if (si !== -1) {
            // Update fields
            stopsData[si].stop_name = stop.stop_name;
            stopsData[si].stop_code = stop.stop_code || "";
            stopsData[si].stop_desc = stop.stop_desc || "";
            stopsData[si].wheelchair_boarding = stop.wheelchair_boarding || "";
            // Ensure parser's gtfsData reference updated (getFileData may return ref)
            parser.gtfsData["stops.txt"] = stopsData;
            // Refresh table view if visible
            try {
              this.gtfsEditor.displayFileContent("stops.txt");
            } catch (err) {
              // ignore refresh errors
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to persist stop edits to parser data:", err);
    }
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
    if (stopIndex === -1) {
      console.warn(`Stop ${stopId} not found in routeStops`);
      return;
    }

    const stop = this.routeStops[stopIndex];

    // Clear pulse interval if it exists
    if (stop.pulseInterval) {
      clearInterval(stop.pulseInterval);
      stop.pulseInterval = null;
    }

    // Remove marker - need to handle both the current marker and any old markers
    if (stop.marker) {
      try {
        console.log(`Removing marker for stop ${stopId}`, {
          hasMap: !!stop.marker._map,
          markerType: stop.marker.constructor.name,
          latLng: stop.marker.getLatLng(),
          hasStopId: !!stop.marker._stopId,
        });

        // Close and unbind popup
        if (stop.marker.getPopup && stop.marker.getPopup()) {
          stop.marker.closePopup();
          stop.marker.unbindPopup();
        }

        // Remove from map - force removal
        if (stop.marker._map) {
          stop.marker._map.removeLayer(stop.marker);
        }
        this.map.removeLayer(stop.marker);
        stop.marker.remove();

        console.log(`Marker removed for stop ${stopId}`);
      } catch (error) {
        console.error(`Error removing marker for stop ${stopId}:`, error);
      }
    }

    // Also check for any orphaned old marker (before drag conversion)
    if (stop._oldMarker) {
      try {
        console.log(`Removing old marker for stop ${stopId}`);
        if (stop._oldMarker._map) {
          stop._oldMarker._map.removeLayer(stop._oldMarker);
        }
        this.map.removeLayer(stop._oldMarker);
        stop._oldMarker.remove();
        stop._oldMarker = null;
      } catch (error) {
        console.log(`Error removing old marker:`, error.message);
      }
    }

    // Aggressive cleanup: search for any markers at this stop's location
    const stopLat = parseFloat(stop.stop_lat);
    const stopLng = parseFloat(stop.stop_lon);
    const layersToRemove = [];

    this.map.eachLayer((layer) => {
      if (layer.getLatLng) {
        const layerLatLng = layer.getLatLng();
        const distance =
          Math.abs(layerLatLng.lat - stopLat) +
          Math.abs(layerLatLng.lng - stopLng);

        // If layer is at the same location (within tiny threshold)
        if (distance < 0.000001) {
          // Check if it's a marker (not a label) by checking its class
          const isMarker =
            layer instanceof L.CircleMarker || layer instanceof L.Marker;
          const isLabel =
            layer.options &&
            layer.options.icon &&
            layer.options.icon.options.className === "stop-label";

          if (isMarker && !isLabel) {
            layersToRemove.push(layer);
          }
        }
      }
    });

    if (layersToRemove.length > 0) {
      console.log(
        `Found ${layersToRemove.length} orphaned marker(s) at stop location, removing...`
      );
      layersToRemove.forEach((layer) => {
        try {
          this.map.removeLayer(layer);
          layer.remove();
        } catch (e) {
          console.log("Error removing orphaned marker:", e.message);
        }
      });
    }

    // Remove label - labels are also added directly to map
    if (stop.label) {
      try {
        console.log(
          `Removing label for stop ${stopId}, label has _map:`,
          !!stop.label._map
        );
        if (stop.label._map) {
          stop.label.removeFrom(this.map);
        }
        stop.label.remove();
        // Force removal from map's layer list
        this.map.removeLayer(stop.label);
        console.log(`Label removed for stop ${stopId}`);
      } catch (error) {
        console.error(`Error removing label for stop ${stopId}:`, error);
      }
    }

    // Clear references
    stop.marker = null;
    stop.label = null;

    // Remove from array
    this.routeStops.splice(stopIndex, 1);

    // Update stop sequences and names
    this.routeStops.forEach((s, index) => {
      s.stop_sequence = index + 1;
      // Update stop names if they're using default naming
      if (s.stop_name && s.stop_name.startsWith("Stop ")) {
        s.stop_name = `Stop ${index + 1}`;
        // Update the label text on map
        if (s.label) {
          const labelDiv = s.label
            .getElement()
            ?.querySelector(".stop-label-text");
          if (labelDiv) {
            labelDiv.textContent = s.stop_name;
          }
        }
      }
    });

    this.updateRouteLine();
    this.updateTripInfo();
  }

  updateRouteLine() {
    // Remove existing route line if it exists
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }

    // Don't create dotted line between stops during trip creation
    // Shapes now handle the route visualization
  }

  updateTripInputs() {
    if (!this.currentTrip) return;

    // Update currentTrip object with current input values
    this.currentTrip.headsign = document
      .getElementById("tripHeadsignInput")
      .value.trim();
    this.currentTrip.direction =
      document.getElementById("directionSelect").value;

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

    // Add bulk actions header
    const bulkActionsHeader = document.createElement("div");
    bulkActionsHeader.className = "stops-list-bulk-actions";
    bulkActionsHeader.innerHTML = `
      <div class="bulk-actions-controls">
        <label class="bulk-select-all">
          <input type="checkbox" id="selectAllStops" />
          <span>Select All</span>
        </label>
        <button class="bulk-delete-btn" id="bulkDeleteStopsBtn" disabled>Delete Selected</button>
        <button class="clear-all-btn" id="clearAllStopsBtn">Clear All Stops</button>
      </div>
    `;
    stopsList.appendChild(bulkActionsHeader);

    // Add event listeners for bulk actions
    document
      .getElementById("selectAllStops")
      .addEventListener("change", (e) => {
        const checkboxes = stopsList.querySelectorAll(".stop-checkbox");
        checkboxes.forEach((cb) => (cb.checked = e.target.checked));
        this.updateBulkDeleteButton();
      });

    document
      .getElementById("bulkDeleteStopsBtn")
      .addEventListener("click", () => {
        this.deleteSelectedStops();
      });

    document
      .getElementById("clearAllStopsBtn")
      .addEventListener("click", () => {
        this.clearAllStops();
      });

    // Add individual stop items
    this.routeStops.forEach((stop, index) => {
      const li = document.createElement("li");
      li.className = "stop-list-item";

      // Checkbox for selection
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "stop-checkbox";
      checkbox.setAttribute("data-stop-id", stop.stop_id);
      checkbox.addEventListener("change", () => this.updateBulkDeleteButton());

      // Container for stop info (name + time stacked vertically)
      const stopInfoContainer = document.createElement("div");
      stopInfoContainer.className = "stop-info-container";

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
      stopInfo.addEventListener("mouseenter", (e) =>
        this.showStopTooltip(e, stop)
      );
      stopInfo.addEventListener("mouseleave", () => this.hideStopTooltip());

      // Add click-to-edit functionality for stop name
      stopName.addEventListener("click", (e) => this.editStopName(e, stop));

      const stopTime = document.createElement("div");
      stopTime.className = "stop-time stop-time-editable";
      if (stop.arrival_time && stop.departure_time) {
        stopTime.textContent = `${this.formatGTFSTime(
          stop.arrival_time
        )} - ${this.formatGTFSTime(stop.departure_time)}`;
      } else {
        stopTime.textContent = "No times set";
      }
      stopTime.setAttribute("data-stop-id", stop.stop_id);

      // Add click-to-edit functionality for stop times
      stopTime.addEventListener("click", (e) => this.editStopTime(e, stop));

      // Add both to container
      stopInfoContainer.appendChild(stopInfo);
      stopInfoContainer.appendChild(stopTime);

      // Wheelchair boarding selector
      const wheelchairContainer = document.createElement("div");
      wheelchairContainer.className = "stop-wheelchair-container";

      const wheelchairSelect = document.createElement("select");
      wheelchairSelect.className = "stop-wheelchair-select";
      wheelchairSelect.setAttribute("data-stop-id", stop.stop_id);
      wheelchairSelect.title = "Wheelchair Boarding";

      const wheelchairOptions = [
        { value: "", label: "♿ Unknown" },
        { value: "1", label: "♿ Accessible" },
        { value: "2", label: "♿ Not Accessible" }
      ];

      wheelchairOptions.forEach(option => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.label;
        if (stop.wheelchair_boarding === option.value) {
          opt.selected = true;
        }
        wheelchairSelect.appendChild(opt);
      });

      wheelchairSelect.addEventListener("change", (e) => {
        e.stopPropagation();
        this.updateStopWheelchairBoarding(stop.stop_id, e.target.value);
      });

      wheelchairContainer.appendChild(wheelchairSelect);

      // Action buttons container
      const actionsContainer = document.createElement("div");
      actionsContainer.className = "stop-actions";

      // Insert after button
      const insertBtn = document.createElement("button");
      insertBtn.className = "stop-insert-btn";
      insertBtn.innerHTML = "+";
      insertBtn.title = "Insert stop after this one";
      insertBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.enableInsertAfterMode(index);
      });

      // Individual delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "stop-delete-btn";
      deleteBtn.innerHTML = "×";
      deleteBtn.title = "Delete this stop";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeStop(stop.stop_id);
      });

      actionsContainer.appendChild(insertBtn);
      actionsContainer.appendChild(deleteBtn);

      li.appendChild(checkbox);
      li.appendChild(stopInfoContainer);
      li.appendChild(wheelchairContainer);
      li.appendChild(actionsContainer);
      stopsList.appendChild(li);
    });
  }

  updateStopWheelchairBoarding(stopId, value) {
    const stop = this.routeStops.find((s) => s.stop_id === stopId);
    if (!stop) return;

    // Update the stop object
    stop.wheelchair_boarding = value;

    // Update in parser data if stop exists in stops.txt
    try {
      if (this.gtfsEditor && this.gtfsEditor.parser) {
        const parser = this.gtfsEditor.parser;
        const stopsData = parser.getFileData("stops.txt");
        if (Array.isArray(stopsData)) {
          const stopIndex = stopsData.findIndex((s) => s.stop_id === stopId);
          if (stopIndex !== -1) {
            stopsData[stopIndex].wheelchair_boarding = value;
            parser.gtfsData["stops.txt"] = stopsData;

            // Refresh table view if visible
            try {
              this.gtfsEditor.displayFileContent("stops.txt");
            } catch (err) {
              // Ignore refresh errors
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to persist wheelchair_boarding to parser data:", err);
    }

    // Show feedback
    const accessibilityText = value === "1" ? "accessible" : value === "2" ? "not accessible" : "unknown";
    this.showMapMessage(`Stop marked as ${accessibilityText}`, "success");
  }

  updateBulkDeleteButton() {
    const bulkDeleteBtn = document.getElementById("bulkDeleteStopsBtn");
    if (!bulkDeleteBtn) return;

    const checkboxes = document.querySelectorAll(".stop-checkbox:checked");
    bulkDeleteBtn.disabled = checkboxes.length === 0;
    bulkDeleteBtn.textContent =
      checkboxes.length > 0
        ? `Delete Selected (${checkboxes.length})`
        : "Delete Selected";
  }

  deleteSelectedStops() {
    const checkboxes = document.querySelectorAll(".stop-checkbox:checked");
    if (checkboxes.length === 0) return;

    const stopIds = Array.from(checkboxes).map((cb) =>
      cb.getAttribute("data-stop-id")
    );

    if (
      !confirm(
        `Delete ${stopIds.length} selected stop(s)? This cannot be undone.`
      )
    ) {
      return;
    }

    // Remove stops in reverse order to maintain indices
    stopIds.forEach((stopId) => {
      this.removeStop(stopId);
    });

    this.showMapMessage(`Deleted ${stopIds.length} stop(s)`, "success");
  }

  clearAllStops() {
    if (this.routeStops.length === 0) return;

    if (
      !confirm(
        `Clear all ${this.routeStops.length} stops? This cannot be undone.`
      )
    ) {
      return;
    }

    // Create a copy of the array to avoid modification during iteration
    const stopsToRemove = [...this.routeStops];
    stopsToRemove.forEach((stop) => {
      this.removeStop(stop.stop_id);
    });

    this.showMapMessage("All stops cleared", "success");
  }

  enableInsertAfterMode(afterIndex) {
    // Store the insertion position
    this.insertAfterIndex = afterIndex;

    // Show a message to the user
    const stopName =
      this.routeStops[afterIndex]?.stop_name || `Stop ${afterIndex + 1}`;
    this.showMapMessage(
      `Click on the map to insert a new stop after "${stopName}". Press ESC to cancel.`,
      "info"
    );

    // Change cursor to indicate insert mode
    const mapContainer = document.getElementById("mapContainer");
    if (mapContainer) {
      mapContainer.style.cursor = "crosshair";
    }

    // Add temporary map click handler for inserting
    this.insertModeClickHandler = (e) => {
      this.insertStopAfter(e.latlng.lat, e.latlng.lng, afterIndex);
      this.disableInsertAfterMode();
    };

    this.map.once("click", this.insertModeClickHandler);

    // Allow ESC to cancel
    this.insertModeEscHandler = (e) => {
      if (e.key === "Escape") {
        this.disableInsertAfterMode();
        this.showMapMessage("Insert mode cancelled", "info");
      }
    };
    document.addEventListener("keydown", this.insertModeEscHandler);
  }

  disableInsertAfterMode() {
    this.insertAfterIndex = null;
    const mapContainer = document.getElementById("mapContainer");
    if (mapContainer) {
      mapContainer.style.cursor = this.isCreatingTrip ? "crosshair" : "default";
    }

    // Remove event listeners
    if (this.insertModeClickHandler) {
      this.map.off("click", this.insertModeClickHandler);
      this.insertModeClickHandler = null;
    }
    if (this.insertModeEscHandler) {
      document.removeEventListener("keydown", this.insertModeEscHandler);
      this.insertModeEscHandler = null;
    }
  }

  async insertStopAfter(lat, lng, afterIndex) {
    const timingMethod =
      document.getElementById("timingMethodSelect")?.value || "auto";
    let customTimes = null;

    // If manual timing, prompt for times
    if (timingMethod === "manual") {
      const arrival = prompt("Enter arrival time (HH:MM):", "08:00");
      if (!arrival) {
        this.showMapMessage("Stop insertion cancelled", "info");
        return;
      }
      const departure = prompt("Enter departure time (HH:MM):", arrival);
      if (!departure) {
        this.showMapMessage("Stop insertion cancelled", "info");
        return;
      }
      customTimes = { arrival, departure };
    }

    // Generate unique stop ID
    const stopId = `stop_${this.getNextStopSequence()}`;
    let stopName = `Stop ${afterIndex + 2}`; // Name based on position

    // Check if street-based naming is enabled
    const useStreetNames =
      document.getElementById("useStreetNamesToggle")?.checked || false;

    if (useStreetNames) {
      // Try to get street name from reverse geocoding
      const streetName = await this.reverseGeocode(lat, lng);
      if (streetName) {
        stopName = streetName;
      }
      // If reverse geocoding fails or returns null, keep default "Stop N" name
    }

    // Create stop object
    const stop = {
      stop_id: stopId,
      stop_name: stopName,
      stop_lat: lat.toFixed(6),
      stop_lon: lng.toFixed(6),
      stop_sequence: afterIndex + 2, // Will be updated
    };

    // Add timing information
    this.addTimingToStop(stop, customTimes);

    // Create marker for the new stop
    const marker = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: "#4caf50",
      color: "white",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    }).addTo(this.map);

    // Add label
    const label = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "stop-label",
        html: `<div class="stop-label-text">${stop.stop_name}</div>`,
      }),
    }).addTo(this.map);

    // Add references BEFORE making draggable (makeStopDraggable will update stop.marker)
    stop.marker = marker;
    stop.label = label;

    // Make stop draggable (this will replace stop.marker with drag marker)
    this.makeStopDraggable(marker, stop);

    // Create popup and bind to the NEW drag marker (stop.marker now points to drag marker)
    const popupContent = this.createStopPopup(stop, stop.marker);
    stop.marker.bindPopup(popupContent);

    // Insert at the correct position
    this.routeStops.splice(afterIndex + 1, 0, stop);

    // Update all stop sequences and names
    this.routeStops.forEach((s, index) => {
      s.stop_sequence = index + 1;
      s.stop_name = s.stop_name.startsWith("Stop ")
        ? `Stop ${index + 1}`
        : s.stop_name;

      // Update label if it exists
      if (s.label) {
        const labelDiv = s.label
          .getElement()
          ?.querySelector(".stop-label-text");
        if (labelDiv) {
          labelDiv.textContent = s.stop_name;
        }
      }
    });

    // Update shape if shapes are enabled
    if (this.currentTripShape && !this.noShapes) {
      const latlngs = this.currentTripShape.getLatLngs();
      const newStopLatLng = L.latLng(lat, lng);

      const prevStop = this.routeStops[afterIndex];
      const nextStop = this.routeStops[afterIndex + 2]; // After we inserted the stop in the array

      let insertIndex = latlngs.length; // Default to end

      if (prevStop && nextStop) {
        // Find the shape indices for prev and next stops (closest points)
        const prevStopLatLng = L.latLng(
          parseFloat(prevStop.stop_lat),
          parseFloat(prevStop.stop_lon)
        );
        const nextStopLatLng = L.latLng(
          parseFloat(nextStop.stop_lat),
          parseFloat(nextStop.stop_lon)
        );

        let prevStopShapeIndex = -1;
        let prevMinDist = Infinity;

        // Find previous stop in shape
        for (let i = 0; i < latlngs.length; i++) {
          const dist = prevStopLatLng.distanceTo(latlngs[i]);
          if (dist < prevMinDist) {
            prevMinDist = dist;
            prevStopShapeIndex = i;
          }
        }

        // Find next stop in shape (search after previous)
        let nextStopShapeIndex = -1;
        let nextMinDist = Infinity;
        if (prevStopShapeIndex !== -1) {
          for (let i = prevStopShapeIndex + 1; i < latlngs.length; i++) {
            const dist = nextStopLatLng.distanceTo(latlngs[i]);
            if (dist < nextMinDist) {
              nextMinDist = dist;
              nextStopShapeIndex = i;
            }
          }
        }

        console.log(
          `Shape insertion: prev at ${prevStopShapeIndex}, next at ${nextStopShapeIndex}`
        );

        // If we found both stops, find the best LINE SEGMENT to insert into
        if (
          prevStopShapeIndex !== -1 &&
          nextStopShapeIndex !== -1 &&
          nextStopShapeIndex > prevStopShapeIndex
        ) {
          let minSegmentDist = Infinity;
          let bestSegmentInsertIndex = prevStopShapeIndex + 1;

          // Check each line segment between prev and next stops
          for (let i = prevStopShapeIndex; i < nextStopShapeIndex; i++) {
            const segmentStart = latlngs[i];
            const segmentEnd = latlngs[i + 1];

            // Calculate distance from new stop to this line segment
            const dist = this.distanceToLineSegment(
              newStopLatLng,
              segmentStart,
              segmentEnd
            );

            if (dist < minSegmentDist) {
              minSegmentDist = dist;
              bestSegmentInsertIndex = i + 1; // Insert after segment start
            }
          }

          insertIndex = bestSegmentInsertIndex;
          console.log(
            `Inserting at ${insertIndex} (closest to line segment, dist: ${minSegmentDist.toFixed(
              4
            )})`
          );
        } else if (prevStopShapeIndex !== -1) {
          // Only found prev, insert right after it
          insertIndex = prevStopShapeIndex + 1;
          console.log(`Only found prev stop, inserting at ${insertIndex}`);
        }
      } else if (prevStop) {
        // Only previous stop exists (inserting at end)
        const prevStopLatLng = L.latLng(
          parseFloat(prevStop.stop_lat),
          parseFloat(prevStop.stop_lon)
        );
        let prevStopShapeIndex = -1;
        let prevMinDist = Infinity;

        for (let i = 0; i < latlngs.length; i++) {
          const dist = prevStopLatLng.distanceTo(latlngs[i]);
          if (dist < prevMinDist) {
            prevMinDist = dist;
            prevStopShapeIndex = i;
          }
        }

        insertIndex =
          prevStopShapeIndex !== -1 ? prevStopShapeIndex + 1 : latlngs.length;
        console.log(`Inserting at end: ${insertIndex}`);
      }

      console.log(`Before insertion: ${latlngs.length} points`);
      console.log(`Inserting stop at shape index ${insertIndex}`);

      latlngs.splice(insertIndex, 0, newStopLatLng);

      console.log(`After insertion: ${latlngs.length} points`);
      console.log(
        `First 3 points:`,
        latlngs
          .slice(0, 3)
          .map((ll) => `(${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)})`)
      );
      console.log(
        `Last 3 points:`,
        latlngs
          .slice(-3)
          .map((ll) => `(${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)})`)
      );
      console.log(
        `New stop location: (${newStopLatLng.lat.toFixed(
          4
        )}, ${newStopLatLng.lng.toFixed(4)})`
      );

      this.currentTripShape.setLatLngs(latlngs);
      this.currentTripShapePoints = latlngs;

      // Debug: check how many polylines are on the map
      let polylineCount = 0;
      this.map.eachLayer((layer) => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          polylineCount++;
          console.log(
            `Polyline found with ${layer.getLatLngs().length} points`
          );
        }
      });
      console.log(`Total polylines on map: ${polylineCount}`);
    }

    this.updateRouteLine();
    this.updateTripInfo();
    this.showMapMessage(
      `Stop inserted after position ${afterIndex + 1}`,
      "success"
    );
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
      if (tooltip.parentNode) {
        // Only update if tooltip still exists
        tooltip.style.left = e.pageX + 10 + "px";
        tooltip.style.top = e.pageY - 10 + "px";
      }
    };

    updatePosition(event);

    // Store the update function and target element for cleanup
    this.currentTooltipData = {
      updatePosition,
      target: event.target,
      tooltip,
    };

    event.target.addEventListener("mousemove", updatePosition);
  }

  hideStopTooltip() {
    // Clean up event listener first
    if (this.currentTooltipData) {
      this.currentTooltipData.target.removeEventListener(
        "mousemove",
        this.currentTooltipData.updatePosition
      );
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
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const ampm = hours >= 12 ? "PM" : "AM";
    return `${displayHours}:${minutes} ${ampm}`;
  }

  toggleSidebarCollapse() {
    const content = document.getElementById("sidebarContent");
    const collapseBtn = document.getElementById("collapseSidebarBtn");

    if (!content || !collapseBtn) {
      console.warn("Sidebar elements not found for collapse");
      return;
    }

    if (content.classList.contains("collapsed")) {
      content.classList.remove("collapsed");
      content.style.display = "block";
      collapseBtn.textContent = "−";
      collapseBtn.title = "Collapse Sidebar";
    } else {
      content.classList.add("collapsed");
      content.style.display = "none";
      collapseBtn.textContent = "+";
      collapseBtn.title = "Expand Sidebar";
    }
  }

  editStopName(event, stop) {
    event.stopPropagation();
    const span = event.target;
    const currentName = span.textContent;

    // Resolve the current stop object by id to avoid stale closures
    const stopIdAttr =
      span.getAttribute("data-stop-id") || (stop && stop.stop_id);
    const currentStop =
      this.routeStops.find((s) => s.stop_id === stopIdAttr) || stop;
    if (!currentStop) {
      console.warn("editStopName: stop not found for id", stopIdAttr);
      return;
    }

    // Create input element
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentName;
    input.className = "stop-name-input";
    input.style.cssText =
      "background: white; border: 1px solid #4caf50; border-radius: 2px; padding: 2px 4px; font-size: 12px; width: 120px;";

    // Replace span with input
    span.parentNode.replaceChild(input, span);
    input.focus();
    input.select();

    const saveEdit = () => {
      const newName =
        input.value.trim() ||
        `Stop ${currentStop.stop_sequence || currentStop.sequence}`;
      currentStop.stop_name = newName;

      // Debug info: show which stop object we're updating
      try {
        const idx = this.routeStops.findIndex(
          (s) => s.stop_id === currentStop.stop_id
        );
        console.debug("editStopName: saving", {
          stop_id: currentStop.stop_id,
          index: idx,
          newName,
        });
      } catch (e) {}

      // Update the label on the map (use same markup/class as initial rendering)
      if (currentStop.label) {
        try {
          currentStop.label.setIcon(
            L.divIcon({
              html: `<div class="stop-label">${newName}</div>`,
              className: "stop-label-container",
              iconSize: [null, null],
              iconAnchor: [0, -5],
            })
          );
        } catch (err) {
          console.warn(
            "Failed to set label icon for stop",
            currentStop.stop_id,
            err
          );
        }
      }

      // Update the marker popup if it exists (we'll rebind later)
      if (currentStop.marker && currentStop.marker.getPopup()) {
        // nop here; we'll rebind popup below
      }
      // Persist inline name edit into parser gtfsData (stops.txt) so table view updates
      try {
        if (this.gtfsEditor && this.gtfsEditor.parser) {
          const parser = this.gtfsEditor.parser;
          let stopsData = parser.getFileData("stops.txt");
          if (!Array.isArray(stopsData)) {
            stopsData = [];
          }
          const si = stopsData.findIndex(
            (s) => s.stop_id === currentStop.stop_id
          );
          if (si !== -1) {
            stopsData[si].stop_name = currentStop.stop_name;
            stopsData[si].stop_code = currentStop.stop_code || "";
            stopsData[si].stop_desc = currentStop.stop_desc || "";
          } else {
            // If stop doesn't exist in stops.txt yet, add a minimal record
            stopsData.push({
              stop_id: currentStop.stop_id,
              stop_name: currentStop.stop_name,
              stop_lat: currentStop.stop_lat,
              stop_lon: currentStop.stop_lon,
              stop_code: currentStop.stop_code || "",
              stop_desc: currentStop.stop_desc || "",
            });
          }
          parser.gtfsData["stops.txt"] = stopsData;
          try {
            this.gtfsEditor.displayFileContent("stops.txt");
          } catch (err) {
            // ignore display refresh errors
          }
        }
      } catch (err) {
        console.warn("Failed to persist inline stop name edit:", err);
      }

      // Rebind popup content so it reflects the new stop name/fields
      try {
        if (currentStop.marker) {
          const popupEl = this.createStopPopup(currentStop);
          currentStop.marker.unbindPopup();
          currentStop.marker.bindPopup(popupEl);
        }
      } catch (err) {
        // ignore popup rebind errors
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
    inputContainer.style.cssText =
      "display: flex; gap: 4px; align-items: center; flex-wrap: wrap;";

    // Create arrival time input
    const arrivalInput = document.createElement("input");
    arrivalInput.type = "time";
    arrivalInput.className = "stop-time-input";
    arrivalInput.style.cssText =
      "background: white; border: 1px solid #4caf50; border-radius: 2px; padding: 1px 3px; font-size: 10px; font-family: monospace; width: 60px;";

    // Create departure time input
    const departureInput = document.createElement("input");
    departureInput.type = "time";
    departureInput.className = "stop-time-input";
    departureInput.style.cssText =
      "background: white; border: 1px solid #4caf50; border-radius: 2px; padding: 1px 3px; font-size: 10px; font-family: monospace; width: 60px;";

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
      const validation = this.validateStopTimes(
        stop.stop_id,
        newArrivalTime,
        newDepartureTime
      );
      if (!validation.valid) {
        alert(validation.message);
        // Keep the inputs open and focus back to the problematic input
        if (
          validation.message.includes("Departure time cannot be before arrival")
        ) {
          departureInput.focus();
        } else if (
          validation.message.includes("Arrival time cannot be before")
        ) {
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
        newTimeDiv.textContent = `${this.formatGTFSTime(
          stop.arrival_time
        )} - ${this.formatGTFSTime(stop.departure_time)}`;
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
    return `${displayHours.toString().padStart(2, "0")}:${minutes}`;
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
    const stop = this.routeStops.find((s) => s.stop_id === stopId);
    if (!stop) return { valid: true };

    const stopIndex = this.routeStops.indexOf(stop);

    // Convert times to minutes for comparison
    const newArrivalMinutes = this.gtfsTimeToMinutes(newArrivalTime);
    const newDepartureMinutes = this.gtfsTimeToMinutes(newDepartureTime);

    // Check that departure is not before arrival for this stop
    if (newDepartureMinutes < newArrivalMinutes) {
      return {
        valid: false,
        message:
          "Departure time cannot be before arrival time for the same stop.",
      };
    }

    // Check previous stop (if exists)
    if (stopIndex > 0) {
      const prevStop = this.routeStops[stopIndex - 1];
      if (prevStop.departure_time) {
        const prevDepartureMinutes = this.gtfsTimeToMinutes(
          prevStop.departure_time
        );
        if (newArrivalMinutes < prevDepartureMinutes) {
          return {
            valid: false,
            message: `Arrival time cannot be before the previous stop's departure time (${this.formatGTFSTime(
              prevStop.departure_time
            )}).`,
          };
        }
      }
    }

    // Check next stop (if exists)
    if (stopIndex < this.routeStops.length - 1) {
      const nextStop = this.routeStops[stopIndex + 1];
      if (nextStop.arrival_time) {
        const nextArrivalMinutes = this.gtfsTimeToMinutes(
          nextStop.arrival_time
        );
        if (newDepartureMinutes > nextArrivalMinutes) {
          return {
            valid: false,
            message: `Departure time cannot be after the next stop's arrival time (${this.formatGTFSTime(
              nextStop.arrival_time
            )}).`,
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
        if (
          newArrivalMinutes === otherArrival ||
          newArrivalMinutes === otherDeparture ||
          newDepartureMinutes === otherArrival ||
          newDepartureMinutes === otherDeparture
        ) {
          return {
            valid: false,
            message: `Stop times cannot be identical to another stop's times.`,
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
      .filter((s) => s.arrival_time && s.departure_time)
      .flatMap((s) => [
        this.gtfsTimeToMinutes(s.arrival_time),
        this.gtfsTimeToMinutes(s.departure_time),
      ])
      .sort((a, b) => a - b);

    // Find a gap of at least 1 minute
    while (existingTimes.includes(timeMinutes)) {
      timeMinutes += 1;
    }

    // Convert back to GTFS time format
    const hours = Math.floor(timeMinutes / 60);
    const minutes = timeMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:00`;
  }

  // Validate and automatically fix any time conflicts for a specific stop
  validateAndFixStopTimes(stopId) {
    const stop = this.routeStops.find((s) => s.stop_id === stopId);
    if (!stop || !stop.arrival_time || !stop.departure_time) return;

    const validation = this.validateStopTimes(
      stopId,
      stop.arrival_time,
      stop.departure_time
    );
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

  initializeMap(containerId = "mapContainer") {
    console.log("Initializing map into container:", containerId);

    // Check if container exists and has dimensions
    const container = document.getElementById(containerId);
    if (!container) {
      console.error("Map container not found:", containerId);
      return;
    }

    console.log(
      "Container dimensions:",
      container.clientWidth,
      container.clientHeight
    );
    try {
      // Hide any loading indicators if present
      const loadingElement = document.getElementById("mapLoading");
      if (loadingElement) loadingElement.style.display = "none";

      // Create or reuse drawnItems
      if (!this.drawnItems) this.drawnItems = new L.FeatureGroup();

      // Initialize Leaflet map in the target container
      this.map = L.map(containerId, {
        boxZoom: false, // Disable shift-drag zoom box to prevent zoom on shift-click
      }).setView([40.7128, -74.006], 12);

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(this.map);

      // Add drawn items layer and draw controls
      this.drawnItems.addTo(this.map);

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
        edit: { featureGroup: this.drawnItems, remove: true },
      });
      this.map.addControl(drawControl);

      // Map event handlers
      this.map.on("click", (e) => this.handleMapClick(e));
      if (L && L.Draw) {
        this.map.on(L.Draw.Event.CREATED, (e) => this.handleDrawCreated(e));
        this.map.on(L.Draw.Event.EDITED, (e) => this.handleDrawEdited(e));
        this.map.on(L.Draw.Event.DELETED, (e) => this.handleDrawDeleted(e));
      }

      // Ensure the map properly measures its container
      setTimeout(() => {
        if (this.map) this.map.invalidateSize(true);
      }, 200);
      setTimeout(() => {
        if (this.map) this.map.invalidateSize(true);
      }, 800);

      // Try to set view to user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            try {
              this.map.setView([pos.coords.latitude, pos.coords.longitude], 13);
            } catch (e) {}
          },
          (err) => {
            /* ignore */
          }
        );
      }

      console.log("Map initialization completed in container:", containerId);
    } catch (err) {
      console.error("Failed to initialize Leaflet map:", err);
    }
  }

  generateGTFSFromTrip() {
    const parser = this.gtfsEditor.parser;
    const isEditing = this.currentTrip && this.currentTrip.isEditing;

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

    // 5. Save Trip Shape (if drawn)
    let shapeId = null;
    if (
      this.currentTripShape &&
      this.currentTripShapePoints &&
      this.currentTripShapePoints.length > 0
    ) {
      shapeId = `shape_${this.currentTrip.id}_${Date.now()}`;

      // Add shape points to shapes.txt
      this.currentTripShapePoints.forEach((point, index) => {
        // Handle both array format [lat, lng] and LatLng object format
        const lat = Array.isArray(point) ? point[0] : point.lat;
        const lng = Array.isArray(point) ? point[1] : point.lng;

        parser.addRow("shapes.txt", {
          shape_id: shapeId,
          shape_pt_lat: lat,
          shape_pt_lon: lng,
          shape_pt_sequence: index + 1,
          shape_dist_traveled: "", // Optional field
        });
      });

      console.log(
        `Saved shape ${shapeId} with ${this.currentTripShapePoints.length} points`
      );
    }

    // 6. Handle Trip (add or update)
    const tripData = {
      route_id: this.currentRoute.id,
      service_id: serviceId,
      trip_id: this.currentTrip.id,
      trip_headsign: this.currentTrip.headsign,
      direction_id: this.currentTrip.direction,
    };

    // Add shape_id if we have a shape
    if (shapeId) {
      tripData.shape_id = shapeId;
    }

    if (this.currentTrip.shortName) {
      tripData.trip_short_name = this.currentTrip.shortName;
    }

    if (this.currentTrip.wheelchairAccessible) {
      tripData.wheelchair_accessible = this.currentTrip.wheelchairAccessible;
    }

    if (isEditing) {
      // Update existing trip
      const tripsData = parser.getFileData("trips.txt");
      const existingTripIndex = tripsData.findIndex(
        (t) => t.trip_id === this.currentTrip.id
      );
      if (existingTripIndex !== -1) {
        tripsData[existingTripIndex] = tripData;
        console.log(`Updated existing trip ${this.currentTrip.id}`);
      }
    } else {
      // Add new trip
      parser.addRow("trips.txt", tripData);
      console.log("Added new trip to trips.txt:", tripData);

      // Verify it was added
      const allTrips = parser.getFileData("trips.txt");
      console.log("Total trips after addition:", allTrips?.length);
      console.log("Last trip in data:", allTrips?.[allTrips.length - 1]);
    }

    // 7. Handle Stop Times (add or update)
    if (isEditing) {
      // Remove existing stop times for this trip
      const stopTimesData = parser.getFileData("stop_times.txt");
      const filteredStopTimes = stopTimesData.filter(
        (st) => st.trip_id !== this.currentTrip.id
      );
      parser.gtfsData["stop_times.txt"] = filteredStopTimes;
      console.log(
        `Removed ${
          stopTimesData.length - filteredStopTimes.length
        } existing stop times for trip ${this.currentTrip.id}`
      );
    }

    // Add updated stop times
    this.routeStops.forEach((stop, index) => {
      const arrivalTime = stop.arrival_time || this.generateDefaultTime(index);
      const departureTime = stop.departure_time || arrivalTime;

      parser.addRow("stop_times.txt", {
        trip_id: this.currentTrip.id,
        arrival_time: arrivalTime,
        departure_time: departureTime,
        stop_id: stop.stop_id,
        stop_sequence: stop.sequence || index + 1,
      });
    });

    // 8. Handle Shape updates for editing (shapes were already handled above in step 5)
    if (isEditing && shapeId) {
      // Remove existing shape data for the old shape_id if it exists
      const tripsData = parser.getFileData("trips.txt");
      const existingTrip = tripsData.find(
        (t) => t.trip_id === this.currentTrip.id
      );
      if (
        existingTrip &&
        existingTrip.shape_id &&
        existingTrip.shape_id !== shapeId
      ) {
        // Remove old shape points
        const shapesData = parser.getFileData("shapes.txt");
        const filteredShapes = shapesData.filter(
          (s) => s.shape_id !== existingTrip.shape_id
        );
        parser.gtfsData["shapes.txt"] = filteredShapes;
        console.log(`Removed old shape data for ${existingTrip.shape_id}`);
      }
    }

    // 9. Apply frequencies if enabled
    console.log("=== Checking if frequencies should be applied ===");
    console.log("this.gtfsEditor exists?", !!this.gtfsEditor);
    console.log(
      "this.gtfsEditor.currentFrequencyPeriods:",
      this.gtfsEditor?.currentFrequencyPeriods
    );
    console.log("isEditing:", isEditing);

    if (
      this.gtfsEditor &&
      this.gtfsEditor.currentFrequencyPeriods &&
      this.gtfsEditor.currentFrequencyPeriods.length > 0 &&
      !isEditing
    ) {
      console.log("=== Applying frequencies to trip ===");
      // Only apply frequencies for new trips
      const frequencyApplied = this.gtfsEditor.applyFrequenciesToTrip(
        this.currentTrip.id
      );
      if (frequencyApplied) {
        console.log(
          `Trip ${this.currentTrip.id} configured with frequency-based service`
        );

        // Refresh the create table view to show the new frequencies
        setTimeout(() => {
          this.populateCreateTableView();
        }, 100);
      }
    } else {
      console.log("=== NOT applying frequencies - condition failed ===");
      if (!this.gtfsEditor) console.log("  - gtfsEditor is null/undefined");
      if (!this.gtfsEditor?.currentFrequencyPeriods)
        console.log("  - currentFrequencyPeriods is null/undefined");
      if (this.gtfsEditor?.currentFrequencyPeriods?.length === 0)
        console.log("  - currentFrequencyPeriods is empty array");
      if (isEditing) console.log("  - isEditing is true");
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

  clearCurrentTrip(clearFrequencies = false) {
    console.log("clearCurrentTrip called, clearFrequencies:", clearFrequencies);
    this.clearTripData();

    // Reset state
    this.currentTrip = null;
    this.isCreatingTrip = false;

    // Reset UI
    document.getElementById("startTripBtn").disabled = false;
    document.getElementById("finishTripBtn").disabled = true;
    this.hideInfoPanel();
    const mapContainer = document.getElementById("mapContainer");
    if (mapContainer) {
      mapContainer.style.cursor = "";
    }

    // Clear trip inputs
    document.getElementById("tripHeadsignInput").value = "";
    document.getElementById("tripShortNameInput").value = "";

    // Only clear frequency periods if explicitly requested
    // This allows frequencies to be configured before starting a trip
    if (clearFrequencies && this.gtfsEditor) {
      console.log("Clearing frequency periods");
      this.gtfsEditor.clearFrequencyPeriods();
    } else {
      console.log("Keeping frequency periods (not clearing)");
    }
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

    // Remove current trip shape
    if (this.currentTripShape) {
      // Remove visible drag handles before removing the shape
      this.removeVisibleDragHandles(this.currentTripShape);
      this.map.removeLayer(this.currentTripShape);
      this.currentTripShape = null;
    }
    this.currentTripShapePoints = [];
    this.shapePointsHistory = []; // Clear shape undo history

    // Remove route shape drag handles too
    if (this.routeShape) {
      this.removeVisibleDragHandles(this.routeShape);
    }

    // Clear any lingering map layers (more comprehensive cleanup)
    if (this.map) {
      this.map.eachLayer((layer) => {
        // Don't remove base tiles, drawnItems, or other permanent layers
        if (
          layer !== this.drawnItems &&
          layer.options &&
          !layer._url && // Don't remove tile layers
          !layer._isBaseLayer
        ) {
          // Don't remove base layers
          // Check if this layer looks like a stop marker, shape line, or other trip/route element
          if (
            layer._latlng || // Markers have _latlng
            layer._latlngs || // Polylines have _latlngs
            (layer.options &&
              (layer.options.className === "leaflet-div-icon" ||
                layer.options.color))
          ) {
            this.map.removeLayer(layer);
          }
        }
      });
    }

    // Reset stops array
    this.routeStops = [];
  }

  clearCurrentRoute() {
    // Legacy method - redirect to trip clearing
    this.clearCurrentTrip(true);
  }

  clearAllData() {
    // Clear all map data and reset state
    this.clearCurrentTrip(true);

    // Safety cleanup for any remaining intervals
    if (this.routeStops) {
      this.routeStops.forEach((stop) => {
        if (stop.pulseInterval) {
          clearInterval(stop.pulseInterval);
        }
      });
    }

    // Clear all map layers
    if (this.map) {
      this.map.eachLayer((layer) => {
        if (layer !== this.drawnItems && layer.options && !layer._url) {
          // Don't remove tile layers
          this.map.removeLayer(layer);
        }
      });
    }

    // Reset route state
    this.currentRoute = null;
    this.isCreatingTrip = false;

    // Hide panels
    this.hideInfoPanel();

    // Reset UI state
    document.getElementById("routeSection").style.display = "block";
    document.getElementById("tripSection").style.display = "none";
    const mapContainer = document.getElementById("mapContainer");
    if (mapContainer) {
      mapContainer.style.cursor = "";
    }

    console.log("All map data cleared");
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

  // GTFS Route/Trip Filtering and Visualization
  filterMapData(routeId, tripId, showAll = false) {
    console.log("filterMapData called with:", { routeId, tripId, showAll });
    this.clearMapFilter(); // Clear existing filtered data

    if (!this.gtfsEditor.files) {
      console.log("No GTFS files available");
      return;
    }

    const stopsFile = this.gtfsEditor.files.find((f) => f.name === "stops");
    const routesFile = this.gtfsEditor.files.find((f) => f.name === "routes");
    const tripsFile = this.gtfsEditor.files.find((f) => f.name === "trips");
    const stopTimesFile = this.gtfsEditor.files.find(
      (f) => f.name === "stop_times"
    );

    if (!stopsFile || !routesFile || !tripsFile || !stopTimesFile) return;

    // Create a layer group for filtered data
    if (!this.filteredDataGroup) {
      this.filteredDataGroup = L.layerGroup().addTo(this.map);
    }

    if (showAll) {
      // Performance improvement: Don't show all routes at once as it can freeze the browser
      console.warn(
        "Show all routes disabled to prevent performance issues. Please select a specific route."
      );
      return;
    } else if (tripId) {
      // Show specific trip
      this.visualizeTrip(
        tripId,
        stopsFile.data,
        stopTimesFile.data,
        tripsFile.data,
        routesFile.data
      );
    } else if (routeId) {
      // Show trips for the route (limited to prevent performance issues)
      const routeTrips = tripsFile.data.filter(
        (trip) => trip.route_id === routeId
      );
      const maxTrips = 10; // Limit to 10 trips to prevent freezing

      if (routeTrips.length > maxTrips) {
        console.warn(
          `Route has ${routeTrips.length} trips. Showing only first ${maxTrips} trips to prevent performance issues. Select a specific trip for complete view.`
        );
      }

      routeTrips.slice(0, maxTrips).forEach((trip) => {
        this.visualizeTrip(
          trip.trip_id,
          stopsFile.data,
          stopTimesFile.data,
          tripsFile.data,
          routesFile.data
        );
      });
    }
    // If neither routeId nor tripId is provided and showAll is false, show nothing (empty map)
  }

  visualizeTrip(tripId, stops, stopTimes, trips, routes) {
    // Get trip details
    const trip = trips.find((t) => t.trip_id === tripId);
    if (!trip) return;

    // Get route details for styling
    const route = routes.find((r) => r.route_id === trip.route_id);
    const routeColor =
      route && route.route_color ? `#${route.route_color}` : "#4caf50";

    // Get stop times for this trip (ordered by stop_sequence)
    const tripStopTimes = stopTimes
      .filter((st) => st.trip_id === tripId)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

    if (tripStopTimes.length === 0) return;

    // Create route polyline
    const routePoints = [];
    const tripStops = [];

    tripStopTimes.forEach((stopTime, index) => {
      const stop = stops.find((s) => s.stop_id === stopTime.stop_id);
      if (stop) {
        const lat = parseFloat(stop.stop_lat);
        const lng = parseFloat(stop.stop_lon);
        routePoints.push([lat, lng]);

        // Create stop marker - make it draggable for editing
        const stopMarker = L.marker([lat, lng], {
          draggable: true,
          icon: L.divIcon({
            className: "editable-stop-marker",
            html: `<div style="background: ${routeColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        });

        // Stop popup with editing functionality
        const arrivalTime = stopTime.arrival_time || "N/A";
        const departureTime = stopTime.departure_time || "N/A";
        stopMarker.bindPopup(`
          <div class="stop-popup">
            <h4>${stop.stop_name || stop.stop_id}</h4>
            <p><strong>Stop:</strong> ${index + 1} of ${
          tripStopTimes.length
        }</p>

            <div class="popup-field">
              <label>Stop Name:</label>
              <input type="text" id="edit-stop-name-${stop.stop_id}" value="${
          stop.stop_name || ""
        }" />
            </div>

            <div class="popup-field">
              <label>Wheelchair Boarding:</label>
              <select id="edit-wheelchair-boarding-${stop.stop_id}">
                <option value="" ${
          !stop.wheelchair_boarding || stop.wheelchair_boarding === ""
            ? "selected"
            : ""
        }>No information</option>
                <option value="1" ${
          stop.wheelchair_boarding === "1" ? "selected" : ""
        }>Accessible</option>
                <option value="2" ${
          stop.wheelchair_boarding === "2" ? "selected" : ""
        }>Not accessible</option>
              </select>
            </div>

            <div class="time-inputs">
              <div class="time-field">
                <label>Arrival:</label>
                <input type="time" id="edit-arrival-${
                  stop.stop_id
                }" value="${this.convertToTimeInput(arrivalTime)}" />
              </div>
              <div class="time-field">
                <label>Departure:</label>
                <input type="time" id="edit-departure-${
                  stop.stop_id
                }" value="${this.convertToTimeInput(departureTime)}" />
              </div>
            </div>

            <div class="coord-display">
              ${lat.toFixed(6)}, ${lng.toFixed(6)}
            </div>

            <div class="popup-buttons">
              <button class="update-btn" onclick="mapEditor.updateStopData('${
                stop.stop_id
              }', '${tripId}', ${index})">Update</button>
              <button class="remove-btn" onclick="mapEditor.removeStopFromTrip('${
                stop.stop_id
              }', '${tripId}')">Remove</button>
            </div>
          </div>
        `);

        // Make stop draggable
        stopMarker.on("dragend", (e) => {
          const newLatLng = e.target.getLatLng();
          this.updateStopPosition(stop.stop_id, newLatLng.lat, newLatLng.lng);
        });

        this.filteredDataGroup.addLayer(stopMarker);
        tripStops.push({ marker: stopMarker, stop, stopTime });
      }
    });

    // Load trip shape if available, otherwise create polyline from stops
    if (trip.shape_id) {
      this.loadTripShape(trip.shape_id, routeColor, route);
    } else if (routePoints.length > 1) {
      // Create route polyline from stops if no shape available
      const routePolyline = L.polyline(routePoints, {
        color: routeColor,
        weight: 4,
        opacity: 0.8,
      });

      // Route popup with trip details
      routePolyline.bindPopup(`
        <div class="route-popup">
          <h4>${
            route
              ? route.route_short_name || route.route_long_name
              : "Unknown Route"
          }</h4>
          <p><strong>Trip:</strong> ${trip.trip_headsign || tripId}</p>
          <p><strong>Direction:</strong> ${trip.direction_id || "0"}</p>
          <p><strong>Stops:</strong> ${tripStops.length}</p>
        </div>
      `);

      this.filteredDataGroup.addLayer(routePolyline);
    }

    // Zoom to fit the trip data
    setTimeout(() => {
      const bounds = [];

      // Collect all coordinates from stops
      tripStops.forEach((stopData) => {
        const latLng = stopData.marker.getLatLng();
        bounds.push([latLng.lat, latLng.lng]);
      });

      // If we have a shape, add its bounds too
      if (trip.shape_id) {
        const shapesFile = this.gtfsEditor.files.find(
          (f) => f.name === "shapes"
        );
        if (shapesFile) {
          const shapePoints = shapesFile.data
            .filter((shape) => shape.shape_id === trip.shape_id)
            .map((shape) => [
              parseFloat(shape.shape_pt_lat),
              parseFloat(shape.shape_pt_lon),
            ])
            .filter((p) => !isNaN(p[0]) && !isNaN(p[1]));
          bounds.push(...shapePoints);
        }
      }

      // Zoom to bounds if we have any
      if (bounds.length > 0) {
        const leafletBounds = L.latLngBounds(bounds);
        this.map.fitBounds(leafletBounds, {
          padding: [50, 50],
          maxZoom: 16,
        });
      }
    }, 200);
  }

  loadTripShape(shapeId, routeColor, route) {
    const shapesFile = this.gtfsEditor.files.find((f) => f.name === "shapes");
    if (!shapesFile) return;

    // Get shape points for this shape_id
    const shapePoints = shapesFile.data
      .filter((shape) => shape.shape_id === shapeId)
      .map((shape) => ({
        lat: parseFloat(shape.shape_pt_lat),
        lng: parseFloat(shape.shape_pt_lon),
        sequence: parseInt(shape.shape_pt_sequence),
        dist: parseFloat(shape.shape_dist_traveled || 0),
      }))
      .sort((a, b) => a.sequence - b.sequence)
      .filter((p) => !isNaN(p.lat) && !isNaN(p.lng));

    if (shapePoints.length < 2) return;

    const routeName = route
      ? route.route_short_name || route.route_long_name
      : "Unknown Route";

    // Create editable polyline for the shape
    const latlngs = shapePoints.map((p) => [p.lat, p.lng]);
    const shapePolyline = L.polyline(latlngs, {
      color: routeColor,
      weight: 4,
      opacity: 0.8,
    });

    // Store shape data for editing
    shapePolyline.shapeId = shapeId;
    shapePolyline.shapePoints = shapePoints;

    // Add popup with editing functionality
    shapePolyline.bindPopup(`
      <div class="shape-popup">
        <h4>${routeName}</h4>
        <p><strong>Shape ID:</strong> ${shapeId}</p>
        <p><strong>Points:</strong> ${shapePoints.length}</p>
        <p><strong>Route Type:</strong> ${this.getRouteTypeName(
          route?.route_type
        )}</p>
        <div class="shape-actions">
          <button onclick="window.mapEditor.enableShapeEditing(this.parentElement.parentElement.parentElement._source)" class="edit-btn">Edit Shape</button>
          <button onclick="window.mapEditor.deleteShape('${shapeId}')" class="remove-btn">Delete Shape</button>
        </div>
      </div>
    `);

    // Enable direct click editing
    shapePolyline.on("click", () => this.enableShapeEditing(shapePolyline));

    this.filteredDataGroup.addLayer(shapePolyline);
  }

  clearMapFilter() {
    if (this.filteredDataGroup) {
      this.filteredDataGroup.clearLayers();
    }
  }

  // Helper methods for editing functionality
  convertToTimeInput(gtfsTime) {
    if (!gtfsTime || gtfsTime === "N/A") return "";
    // Convert GTFS time format (HH:MM:SS) to HTML time input format (HH:MM)
    return gtfsTime.substring(0, 5);
  }

  updateStopData(stopId, tripId, stopIndex) {
    const stopName = document.getElementById(`edit-stop-name-${stopId}`).value;
    const wheelchairBoarding = document.getElementById(`edit-wheelchair-boarding-${stopId}`).value;
    const arrival = document.getElementById(`edit-arrival-${stopId}`).value;
    const departure = document.getElementById(`edit-departure-${stopId}`).value;

    // Update stops data
    const stopsFile = this.gtfsEditor.files.find((f) => f.name === "stops");
    if (stopsFile) {
      const stop = stopsFile.data.find((s) => s.stop_id === stopId);
      if (stop) {
        stop.stop_name = stopName;
        stop.wheelchair_boarding = wheelchairBoarding;
      }
    }

    // Update stop_times data
    const stopTimesFile = this.gtfsEditor.files.find(
      (f) => f.name === "stop_times"
    );
    if (stopTimesFile) {
      const stopTime = stopTimesFile.data.find(
        (st) => st.trip_id === tripId && st.stop_id === stopId
      );
      if (stopTime) {
        stopTime.arrival_time = arrival ? arrival + ":00" : "";
        stopTime.departure_time = departure ? departure + ":00" : "";
      }
    }

    console.log(
      `Updated stop ${stopId}: name="${stopName}", arrival="${arrival}", departure="${departure}"`
    );

    // Close popup and refresh display
    this.map.closePopup();
    this.refreshCurrentFilter();
  }

  updateStopPosition(stopId, newLat, newLng) {
    // Update stop coordinates in the data
    const stopsFile = this.gtfsEditor.files.find((f) => f.name === "stops");
    if (stopsFile) {
      const stop = stopsFile.data.find((s) => s.stop_id === stopId);
      if (stop) {
        stop.stop_lat = newLat.toFixed(6);
        stop.stop_lon = newLng.toFixed(6);
        console.log(
          `Updated stop ${stopId} position to: ${newLat.toFixed(
            6
          )}, ${newLng.toFixed(6)}`
        );
      }
    }
  }

  removeStopFromTrip(stopId, tripId) {
    if (!confirm("Remove this stop from the trip? This cannot be undone."))
      return;

    // Remove from stop_times
    const stopTimesFile = this.gtfsEditor.files.find(
      (f) => f.name === "stop_times"
    );
    if (stopTimesFile) {
      const index = stopTimesFile.data.findIndex(
        (st) => st.trip_id === tripId && st.stop_id === stopId
      );
      if (index !== -1) {
        stopTimesFile.data.splice(index, 1);
        console.log(`Removed stop ${stopId} from trip ${tripId}`);
      }
    }

    // Close popup and refresh display
    this.map.closePopup();
    this.refreshCurrentFilter();
  }

  refreshCurrentFilter() {
    // Re-apply the current filter to refresh the display
    if (this.gtfsEditor) {
      this.gtfsEditor.applyMapFilter();
    }
  }

  enableRouteShapeDrawing() {
    if (!this.map || !this.currentRoute) return;

    // Show instruction message
    this.showMapMessage(
      "Draw the route shape by clicking points on the map, or use the drawing tools on the right",
      "info"
    );

    // Update the drawing control color to match the route
    const routeColor = `#${this.currentRoute.color}`;
    this.updateDrawingControlColor(routeColor);

    // Enable polyline drawing mode
    this.enablePolylineDrawing();
  }

  showMapMessage(message, type = "info") {
    // Remove any existing message
    const existingMessage = document.querySelector(".map-instruction-message");
    if (existingMessage) {
      existingMessage.remove();
    }

    // Create new message overlay
    const messageDiv = document.createElement("div");
    messageDiv.className = "map-instruction-message";

    const bgColor =
      type === "info" ? "rgba(33, 150, 243, 0.9)" : "rgba(76, 175, 80, 0.9)";
    const textColor = "white";

    messageDiv.style.cssText = `
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: ${bgColor};
      color: ${textColor};
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      max-width: 400px;
      text-align: center;
    `;
    messageDiv.textContent = message;

    const mapContainer = document.getElementById("mapContainer");
    if (mapContainer) {
      mapContainer.style.position = "relative";
      mapContainer.appendChild(messageDiv);

      // Auto-hide after 5 seconds
      setTimeout(() => {
        if (messageDiv && messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 5000);
    }
  }

  updateDrawingControlColor(color) {
    // Update the polyline drawing options to use the route color
    if (this.map && this.map.drawControl) {
      const drawControl = this.map.drawControl;
      if (drawControl.options.draw.polyline) {
        drawControl.options.draw.polyline.shapeOptions.color = color;
      }
    }
  }

  enablePolylineDrawing() {
    // This enables the drawing toolbar - users can click the polyline tool
    console.log("Shape drawing enabled for route:", this.currentRoute.name);
  }

  makeShapeEditable(polyline) {
    if (!polyline) return;

    // Enable editing on the polyline
    polyline.editing.enable();

    // Store reference for future use
    polyline.isEditable = true;

    // Add event listeners for shape editing
    polyline.on("edit", () => {
      this.onShapeEdited(polyline);
    });

    // Add click handler to show edit controls
    polyline.on("click", () => {
      this.showShapeEditTooltip(polyline);
    });

    // Make shape nodes draggable by adding vertex drag handlers
    polyline.on("editable:vertex:dragstart", (e) => {
      this.onShapeVertexDragStart(e);
    });

    polyline.on("editable:vertex:drag", (e) => {
      this.onShapeVertexDrag(e);
    });

    polyline.on("editable:vertex:dragend", (e) => {
      this.onShapeVertexDragEnd(e);
    });

    console.log("Shape is now editable with draggable nodes");
  }

  onShapeEdited(polyline) {
    // Update route info when shape is edited
    this.updateRouteInfo();

    // Auto-save the shape data
    this.saveShapeToRoute(polyline);
  }

  saveShapeToRoute(polyline) {
    if (!polyline || !this.currentRoute) return;

    // Store the shape points in the current route
    this.currentRoute.shapePoints = polyline
      .getLatLngs()
      .map((latlng, index) => ({
        lat: latlng.lat.toFixed(6),
        lng: latlng.lng.toFixed(6),
        sequence: index + 1,
      }));

    console.log(
      "Shape saved to route:",
      this.currentRoute.shapePoints.length,
      "points"
    );
  }

  showShapeEditTooltip(polyline) {
    // Show a temporary tooltip with editing instructions
    const tooltip = L.tooltip({
      permanent: false,
      direction: "top",
      offset: [0, -10],
    })
      .setContent(
        "Drag the nodes to edit the shape. Right-click nodes to delete."
      )
      .setLatLng(polyline.getBounds().getCenter());

    tooltip.addTo(this.map);

    // Auto-remove tooltip after 3 seconds
    setTimeout(() => {
      this.map.removeLayer(tooltip);
    }, 3000);
  }

  onShapeVertexDragStart(e) {
    // Visual feedback when vertex drag starts
    const vertex = e.vertex;
    if (vertex) {
      this.showMapMessage("Dragging shape node...", "info");
    }
  }

  onShapeVertexDrag(e) {
    // Update position during drag - visual feedback
    // The shape automatically redraws during the drag
  }

  onShapeVertexDragEnd(e) {
    // Handle when vertex drag ends
    const polyline = e.layer;
    this.showMapMessage(
      "Shape node moved! Changes will be saved with trip.",
      "success"
    );

    // Update the shape data if this is the current trip shape
    if (polyline === this.currentTripShape) {
      this.currentTripShapePoints = polyline
        .getLatLngs()
        .map((latlng) => [latlng.lat, latlng.lng]);
      console.log(
        "Updated trip shape points:",
        this.currentTripShapePoints.length
      );
    }

    // Auto-save if this is a route shape
    if (polyline !== this.currentTripShape) {
      this.saveShapeToRoute(polyline);
    }

    // Update visible drag handles after the shape changes
    this.updateVisibleDragHandles(polyline);
  }

  addVisibleDragHandles(polyline) {
    if (!polyline || !polyline.getLatLngs) return;

    // Remove any existing drag handles for this polyline
    this.removeVisibleDragHandles(polyline);

    // Create array to store drag handles
    polyline._dragHandles = [];

    const latlngs = polyline.getLatLngs();
    const shapeColor = polyline.options.color || "#4caf50";

    latlngs.forEach((latlng, index) => {
      // Create a draggable marker for each vertex using a simple colored circle
      const dragHandle = L.marker(latlng, {
        draggable: true,
        icon: L.divIcon({
          className: "shape-drag-handle-marker",
          html: `<div class="shape-drag-circle" style="background-color: ${shapeColor}; border: 2px solid white; border-radius: 50%; width: 12px; height: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.4);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      });

      // Add tooltip
      dragHandle.bindTooltip(
        `Shape node ${index + 1} - Drag to move, double-click to delete`,
        {
          permanent: false,
          direction: "top",
          offset: [0, -10],
        }
      );

      // Add double-click to delete node (Mac compatible)
      dragHandle.on("dblclick", (e) => {
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();
        this.deleteShapeNode(polyline, index);
      });

      // Make the handle draggable using Leaflet's built-in dragging
      dragHandle.on("dragstart", () => {
        this.showMapMessage("Dragging shape node...", "info");
      });

      dragHandle.on("drag", () => {
        // Update the polyline vertex in real-time
        const latlngs = polyline.getLatLngs();
        latlngs[index] = dragHandle.getLatLng();
        polyline.setLatLngs(latlngs);
      });

      dragHandle.on("dragend", () => {
        this.showMapMessage(
          "Shape node moved! Changes will be saved with trip.",
          "success"
        );

        // Update the shape data if this is the current trip shape
        if (polyline === this.currentTripShape) {
          this.currentTripShapePoints = polyline
            .getLatLngs()
            .map((latlng) => [latlng.lat, latlng.lng]);
          console.log(
            "Updated trip shape points:",
            this.currentTripShapePoints.length
          );
        }

        // Auto-save if this is a route shape
        if (polyline !== this.currentTripShape) {
          this.saveShapeToRoute(polyline);
        }

        // Update all drag handles after moving one
        this.updateVisibleDragHandles(polyline);
      });

      // Visual feedback on hover - simpler approach
      dragHandle.on("mouseover", () => {
        const element = dragHandle.getElement();
        if (element) {
          const circle = element.querySelector(".shape-drag-circle");
          if (circle) {
            circle.style.transform = "scale(1.3)";
            circle.style.zIndex = "1000";
          }
        }
      });

      dragHandle.on("mouseout", () => {
        const element = dragHandle.getElement();
        if (element) {
          const circle = element.querySelector(".shape-drag-circle");
          if (circle) {
            circle.style.transform = "scale(1)";
            circle.style.zIndex = "";
          }
        }
      });

      dragHandle.addTo(this.map);
      polyline._dragHandles.push(dragHandle);
    });

    console.log(`Added ${latlngs.length} visible drag handles to shape`);

    // Add click handler to polyline for adding new nodes
    if (!polyline._hasClickHandler) {
      polyline.on("click", (e) => {
        // Only add nodes if we're actively creating/editing a trip
        if (this.isCreatingTrip && polyline === this.currentTripShape) {
          // Prevent event from bubbling up to the map click handler
          L.DomEvent.stopPropagation(e);
          this.addShapeNodeAtPosition(polyline, e.latlng);
        }
      });
      polyline._hasClickHandler = true;
    }
  }

  removeVisibleDragHandles(polyline) {
    if (polyline && polyline._dragHandles) {
      polyline._dragHandles.forEach((handle) => {
        this.map.removeLayer(handle);
      });
      polyline._dragHandles = [];
    }
  }

  updateVisibleDragHandles(polyline) {
    // Remove existing handles and add new ones based on current shape
    this.removeVisibleDragHandles(polyline);
    this.addVisibleDragHandles(polyline);
  }

  deleteShapeNode(polyline, nodeIndex) {
    if (!polyline || nodeIndex < 0) return;

    const latlngs = polyline.getLatLngs();

    // Don't allow deletion if only 2 points left (minimum for a line)
    if (latlngs.length <= 2) {
      this.showMapMessage(
        "Cannot delete - shape must have at least 2 points",
        "error"
      );
      return;
    }

    // Confirm deletion
    if (confirm(`Delete shape node ${nodeIndex + 1}?`)) {
      // Remove the point from the polyline
      latlngs.splice(nodeIndex, 1);
      polyline.setLatLngs(latlngs);

      // Update the shape data if this is the current trip shape
      if (polyline === this.currentTripShape) {
        this.currentTripShapePoints = latlngs.map((latlng) => [
          latlng.lat,
          latlng.lng,
        ]);
        console.log(
          "Deleted shape node, remaining points:",
          this.currentTripShapePoints.length
        );
      }

      // Auto-save if this is a route shape
      if (polyline !== this.currentTripShape) {
        this.saveShapeToRoute(polyline);
      }

      // Update drag handles
      this.updateVisibleDragHandles(polyline);

      this.showMapMessage(`Deleted shape node ${nodeIndex + 1}`, "success");
    }
  }

  addShapeNodeAtPosition(polyline, latlng) {
    if (!polyline || !latlng) return;

    const latlngs = polyline.getLatLngs();

    // Find the best position to insert the new point (closest line segment)
    let insertIndex = latlngs.length; // Default to end
    let minDistance = Infinity;

    for (let i = 0; i < latlngs.length - 1; i++) {
      const segmentStart = latlngs[i];
      const segmentEnd = latlngs[i + 1];

      // Calculate distance from click point to this line segment
      const distance = this.distanceToLineSegment(
        latlng,
        segmentStart,
        segmentEnd
      );

      if (distance < minDistance) {
        minDistance = distance;
        insertIndex = i + 1; // Insert after the start of the closest segment
      }
    }

    // Insert the new point
    latlngs.splice(insertIndex, 0, latlng);
    polyline.setLatLngs(latlngs);

    // Update the shape data if this is the current trip shape
    if (polyline === this.currentTripShape) {
      this.currentTripShapePoints = latlngs.map((latlng) => [
        latlng.lat,
        latlng.lng,
      ]);
      console.log(
        "Added shape node, total points:",
        this.currentTripShapePoints.length
      );
    }

    // Auto-save if this is a route shape
    if (polyline !== this.currentTripShape) {
      this.saveShapeToRoute(polyline);
    }

    // Update drag handles
    this.updateVisibleDragHandles(polyline);

    this.showMapMessage(
      `Added shape node at position ${insertIndex + 1}`,
      "success"
    );
  }

  distanceToLineSegment(point, lineStart, lineEnd) {
    // Calculate distance from a point to a line segment
    const A = point.lng - lineStart.lng;
    const B = point.lat - lineStart.lat;
    const C = lineEnd.lng - lineStart.lng;
    const D = lineEnd.lat - lineStart.lat;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    let param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = lineStart.lng;
      yy = lineStart.lat;
    } else if (param > 1) {
      xx = lineEnd.lng;
      yy = lineEnd.lat;
    } else {
      xx = lineStart.lng + param * C;
      yy = lineStart.lat + param * D;
    }

    const dx = point.lng - xx;
    const dy = point.lat - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  makeStopDraggable(marker, stop) {
    if (!marker || !stop) return;

    // Convert CircleMarker to draggable Marker for better drag experience
    const dragMarker = L.marker(
      [marker.getLatLng().lat, marker.getLatLng().lng],
      {
        draggable: true,
        icon: L.divIcon({
          className: "draggable-stop-marker",
          html: `<div class="draggable-stop-content" style="background: #ff5722; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; cursor: move; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }
    );

    // Store reference to old marker in case we need it for cleanup later
    stop._oldMarker = marker;

    // Add unique identifier to track this marker
    dragMarker._stopId = stop.stop_id;

    // Add new marker first
    dragMarker.addTo(this.map);

    // Update references BEFORE removing old marker
    stop.marker = dragMarker;

    // Remove the old CircleMarker
    try {
      this.map.removeLayer(marker);
      marker.remove();
      console.log(
        `Converted CircleMarker to draggable Marker for ${stop.stop_name}`
      );
    } catch (e) {
      console.log("Error removing old marker during drag setup:", e.message);
    }

    // Add drag event handlers
    dragMarker.on("dragstart", () => {
      this.onStopDragStart(dragMarker, stop);
    });

    dragMarker.on("drag", () => {
      this.onStopDrag(dragMarker, stop);
    });

    dragMarker.on("dragend", () => {
      this.onStopDragEnd(dragMarker, stop);
    });

    // Show tooltip on first creation
    if (this.routeStops.length === 1) {
      setTimeout(() => {
        this.showMapMessage(
          "Stops can be dragged to reposition them!",
          "success"
        );
      }, 1000);
    }

    console.log("Stop made draggable:", stop.stop_name);
  }

  onStopDragStart(marker, stop) {
    // Visual feedback when drag starts
    marker.setOpacity(0.7);

    // Store original position in case we need to revert
    stop.originalPosition = marker.getLatLng();
  }

  onStopDrag(marker, stop) {
    // Update the label position as the marker moves
    if (stop.label) {
      stop.label.setLatLng(marker.getLatLng());
    }

    // Update the route line if it exists
    this.updateRouteLineForDrag();
  }

  onStopDragEnd(marker, stop) {
    // Restore opacity
    marker.setOpacity(1);

    // Update stop coordinates
    const newPos = marker.getLatLng();
    stop.stop_lat = newPos.lat.toFixed(6);
    stop.stop_lon = newPos.lng.toFixed(6);

    // Update label position
    if (stop.label) {
      stop.label.setLatLng(newPos);
    }

    // Update route line
    this.updateRouteInfo();

    // Show feedback
    this.showMapMessage(
      `Stop "${stop.stop_name}" moved to new location`,
      "success"
    );

    console.log(
      `Stop ${stop.stop_name} moved to:`,
      newPos.lat.toFixed(6),
      newPos.lng.toFixed(6)
    );
  }

  updateRouteLineForDrag() {
    // Update the route line to show the current positions during drag
    if (this.routeLine && this.routeStops.length > 1) {
      const latlngs = this.routeStops.map((stop) => stop.marker.getLatLng());
      this.routeLine.setLatLngs(latlngs);
    }
  }

  addShapeNode(lat, lng) {
    if (!this.isCreatingTrip) return;

    // Initialize trip shape if it doesn't exist
    if (!this.currentTripShape) {
      this.initializeTripShape();
    }

    // Save current state to history before adding new point
    if (!this.shapePointsHistory) {
      this.shapePointsHistory = [];
    }
    this.shapePointsHistory.push([...this.currentTripShapePoints]);

    // Add the new point to the shape
    const newPoint = [lat, lng];
    this.currentTripShapePoints.push(newPoint);

    // Update the polyline
    if (this.currentTripShape) {
      this.currentTripShape.setLatLngs(this.currentTripShapePoints);
      // Update existing drag handles when adding new points
      this.updateVisibleDragHandles(this.currentTripShape);
    } else {
      // Create the shape polyline
      const routeColor = this.currentRoute
        ? `#${this.currentRoute.color}`
        : "#4caf50";
      this.currentTripShape = L.polyline(this.currentTripShapePoints, {
        color: routeColor,
        weight: 4,
        opacity: 0.8,
      }).addTo(this.map);

      // Make it editable
      this.makeShapeEditable(this.currentTripShape);
    }

    // Show visual feedback
    const tempMarker = L.circleMarker([lat, lng], {
      radius: 4,
      fillColor: "#2196f3",
      color: "white",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    }).addTo(this.map);

    // Remove temp marker after 1 second
    setTimeout(() => {
      this.map.removeLayer(tempMarker);
    }, 1000);

    console.log(
      `Added shape node ${this.currentTripShapePoints.length} at`,
      lat.toFixed(6),
      lng.toFixed(6)
    );
  }

  initializeTripShape() {
    this.currentTripShapePoints = [];
    this.currentTripShape = null;
    this.shapePointsHistory = []; // Track shape points for undo functionality

    // Show instruction message
    const noShapes =
      document.getElementById("noShapesToggle")?.checked || false;
    if (noShapes) {
      this.showMapMessage(
        "Shapes disabled. Click to add first stop, then Shift+click to add more stops.",
        "info"
      );
    } else {
      this.showMapMessage(
        "Click to add first stop (starts shape), then click for shape nodes or Shift+click for stops. Ctrl+Z to undo.",
        "info"
      );
    }
  }

  undoLastShapePoint() {
    if (
      !this.isCreatingTrip ||
      !this.shapePointsHistory ||
      this.shapePointsHistory.length === 0
    ) {
      this.showMapMessage("No shape points to undo", "warning");
      return;
    }

    // Restore previous state
    this.currentTripShapePoints = this.shapePointsHistory.pop();

    // Update the polyline
    if (this.currentTripShape) {
      if (this.currentTripShapePoints.length > 0) {
        this.currentTripShape.setLatLngs(this.currentTripShapePoints);
        // Update drag handles after undo
        this.updateVisibleDragHandles(this.currentTripShape);
      } else {
        // Remove the shape if no points left
        this.removeVisibleDragHandles(this.currentTripShape);
        this.map.removeLayer(this.currentTripShape);
        this.currentTripShape = null;
      }
    }

    this.showMapMessage(
      `Undid last shape point (${this.currentTripShapePoints.length} points remaining)`,
      "info"
    );
    console.log(
      `Undid shape point, ${this.currentTripShapePoints.length} points remaining`
    );
  }

  displayAllRoutes(gtfsData) {
    // This method displays all routes and stops on the map like the upload visualizer
    if (!this.map) {
      console.warn("Map not initialized yet");
      return;
    }

    // Use the existing loadExistingData method to display all GTFS data
    this.loadExistingData();
  }

  // Helper methods for stop creation
  addTimingToStop(stop, customTimes) {
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
  }

  createStopMarkerAndFinalize(stop) {
    const lat = parseFloat(stop.stop_lat);
    const lng = parseFloat(stop.stop_lon);

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
      draggable: false, // Will be made draggable after creation
    }).addTo(this.map);

    // Make the stop draggable during trip creation
    this.makeStopDraggable(marker, stop);

    // Add permanent label above the marker
    const label = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "stop-label",
        html: `<div class="stop-label-text">${stop.stop_name}</div>`,
        iconSize: [120, 20],
        iconAnchor: [60, 30], // Position label above marker
      }),
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

    // Persist the new stop to the parser's stops.txt so the existing-stops
    // selector can include it immediately in this session.
    try {
      if (this.gtfsEditor && this.gtfsEditor.parser) {
        const parser = this.gtfsEditor.parser;
        // Only add the stop to stops.txt if it doesn't already exist there
        const existingStops = parser.getFileData
          ? parser.getFileData("stops.txt") || []
          : [];
        const alreadyExists = existingStops.some(
          (s) => s && s.stop_id === stop.stop_id
        );
        if (!alreadyExists) {
          // Create a row in the parser - addRow will ensure headers are respected
          parser.addRow("stops.txt", {
            stop_id: stop.stop_id,
            stop_name: stop.stop_name,
            stop_lat: stop.stop_lat,
            stop_lon: stop.stop_lon,
            stop_code: stop.stop_code || "",
            stop_desc: stop.stop_desc || "",
            zone_id: stop.zone_id || "",
            stop_url: stop.stop_url || "",
            location_type: stop.location_type || "",
            parent_station: stop.parent_station || "",
            wheelchair_boarding: stop.wheelchair_boarding || "",
          });
        } else {
          console.debug(
            "createStopMarkerAndFinalize: stop already exists in stops.txt, skipping add",
            stop.stop_id
          );
        }

        // Update file tabs and refresh the existing stops UI so the new stop
        // becomes selectable without requiring a page reload.
        if (typeof this.gtfsEditor.updateFileTabs === "function") {
          this.gtfsEditor.updateFileTabs();
        }
        if (
          typeof this.gtfsEditor.refreshExistingStopsVisibility === "function"
        ) {
          this.gtfsEditor.refreshExistingStopsVisibility();
        }
      }
    } catch (err) {
      console.warn("Failed to persist new stop to parser:", err);
    }

    // After adding the stop, validate and fix any time conflicts
    this.validateAndFixStopTimes(stop.stop_id);

    this.updateRouteInfo();

    // Connect stops with a line if we have more than one
    if (this.routeStops.length > 1) {
      this.updateRouteLine();
    }

    this.updateTripInfo();
  }

  // Trip Creation Method functionality
  handleTripCreationMethodChange() {
    const methodSelect = document.getElementById("tripCreationMethodSelect");
    const copySection = document.getElementById("copyTripSection");

    if (!methodSelect || !copySection) return;

    if (methodSelect.value === "copy") {
      copySection.style.display = "block";
      // Refresh the trip selector when switching to copy mode
      this.populateCopyTripSelector();
    } else {
      copySection.style.display = "none";
      // Clear any loaded trip data when switching back to scratch
      this.resetTripForm();
    }
  }

  populateCopyTripSelector() {
    const tripSelect = document.getElementById("copyFromTripSelect");
    if (!tripSelect) return;

    // Clear existing options
    tripSelect.innerHTML =
      '<option value="">Choose an existing trip...</option>';

    if (!this.currentRoute) {
      console.log("Copy trip selector: No current route");
      tripSelect.disabled = true;
      return;
    }

    if (!this.gtfsEditor) {
      console.log("Copy trip selector: No GTFS editor");
      tripSelect.disabled = true;
      return;
    }

    if (!this.gtfsEditor.parser) {
      console.log("Copy trip selector: No parser in GTFS editor");
      tripSelect.disabled = true;
      return;
    }

    if (typeof this.gtfsEditor.parser.getFileData !== "function") {
      console.log("Copy trip selector: getFileData method not available");
      tripSelect.disabled = true;
      return;
    }

    // Get existing trips for the current route
    const tripsData = this.gtfsEditor.parser.getFileData("trips.txt");

    if (!tripsData || tripsData.length === 0) {
      console.log("Copy trip selector: No trips data found");
      tripSelect.disabled = true;
      return;
    }

    // Filter trips for current route
    const routeTrips = tripsData.filter(
      (trip) => trip.route_id === this.currentRoute.id
    );

    if (routeTrips.length === 0) {
      console.log(
        `Copy trip selector: No trips found for route ${this.currentRoute.id}. Available trips:`,
        tripsData.map((t) => `${t.trip_id}(${t.route_id})`)
      );
      tripSelect.disabled = true;
      return;
    }

    // Populate the select with trips
    routeTrips.forEach((trip) => {
      const option = document.createElement("option");
      option.value = trip.trip_id;
      option.textContent = `${trip.trip_headsign || trip.trip_id} (Dir ${
        trip.direction_id || "0"
      })`;
      tripSelect.appendChild(option);
    });

    tripSelect.disabled = false;
    console.log(
      `Copy trip selector: Populated with ${routeTrips.length} trips for route ${this.currentRoute.id}`
    );
  }

  handleCopyTripSelectChange() {
    const tripSelect = document.getElementById("copyFromTripSelect");
    const loadBtn = document.getElementById("loadTripDataBtn");

    if (!tripSelect || !loadBtn) return;

    loadBtn.disabled = tripSelect.value === "";
  }

  loadTripData() {
    const tripSelect = document.getElementById("copyFromTripSelect");
    if (!tripSelect || !tripSelect.value) return;

    const selectedTripId = tripSelect.value;

    try {
      // Get trip data
      const tripsData = this.gtfsEditor.parser.getFileData("trips.txt");
      const selectedTrip = tripsData.find(
        (trip) => trip.trip_id === selectedTripId
      );

      if (!selectedTrip) {
        this.showMapMessage("Selected trip not found", "error");
        return;
      }

      // Clear current trip data completely to start fresh
      this.clearTripData();

      // Load trip basic info into form
      document.getElementById("tripHeadsignInput").value =
        selectedTrip.trip_headsign || "";
      document.getElementById("directionSelect").value =
        selectedTrip.direction_id || "0";
      document.getElementById("tripShortNameInput").value =
        selectedTrip.trip_short_name || "";
      document.getElementById("wheelchairAccessibleSelect").value =
        selectedTrip.wheelchair_accessible || "";

      // Create new trip object for the copied trip (with new ID)
      const nextSeq = this.getNextTripSequence(this.currentRoute.id);
      this.currentTrip = {
        id: `trip_${this.currentRoute.id}_${nextSeq}`,
        headsign: selectedTrip.trip_headsign || "",
        direction: selectedTrip.direction_id || "0",
        shortName: selectedTrip.trip_short_name || "",
        wheelchairAccessible: selectedTrip.wheelchair_accessible || "",
        isNew: true, // Mark as new trip since we're copying
      };

      // Load service info if available
      if (selectedTrip.service_id) {
        const calendarMethodSelect = document.getElementById(
          "calendarMethodSelect"
        );
        const existingServiceSelect = document.getElementById(
          "existingServiceSelect"
        );

        calendarMethodSelect.value = "existing";
        this.handleCalendarMethodChange(); // Show existing service selector

        // Set the service
        existingServiceSelect.value = selectedTrip.service_id;
      }

      // Get stop times for the selected trip
      const stopTimesData =
        this.gtfsEditor.parser.getFileData("stop_times.txt");
      const tripStopTimes = stopTimesData
        .filter((st) => st.trip_id === selectedTripId)
        .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

      if (tripStopTimes.length > 0) {
        // Get stops data
        const stopsData = this.gtfsEditor.parser.getFileData("stops.txt");

        console.log("Loading", tripStopTimes.length, "stops from copied trip");

        // Load stops
        tripStopTimes.forEach((stopTime, index) => {
          const stopData = stopsData.find(
            (stop) => stop.stop_id === stopTime.stop_id
          );
          if (stopData) {
            const stopInfo = {
              stop_id: stopData.stop_id,
              stop_name: stopData.stop_name,
              stop_lat: parseFloat(stopData.stop_lat),
              stop_lon: parseFloat(stopData.stop_lon),
              arrival_time: stopTime.arrival_time,
              departure_time: stopTime.departure_time,
              stop_sequence: index + 1,
              timepoint: stopTime.timepoint || 0,
            };

            // Create marker on map (this will also add the stop to routeStops array)
            this.createStopMarkerAndFinalize(
              stopInfo,
              [stopInfo.stop_lat, stopInfo.stop_lon],
              {
                arrival: stopTime.arrival_time,
                departure: stopTime.departure_time,
              }
            );
          }
        });
      }

      // Load shape if exists
      if (selectedTrip.shape_id) {
        const shapesData = this.gtfsEditor.parser.getFileData("shapes.txt");
        const shapePoints = shapesData
          .filter((shape) => shape.shape_id === selectedTrip.shape_id)
          .sort(
            (a, b) =>
              parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence)
          )
          .map((point) => [
            parseFloat(point.shape_pt_lat),
            parseFloat(point.shape_pt_lon),
          ]);

        if (shapePoints.length > 0) {
          this.currentTripShapePoints = shapePoints;
          console.log("Loading shape with", shapePoints.length, "points");

          // Create the shape polyline
          const routeColor = this.currentRoute
            ? `#${this.currentRoute.color}`
            : "#4caf50";
          this.currentTripShape = L.polyline(this.currentTripShapePoints, {
            color: routeColor,
            weight: 4,
            opacity: 0.8,
          }).addTo(this.map);

          console.log("Created shape polyline on map");

          // Make it editable (but don't show drag handles initially when copying)
          this.makeShapeEditable(this.currentTripShape);
          console.log("Made copied shape editable");
        } else {
          console.log("No shape points found for trip", selectedTrip.shape_id);
        }
      }

      // Update UI state for editing the copied trip
      this.isCreatingTrip = true;
      document.getElementById("startTripBtn").disabled = true;
      document.getElementById("finishTripBtn").disabled = false;
      const mapContainer = document.getElementById("mapContainer");
      if (mapContainer) {
        mapContainer.style.cursor = "crosshair";
      }

      this.updateRouteInfo();
      this.updateTripInfo();
      this.showInfoPanel();

      // Fit map to show all loaded stops
      if (this.routeStops.length > 0) {
        const bounds = new L.LatLngBounds();
        this.routeStops.forEach((stop) => {
          bounds.extend([stop.stop_lat, stop.stop_lon]);
        });
        this.map.fitBounds(bounds, { padding: [20, 20] });
      }

      this.showMapMessage(
        `Loaded trip data: ${this.routeStops.length} stops. You can now modify and save as a new trip.`,
        "success"
      );
      console.log(
        `Loaded trip data from ${selectedTripId}:`,
        this.routeStops.length,
        "stops"
      );
    } catch (error) {
      console.error("Error loading trip data:", error);
      this.showMapMessage("Error loading trip data", "error");
    }
  }

  resetTripForm() {
    // Reset form to default values
    document.getElementById("tripHeadsignInput").value = "";
    document.getElementById("directionSelect").value = "0";
    document.getElementById("tripShortNameInput").value = "";
    document.getElementById("calendarMethodSelect").value = "";
    this.handleCalendarMethodChange();
  }

  manageFrequencies(tripId) {
    if (!this.gtfsEditor || !this.gtfsEditor.parser) {
      alert("No GTFS data available");
      return;
    }

    // Get existing frequencies for this trip
    const existingFrequencies =
      this.gtfsEditor.parser.getFrequenciesForTrip(tripId);

    // Create a modal dialog for managing frequencies
    const modal = document.createElement("div");
    modal.className = "frequency-modal";
    modal.innerHTML = `
      <div class="frequency-modal-content">
        <div class="frequency-modal-header">
          <h3>Manage Frequencies for Trip ${tripId}</h3>
          <button type="button" class="close-modal" id="closeFreqModal">×</button>
        </div>
        <div class="frequency-modal-body">
          <div class="existing-frequencies">
            <h4>Current Frequency Periods</h4>
            <div class="frequency-list" id="modalFrequencyList">
              ${
                existingFrequencies.length === 0
                  ? '<p class="no-frequencies">No frequency periods defined</p>'
                  : ""
              }
            </div>
          </div>
          <div class="add-frequency">
            <h4>Add New Frequency Period</h4>
            <div class="frequency-inputs">
              <div class="input-group">
                <label>Start Time:</label>
                <input type="time" id="modalStartTime" value="06:00">
              </div>
              <div class="input-group">
                <label>End Time:</label>
                <input type="time" id="modalEndTime" value="22:00">
              </div>
              <div class="input-group">
                <label>Headway (minutes):</label>
                <input type="number" id="modalHeadway" value="15" min="1" max="120">
              </div>
              <div class="input-group">
                <label>Timing:</label>
                <select id="modalExactTimes">
                  <option value="0">Exact times</option>
                  <option value="1">Approximate times</option>
                </select>
              </div>
            </div>
            <button type="button" class="add-freq-btn" id="addFrequencyBtn">
              Add Frequency Period
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Attach event listener to close button
    const closeBtn = document.getElementById("closeFreqModal");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        modal.remove();
      });
    }

    // Attach event listener to Add Frequency button
    const addFreqBtn = document.getElementById("addFrequencyBtn");
    if (addFreqBtn) {
      addFreqBtn.addEventListener("click", () => {
        this.addFrequencyToTrip(tripId);
      });
    }

    // Populate existing frequencies
    this.updateModalFrequencyList(tripId, existingFrequencies);

    // Make modal closable by clicking outside
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  updateModalFrequencyList(tripId, frequencies) {
    const list = document.getElementById("modalFrequencyList");
    if (!list) return;

    if (frequencies.length === 0) {
      list.innerHTML =
        '<p class="no-frequencies">No frequency periods defined</p>';
      return;
    }

    list.innerHTML = "";
    frequencies.forEach((freq, index) => {
      const headwayMins = Math.floor(parseInt(freq.headway_secs) / 60);
      const exactText = freq.exact_times === "0" ? "exact" : "approx";

      const item = document.createElement("div");
      item.className = "modal-frequency-item";

      const freqInfo = document.createElement("div");
      freqInfo.className = "freq-info";
      freqInfo.innerHTML = `
        <span class="freq-time">${freq.start_time} - ${freq.end_time}</span>
        <span class="freq-headway">Every ${headwayMins} min (${exactText})</span>
      `;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-freq-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        this.deleteFrequencyFromTrip(tripId, freq.start_time);
      });

      item.appendChild(freqInfo);
      item.appendChild(deleteBtn);
      list.appendChild(item);
    });
  }

  addFrequencyToTrip(tripId) {
    console.log("=== addFrequencyToTrip called ===", tripId);
    const startTime = document.getElementById("modalStartTime").value;
    const endTime = document.getElementById("modalEndTime").value;
    const headwayMins = parseInt(document.getElementById("modalHeadway").value);
    const exactTimes = document.getElementById("modalExactTimes").value;

    console.log("Input values:", {
      startTime,
      endTime,
      headwayMins,
      exactTimes,
    });

    if (!startTime || !endTime || !headwayMins) {
      alert("Please fill in all fields");
      return;
    }

    if (startTime >= endTime) {
      alert("End time must be after start time");
      return;
    }

    // Convert HH:MM to HH:MM:SS format for GTFS
    const startTimeGTFS = this.convertToGTFSTime(startTime);
    const endTimeGTFS = this.convertToGTFSTime(endTime);

    console.log("Converted times:", { startTimeGTFS, endTimeGTFS });
    console.log("this.gtfsEditor exists?", !!this.gtfsEditor);
    console.log("this.gtfsEditor.parser exists?", !!this.gtfsEditor?.parser);

    // Add the frequency
    const result = this.gtfsEditor.parser.addFrequency(
      tripId,
      startTimeGTFS,
      endTimeGTFS,
      headwayMins * 60, // Convert to seconds
      parseInt(exactTimes)
    );

    console.log("addFrequency result:", result);
    console.log(
      "Parser gtfsData after add:",
      this.gtfsEditor.parser.gtfsData["frequencies.txt"]
    );

    // Refresh the display
    const updatedFrequencies =
      this.gtfsEditor.parser.getFrequenciesForTrip(tripId);
    this.updateModalFrequencyList(tripId, updatedFrequencies);

    // Clear inputs
    document.getElementById("modalStartTime").value = "06:00";
    document.getElementById("modalEndTime").value = "22:00";
    document.getElementById("modalHeadway").value = "15";
    document.getElementById("modalExactTimes").value = "0";

    // Refresh existing trips list to show updated frequency count
    this.updateExistingTripsDisplay();

    // Update the files list to reflect changes
    console.log("About to call updateFileTabs");
    if (this.gtfsEditor) {
      console.log("Calling gtfsEditor.updateFileTabs()");
      this.gtfsEditor.updateFileTabs();
      console.log("updateFileTabs completed");

      // Refresh table view if frequencies.txt is currently displayed
      const currentFile = this.gtfsEditor.currentFile;
      console.log("Current file:", currentFile);
      const isFrequenciesFile =
        currentFile === "frequencies.txt" ||
        (currentFile && currentFile.name === "frequencies");

      console.log("Is frequencies file?", isFrequenciesFile);

      if (isFrequenciesFile) {
        console.log("Refreshing display for frequencies file");
        this.gtfsEditor.displayFileContent(currentFile);
      }
    } else {
      console.error("this.gtfsEditor is null/undefined!");
    }

    console.log("=== addFrequencyToTrip completed ===");
    alert("Frequency period added successfully!");
  }

  deleteFrequencyFromTrip(tripId, startTime) {
    if (confirm("Are you sure you want to delete this frequency period?")) {
      const deleted = this.gtfsEditor.parser.deleteFrequency(tripId, startTime);

      if (!deleted) {
        alert("Failed to delete frequency period. Please try again.");
        console.error(
          "Delete failed for tripId:",
          tripId,
          "startTime:",
          startTime
        );
        return;
      }

      // Refresh the display
      const updatedFrequencies =
        this.gtfsEditor.parser.getFrequenciesForTrip(tripId);
      this.updateModalFrequencyList(tripId, updatedFrequencies);

      // Refresh existing trips list to show updated frequency count
      this.updateExistingTripsDisplay();

      // Update the files list to reflect changes
      if (this.gtfsEditor) {
        this.gtfsEditor.updateFileTabs();

        // Refresh table view if frequencies.txt is currently displayed
        const currentFile = this.gtfsEditor.currentFile;
        const isFrequenciesFile =
          currentFile === "frequencies.txt" ||
          (currentFile && currentFile.name === "frequencies");

        if (isFrequenciesFile) {
          this.gtfsEditor.displayFileContent(currentFile);
        }
      }

      alert("Frequency period deleted successfully!");
    }
  }

  updateExistingTripsDisplay() {
    // This method refreshes the existing trips display - just call the existing method
    this.refreshExistingTripsVisibility();
  }

  populateCreateTableView() {
    // Populate the create section's table view with current GTFS data
    console.log("populateCreateTableView called");

    if (!this.gtfsEditor || !this.gtfsEditor.parser) {
      console.warn("No GTFS editor or parser available for create table view");
      return;
    }

    const createFileTabs = document.getElementById("createFileTabs");
    const createTableContainer = document.getElementById(
      "createTableContainer"
    );

    if (!createFileTabs || !createTableContainer) {
      console.warn("Create table view elements not found");
      return;
    }

    // Get current GTFS data - use parser's gtfsData directly
    const gtfsData = this.gtfsEditor.parser.gtfsData;
    if (!gtfsData) {
      console.warn("No GTFS data available");
      createTableContainer.innerHTML =
        '<div style="padding: 20px; text-align: center; color: #666;">No data to display yet. Create routes and trips to see them here.</div>';
      return;
    }

    // Convert gtfsData to files format
    const files = [];

    console.log(
      "populateCreateTableView - gtfsData keys:",
      Object.keys(gtfsData)
    );
    console.log("frequencies.txt exists?", "frequencies.txt" in gtfsData);
    console.log("frequencies.txt data:", gtfsData["frequencies.txt"]);
    console.log("frequencies.txt length:", gtfsData["frequencies.txt"]?.length);

    for (const [filename, data] of Object.entries(gtfsData)) {
      // Only include files with data
      if (Array.isArray(data) && data.length > 0) {
        console.log(
          `Including ${filename} in create table view (${data.length} rows)`
        );
        files.push({
          name: filename.replace(".txt", ""),
          data: data,
        });
      } else {
        console.log(
          `Skipping ${filename} - no data or not array (isArray: ${Array.isArray(
            data
          )}, length: ${data?.length})`
        );
      }
    }

    console.log(
      "Files to display:",
      files.length,
      files.map((f) => f.name)
    );

    if (files.length === 0) {
      createTableContainer.innerHTML =
        '<div style="padding: 20px; text-align: center; color: #666;">No data to display yet. Create routes and trips to see them here.</div>';
      return;
    }

    // Populate file tabs
    createFileTabs.innerHTML = "";
    files.forEach((file, index) => {
      const tab = document.createElement("button");
      tab.className = "file-tab" + (index === 0 ? " active" : "");
      tab.textContent = file.name;
      tab.onclick = () => {
        // Update active tab
        createFileTabs
          .querySelectorAll(".file-tab")
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        // Display this file's content
        this.displayCreateFileContent(file);
      };
      createFileTabs.appendChild(tab);
    });

    // Display first file by default
    if (files.length > 0) {
      this.displayCreateFileContent(files[0]);
    }
  }

  displayCreateFileContent(file) {
    const createTableContainer = document.getElementById(
      "createTableContainer"
    );
    if (!createTableContainer || !file) return;

    console.log("displayCreateFileContent called with file:", file);

    // Get the filename and data
    const filename = file.name + ".txt";
    const data = this.gtfsEditor.parser.getFileData(filename);

    console.log(`Displaying ${filename}, data length:`, data ? data.length : 0);

    const spec = GTFS_SPEC.files[filename];

    // Clear container
    createTableContainer.innerHTML = "";

    if (!data || data.length === 0) {
      createTableContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #666;">
          <p>No data in ${filename}</p>
        </div>
      `;
      return;
    }

    // Create table
    const table = document.createElement("table");
    table.style.cssText = "width: 100%; border-collapse: collapse;";

    // Get headers
    const headers = spec
      ? [...spec.required_fields, ...spec.optional_fields]
      : Object.keys(data[0] || {});

    // Create header row
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headers.forEach((header) => {
      const th = document.createElement("th");
      th.textContent = header;
      th.style.cssText = `
        padding: 12px 8px;
        background: #f8f9fa;
        border: 1px solid #ddd;
        text-align: left;
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 5;
      `;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    const tbody = document.createElement("tbody");
    data.forEach((row, index) => {
      const tr = document.createElement("tr");
      tr.dataset.index = index;

      headers.forEach((header) => {
        const td = document.createElement("td");
        td.style.cssText = `
          padding: 4px;
          border: 1px solid #ddd;
        `;

        // Create editable input
        const input = document.createElement("input");
        input.type = "text";
        input.value = row[header] || "";
        input.dataset.field = header;
        input.dataset.index = index;
        input.style.cssText = `
          width: 100%;
          border: none;
          padding: 4px;
          background: transparent;
          font-size: 13px;
        `;

        // Add change handler to update data
        input.addEventListener("change", (e) => {
          this.updateCreateTableCell(filename, index, header, e.target.value);
        });

        td.appendChild(input);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Add file info header
    const fileInfo = document.createElement("div");
    fileInfo.style.cssText = `
      padding: 8px 12px;
      background: #f8f9fa;
      border-radius: 4px;
      border-left: 3px solid #007bff;
      font-size: 14px;
      color: #495057;
      margin-bottom: 10px;
    `;
    fileInfo.innerHTML = `<strong>${filename}</strong> - ${data.length} rows`;

    // Add scrollable wrapper for table
    const scrollWrapper = document.createElement("div");
    scrollWrapper.style.cssText = `
      max-height: 500px;
      overflow: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
    `;
    scrollWrapper.appendChild(table);

    createTableContainer.appendChild(fileInfo);
    createTableContainer.appendChild(scrollWrapper);
  }

  updateCreateTableCell(filename, rowIndex, field, value) {
    // Update the cell in the parser's gtfsData
    if (!this.gtfsEditor || !this.gtfsEditor.parser) {
      console.error("No GTFS editor or parser available");
      return;
    }

    const data = this.gtfsEditor.parser.getFileData(filename);
    if (!data || !data[rowIndex]) {
      console.error(`Row ${rowIndex} not found in ${filename}`);
      return;
    }

    // Update the value
    data[rowIndex][field] = value;
    console.log(`Updated ${filename}[${rowIndex}].${field} = "${value}"`);

    // Mark as modified
    if (this.gtfsEditor.parser.gtfsData) {
      this.gtfsEditor.parser.gtfsData[filename] = data;
    }
  }

  // Mode Selection Methods
  showModeSelection() {
    console.log("=== showModeSelection called ===");

    // Hide all sections
    const modeSection = document.getElementById("modeSelectionSection");
    console.log("modeSelectionSection element:", modeSection);
    console.log(
      "modeSelectionSection display before:",
      modeSection?.style.display
    );

    if (modeSection) {
      modeSection.style.display = "block";
      console.log(
        "modeSelectionSection display after:",
        modeSection.style.display
      );

      // Check actual rendered dimensions
      const rect = modeSection.getBoundingClientRect();
      console.log("modeSelectionSection dimensions:", {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
      });
      // If size is zero, walk up parent chain and log computed styles to diagnose
      if (rect.width === 0 || rect.height === 0) {
        try {
          console.warn(
            "modeSelectionSection has zero size - dumping parent chain diagnostics"
          );
          let p = modeSection;
          const parents = [];
          while (p) {
            const r = p.getBoundingClientRect
              ? p.getBoundingClientRect()
              : { width: null, height: null, top: null, left: null };
            const cs = window.getComputedStyle(p);
            parents.push({
              tag: p.tagName.toLowerCase(),
              id: p.id || null,
              class: p.className || null,
              rect: {
                width: r.width,
                height: r.height,
                top: r.top,
                left: r.left,
              },
              display: cs.display,
              visibility: cs.visibility,
              position: cs.position,
              overflow: cs.overflow,
              offsetParent: p.offsetParent
                ? p.offsetParent.id ||
                  p.offsetParent.className ||
                  p.offsetParent.tagName
                : null,
            });
            p = p.parentElement;
            if (parents.length > 30) break; // safety
          }
          console.table(parents);
        } catch (err) {
          console.warn("Parent chain diagnostics failed:", err);
        }
      }
      console.log(
        "modeSelectionSection computed display:",
        window.getComputedStyle(modeSection).display
      );
      console.log(
        "modeSelectionSection computed visibility:",
        window.getComputedStyle(modeSection).visibility
      );
      console.log(
        "modeSelectionSection offsetParent:",
        modeSection.offsetParent
      );
      console.log(
        "modeSelectionSection children count:",
        modeSection.children.length
      );

      // Check the mode buttons
      const createBtn = document.getElementById("modeCreateRouteBtn");
      const editBtn = document.getElementById("modeEditRouteBtn");
      const tripBtn = document.getElementById("modeCreateTripBtn");
      const feedInfoBtn = document.getElementById("modeFeedInfoBtn");

      console.log("Mode buttons exist:", {
        createRoute: !!createBtn,
        editRoute: !!editBtn,
        createTrip: !!tripBtn,
        feedInfo: !!feedInfoBtn,
      });

      if (createBtn) {
        const btnRect = createBtn.getBoundingClientRect();
        console.log("Create Route button dimensions:", {
          width: btnRect.width,
          height: btnRect.height,
          display: window.getComputedStyle(createBtn).display,
        });
      }
    } else {
      console.error("modeSelectionSection not found!");
    }

    document.getElementById("routeSection").style.display = "none";
    document.getElementById("routeSelectSection").style.display = "none";
    document.getElementById("tripSection").style.display = "none";
    document.getElementById("editRouteSection").style.display = "none";
    document.getElementById("createTripOnlySection").style.display = "none";
    document.getElementById("feedInfoSection").style.display = "none";

    console.log("All other sections hidden");

    // Update mode button states based on existing data
    this.updateModeButtonStates();

    console.log("=== showModeSelection complete ===");
  }

  updateModeButtonStates() {
    const routesData =
      this.gtfsEditor &&
      this.gtfsEditor.parser &&
      this.gtfsEditor.parser.gtfsData &&
      (this.gtfsEditor.parser.gtfsData["routes.txt"] ||
        this.gtfsEditor.parser.gtfsData.routes);

    const hasRoutes = routesData && routesData.length > 0;

    const editBtn = document.getElementById("modeEditRouteBtn");
    const createTripBtn = document.getElementById("modeCreateTripBtn");

    if (editBtn) editBtn.disabled = !hasRoutes;
    if (createTripBtn) createTripBtn.disabled = !hasRoutes;
  }

  showCreateRouteMode() {
    document.getElementById("modeSelectionSection").style.display = "none";
    document.getElementById("routeSection").style.display = "block";
    document.getElementById("routeSelectSection").style.display = "none";
    document.getElementById("tripSection").style.display = "none";
    document.getElementById("editRouteSection").style.display = "none";
    document.getElementById("createTripOnlySection").style.display = "none";
    document.getElementById("feedInfoSection").style.display = "none";
  }

  showEditRouteMode() {
    document.getElementById("modeSelectionSection").style.display = "none";
    document.getElementById("routeSection").style.display = "none";
    document.getElementById("routeSelectSection").style.display = "none";
    document.getElementById("tripSection").style.display = "none";
    document.getElementById("editRouteSection").style.display = "block";
    document.getElementById("createTripOnlySection").style.display = "none";
    document.getElementById("feedInfoSection").style.display = "none";

    // Populate route dropdown
    this.populateEditRouteDropdown();
  }

  showCreateTripMode() {
    document.getElementById("modeSelectionSection").style.display = "none";
    document.getElementById("routeSection").style.display = "none";
    document.getElementById("routeSelectSection").style.display = "none";
    document.getElementById("tripSection").style.display = "none";
    document.getElementById("editRouteSection").style.display = "none";
    document.getElementById("createTripOnlySection").style.display = "block";
    document.getElementById("feedInfoSection").style.display = "none";

    // Populate route dropdown and reset state
    this.populateCreateTripRouteDropdown();
    document.getElementById("createNewTripBtn").disabled = true;
    document.getElementById("existingTripsSection").style.display = "none";
  }

  handleTripsManagerRouteSelect() {
    const select = document.getElementById("createTripRouteSelect");
    const createBtn = document.getElementById("createNewTripBtn");
    const existingTripsSection = document.getElementById(
      "existingTripsSection"
    );

    if (!select.value) {
      createBtn.disabled = true;
      existingTripsSection.style.display = "none";
      return;
    }

    // Enable create button
    createBtn.disabled = false;

    // Show and populate trips list
    existingTripsSection.style.display = "block";
    this.populateTripsManagerList(select.value);
  }

  populateTripsManagerList(routeId) {
    const listContainer = document.getElementById("tripsManagerList");
    if (!listContainer) return;

    const trips =
      this.gtfsEditor.parser.gtfsData["trips.txt"] ||
      this.gtfsEditor.parser.gtfsData.trips ||
      [];
    const routeTrips = trips.filter((t) => t.route_id === routeId);

    if (routeTrips.length === 0) {
      listContainer.innerHTML =
        '<div class="empty-trips-message">No trips on this route yet</div>';
      return;
    }

    listContainer.innerHTML = "";
    routeTrips.forEach((trip) => {
      const tripItem = document.createElement("div");
      tripItem.className = "trip-item";
      tripItem.innerHTML = `
        <div class="trip-info">
          <div class="trip-name">${trip.trip_headsign || trip.trip_id}</div>
          <div class="trip-details">ID: ${trip.trip_id} | Direction: ${
        trip.direction_id || 0
      }</div>
        </div>
        <div class="trip-actions">
          <button class="edit-trip-btn" data-trip-id="${
            trip.trip_id
          }">Edit</button>
          <button class="delete-trip-btn" data-trip-id="${
            trip.trip_id
          }">Delete</button>
        </div>
      `;
      listContainer.appendChild(tripItem);
    });

    // Add event listeners to buttons
    listContainer.querySelectorAll(".edit-trip-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tripId = e.target.dataset.tripId;
        this.editTripFromManager(tripId);
      });
    });

    listContainer.querySelectorAll(".delete-trip-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tripId = e.target.dataset.tripId;
        this.deleteTripFromManager(tripId);
      });
    });
  }

  createNewTripOnRoute() {
    const routeId = document.getElementById("createTripRouteSelect").value;
    if (!routeId) {
      alert("Please select a route");
      return;
    }

    // Clear any existing trip data first
    this.clearCurrentTrip(true);

    // Load the route
    const routes =
      this.gtfsEditor.parser.gtfsData["routes.txt"] ||
      this.gtfsEditor.parser.gtfsData.routes ||
      [];
    const route = routes.find((r) => r.route_id === routeId);

    if (route) {
      // Set current route
      this.currentRoute = {
        id: route.route_id,
        name: route.route_short_name || route.route_long_name,
        type: route.route_type,
        color: route.route_color || "4caf50",
        textColor: route.route_text_color || "ffffff",
      };

      // Show trip section
      this.showTripSection();
      document.getElementById("createTripOnlySection").style.display = "none";
      document.getElementById("tripSection").style.display = "block";
    }
  }

  editTripFromManager(tripId) {
    // Load the trip for editing
    this.loadTripForEditing(tripId);

    // Hide trips manager, show trip section
    document.getElementById("createTripOnlySection").style.display = "none";
    document.getElementById("tripSection").style.display = "block";
  }

  deleteTripFromManager(tripId) {
    if (
      !confirm(
        `Are you sure you want to delete trip ${tripId}? This will also delete all associated stop times.`
      )
    ) {
      return;
    }

    // Remove trip from trips.txt
    let trips =
      this.gtfsEditor.parser.gtfsData["trips.txt"] ||
      this.gtfsEditor.parser.gtfsData.trips ||
      [];
    trips = trips.filter((t) => t.trip_id !== tripId);
    this.gtfsEditor.parser.gtfsData["trips.txt"] = trips;

    // Remove associated stop times
    let stopTimes =
      this.gtfsEditor.parser.gtfsData["stop_times.txt"] ||
      this.gtfsEditor.parser.gtfsData.stop_times ||
      [];
    stopTimes = stopTimes.filter((st) => st.trip_id !== tripId);
    this.gtfsEditor.parser.gtfsData["stop_times.txt"] = stopTimes;

    // Remove associated shapes if they're trip-specific
    let shapes =
      this.gtfsEditor.parser.gtfsData["shapes.txt"] ||
      this.gtfsEditor.parser.gtfsData.shapes ||
      [];
    shapes = shapes.filter((s) => s.shape_id !== tripId);
    this.gtfsEditor.parser.gtfsData["shapes.txt"] = shapes;

    // Remove associated frequencies if they exist
    if (
      this.gtfsEditor.parser.gtfsData["frequencies.txt"] ||
      this.gtfsEditor.parser.gtfsData.frequencies
    ) {
      let frequencies =
        this.gtfsEditor.parser.gtfsData["frequencies.txt"] ||
        this.gtfsEditor.parser.gtfsData.frequencies ||
        [];
      frequencies = frequencies.filter((f) => f.trip_id !== tripId);
      this.gtfsEditor.parser.gtfsData["frequencies.txt"] = frequencies;
    }

    alert("Trip deleted successfully!");

    // Refresh the trips list
    const routeId = document.getElementById("createTripRouteSelect").value;
    this.populateTripsManagerList(routeId);

    // Update the editor tables if they're visible
    if (this.gtfsEditor && this.gtfsEditor.currentFile) {
      this.gtfsEditor.updateFileTabs();
      this.gtfsEditor.displayFileContent(this.gtfsEditor.currentFile);
    }
  }

  populateEditRouteDropdown() {
    const select = document.getElementById("editRouteSelect");
    if (!select) return;

    select.innerHTML = '<option value="">Choose a route...</option>';

    if (!this.gtfsEditor || !this.gtfsEditor.parser) return;

    const routes =
      this.gtfsEditor.parser.gtfsData["routes.txt"] ||
      this.gtfsEditor.parser.gtfsData.routes ||
      [];
    routes.forEach((route) => {
      const option = document.createElement("option");
      option.value = route.route_id;
      option.textContent = `${
        route.route_short_name || route.route_long_name || route.route_id
      }`;
      select.appendChild(option);
    });
  }

  populateCreateTripRouteDropdown() {
    const select = document.getElementById("createTripRouteSelect");
    if (!select) return;

    select.innerHTML = '<option value="">Choose a route...</option>';

    if (!this.gtfsEditor || !this.gtfsEditor.parser) return;

    const routes =
      this.gtfsEditor.parser.gtfsData["routes.txt"] ||
      this.gtfsEditor.parser.gtfsData.routes ||
      [];
    routes.forEach((route) => {
      const option = document.createElement("option");
      option.value = route.route_id;
      option.textContent = `${
        route.route_short_name || route.route_long_name || route.route_id
      }`;
      select.appendChild(option);
    });
  }

  handleEditRouteSelect() {
    const select = document.getElementById("editRouteSelect");
    const details = document.getElementById("editRouteDetails");

    if (!select.value) {
      details.style.display = "none";
      return;
    }

    details.style.display = "block";

    // Load route data
    const routes =
      this.gtfsEditor.parser.gtfsData["routes.txt"] ||
      this.gtfsEditor.parser.gtfsData.routes ||
      [];
    const route = routes.find((r) => r.route_id === select.value);

    if (route) {
      document.getElementById("editRouteNameInput").value =
        route.route_short_name || "";
      document.getElementById("editRouteLongNameInput").value =
        route.route_long_name || "";
      document.getElementById("editRouteTypeSelect").value =
        route.route_type || "3";
      document.getElementById("editRouteColorInput").value =
        "#" + (route.route_color || "4caf50");
      document.getElementById("editRouteColorHex").value =
        "#" + (route.route_color || "4caf50");
      document.getElementById("editRouteTextColorInput").value =
        "#" + (route.route_text_color || "ffffff");
      document.getElementById("editRouteTextColorHex").value =
        "#" + (route.route_text_color || "ffffff");
    }
  }

  saveRouteEdits() {
    const routeId = document.getElementById("editRouteSelect").value;
    if (!routeId) return;

    const routes =
      this.gtfsEditor.parser.gtfsData["routes.txt"] ||
      this.gtfsEditor.parser.gtfsData.routes ||
      [];
    const route = routes.find((r) => r.route_id === routeId);

    if (route) {
      route.route_short_name =
        document.getElementById("editRouteNameInput").value;
      route.route_long_name = document.getElementById(
        "editRouteLongNameInput"
      ).value;
      route.route_type = document.getElementById("editRouteTypeSelect").value;
      route.route_color = document
        .getElementById("editRouteColorHex")
        .value.replace("#", "");
      route.route_text_color = document
        .getElementById("editRouteTextColorHex")
        .value.replace("#", "");

      alert("Route updated successfully!");

      // Refresh the display if needed
      if (this.gtfsEditor && this.gtfsEditor.currentFile) {
        this.gtfsEditor.updateFileTabs();
        this.gtfsEditor.displayFileContent(this.gtfsEditor.currentFile);
      }
    }
  }

  selectRouteForTrip() {
    const routeId = document.getElementById("createTripRouteSelect").value;
    if (!routeId) {
      alert("Please select a route");
      return;
    }

    // Load the route
    const routes =
      this.gtfsEditor.parser.gtfsData["routes.txt"] ||
      this.gtfsEditor.parser.gtfsData.routes ||
      [];
    const route = routes.find((r) => r.route_id === routeId);

    if (route) {
      // Set current route
      this.currentRoute = {
        id: route.route_id,
        name: route.route_short_name || route.route_long_name,
        type: route.route_type,
        color: route.route_color || "4caf50",
        textColor: route.route_text_color || "ffffff",
      };

      // Show trip section
      this.showTripSection();
      document.getElementById("createTripOnlySection").style.display = "none";
      document.getElementById("tripSection").style.display = "block";
    }
  }

  showFeedInfoMode() {
    document.getElementById("modeSelectionSection").style.display = "none";
    document.getElementById("routeSection").style.display = "none";
    document.getElementById("routeSelectSection").style.display = "none";
    document.getElementById("tripSection").style.display = "none";
    document.getElementById("editRouteSection").style.display = "none";
    document.getElementById("createTripOnlySection").style.display = "none";
    document.getElementById("feedInfoSection").style.display = "block";

    // Populate feed info form with existing data
    this.populateFeedInfoForm();
  }

  populateFeedInfoForm() {
    if (!this.gtfsEditor || !this.gtfsEditor.parser) return;

    const gtfsData = this.gtfsEditor.parser.gtfsData;
    const feedInfo = gtfsData["feed_info.txt"] && gtfsData["feed_info.txt"][0];

    if (feedInfo) {
      document.getElementById("feedPublisherNameInput").value =
        feedInfo.feed_publisher_name || "";
      document.getElementById("feedPublisherUrlInput").value =
        feedInfo.feed_publisher_url || "";
      document.getElementById("feedLangInput").value = feedInfo.feed_lang || "";
      document.getElementById("feedDefaultLangInput").value =
        feedInfo.default_lang || "";

      // Convert YYYYMMDD to YYYY-MM-DD for date inputs
      const startDate = feedInfo.feed_start_date || "";
      const endDate = feedInfo.feed_end_date || "";
      document.getElementById("feedStartDateInput").value = startDate
        ? `${startDate.substring(0, 4)}-${startDate.substring(
            4,
            6
          )}-${startDate.substring(6, 8)}`
        : "";
      document.getElementById("feedEndDateInput").value = endDate
        ? `${endDate.substring(0, 4)}-${endDate.substring(
            4,
            6
          )}-${endDate.substring(6, 8)}`
        : "";

      document.getElementById("feedVersionInput").value =
        feedInfo.feed_version || "";
      document.getElementById("feedContactEmailInput").value =
        feedInfo.feed_contact_email || "";
      document.getElementById("feedContactUrlInput").value =
        feedInfo.feed_contact_url || "";
    } else {
      // Clear all fields if no feed info exists
      document.getElementById("feedPublisherNameInput").value = "";
      document.getElementById("feedPublisherUrlInput").value = "";
      document.getElementById("feedLangInput").value = "en";
      document.getElementById("feedDefaultLangInput").value = "";
      document.getElementById("feedStartDateInput").value = "";
      document.getElementById("feedEndDateInput").value = "";
      document.getElementById("feedVersionInput").value = "";
      document.getElementById("feedContactEmailInput").value = "";
      document.getElementById("feedContactUrlInput").value = "";
    }
  }

  saveFeedInfo() {
    if (!this.gtfsEditor || !this.gtfsEditor.parser) {
      alert("GTFS parser not initialized");
      return;
    }

    // Get values from form
    const feedPublisherName = document
      .getElementById("feedPublisherNameInput")
      .value.trim();
    const feedPublisherUrl = document
      .getElementById("feedPublisherUrlInput")
      .value.trim();
    const feedLang = document.getElementById("feedLangInput").value.trim();
    const feedDefaultLang = document
      .getElementById("feedDefaultLangInput")
      .value.trim();
    const feedStartDate = document.getElementById("feedStartDateInput").value;
    const feedEndDate = document.getElementById("feedEndDateInput").value;
    const feedVersion = document
      .getElementById("feedVersionInput")
      .value.trim();
    const feedContactEmail = document
      .getElementById("feedContactEmailInput")
      .value.trim();
    const feedContactUrl = document
      .getElementById("feedContactUrlInput")
      .value.trim();

    // Validate required fields
    if (!feedPublisherName || !feedPublisherUrl || !feedLang) {
      alert(
        "Please fill in all required fields: Publisher Name, Publisher URL, and Feed Language"
      );
      return;
    }

    // Validate language codes
    if (feedLang.length !== 2) {
      alert(
        "Feed Language must be a 2-letter ISO 639-1 code (e.g., en, es, fr)"
      );
      return;
    }

    if (feedDefaultLang && feedDefaultLang.length !== 2) {
      alert(
        "Default Language must be a 2-letter ISO 639-1 code (e.g., en, es, fr)"
      );
      return;
    }

    // Create feed info object
    const feedInfo = {
      feed_publisher_name: feedPublisherName,
      feed_publisher_url: feedPublisherUrl,
      feed_lang: feedLang,
    };

    // Add optional fields if provided
    if (feedDefaultLang) feedInfo.default_lang = feedDefaultLang;
    if (feedStartDate)
      feedInfo.feed_start_date = feedStartDate.replace(/-/g, "");
    if (feedEndDate) feedInfo.feed_end_date = feedEndDate.replace(/-/g, "");
    if (feedVersion) feedInfo.feed_version = feedVersion;
    if (feedContactEmail) feedInfo.feed_contact_email = feedContactEmail;
    if (feedContactUrl) feedInfo.feed_contact_url = feedContactUrl;

    // Update or create feed_info.txt in GTFS data
    const gtfsData = this.gtfsEditor.parser.gtfsData;
    gtfsData["feed_info.txt"] = [feedInfo];

    // Add to parser's fileList if not already there
    if (!this.gtfsEditor.parser.fileList.includes("feed_info.txt")) {
      this.gtfsEditor.parser.fileList.push("feed_info.txt");
      console.log("Added feed_info.txt to parser.fileList");
    }

    // Update file tabs to show feed_info.txt
    if (this.gtfsEditor && this.gtfsEditor.currentFile) {
      this.gtfsEditor.updateFileTabs();
      this.gtfsEditor.displayFileContent(this.gtfsEditor.currentFile);
    }

    alert("Feed info saved successfully!");
    console.log("Feed info saved:", feedInfo);
  }
}

// Global reference for popup callbacks
let mapEditor;
