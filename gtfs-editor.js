// GTFS Editor - Handles the UI for editing GTFS data
class GTFSEditor {
  constructor() {
    this.parser = new GTFSParser();
    this.currentFile = null;
    this.selectedRows = new Set();
    this.mapEditor = null;
    this.files = null; // Store uploaded GTFS files
    this.isNewGTFS = false; // Track if this is a new GTFS creation vs uploaded file
    this.agencyUrl = null; // Store agency URL from agency.txt
    this.routeOptions = []; // Store route options for search
    this.tripOptions = []; // Store trip options for search
    this.selectedRouteId = ""; // Track selected route
    this.selectedTripId = ""; // Track selected trip
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // File upload
    document
      .getElementById("uploadBtn")
      .addEventListener("click", () => this.handleFileUpload());

    // Create new feed
    document
      .getElementById("createNewBtn")
      .addEventListener("click", () => this.createNewFeed());

    // Reset page
    document
      .getElementById("resetPageBtn")
      .addEventListener("click", () => this.resetPage());

    // Editor actions
    document
      .getElementById("addRowBtn")
      .addEventListener("click", () => this.addRow());
    document
      .getElementById("deleteRowBtn")
      .addEventListener("click", () => this.deleteSelectedRows());
    document
      .getElementById("downloadBtn")
      .addEventListener("click", () => this.downloadFeed());

    // View switching
    document
      .getElementById("tableViewBtn")
      .addEventListener("click", () => this.activateTableView());
    document
      .getElementById("mapViewBtn")
      .addEventListener("click", () => this.activateMapView());

    // Route/Trip filter searchable inputs
    this.initializeSearchableSelectors();
    document
      .getElementById("applyFilterBtn")
      .addEventListener("click", () => this.applyMapFilter());
    document
      .getElementById("clearFilterBtn")
      .addEventListener("click", () => this.clearMapFilter());

    // Existing stops functionality
    document
      .getElementById("existingStopsSearch")
      .addEventListener("input", (e) =>
        this.filterExistingStops(e.target.value)
      );

    // Route creator collapse functionality
    document
      .getElementById("collapseCreatorBtn")
      .addEventListener("click", () => this.toggleRouteCreator());
    document
      .getElementById("routeCreatorHeader")
      .addEventListener("click", () => this.toggleRouteCreator());

    // Filter collapse functionality
    document
      .getElementById("collapseFilterBtn")
      .addEventListener("click", () => this.toggleRouteFilter());
    document
      .getElementById("filterHeader")
      .addEventListener("click", () => this.toggleRouteFilter());

    // Agency website button
    document
      .getElementById("agencyWebsiteBtn")
      .addEventListener("click", () => this.visitAgencyWebsite());
  }

