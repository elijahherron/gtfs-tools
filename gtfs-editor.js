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

    // Existing stops functionality - Note: actual event listeners are set up in initializeExistingStopsEvents()
    // when the existing stops selector is initialized

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

    // Instructions panel buttons
    document
      .getElementById("closeInstructions")
      .addEventListener("click", () => this.closeInstructions());
    document
      .getElementById("collapseInstructions")
      .addEventListener("click", () => this.toggleInstructions());

    // Save/Load/Preview buttons
    document
      .getElementById("saveWorkBtn")
      .addEventListener("click", () => this.saveWork());
    document
      .getElementById("loadWorkBtn")
      .addEventListener("click", () => this.loadWork());
    document
      .getElementById("loadWorkFile")
      .addEventListener("change", (e) => this.handleLoadWorkFile(e));
    document
      .getElementById("previewBtn")
      .addEventListener("click", () => this.previewGTFS());
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

      // Show instructions panel for new GTFS
      this.showInstructions();

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
    // Preserve disabled state when recreating tabs
    const wasDisabled = tabsContainer.classList.contains("disabled");
    tabsContainer.innerHTML = "";
    if (wasDisabled) {
      tabsContainer.classList.add("disabled");
    }

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
    
    console.log("displayFileContent called with file:", file, "filename:", filename, "data length:", data ? data.length : 0);

    const spec = GTFS_SPEC.files[filename];
    const container = document.getElementById("tableContainer");
    
    // Clear container to start fresh
    container.innerHTML = "";
    
    // Create wrapper structure: header stays fixed, table area scrolls
    const headerArea = document.createElement('div');
    headerArea.style.cssText = `
      margin-bottom: 10px;
      background: white;
      border-bottom: 1px solid #ddd;
      position: sticky;
      top: 0;
      z-index: 10;
    `;
    
    const scrollableArea = document.createElement('div');
    scrollableArea.style.cssText = `
      max-height: 450px;
      overflow-y: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
    `;
    
    container.appendChild(headerArea);
    container.appendChild(scrollableArea);

    if (!data || data.length === 0) {
      // Add file info header for empty files too
      const fileInfoDiv = document.createElement('div');
      fileInfoDiv.style.cssText = `
        padding: 8px 12px;
        background: #f8f9fa;
        border-radius: 4px;
        border-left: 3px solid #007bff;
        font-size: 14px;
        color: #495057;
      `;
      fileInfoDiv.innerHTML = `<strong>${filename}</strong> - No data`;
      headerArea.appendChild(fileInfoDiv);
      
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = "text-align: center; padding: 40px; color: #666;";
      emptyDiv.innerHTML = `
                    <p>No data in ${filename}</p>
                    <p>Click "Add Row" to add some data</p>
                `;
      scrollableArea.appendChild(emptyDiv);
      return;
    }

    // Performance protection: limit display for large datasets
    const MAX_SAFE_ROWS = 1000;
    const EXTREMELY_LARGE_THRESHOLD = 5000000; // 5 million rows - truly massive files
    
    console.log("Data length:", data.length, "MAX_SAFE_ROWS:", MAX_SAFE_ROWS);
    
    // For extremely large datasets (5M+ rows), don't even attempt to process
    if (data.length > EXTREMELY_LARGE_THRESHOLD) {
      console.log("Extremely large dataset detected, showing warning only");
      
      // Add file info header even for blocked files
      const fileInfoDiv = document.createElement('div');
      fileInfoDiv.style.cssText = `
        padding: 8px 12px;
        background: #f8f9fa;
        border-radius: 4px;
        border-left: 3px solid #dc3545;
        font-size: 14px;
        color: #495057;
      `;
      fileInfoDiv.innerHTML = `<strong>${filename}</strong> - ${data.length.toLocaleString()} rows (blocked)`;
      headerArea.appendChild(fileInfoDiv);
      
      const warningDiv = document.createElement('div');
      warningDiv.style.cssText = `
        padding: 20px; 
        background: #f8d7da; 
        border: 1px solid #f5c6cb; 
        border-radius: 8px; 
        color: #721c24;
        text-align: center;
      `;
      warningDiv.innerHTML = `
        <h3>🚫 Dataset Too Large to Display</h3>
        <p><strong>${filename}</strong> contains <strong>${data.length.toLocaleString()}</strong> rows, which is too large for browser display.</p>
        <p>This file would freeze your browser. Please use:</p>
        <ul style="text-align: left; max-width: 400px; margin: 15px auto;">
          <li><strong>Map View:</strong> For creating routes and trips</li>
          <li><strong>Download GTFS:</strong> To edit this file externally</li>
          <li><strong>External Tools:</strong> Like Excel, Google Sheets, or database tools</li>
        </ul>
      `;
      scrollableArea.appendChild(warningDiv);
      return;
    }
    
    let displayData = data;
    let isLimitedDisplay = false;
    
    // Always add file info header first - shows row count for ALL files
    const fileInfoDiv = document.createElement('div');
    fileInfoDiv.style.cssText = `
      padding: 8px 12px;
      background: #f8f9fa;
      border-radius: 4px;
      border-left: 3px solid #007bff;
      font-size: 14px;
      color: #495057;
    `;
    
    const totalRows = data ? data.length : 0;
    let fileInfoText = `<strong>${filename}</strong>`;
    
    if (data.length > MAX_SAFE_ROWS) {
      displayData = data.slice(0, MAX_SAFE_ROWS);
      isLimitedDisplay = true;
      fileInfoText += ` - Showing ${MAX_SAFE_ROWS.toLocaleString()} of ${totalRows.toLocaleString()} rows`;
    } else {
      fileInfoText += ` - ${totalRows.toLocaleString()} rows`;
    }
    
    fileInfoDiv.innerHTML = fileInfoText;
    console.log("Adding file info:", fileInfoText, "to headerArea:", headerArea);
    headerArea.appendChild(fileInfoDiv);
    
    // Add warning for large datasets
    if (data.length > MAX_SAFE_ROWS) {
      console.log("Large dataset, limiting to", MAX_SAFE_ROWS, "rows");
      
      const warningDiv = document.createElement('div');
      warningDiv.style.cssText = `
        padding: 12px; 
        margin-top: 8px; 
        background: #fff3cd; 
        border: 1px solid #ffeaa7; 
        border-radius: 8px; 
        color: #856404;
        text-align: center;
        font-size: 13px;
      `;
      warningDiv.innerHTML = `
        <strong>⚠️ Large Dataset - Performance Limit Applied</strong><br>
        <small>This file is too large to display completely. Only the first ${MAX_SAFE_ROWS.toLocaleString()} rows are shown for performance.<br>
        Use Map View for creating routes, or download the full GTFS file to edit externally.</small>
      `;
      headerArea.appendChild(warningDiv);
    }

    // Get all unique headers from data and spec
    let headers = new Set();
    if (spec) {
      spec.required_fields.forEach((field) => headers.add(field));
      spec.optional_fields.forEach((field) => headers.add(field));
    }
    displayData.forEach((row) => {
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
      th.style.cursor = "pointer";
      th.style.userSelect = "none";
      th.style.position = "relative";
      th.dataset.column = header;
      
      // Add sort indicator
      const sortIndicator = document.createElement("span");
      sortIndicator.style.cssText = `
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 12px;
        color: #999;
      `;
      sortIndicator.textContent = "↕";
      th.appendChild(sortIndicator);

      // Mark required fields
      if (spec && spec.required_fields.includes(header)) {
        th.style.backgroundColor = "#fff3cd";
        th.title = "Required field - Click to sort";
      } else {
        th.title = "Click to sort";
      }

      // Add click handler for sorting
      th.addEventListener("click", () => this.sortTableByColumn(header, table, tbody, displayData, headers));

      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    const tbody = document.createElement("tbody");

    displayData.forEach((row, index) => {
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
    scrollableArea.appendChild(table);

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

  sortTableByColumn(columnName, table, tbody, data, headers) {
    // Track current sort state
    if (!this.sortState) {
      this.sortState = {};
    }
    
    const currentSort = this.sortState[columnName] || 'none';
    let newSort;
    
    // Cycle through: none -> asc -> desc -> none
    if (currentSort === 'none') {
      newSort = 'asc';
    } else if (currentSort === 'asc') {
      newSort = 'desc';
    } else {
      newSort = 'none';
    }
    
    // Reset all other column states
    Object.keys(this.sortState).forEach(key => {
      if (key !== columnName) {
        this.sortState[key] = 'none';
      }
    });
    this.sortState[columnName] = newSort;
    
    // Update sort indicators
    table.querySelectorAll('th[data-column] span').forEach(indicator => {
      const column = indicator.parentElement.dataset.column;
      if (column === columnName) {
        if (newSort === 'asc') {
          indicator.textContent = '↑';
          indicator.style.color = '#007bff';
        } else if (newSort === 'desc') {
          indicator.textContent = '↓';
          indicator.style.color = '#007bff';
        } else {
          indicator.textContent = '↕';
          indicator.style.color = '#999';
        }
      } else {
        indicator.textContent = '↕';
        indicator.style.color = '#999';
      }
    });
    
    // If sorting is reset to 'none', restore original order
    if (newSort === 'none') {
      this.rebuildTableBody(tbody, data, headers);
      return;
    }
    
    // Sort the data
    const sortedData = [...data].sort((a, b) => {
      let aVal = a[columnName] || '';
      let bVal = b[columnName] || '';
      
      // Convert to strings for comparison
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      
      // Try to parse as numbers if they look numeric
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        // Numeric comparison
        return newSort === 'asc' ? aNum - bNum : bNum - aNum;
      } else {
        // String comparison
        if (aVal < bVal) return newSort === 'asc' ? -1 : 1;
        if (aVal > bVal) return newSort === 'asc' ? 1 : -1;
        return 0;
      }
    });
    
    // Rebuild table with sorted data
    this.rebuildTableBody(tbody, sortedData, headers);
  }
  
  rebuildTableBody(tbody, data, headers) {
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Rebuild rows with sorted data
    data.forEach((row, index) => {
      const tr = document.createElement("tr");
      tr.dataset.index = index;

      // Add checkbox
      const checkboxCell = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "row-checkbox";
      checkbox.dataset.index = index;
      checkboxCell.appendChild(checkbox);
      tr.appendChild(checkboxCell);

      // Add data cells
      headers.forEach((header) => {
        const td = document.createElement("td");
        const value = row[header] || "";
        
        const input = document.createElement("input");
        input.type = "text";
        input.value = value;
        input.dataset.field = header;
        input.dataset.index = index;
        
        input.addEventListener("blur", (e) => {
          const filename = this.currentFile.name ? this.currentFile.name + ".txt" : this.currentFile;
          this.updateCell(filename, parseInt(e.target.dataset.index), e.target.dataset.field, e.target.value);
        });

        // Color display for route_color fields
        if (header === "route_color" && value && value.length === 6) {
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
          td.style.cssText = "display: flex; align-items: center;";
          td.appendChild(colorDiv);
        }

        td.appendChild(input);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    
    // Re-add event listeners for checkboxes
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

    // Handle both old format (strings) and new format (objects)
    let filename;
    if (typeof this.currentFile === "string") {
      filename = this.currentFile;
    } else {
      filename = this.currentFile.name + ".txt";
    }

    this.parser.addRow(filename);
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

    // Handle both old format (strings) and new format (objects)
    let filename;
    if (typeof this.currentFile === "string") {
      filename = this.currentFile;
    } else {
      filename = this.currentFile.name + ".txt";
    }

    indices.forEach((index) => {
      this.parser.deleteRow(filename, index);
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
      // Generate filename with current date: gtfs_YYYY-MM-DD.zip
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      a.download = `gtfs_${dateStr}.zip`;
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

  initializeRouteOptions(gtfsData) {
    // Initialize route options from the GTFS data for filtering
    if (!gtfsData["routes.txt"]) {
      this.routeOptions = [];
      return;
    }

    const routes = gtfsData["routes.txt"];
    this.routeOptions = routes.map((route) => {
      const routeText = `${route.route_short_name || route.route_long_name || route.route_id} - ${route.route_long_name || route.route_short_name || "Unnamed Route"}`;
      return {
        value: route.route_id,
        text: routeText,
        searchText: `${route.route_short_name || ""} ${route.route_long_name || ""} ${route.route_id}`.toLowerCase(),
      };
    });

    // Sort routes alphabetically
    this.routeOptions.sort((a, b) => a.text.localeCompare(b.text));
  }

  initializeTripOptions(gtfsData) {
    // Initialize trip options - they will be populated when a route is selected
    this.tripOptions = [];
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
    console.log("showExistingStops called");
    console.log("this.files:", this.files);
    
    if (!this.files || this.files.length === 0) {
      console.log("No files available for existing stops");
      document.getElementById("existingStopsSection").style.display = "none";
      return;
    }

    const stopsFile = this.files.find((f) => f.name === "stops");
    console.log("stopsFile:", stopsFile);
    
    if (!stopsFile || !stopsFile.data || stopsFile.data.length === 0) {
      console.log("No stops file or no stops data");
      document.getElementById("existingStopsSection").style.display = "none";
      return;
    }

    console.log("Showing existing stops section with", stopsFile.data.length, "stops");
    document.getElementById("existingStopsSection").style.display = "block";
    this.initializeExistingStopsSelector(stopsFile.data);
  }

  initializeExistingStopsSelector(stops) {
    console.log("initializeExistingStopsSelector called with", stops.length, "stops");
    
    // Store stops for the selector
    this.existingStopsOptions = stops.map((stop) => {
      // Fix NaN issue by providing fallback values and validation
      const lat = parseFloat(stop.stop_lat);
      const lng = parseFloat(stop.stop_lon);
      const hasValidCoords = !isNaN(lat) && !isNaN(lng);
      
      const stopName = stop.stop_name || stop.stop_id || "Unnamed Stop";
      const coordsText = hasValidCoords 
        ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        : "No coordinates";
      
      return {
        stop: stop,
        value: stop.stop_id,
        text: `${stopName} (${coordsText})`,
        searchText: `${stopName} ${stop.stop_id} ${coordsText}`.toLowerCase(),
      };
    });

    console.log("Created", this.existingStopsOptions.length, "existing stops options");
    this.selectedExistingStop = null;
    
    // Initialize event listeners for the existing stops selector
    this.initializeExistingStopsEvents();
  }

  initializeExistingStopsEvents() {
    console.log("initializeExistingStopsEvents called");
    
    const searchInput = document.getElementById("existingStopsSearch");
    const dropdown = document.getElementById("existingStopsDropdown");
    const addButton = document.getElementById("addExistingStopBtn");

    console.log("Elements found:", {
      searchInput: !!searchInput,
      dropdown: !!dropdown,
      addButton: !!addButton
    });

    if (!searchInput || !dropdown) {
      console.error("Required elements not found for existing stops events");
      return;
    }

    // Remove existing event listeners to avoid duplicates
    searchInput.replaceWith(searchInput.cloneNode(true));
    const newSearchInput = document.getElementById("existingStopsSearch");
    
    newSearchInput.addEventListener("input", (e) => {
      console.log("Search input changed:", e.target.value);
      this.filterExistingStopsOptions(e.target.value);
    });
    newSearchInput.addEventListener("focus", () => {
      console.log("Search input focused");
      this.showAllExistingStopsOptions();
    });
    newSearchInput.addEventListener("blur", (e) => {
      setTimeout(() => this.hideExistingStopsDropdown(), 150);
    });

    // Add button event listener
    if (addButton) {
      addButton.replaceWith(addButton.cloneNode(true));
      const newAddButton = document.getElementById("addExistingStopBtn");
      newAddButton.addEventListener("click", () => this.addSelectedExistingStop());
    }

    // Click outside to close dropdown
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#existingStopsContainer")) {
        this.hideExistingStopsDropdown();
      }
    });
    
    console.log("Existing stops events initialized successfully");
  }

  filterExistingStopsOptions(searchTerm) {
    const dropdown = document.getElementById("existingStopsDropdown");

    if (!this.existingStopsOptions) return;

    const filteredOptions =
      searchTerm.trim() === ""
        ? this.existingStopsOptions
        : this.existingStopsOptions.filter((option) =>
            option.searchText.includes(searchTerm.toLowerCase())
          );

    this.renderExistingStopsDropdown(dropdown, filteredOptions);

    if (filteredOptions.length > 0) {
      this.showExistingStopsDropdown();
    } else {
      this.hideExistingStopsDropdown();
    }
  }

  renderExistingStopsDropdown(dropdown, options) {
    dropdown.innerHTML = "";

    options.forEach((option) => {
      const optionEl = document.createElement("div");
      optionEl.className = "search-option";
      optionEl.textContent = option.text;
      optionEl.addEventListener("click", () => this.selectExistingStop(option));
      dropdown.appendChild(optionEl);
    });
  }

  selectExistingStop(option) {
    this.selectedExistingStop = option.stop;
    document.getElementById("existingStopsSearch").value = option.text;
    document.getElementById("addExistingStopBtn").disabled = false;
    this.hideExistingStopsDropdown();
  }

  showAllExistingStopsOptions() {
    if (this.existingStopsOptions && this.existingStopsOptions.length > 0) {
      const dropdown = document.getElementById("existingStopsDropdown");
      this.renderExistingStopsDropdown(dropdown, this.existingStopsOptions);
      this.showExistingStopsDropdown();
    }
  }

  showExistingStopsDropdown() {
    document.getElementById("existingStopsDropdown").classList.add("show");
  }

  hideExistingStopsDropdown() {
    document.getElementById("existingStopsDropdown").classList.remove("show");
  }

  addSelectedExistingStop() {
    if (!this.selectedExistingStop) {
      this.showStatus("Please select a stop first", "error");
      return;
    }

    this.addExistingStopToTrip(this.selectedExistingStop);
    
    // Clear selection after adding
    document.getElementById("existingStopsSearch").value = "";
    document.getElementById("addExistingStopBtn").disabled = true;
    this.selectedExistingStop = null;
  }

  addExistingStopToTrip(stop) {
    // Add the existing stop to the current trip being created
    if (this.mapEditor && this.mapEditor.currentTrip && this.mapEditor.isCreatingTrip) {
      const lat = parseFloat(stop.stop_lat);
      const lng = parseFloat(stop.stop_lon);

      // Validate coordinates
      if (isNaN(lat) || isNaN(lng)) {
        this.showStatus("Stop has invalid coordinates and cannot be added", "error");
        return;
      }

      // Use the map editor's addExistingStop method
      this.mapEditor.addExistingStop(lat, lng, {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name || stop.stop_id,
        stop_code: stop.stop_code || "",
        stop_desc: stop.stop_desc || "",
        zone_id: stop.zone_id || "",
        stop_url: stop.stop_url || "",
        location_type: stop.location_type || "0",
        parent_station: stop.parent_station || "",
        wheelchair_boarding: stop.wheelchair_boarding || ""
      });
      
      this.showStatus(`Added existing stop: ${stop.stop_name || stop.stop_id}`, "success");
    } else {
      this.showStatus("Please start creating a trip first", "error");
    }
  }

  copyStopInfo(stop) {
    const stopInfo = `Name: ${stop.stop_name || stop.stop_id}
ID: ${stop.stop_id}
Latitude: ${stop.stop_lat}
Longitude: ${stop.stop_lon}`;
    
    // Try to copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(stopInfo).then(() => {
        this.showStatus("Stop information copied to clipboard", "success");
      }).catch(() => {
        this.showStatus("Could not copy to clipboard", "error");
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = stopInfo;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        this.showStatus("Stop information copied to clipboard", "success");
      } catch (err) {
        this.showStatus("Could not copy to clipboard", "error");
      }
      document.body.removeChild(textArea);
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

    // Enable file tabs in table view
    const fileTabs = document.getElementById("fileTabs");
    if (fileTabs) {
      fileTabs.classList.remove("disabled");
    }

    // Show table actions
    document.querySelector(".table-actions").style.display = "block";

    // Hide route filter and existing stops by default
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
      // Check if we have existing stops even in new GTFS mode
      const stopsFile = this.files ? this.files.find((f) => f.name === "stops") : null;
      if (stopsFile && stopsFile.data && stopsFile.data.length > 0) {
        this.showExistingStops();
      } else {
        this.hideExistingStops();
      }
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
    // Preserve disabled state when recreating tabs
    const wasDisabled = fileTabs.classList.contains("disabled");
    fileTabs.innerHTML = "";
    if (wasDisabled) {
      fileTabs.classList.add("disabled");
    }

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

  showInstructions() {
    document.getElementById("floatingInstructions").style.display = "block";
  }

  closeInstructions() {
    document.getElementById("floatingInstructions").style.display = "none";
  }

  toggleInstructions() {
    const content = document.getElementById("instructionsWindowContent");
    const collapseBtn = document.getElementById("collapseInstructions");
    
    if (content.classList.contains("collapsed")) {
      content.classList.remove("collapsed");
      collapseBtn.textContent = "−";
      collapseBtn.title = "Collapse Panel";
    } else {
      content.classList.add("collapsed");
      collapseBtn.textContent = "+";
      collapseBtn.title = "Expand Panel";
    }
  }

  // Method to refresh existing stops visibility (called from map editor)
  refreshExistingStopsVisibility() {
    if (this.isNewGTFS) {
      // Check if we have existing stops now
      const stopsFile = this.files ? this.files.find((f) => f.name === "stops") : null;
      if (stopsFile && stopsFile.data && stopsFile.data.length > 0) {
        console.log("Refreshing existing stops - found", stopsFile.data.length, "stops");
        this.showExistingStops();
      } else {
        console.log("Refreshing existing stops - no stops found, hiding");
        this.hideExistingStops();
      }
    }
  }

  // Save/Load/Preview functionality
  saveWork() {
    try {
      const workData = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        isNewGTFS: this.isNewGTFS,
        files: this.files,
        gtfsData: this.parser.gtfsData,
        currentFile: this.currentFile,
        agencyUrl: this.agencyUrl
      };

      // Save to localStorage as backup
      localStorage.setItem('gtfs-work-backup', JSON.stringify(workData));

      // Download as file
      const blob = new Blob([JSON.stringify(workData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gtfs-work-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showStatus("Work saved successfully!", "success");
    } catch (error) {
      console.error("Error saving work:", error);
      this.showStatus("Error saving work: " + error.message, "error");
    }
  }

  loadWork() {
    document.getElementById('loadWorkFile').click();
  }

  handleLoadWorkFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workData = JSON.parse(e.target.result);
        this.restoreWork(workData);
      } catch (error) {
        console.error("Error loading work:", error);
        this.showStatus("Error loading work: Invalid file format", "error");
      }
    };
    reader.readAsText(file);
  }

  restoreWork(workData) {
    try {
      // Validate work data
      if (!workData.version || !workData.files || !workData.gtfsData) {
        throw new Error("Invalid work file format");
      }

      // Restore state
      this.isNewGTFS = workData.isNewGTFS || false;
      this.files = workData.files;
      this.parser.gtfsData = workData.gtfsData;
      this.currentFile = workData.currentFile || this.files[0];
      this.agencyUrl = workData.agencyUrl || null;

      // Update UI
      if (this.isNewGTFS) {
        this.updateUIForCreationMode();
      } else {
        this.updateUIForEditingMode();
      }

      // Show editor and restore file display
      this.showEditor(this.files);
      this.displayFileContent(this.currentFile);

      // Extract and display agency info if available
      if (workData.gtfsData["agency.txt"]) {
        this.extractAgencyUrl(workData.gtfsData);
      }

      // Refresh existing stops visibility
      this.refreshExistingStopsVisibility();

      // Clear map editor state and switch to appropriate view
      if (this.mapEditor) {
        this.mapEditor.clearAllData();
      }

      this.showStatus("Work loaded successfully!", "success");

      // Reset file input
      document.getElementById('loadWorkFile').value = '';
    } catch (error) {
      console.error("Error restoring work:", error);
      this.showStatus("Error restoring work: " + error.message, "error");
    }
  }

  // Auto-save functionality
  autoSave() {
    if (this.files && this.files.length > 0) {
      try {
        const workData = {
          version: "1.0",
          timestamp: new Date().toISOString(),
          isNewGTFS: this.isNewGTFS,
          files: this.files,
          gtfsData: this.parser.gtfsData,
          currentFile: this.currentFile,
          agencyUrl: this.agencyUrl,
          isAutoSave: true
        };
        localStorage.setItem('gtfs-work-autosave', JSON.stringify(workData));
      } catch (error) {
        console.warn("Auto-save failed:", error);
      }
    }
  }

  // Check for auto-saved work on startup
  checkForAutoSave() {
    const autoSave = localStorage.getItem('gtfs-work-autosave');
    if (autoSave) {
      try {
        const workData = JSON.parse(autoSave);
        const timeDiff = new Date() - new Date(workData.timestamp);
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // Only offer to restore if less than 24 hours old
        if (hoursDiff < 24) {
          const restore = confirm(
            `Found auto-saved work from ${new Date(workData.timestamp).toLocaleString()}.\n\nWould you like to restore it?`
          );
          if (restore) {
            this.restoreWork(workData);
            return true;
          }
        }
      } catch (error) {
        console.warn("Error checking auto-save:", error);
      }
    }
    return false;
  }

  previewGTFS() {
    // Show the floating preview window
    this.showFloatingPreview();
  }

  showFloatingPreview() {
    const gtfsData = this.parser.gtfsData;
    const previewWindow = document.getElementById("floatingPreviewWindow");
    
    // Initialize the preview window
    this.initializePreviewWindow();
    
    // Populate the preview data
    this.populatePreviewData(gtfsData);
    
    // Show the window
    previewWindow.style.display = "flex";
    
    // Initialize the preview map after a short delay
    setTimeout(() => {
      this.initializePreviewMap(gtfsData);
    }, 300);
  }

  initializePreviewWindow() {
    const closeBtn = document.getElementById("closePreview");
    const collapseBtn = document.getElementById("collapsePreview");
    
    // Remove existing event listeners to avoid duplicates
    closeBtn.replaceWith(closeBtn.cloneNode(true));
    collapseBtn.replaceWith(collapseBtn.cloneNode(true));
    
    // Add fresh event listeners
    document.getElementById("closePreview").addEventListener("click", () => {
      this.closeFloatingPreview();
    });
    
    document.getElementById("collapsePreview").addEventListener("click", () => {
      this.togglePreviewCollapse();
    });
    
    // Initialize preview route/trip filtering
    this.initializePreviewFiltering();
  }
  
  populatePreviewData(gtfsData) {
    // Populate agency info
    this.populatePreviewAgencyInfo(gtfsData);
    
    // Populate statistics
    this.populatePreviewStats(gtfsData);
    
    // Initialize route options for the preview filter
    this.previewRouteOptions = [];
    this.previewTripOptions = [];
    
    if (gtfsData["routes.txt"]) {
      const routes = gtfsData["routes.txt"];
      this.previewRouteOptions = routes.map((route) => {
        const routeText = `${route.route_short_name || route.route_long_name || route.route_id} - ${route.route_long_name || route.route_short_name || "Unnamed Route"}`;
        return {
          value: route.route_id,
          text: routeText,
          searchText: `${route.route_short_name || ""} ${route.route_long_name || ""} ${route.route_id}`.toLowerCase(),
        };
      });
      this.previewRouteOptions.sort((a, b) => a.text.localeCompare(b.text));
    }
  }
  
  populatePreviewAgencyInfo(gtfsData) {
    // Agency name
    const agencyName = document.getElementById("previewAgencyName");
    if (gtfsData["agency.txt"] && gtfsData["agency.txt"].length > 0) {
      const agencyData = gtfsData["agency.txt"][0];
      agencyName.textContent = agencyData.agency_name || "Unknown Agency";
    } else {
      agencyName.textContent = "No Agency Data";
    }

    // Feed dates
    const feedDates = document.getElementById("previewFeedDates");
    const formatDate = (dateStr) => {
      if (dateStr && dateStr.length === 8) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      }
      return dateStr;
    };

    if (gtfsData["feed_info.txt"] && gtfsData["feed_info.txt"].length > 0) {
      const feedInfo = gtfsData["feed_info.txt"][0];
      const startDate = feedInfo.feed_start_date;
      const endDate = feedInfo.feed_end_date;

      if (startDate && endDate) {
        feedDates.textContent = `${formatDate(startDate)} to ${formatDate(endDate)}`;
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

    // Route count
    const routeCount = document.getElementById("previewRouteCount");
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

      routeCount.textContent = `${totalRoutes} route${totalRoutes !== 1 ? "s" : ""} (${typesList})`;
    } else {
      routeCount.textContent = "No routes defined";
    }

    // Fare info
    const fareInfo = document.getElementById("previewFareInfo");
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
    } else if (gtfsData["fare_attributes.txt"] && gtfsData["fare_attributes.txt"].length > 0) {
      fareInfo.textContent = "Legacy fare system";
    } else {
      fareInfo.textContent = "No fare data available";
    }
  }
  
  populatePreviewStats(gtfsData) {
    const stats = {
      agencies: gtfsData["agency.txt"] ? gtfsData["agency.txt"].length : 0,
      routes: gtfsData["routes.txt"] ? gtfsData["routes.txt"].length : 0,
      trips: gtfsData["trips.txt"] ? gtfsData["trips.txt"].length : 0,
      stops: gtfsData["stops.txt"] ? gtfsData["stops.txt"].length : 0,
      stopTimes: gtfsData["stop_times.txt"] ? gtfsData["stop_times.txt"].length : 0,
      services: gtfsData["calendar.txt"] ? gtfsData["calendar.txt"].length : 0
    };
    
    document.getElementById("previewStatsAgencies").textContent = stats.agencies;
    document.getElementById("previewStatsRoutes").textContent = stats.routes;
    document.getElementById("previewStatsTrips").textContent = stats.trips;
    document.getElementById("previewStatsStops").textContent = stats.stops;
    document.getElementById("previewStatsStopTimes").textContent = stats.stopTimes;
    document.getElementById("previewStatsServices").textContent = stats.services;
  }
  
  initializePreviewMap(gtfsData) {
    const container = document.getElementById("previewMapContainer");
    if (!container) return;
    
    // Clear any existing map
    container.innerHTML = "";
    
    // Create the preview map
    try {
      this.previewMap = L.map(container).setView([40.7128, -74.006], 12);
      
      // Add tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
        opacity: 0.7,
      }).addTo(this.previewMap);
      
      // Force map to recognize container size
      setTimeout(() => {
        if (this.previewMap) {
          this.previewMap.invalidateSize(true);
          // Show initial instruction message
          this.showPreviewMapMessage("Select a route and optionally a trip, then click 'Show on Map' to visualize");
        }
      }, 100);
      
    } catch (error) {
      console.error("Error initializing preview map:", error);
      container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">Map failed to load: ${error.message}</div>`;
    }
  }
  
  
  initializePreviewFiltering() {
    // Initialize filter event listeners
    const routeSearch = document.getElementById("previewRouteSearch");
    const tripSearch = document.getElementById("previewTripSearch");
    const applyBtn = document.getElementById("previewApplyFilter");
    const clearBtn = document.getElementById("previewClearFilter");
    
    // Route search functionality
    routeSearch.addEventListener("input", (e) => this.filterPreviewRouteOptions(e.target.value));
    routeSearch.addEventListener("focus", () => this.showPreviewRouteOptions());
    routeSearch.addEventListener("blur", (e) => {
      setTimeout(() => this.hidePreviewRouteDropdown(), 150);
    });
    
    // Trip search functionality  
    tripSearch.addEventListener("input", (e) => this.filterPreviewTripOptions(e.target.value));
    tripSearch.addEventListener("focus", () => this.showPreviewTripOptions());
    tripSearch.addEventListener("blur", (e) => {
      setTimeout(() => this.hidePreviewTripDropdown(), 150);
    });
    
    // Filter buttons
    applyBtn.addEventListener("click", () => this.applyPreviewFilter());
    clearBtn.addEventListener("click", () => this.clearPreviewFilter());
  }
  
  filterPreviewRouteOptions(searchTerm) {
    const dropdown = document.getElementById("previewRouteDropdown");
    const filteredOptions = searchTerm.trim() === "" 
      ? this.previewRouteOptions 
      : this.previewRouteOptions.filter((option) => option.searchText.includes(searchTerm.toLowerCase()));
    
    this.renderPreviewDropdownOptions(dropdown, filteredOptions, (option) => {
      this.selectPreviewRoute(option.value, option.text);
    });
    
    if (filteredOptions.length > 0) {
      dropdown.classList.add("show");
    } else {
      dropdown.classList.remove("show");
    }
  }
  
  showPreviewRouteOptions() {
    if (this.previewRouteOptions.length > 0) {
      const dropdown = document.getElementById("previewRouteDropdown");
      this.renderPreviewDropdownOptions(dropdown, this.previewRouteOptions, (option) => {
        this.selectPreviewRoute(option.value, option.text);
      });
      dropdown.classList.add("show");
    }
  }
  
  hidePreviewRouteDropdown() {
    document.getElementById("previewRouteDropdown").classList.remove("show");
  }
  
  selectPreviewRoute(routeId, routeText) {
    this.selectedPreviewRouteId = routeId;
    document.getElementById("previewRouteSearch").value = routeText;
    this.hidePreviewRouteDropdown();
    
    // Update trip options based on selected route
    this.updatePreviewTripOptions(routeId);
  }
  
  updatePreviewTripOptions(routeId) {
    const tripSearch = document.getElementById("previewTripSearch");
    
    if (!routeId) {
      this.previewTripOptions = [];
      tripSearch.value = "";
      tripSearch.placeholder = "Select route first...";
      tripSearch.disabled = true;
      return;
    }
    
    const gtfsData = this.parser.gtfsData;
    const trips = gtfsData["trips.txt"] || [];
    const routeTrips = trips.filter((trip) => trip.route_id === routeId);
    
    this.previewTripOptions = routeTrips.map((trip) => {
      const tripText = `${trip.trip_headsign || "No destination"} (Dir ${trip.direction_id || "0"}) - ${trip.trip_id}`;
      return {
        value: trip.trip_id,
        text: tripText,
        searchText: `${trip.trip_headsign || "no destination"} ${trip.trip_id} dir${trip.direction_id || "0"}`.toLowerCase(),
      };
    });
    
    tripSearch.value = "";
    tripSearch.placeholder = "Click to select or type to search trips...";
    tripSearch.disabled = false;
  }
  
  renderPreviewDropdownOptions(dropdown, options, onSelectCallback) {
    dropdown.innerHTML = "";
    options.forEach((option) => {
      const optionEl = document.createElement("div");
      optionEl.className = "search-option";
      optionEl.textContent = option.text;
      optionEl.addEventListener("click", () => onSelectCallback(option));
      dropdown.appendChild(optionEl);
    });
  }
  
  applyPreviewFilter() {
    if (!this.previewMap) {
      console.warn("Preview map not initialized");
      return;
    }

    const routeId = this.selectedPreviewRouteId;
    const tripId = this.selectedPreviewTripId;
    
    console.log("Applying preview filter - routeId:", routeId, "tripId:", tripId);
    
    // Clear existing map layers first
    this.clearPreviewMapLayers();
    
    const gtfsData = this.parser.gtfsData;
    
    if (!routeId && !tripId) {
      // No filter selected - show message
      this.showPreviewMapMessage("Select a route and optionally a trip, then click 'Show on Map' to visualize");
      return;
    }
    
    // Filter and display the selected route/trip
    this.displayPreviewFilteredData(gtfsData, routeId, tripId);
  }
  
  clearPreviewMapLayers() {
    if (!this.previewMap) return;
    
    // Remove all markers and polylines
    this.previewMap.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        this.previewMap.removeLayer(layer);
      }
    });
    
    // Clear any existing message overlay
    const existingMessage = document.querySelector('.preview-map-message');
    if (existingMessage) {
      existingMessage.remove();
    }
  }
  
  showPreviewMapMessage(message) {
    const container = document.getElementById("previewMapContainer");
    
    // Remove existing message
    const existingMessage = container.querySelector('.preview-map-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Add new message overlay
    const messageDiv = document.createElement('div');
    messageDiv.className = 'preview-map-message';
    messageDiv.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.95);
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      color: #666;
      font-size: 14px;
      max-width: 250px;
      z-index: 1000;
      border: 1px solid #e9ecef;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    messageDiv.textContent = message;
    
    container.style.position = 'relative';
    container.appendChild(messageDiv);
  }
  
  displayPreviewFilteredData(gtfsData, routeId, tripId) {
    const routes = gtfsData["routes.txt"] || [];
    const trips = gtfsData["trips.txt"] || [];
    const stops = gtfsData["stops.txt"] || [];
    const stopTimes = gtfsData["stop_times.txt"] || [];
    const shapes = gtfsData["shapes.txt"] || [];
    
    // Find the selected route
    const selectedRoute = routes.find(r => r.route_id === routeId);
    if (!selectedRoute) {
      this.showPreviewMapMessage("Selected route not found");
      return;
    }
    
    // Get trips for this route (or specific trip if selected)
    let filteredTrips;
    if (tripId) {
      filteredTrips = trips.filter(t => t.trip_id === tripId && t.route_id === routeId);
    } else {
      filteredTrips = trips.filter(t => t.route_id === routeId);
    }
    
    if (filteredTrips.length === 0) {
      this.showPreviewMapMessage("No trips found for selected route");
      return;
    }
    
    // Get all stops for these trips
    const tripIds = filteredTrips.map(t => t.trip_id);
    const filteredStopTimes = stopTimes.filter(st => tripIds.includes(st.trip_id));
    const stopIds = [...new Set(filteredStopTimes.map(st => st.stop_id))];
    const filteredStops = stops.filter(s => stopIds.includes(s.stop_id));
    
    // Display stops
    const validStops = [];
    filteredStops.forEach((stop) => {
      if (stop.stop_lat && stop.stop_lon) {
        const lat = parseFloat(stop.stop_lat);
        const lng = parseFloat(stop.stop_lon);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: "existing-stop-marker",
              html: '<div class="stop-marker-content"></div>',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            }),
          }).addTo(this.previewMap);
          
          marker.bindPopup(`
            <div>
              <h4>${stop.stop_name || "Unnamed Stop"}</h4>
              <p><strong>ID:</strong> ${stop.stop_id}</p>
              <p><strong>Route:</strong> ${selectedRoute.route_short_name || selectedRoute.route_long_name}</p>
              <p><strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
            </div>
          `);
          
          validStops.push(L.marker([lat, lng]));
        }
      }
    });
    
    // Display shapes for these trips
    const shapeIds = [...new Set(filteredTrips.map(t => t.shape_id).filter(Boolean))];
    this.displayPreviewShapes(gtfsData, shapeIds, selectedRoute);
    
    // Fit map to show all data
    if (validStops.length > 0) {
      const group = new L.featureGroup(validStops);
      this.previewMap.fitBounds(group.getBounds().pad(0.1));
    } else if (shapeIds.length === 0) {
      this.showPreviewMapMessage("No geographic data found for selected route/trip");
    }
    
    // Show success message
    const itemCount = validStops.length;
    const shapeCount = shapeIds.length;
    console.log(`Displayed ${itemCount} stops and ${shapeCount} shapes for route ${routeId}`);
  }
  
  displayPreviewShapes(gtfsData, shapeIds, selectedRoute) {
    const shapes = gtfsData["shapes.txt"] || [];
    
    if (shapes.length === 0 || shapeIds.length === 0) return;
    
    // Group shapes by shape_id
    const shapeGroups = {};
    shapes.forEach((shape) => {
      if (shapeIds.includes(shape.shape_id)) {
        if (!shapeGroups[shape.shape_id]) {
          shapeGroups[shape.shape_id] = [];
        }
        shapeGroups[shape.shape_id].push({
          lat: parseFloat(shape.shape_pt_lat),
          lng: parseFloat(shape.shape_pt_lon),
          sequence: parseInt(shape.shape_pt_sequence),
        });
      }
    });
    
    // Get route color
    let color = "#4caf50"; // default
    if (selectedRoute.route_color && selectedRoute.route_color.length === 6) {
      color = "#" + selectedRoute.route_color;
    }
    
    const routeName = selectedRoute.route_short_name || selectedRoute.route_long_name || selectedRoute.route_id;
    
    // Draw each shape
    Object.keys(shapeGroups).forEach((shapeId) => {
      const shapePoints = shapeGroups[shapeId];
      shapePoints.sort((a, b) => a.sequence - b.sequence);
      
      const validPoints = shapePoints.filter((p) => !isNaN(p.lat) && !isNaN(p.lng));
      if (validPoints.length < 2) return;
      
      const latlngs = validPoints.map((p) => [p.lat, p.lng]);
      const polyline = L.polyline(latlngs, {
        color: color,
        weight: 5,
        opacity: 0.8,
      }).addTo(this.previewMap);
      
      polyline.bindPopup(`
        <div>
          <h4>${routeName}</h4>
          <p><strong>Shape ID:</strong> ${shapeId}</p>
          <p><strong>Points:</strong> ${validPoints.length}</p>
          <p><strong>Route Type:</strong> ${this.getRouteTypeName(selectedRoute.route_type)}</p>
        </div>
      `);
    });
  }
  
  filterPreviewTripOptions(searchTerm) {
    const dropdown = document.getElementById("previewTripDropdown");
    const filteredOptions = searchTerm.trim() === "" 
      ? this.previewTripOptions 
      : this.previewTripOptions.filter((option) => option.searchText.includes(searchTerm.toLowerCase()));
    
    this.renderPreviewDropdownOptions(dropdown, filteredOptions, (option) => {
      this.selectPreviewTrip(option.value, option.text);
    });
    
    if (filteredOptions.length > 0) {
      dropdown.classList.add("show");
    } else {
      dropdown.classList.remove("show");
    }
  }
  
  showPreviewTripOptions() {
    if (this.previewTripOptions.length > 0) {
      const dropdown = document.getElementById("previewTripDropdown");
      this.renderPreviewDropdownOptions(dropdown, this.previewTripOptions, (option) => {
        this.selectPreviewTrip(option.value, option.text);
      });
      dropdown.classList.add("show");
    }
  }
  
  hidePreviewTripDropdown() {
    document.getElementById("previewTripDropdown").classList.remove("show");
  }
  
  selectPreviewTrip(tripId, tripText) {
    this.selectedPreviewTripId = tripId;
    document.getElementById("previewTripSearch").value = tripText;
    this.hidePreviewTripDropdown();
  }

  clearPreviewFilter() {
    document.getElementById("previewRouteSearch").value = "";
    document.getElementById("previewTripSearch").value = "";
    document.getElementById("previewTripSearch").disabled = true;
    document.getElementById("previewTripSearch").placeholder = "Select route first...";
    this.selectedPreviewRouteId = "";
    this.selectedPreviewTripId = "";
    this.previewTripOptions = [];
    
    // Clear the map as well
    this.clearPreviewMapLayers();
    this.showPreviewMapMessage("Select a route and optionally a trip, then click 'Show on Map' to visualize");
  }
  
  closeFloatingPreview() {
    const previewWindow = document.getElementById("floatingPreviewWindow");
    previewWindow.style.display = "none";
    
    // Clean up the preview map
    if (this.previewMap) {
      this.previewMap.remove();
      this.previewMap = null;
    }
  }
  
  togglePreviewCollapse() {
    const content = document.getElementById("previewWindowContent");
    const collapseBtn = document.getElementById("collapsePreview");
    
    if (content.style.display === "none") {
      content.style.display = "block";
      collapseBtn.textContent = "−";
    } else {
      content.style.display = "none";
      collapseBtn.textContent = "+";
    }
  }

}