  initializeSearchableSelectors() {
    // Route search functionality
    const routeSearch = document.getElementById("routeFilterSearch");
    const routeDropdown = document.getElementById("routeSearchDropdown");

    routeSearch.addEventListener("input", (e) =>
      this.filterRouteOptions(e.target.value)
    );
    routeSearch.addEventListener("focus", () => this.showAllRouteOptions());
    routeSearch.addEventListener("blur", (e) => {
      // Delay hiding to allow option clicks
      setTimeout(() => this.hideRouteDropdown(), 150);
    });

    // Trip search functionality
    const tripSearch = document.getElementById("tripFilterSearch");
    const tripDropdown = document.getElementById("tripSearchDropdown");

    tripSearch.addEventListener("input", (e) =>
      this.filterTripOptions(e.target.value)
    );
    tripSearch.addEventListener("focus", () => this.showAllTripOptions());
    tripSearch.addEventListener("blur", (e) => {
      setTimeout(() => this.hideTripDropdown(), 150);
    });

    // Click outside to close dropdowns
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#routeSearchContainer")) {
        this.hideRouteDropdown();
      }
      if (!e.target.closest("#tripSearchContainer")) {
        this.hideTripDropdown();
      }
    });
  }

  filterRouteOptions(searchTerm) {
    const dropdown = document.getElementById("routeSearchDropdown");

    // If search term is empty, show all options
    const filteredOptions =
      searchTerm.trim() === ""
        ? this.routeOptions
        : this.routeOptions.filter((option) =>
            option.searchText.includes(searchTerm.toLowerCase())
          );

    this.renderDropdownOptions(dropdown, filteredOptions, (option) => {
      this.selectRoute(option.value, option.text);
    });

    if (filteredOptions.length > 0) {
      this.showRouteDropdown();
    } else {
      this.hideRouteDropdown();
    }
  }

  filterTripOptions(searchTerm) {
    const dropdown = document.getElementById("tripSearchDropdown");

    // If search term is empty, show all options
    const filteredOptions =
      searchTerm.trim() === ""
        ? this.tripOptions
        : this.tripOptions.filter((option) =>
            option.searchText.includes(searchTerm.toLowerCase())
          );

    this.renderDropdownOptions(dropdown, filteredOptions, (option) => {
      this.selectTrip(option.value, option.text);
    });

    if (filteredOptions.length > 0) {
      this.showTripDropdown();
    } else {
      this.hideTripDropdown();
    }
  }

  renderDropdownOptions(dropdown, options, onSelectCallback) {
    dropdown.innerHTML = "";

    options.forEach((option) => {
      const optionEl = document.createElement("div");
      optionEl.className = "search-option";
      optionEl.textContent = option.text;
      optionEl.addEventListener("click", () => onSelectCallback(option));
      dropdown.appendChild(optionEl);
    });
  }

  selectRoute(routeId, routeText) {
    this.selectedRouteId = routeId;
    document.getElementById("routeFilterSearch").value = routeText;
    this.hideRouteDropdown();
    this.onRouteFilterChange(routeId);
  }

  selectTrip(tripId, tripText) {
    this.selectedTripId = tripId;
    document.getElementById("tripFilterSearch").value = tripText;
    this.hideTripDropdown();
    this.onTripFilterChange(tripId);
  }

  showAllRouteOptions() {
    if (this.routeOptions.length > 0) {
      const dropdown = document.getElementById("routeSearchDropdown");
      this.renderDropdownOptions(dropdown, this.routeOptions, (option) => {
        this.selectRoute(option.value, option.text);
      });
      document.getElementById("routeSearchDropdown").classList.add("show");
    }
  }

  showAllTripOptions() {
    if (this.tripOptions.length > 0) {
      const dropdown = document.getElementById("tripSearchDropdown");
      this.renderDropdownOptions(dropdown, this.tripOptions, (option) => {
        this.selectTrip(option.value, option.text);
      });
      document.getElementById("tripSearchDropdown").classList.add("show");
    }
  }

  showRouteDropdown() {
    document.getElementById("routeSearchDropdown").classList.add("show");
  }

  hideRouteDropdown() {
    document.getElementById("routeSearchDropdown").classList.remove("show");
  }

  showTripDropdown() {
    if (this.tripOptions.length > 0) {
      document.getElementById("tripSearchDropdown").classList.add("show");
    }
  }

  hideTripDropdown() {
    document.getElementById("tripSearchDropdown").classList.remove("show");
  }

  async handleFileUpload() {
    console.log("handleFileUpload started");
    const fileInput = document.getElementById("gtfsUpload");
    const file = fileInput.files[0];

    if (!file) {
      this.showStatus("Please select a GTFS file", "error");
      return;
    }

    if (!file.name.endsWith(".zip")) {
      this.showStatus("Please select a ZIP file", "error");
      return;
    }

    console.log("Starting to parse file:", file.name);
    this.showStatus("Uploading and parsing GTFS file...", "loading");

    try {
      console.log("Calling parser.parseGTFSFile...");
      const result = await this.parser.parseGTFSFile(file);
      console.log("Parser result:", result);

      if (result.success) {
        console.log("Parse successful, calling convertParsedDataToFiles...");
        console.log("result.data type:", typeof result.data, result.data);
        console.log("result.files type:", typeof result.files, result.files);

        // This is an uploaded GTFS file, not a new creation
        this.isNewGTFS = false;

        // Update UI for editing mode
        this.updateUIForEditingMode();

        // Convert the parsed data into the format expected by the editor
        this.files = this.convertParsedDataToFiles(result.data, result.files);

        // Extract agency URL from agency.txt
        this.extractAgencyUrl(result.data);

        this.showStatus(
          `Successfully loaded GTFS with ${result.files.length} files`,
          "success"
        );
        this.showEditor(this.files);
        this.currentFile = this.files[0]; // Default to first file
        this.displayFileContent(this.currentFile);
      } else {
        console.error("Parse failed:", result.error);
        this.showStatus(`Error: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Exception in handleFileUpload:", error);
      this.showStatus(`Error: ${error.message}`, "error");
    }
  }

  createNewFeed() {
    const result = this.parser.createEmptyFeed();
    if (result.success) {
      // This is a new GTFS creation, not an uploaded file
      this.isNewGTFS = true;

      // Update UI for creation mode
      this.updateUIForCreationMode();

      // Convert the parsed data into the format expected by the editor
      this.files = this.convertParsedDataToFiles(result.data, result.files);
      this.showStatus("Created new empty GTFS feed", "success");
      this.showEditor(this.files);
      this.currentFile = this.files[0];
      this.displayFileContent(this.currentFile);

      // For new GTFS creation, start with map view
      this.activateMapView();
      // Hide route filter (no routes to filter yet)
      this.hideRouteFilter();
      // Expand route creator for creating new routes/trips
      this.expandRouteCreator();
    }
  }

  showEditor(files) {
    document.getElementById("editorSection").style.display = "block";
    this.createFileTabs(files);

    // Initialize map editor if not already done
    if (!this.mapEditor) {
      this.mapEditor = new MapEditor(this);
      // Make it globally accessible for popup callbacks
      window.mapEditor = this.mapEditor;
    }

    // Ensure table view is active by default for editing uploaded GTFS
    this.activateTableView();
  }

  createFileTabs(files) {
    const tabsContainer = document.getElementById("fileTabs");
    tabsContainer.innerHTML = "";

    files.forEach((file, index) => {
      const tab = document.createElement("div");
      tab.className = "file-tab";
      // Handle both old format (strings) and new format (objects)
      if (typeof file === "string") {
        tab.textContent = file.replace(".txt", "");
        tab.addEventListener("click", () => this.switchFile(file));
      } else {
        tab.textContent = file.name;
        tab.addEventListener("click", () => this.switchFile(file));
      }

      if (index === 0) {
        tab.classList.add("active");
      }

      tabsContainer.appendChild(tab);
    });
  }

  switchFile(file) {
    this.currentFile = file;
    this.selectedRows.clear();

    // Update active tab
    document.querySelectorAll(".file-tab").forEach((tab) => {
      tab.classList.remove("active");
      // Handle both old format (strings) and new format (objects)
      const tabName =
        typeof file === "string" ? file.replace(".txt", "") : file.name;
      if (tab.textContent === tabName) {
        tab.classList.add("active");
      }
    });

    this.displayFileContent(file);
  }

  displayFileContent(file) {
    // Handle both old format (strings) and new format (objects)
    let data, filename;
    if (typeof file === "string") {
      filename = file;
      data = this.parser.getFileData(filename);
    } else {
      filename = file.name + ".txt";
      data = file.data;
    }

    const spec = GTFS_SPEC.files[filename];
    const container = document.getElementById("tableContainer");

    if (!data || data.length === 0) {
      container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <p>No data in ${filename}</p>
                    <p>Click "Add Row" to add some data</p>
                </div>
            `;
      return;
    }

    // Get all unique headers from data and spec
    let headers = new Set();
    if (spec) {
      spec.required_fields.forEach((field) => headers.add(field));
      spec.optional_fields.forEach((field) => headers.add(field));
    }
    data.forEach((row) => {
      Object.keys(row).forEach((key) => headers.add(key));
    });
    headers = Array.from(headers);

    // Create table
    const table = document.createElement("table");

    // Create header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    // Add checkbox column
    const checkboxHeader = document.createElement("th");
    checkboxHeader.innerHTML = '<input type="checkbox" id="selectAll">';
    checkboxHeader.style.width = "40px";
    headerRow.appendChild(checkboxHeader);

    headers.forEach((header) => {
      const th = document.createElement("th");
      th.textContent = header;

      // Mark required fields
      if (spec && spec.required_fields.includes(header)) {
        th.style.backgroundColor = "#fff3cd";
        th.title = "Required field";
      }

      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    const tbody = document.createElement("tbody");

    data.forEach((row, index) => {
      const tr = document.createElement("tr");
      tr.dataset.index = index;

      // Add checkbox
      const checkboxCell = document.createElement("td");
      checkboxCell.innerHTML = `<input type="checkbox" class="row-checkbox" data-index="${index}">`;
      tr.appendChild(checkboxCell);

      headers.forEach((header) => {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "text";
        input.value = row[header] || "";
        input.dataset.field = header;
        input.dataset.index = index;
        input.addEventListener("change", (e) =>
          this.updateCell(filename, index, header, e.target.value)
        );

        // Add color display for route_color fields
        if (header === "route_color" && row[header]) {
          const colorDiv = document.createElement("div");
          colorDiv.style.cssText = `
                        width: 20px;
                        height: 20px;
                        background-color: #${row[header]};
                        border: 1px solid #ccc;
                        border-radius: 3px;
                        display: inline-block;
                        margin-right: 8px;
                        vertical-align: middle;
                    `;
          td.style.cssText = "display: flex; align-items: center;";
          td.appendChild(colorDiv);
        }

        td.appendChild(input);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.innerHTML = "";
    container.appendChild(table);

    // Add event listeners
    document
      .getElementById("selectAll")
      .addEventListener("change", (e) => this.toggleAllRows(e.target.checked));
    document.querySelectorAll(".row-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) =>
        this.toggleRow(parseInt(e.target.dataset.index), e.target.checked)
      );
    });
  }

  updateCell(filename, rowIndex, field, value) {
    this.parser.updateCell(filename, rowIndex, field, value);

    // Update color display for route_color fields
    if (field === "route_color") {
      const input = document.querySelector(
        `input[data-field="route_color"][data-index="${rowIndex}"]`
      );
      if (input && input.parentElement) {
        const existingColorDiv = input.parentElement.querySelector(
          'div[style*="background-color"]'
        );
        if (existingColorDiv) {
          existingColorDiv.remove();
        }

        if (value && value.length === 6) {
          const colorDiv = document.createElement("div");
          colorDiv.style.cssText = `
                        width: 20px;
                        height: 20px;
                        background-color: #${value};
                        border: 1px solid #ccc;
                        border-radius: 3px;
                        display: inline-block;
                        margin-right: 8px;
                        vertical-align: middle;
                    `;
          input.parentElement.style.cssText =
            "display: flex; align-items: center;";
          input.parentElement.insertBefore(colorDiv, input);
        }
      }
    }
  }

  addRow() {
    if (!this.currentFile) return;

    const newRow = this.parser.addRow(this.currentFile);
    this.displayFileContent(this.currentFile);
    this.showStatus("Row added", "success");
  }

  deleteSelectedRows() {
    if (this.selectedRows.size === 0) {
      this.showStatus("No rows selected", "error");
      return;
    }

    // Sort indices in descending order to delete from end to beginning
    const indices = Array.from(this.selectedRows).sort((a, b) => b - a);

    indices.forEach((index) => {
      this.parser.deleteRow(this.currentFile, index);
    });

    this.selectedRows.clear();
    this.displayFileContent(this.currentFile);
    this.showStatus(`Deleted ${indices.length} row(s)`, "success");
  }

  toggleRow(index, checked) {
    if (checked) {
      this.selectedRows.add(index);
    } else {
      this.selectedRows.delete(index);
    }
  }

  toggleAllRows(checked) {
    const checkboxes = document.querySelectorAll(".row-checkbox");
    checkboxes.forEach((checkbox) => {
      checkbox.checked = checked;
      const index = parseInt(checkbox.dataset.index);
      if (checked) {
        this.selectedRows.add(index);
      } else {
        this.selectedRows.delete(index);
      }
    });
  }

  async downloadFeed() {
    try {
      this.showStatus("Generating GTFS file...", "loading");
      const zipBlob = await this.parser.exportAsZip();

      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gtfs-feed.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showStatus("GTFS file downloaded", "success");
    } catch (error) {
      this.showStatus(`Error generating file: ${error.message}`, "error");
    }
  }

  showStatus(message, type) {
    const statusElement = document.getElementById("uploadStatus");
    statusElement.className = type;
    statusElement.style.display = "block";

    if (type === "loading") {
      statusElement.innerHTML = `<span class="loading"><span></span><span></span><span></span></span> ${message}`;
    } else {
      statusElement.textContent = message;
    }

    if (type !== "loading") {
      setTimeout(() => {
        statusElement.style.display = "none";
      }, 3000);
    }
  }

  convertParsedDataToFiles(gtfsData, fileList) {
    // Convert parser output to expected format: array of {name, data, headers}
    const files = [];

    console.log(
      "Converting files - fileList type:",
      typeof fileList,
      "value:",
      fileList
    );
    console.log("gtfsData keys:", Object.keys(gtfsData));

    // Handle case where fileList might not be an array
    if (!Array.isArray(fileList)) {
      console.error("fileList is not an array:", fileList);
      return [];
    }

    fileList.forEach((item) => {
      console.log("Processing item:", item, "type:", typeof item);

      // Handle both string filenames and file objects
      let filename;
      if (typeof item === "string") {
        filename = item;
      } else if (item && typeof item === "object" && item.name) {
        filename = item.name;
      } else {
        console.error("Invalid item in fileList:", item);
        return; // Skip this item
      }

      console.log("Using filename:", filename);

      if (gtfsData[filename]) {
        const data = gtfsData[filename];
        const name = filename.replace(".txt", ""); // Remove .txt extension

        // Extract headers from first row if data exists
        let headers = [];
        if (data && Array.isArray(data) && data.length > 0) {
          headers = Object.keys(data[0]);
        }

        files.push({
          name: name,
          data: data,
          headers: headers,
        });

        console.log(`Added file: ${name} with ${data ? data.length : 0} rows`);
      } else {
        console.log(`No data found for file: ${filename}`);
      }
    });

    console.log("Converted files:", files);
    return files;
  }

  showRouteFilter() {
    console.log("showRouteFilter called, files:", this.files);
    if (!this.files || this.files.length === 0) {
      console.log("No files available for route filter");
      return; // No filter needed if no GTFS uploaded
    }

    console.log("Showing route filter");
    document.getElementById("routeTripFilter").style.display = "block";
    this.populateRouteFilter();
  }

  hideRouteFilter() {
    document.getElementById("routeTripFilter").style.display = "none";
  }

  populateRouteFilter() {
    const routesFile = this.files.find((f) => f.name === "routes");
    if (!routesFile) {
      console.log("No routes file found");
      return;
    }

    const routeTypeNames = {
      0: "Tram",
      1: "Subway",
      2: "Rail",
      3: "Bus",
      4: "Ferry",
      5: "Cable Tram",
      6: "Aerial Lift",
      7: "Funicular",
    };

    console.log(
      "Populating routes filter with",
      routesFile.data.length,
      "routes"
    );

    this.routeOptions = routesFile.data.map((route) => {
      const routeName =
        route.route_short_name || route.route_long_name || route.route_id;
      const routeType = routeTypeNames[route.route_type] || "Unknown";
      return {
        value: route.route_id,
        text: `${routeName} (${routeType})`,
        searchText: `${routeName} ${routeType} ${route.route_id}`.toLowerCase(),
      };
    });
  }

  onRouteFilterChange(routeId) {
    const tripSearch = document.getElementById("tripFilterSearch");

    if (!routeId) {
      this.tripOptions = [];
      tripSearch.value = "";
      tripSearch.placeholder = "Select route first...";
      tripSearch.disabled = true;
      this.selectedTripId = "";
      return;
    }

    const tripsFile = this.files.find((f) => f.name === "trips");
    if (!tripsFile) {
      console.log("No trips file found");
      return;
    }

    const routeTrips = tripsFile.data.filter(
      (trip) => trip.route_id === routeId
    );
    console.log(`Found ${routeTrips.length} trips for route ${routeId}`);

    // Sort trips alphabetically by headsign
    routeTrips.sort((a, b) => {
      const aHeadsign = (a.trip_headsign || "No destination").toLowerCase();
      const bHeadsign = (b.trip_headsign || "No destination").toLowerCase();
      return aHeadsign.localeCompare(bHeadsign);
    });

    this.tripOptions = routeTrips.map((trip) => {
      const tripText = `${trip.trip_headsign || "No destination"} (Dir ${
        trip.direction_id || "0"
      }) - ${trip.trip_id}`;
      return {
        value: trip.trip_id,
        text: tripText,
        searchText: `${trip.trip_headsign || "no destination"} ${
          trip.trip_id
        } dir${trip.direction_id || "0"}`.toLowerCase(),
      };
    });

    tripSearch.value = "";
    tripSearch.placeholder = "Click to select or type to search trips...";
    tripSearch.disabled = false;
    this.selectedTripId = "";
  }

  onTripFilterChange(tripId) {
    // Trip selection handling - could be used for more specific filtering
  }

  applyMapFilter() {
    const routeId = this.selectedRouteId;
    const tripId = this.selectedTripId;

    console.log("Applying filter - routeId:", routeId, "tripId:", tripId);

    // Call map editor to filter the display
    if (this.mapEditor) {
      // Pass special flag for "show all" when no route is selected (disabled for performance)
      const showAll = routeId === "" && tripId === "";
      console.log("showAll flag:", showAll);
      this.mapEditor.filterMapData(routeId, tripId, showAll);
    }
  }

  clearMapFilter() {
    // Clear route search
    document.getElementById("routeFilterSearch").value = "";
    this.selectedRouteId = "";
    this.hideRouteDropdown();

    // Clear trip search
    document.getElementById("tripFilterSearch").value = "";
    document.getElementById("tripFilterSearch").placeholder =
      "Select route first...";
    document.getElementById("tripFilterSearch").disabled = true;
    this.selectedTripId = "";
    this.tripOptions = [];
    this.hideTripDropdown();

    // Clear map filtering
    if (this.mapEditor) {
      this.mapEditor.clearMapFilter();
    }
  }

  showExistingStops() {
    if (!this.files || this.files.length === 0) {
      document.getElementById("existingStopsSection").style.display = "none";
      return;
    }

    const stopsFile = this.files.find((f) => f.name === "stops");
    if (!stopsFile) {
      document.getElementById("existingStopsSection").style.display = "none";
      return;
    }

    document.getElementById("existingStopsSection").style.display = "block";
    this.populateExistingStops(stopsFile.data);
  }

  populateExistingStops(stops) {
    const stopsList = document.getElementById("existingStopsList");
    stopsList.innerHTML = "";

    stops.forEach((stop) => {
      const stopItem = document.createElement("div");
      stopItem.className = "existing-stop-item";
      stopItem.dataset.stopId = stop.stop_id;
      stopItem.dataset.lat = stop.stop_lat;
      stopItem.dataset.lng = stop.stop_lon;

      stopItem.innerHTML = `
                <div class="existing-stop-name">${
                  stop.stop_name || stop.stop_id
                }</div>
                <div class="existing-stop-coords">${parseFloat(
                  stop.stop_lat
                ).toFixed(6)}, ${parseFloat(stop.stop_lon).toFixed(6)}</div>
            `;

      stopItem.addEventListener("click", () => {
        this.addExistingStopToTrip(stop);
      });

      stopsList.appendChild(stopItem);
    });
  }

  filterExistingStops(searchTerm) {
    const stopItems = document.querySelectorAll(".existing-stop-item");
    const term = searchTerm.toLowerCase();

    stopItems.forEach((item) => {
      const stopName = item
        .querySelector(".existing-stop-name")
        .textContent.toLowerCase();
      const coords = item
        .querySelector(".existing-stop-coords")
        .textContent.toLowerCase();

      if (stopName.includes(term) || coords.includes(term)) {
        item.style.display = "block";
      } else {
        item.style.display = "none";
      }
    });
  }

  addExistingStopToTrip(stop) {
    // Add the existing stop to the current trip being created
    if (this.mapEditor && this.mapEditor.currentTrip) {
      const lat = parseFloat(stop.stop_lat);
      const lng = parseFloat(stop.stop_lon);

      // Use the map editor's method to add the stop
      this.mapEditor.addStopToTrip(lat, lng, {
        stop_name: stop.stop_name || stop.stop_id,
        stop_id: stop.stop_id,
        isExistingStop: true,
      });
    }
  }

  hideExistingStops() {
    document.getElementById("existingStopsSection").style.display = "none";
  }

  toggleRouteCreator() {
    const content = document.getElementById("routeCreatorContent");
    const button = document.getElementById("collapseCreatorBtn");

    if (content.classList.contains("collapsed")) {
      // Expand
      content.classList.remove("collapsed");
      button.textContent = "−";
    } else {
      // Collapse
      content.classList.add("collapsed");
      button.textContent = "+";
    }
  }

  collapseRouteCreator() {
    const content = document.getElementById("routeCreatorContent");
    const button = document.getElementById("collapseCreatorBtn");
    content.classList.add("collapsed");
    button.textContent = "+";
  }

  expandRouteCreator() {
    const content = document.getElementById("routeCreatorContent");
    const button = document.getElementById("collapseCreatorBtn");
    content.classList.remove("collapsed");
    button.textContent = "−";
  }

  toggleRouteFilter() {
    const content = document.getElementById("filterContent");
    const button = document.getElementById("collapseFilterBtn");

    if (content.classList.contains("collapsed")) {
      // Expand
      content.classList.remove("collapsed");
      button.textContent = "−";
    } else {
      // Collapse
      content.classList.add("collapsed");
      button.textContent = "+";
    }
  }

  collapseRouteFilter() {
    const content = document.getElementById("filterContent");
    const button = document.getElementById("collapseFilterBtn");
    content.classList.add("collapsed");
    button.textContent = "+";
  }

  expandRouteFilter() {
    const content = document.getElementById("filterContent");
    const button = document.getElementById("collapseFilterBtn");
    content.classList.remove("collapsed");
    button.textContent = "−";
  }

  activateTableView() {
    // Activate table view button
    document
      .querySelectorAll(".view-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document.getElementById("tableViewBtn").classList.add("active");

    // Show table view
    document.getElementById("tableView").style.display = "block";
    document.getElementById("mapView").style.display = "none";

    // Show table actions
    document.querySelector(".table-actions").style.display = "block";

    // Hide route filter and existing stops
    this.hideRouteFilter();
    this.hideExistingStops();
  }

  activateMapView() {
    // Activate map view button
    document
      .querySelectorAll(".view-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document.getElementById("mapViewBtn").classList.add("active");

    // Show map view
    document.getElementById("tableView").style.display = "none";
    document.getElementById("mapView").style.display = "block";

    // Hide table actions in map view
    document.querySelector(".table-actions").style.display = "none";

    if (this.isNewGTFS) {
      // New GTFS creation mode - optimize for creating routes
      this.hideRouteFilter();
      this.hideExistingStops();
      this.expandRouteCreator();
    } else {
      // Uploaded GTFS editing mode - optimize for editing existing data
      this.showRouteFilter();
      this.showExistingStops();
      this.collapseRouteCreator();
    }

    // Initialize map if needed
    if (this.mapEditor) {
      this.mapEditor.switchToMapView();
      // Start with empty map - no routes shown until user selects one
      this.mapEditor.clearMapFilter();
    }
  }

  updateFileTabs() {
    const fileTabs = document.getElementById("fileTabs");
    fileTabs.innerHTML = "";

    // Add a special tab for the current trip view
    const tab = document.createElement("button");
    tab.className = "file-tab active";
    tab.textContent = this.currentFile.name;
    fileTabs.appendChild(tab);
  }

  filterRoutes(searchTerm) {
    const routeItems = document.querySelectorAll(".route-item");
    const term = searchTerm.toLowerCase();

    routeItems.forEach((item) => {
      const shortName = item
        .querySelector(".route-short-name")
        .textContent.toLowerCase();
      const longName = item
        .querySelector(".route-long-name")
        .textContent.toLowerCase();

      if (shortName.includes(term) || longName.includes(term)) {
        item.style.display = "block";
      } else {
        item.style.display = "none";
      }
    });
  }

  filterTrips(searchTerm) {
    const tripItems = document.querySelectorAll(".trip-item");
    const term = searchTerm.toLowerCase();

    tripItems.forEach((item) => {
      const headsign = item
        .querySelector(".trip-headsign")
        .textContent.toLowerCase();
      const tripId = item.querySelector(".trip-id").textContent.toLowerCase();

      if (headsign.includes(term) || tripId.includes(term)) {
        item.style.display = "block";
      } else {
        item.style.display = "none";
      }
    });
  }

  updateUIForCreationMode() {
    // Show editor title
    document.getElementById("editorTitle").style.display = "block";

    // Hide the create section
    document.querySelector(".create-section").style.display = "none";

    // Show reset button
    document.getElementById("resetPageBtn").style.display = "inline-block";
  }

  updateUIForEditingMode() {
    // Hide editor title
    document.getElementById("editorTitle").style.display = "none";

    // Show the create section
    document.querySelector(".create-section").style.display = "block";

    // Hide reset button
    document.getElementById("resetPageBtn").style.display = "none";
  }

  extractAgencyUrl(gtfsData) {
    // Look for agency.txt file and extract agency_url
    if (gtfsData["agency.txt"] && gtfsData["agency.txt"].length > 0) {
      const agencyData = gtfsData["agency.txt"][0]; // Get first agency
      if (agencyData.agency_url) {
        this.agencyUrl = agencyData.agency_url;
        console.log("Found agency URL:", this.agencyUrl);
      } else {
        this.agencyUrl = null;
        console.log("No agency_url found in agency.txt");
      }
      this.showAgencyInfo();
      this.displayFeedInfo(gtfsData);
    } else {
      this.hideAgencyInfo();
      console.log("No agency.txt file found");
    }
  }

  displayFeedInfo(gtfsData) {
    // Display agency name
    const agencyName = document.getElementById("agencyName");
    if (gtfsData["agency.txt"] && gtfsData["agency.txt"].length > 0) {
      const agencyData = gtfsData["agency.txt"][0];
      agencyName.textContent = agencyData.agency_name || "Unknown Agency";
    } else {
      agencyName.textContent = "No Agency Data";
    }

    // Display feed dates from feed_info.txt
    const feedDates = document.getElementById("feedDates");
    const formatDate = (dateStr) => {
      if (dateStr && dateStr.length === 8) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(
          4,
          6
        )}-${dateStr.substring(6, 8)}`;
      }
      return dateStr;
    };

    if (gtfsData["feed_info.txt"] && gtfsData["feed_info.txt"].length > 0) {
      const feedInfo = gtfsData["feed_info.txt"][0];
      const startDate = feedInfo.feed_start_date;
      const endDate = feedInfo.feed_end_date;

      if (startDate && endDate) {
        feedDates.textContent = `${formatDate(startDate)} to ${formatDate(
          endDate
        )}`;
      } else if (startDate) {
        feedDates.textContent = `From ${formatDate(startDate)}`;
      } else if (endDate) {
        feedDates.textContent = `Until ${formatDate(endDate)}`;
      } else {
        feedDates.textContent = "No date range specified";
      }
    } else {
      feedDates.textContent = "No feed info available";
    }

    // Check for feed expiration warning
    this.checkFeedExpiration(gtfsData);

    // Display route count and types
    const routeCount = document.getElementById("routeCount");
    if (gtfsData["routes.txt"] && gtfsData["routes.txt"].length > 0) {
      const routes = gtfsData["routes.txt"];
      const routeTypes = {};

      routes.forEach((route) => {
        const type = route.route_type;
        const typeName = this.getRouteTypeName(type);
        routeTypes[typeName] = (routeTypes[typeName] || 0) + 1;
      });

      const totalRoutes = routes.length;
      const typesList = Object.entries(routeTypes)
        .map(([type, count]) => (count > 1 ? `${count} ${type}` : `1 ${type}`))
        .join(", ");

      routeCount.textContent = `${totalRoutes} route${
        totalRoutes !== 1 ? "s" : ""
      } (${typesList})`;
    } else {
      routeCount.textContent = "No routes defined";
    }

    // Display fare media information
    const fareInfo = document.getElementById("fareInfo");
    if (gtfsData["fare_media.txt"] && gtfsData["fare_media.txt"].length > 0) {
      const fareMedia = gtfsData["fare_media.txt"];
      const mediaNames = fareMedia
        .map((media) => media.fare_media_name || media.fare_media_id)
        .filter((name) => name);

      if (mediaNames.length > 0) {
        fareInfo.textContent = mediaNames.join(", ");
      } else {
        fareInfo.textContent = `${fareMedia.length} fare media defined`;
      }
    } else if (
      gtfsData["fare_attributes.txt"] &&
      gtfsData["fare_attributes.txt"].length > 0
    ) {
      // Fallback to fare attributes if no fare media
      fareInfo.textContent = "Legacy fare system";
    } else {
      fareInfo.textContent = "No fare data available";
    }
  }

  checkFeedExpiration(gtfsData) {
    const warningElement = document.getElementById("feedExpirationWarning");
    const warningText = warningElement.querySelector(".warning-text");

    // Hide warning by default
    warningElement.style.display = "none";
    warningElement.classList.remove("critical");

    if (gtfsData["feed_info.txt"] && gtfsData["feed_info.txt"].length > 0) {
      const feedInfo = gtfsData["feed_info.txt"][0];
      const endDate = feedInfo.feed_end_date;

      if (endDate && endDate.length === 8) {
        // Parse GTFS date format (YYYYMMDD) to JavaScript Date
        const year = parseInt(endDate.substring(0, 4));
        const month = parseInt(endDate.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(endDate.substring(6, 8));
        const feedEndDate = new Date(year, month, day);

        // Get current date (start of day for accurate comparison)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate days until expiration
        const timeDiff = feedEndDate.getTime() - today.getTime();
        const daysUntilExpiration = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        if (daysUntilExpiration <= 7 && daysUntilExpiration >= 0) {
          // Show warning for feeds expiring in 7 days or less
          if (daysUntilExpiration === 0) {
            warningText.textContent = "This feed expires today!";
            warningElement.classList.add("critical");
          } else if (daysUntilExpiration === 1) {
            warningText.textContent = "This feed expires tomorrow!";
            warningElement.classList.add("critical");
          } else {
            warningText.textContent = `This feed expires in ${daysUntilExpiration} days!`;
          }
          warningElement.style.display = "flex";
        } else if (daysUntilExpiration < 0) {
          // Feed has already expired
          const daysExpired = Math.abs(daysUntilExpiration);
          if (daysExpired === 1) {
            warningText.textContent = "This feed expired yesterday!";
          } else {
            warningText.textContent = `This feed expired ${daysExpired} days ago!`;
          }
          warningElement.classList.add("critical");
          warningElement.style.display = "flex";
        }
      }
    }
  }

  getRouteTypeName(routeType) {
    const routeTypes = {
      0: "Tram",
      1: "Subway",
      2: "Rail",
      3: "Bus",
      4: "Ferry",
      5: "Cable Tram",
      6: "Aerial Lift",
      7: "Funicular",
      11: "Trolleybus",
      12: "Monorail",
    };
    return routeTypes[routeType] || `Type ${routeType}`;
  }

  showAgencyInfo() {
    const agencyInfo = document.getElementById("agencyInfo");
    const agencyWebsiteBtn = document.getElementById("agencyWebsiteBtn");

    if (agencyInfo) {
      agencyInfo.style.display = "block";
    }

    // Show/hide website button based on whether URL exists
    if (agencyWebsiteBtn) {
      agencyWebsiteBtn.style.display = this.agencyUrl ? "inline-block" : "none";
    }
  }

  hideAgencyInfo() {
    const agencyInfo = document.getElementById("agencyInfo");
    if (agencyInfo) {
      agencyInfo.style.display = "none";
    }
  }

  visitAgencyWebsite() {
    if (this.agencyUrl) {
      // Ensure URL has protocol
      let url = this.agencyUrl;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
      window.open(url, "_blank");
    }
  }

  resetPage() {
    // Reload the page to start fresh
    window.location.reload();
  }
}
