/**
 * Direction Configuration Editor
 * Tool for creating and editing transit route direction configurations
 * with support for branching stop sequences.
 */
class DirectionConfigEditor {
  constructor() {
    this.gtfsData = null;
    this.stops = [];
    this.stopsByName = {};
    this.routeKey = "";
    this.directions = [];
    this.currentDirectionIndex = 0;
    this.map = null;
    this.mapMarkers = [];
    this.mapLines = [];
    this.nodeIdCounter = 0;
    this.collapsedNodes = new Set(); // Track which nodes are collapsed
  }

  /**
   * Initialize the editor and bind event listeners
   */
  initialize() {
    this.bindUploadEvents();
    this.bindEditorEvents();
    this.bindViewToggle();
  }

  /**
   * Bind upload tab and file upload events
   */
  bindUploadEvents() {
    // Tab switching
    const tabs = document.querySelectorAll(".upload-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        const tabName = tab.getAttribute("data-tab");
        document.querySelectorAll(".upload-tab-content").forEach((content) => {
          content.classList.remove("active");
        });
        document
          .getElementById(`${tabName === "gtfs" ? "gtfs-upload" : "json-import"}-tab`)
          .classList.add("active");
      });
    });

    // GTFS Upload
    const uploadBtn = document.getElementById("directionUploadBtn");
    if (uploadBtn) {
      uploadBtn.addEventListener("click", () => this.handleGtfsUpload());
    }

    // JSON Import
    const importBtn = document.getElementById("directionImportBtn");
    if (importBtn) {
      importBtn.addEventListener("click", () => this.handleJsonImport());
    }
  }

  /**
   * Bind editor interaction events
   */
  bindEditorEvents() {
    // Route key input
    const routeKeyInput = document.getElementById("routeKeyInput");
    if (routeKeyInput) {
      routeKeyInput.addEventListener("input", (e) => {
        this.routeKey = e.target.value;
        this.updateJsonOutput();
      });
    }

    // Direction selector
    const directionSelect = document.getElementById("directionSelect");
    if (directionSelect) {
      directionSelect.addEventListener("change", (e) => {
        this.currentDirectionIndex = parseInt(e.target.value);
        this.loadDirectionSettings();
        this.renderDiagram();
        this.renderMap();
      });
    }

    // Add direction button
    const addDirBtn = document.getElementById("addDirectionBtn");
    if (addDirBtn) {
      addDirBtn.addEventListener("click", () => this.addDirection());
    }

    // Delete direction button
    const deleteDirBtn = document.getElementById("deleteDirectionBtn");
    if (deleteDirBtn) {
      deleteDirBtn.addEventListener("click", () => this.deleteDirection());
    }

    // Direction settings inputs
    ["directionKeyInput", "directionIdSelect", "tripHeadsignPattern", "idFromSelect"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener("change", () => this.saveDirectionSettings());
          el.addEventListener("input", () => this.saveDirectionSettings());
        }
      }
    );

    // Add stop button
    const addStopBtn = document.getElementById("addStopBtn");
    if (addStopBtn) {
      addStopBtn.addEventListener("click", () => {
        const columnSelect = document.getElementById("addToColumnSelect");
        const column = columnSelect ? parseInt(columnSelect.value) : 0;
        this.addStopNode(column);
      });
    }

    // Add branch button
    const addBranchBtn = document.getElementById("addBranchBtn");
    if (addBranchBtn) {
      addBranchBtn.addEventListener("click", () => this.addBranch());
    }

    // Collapse all button
    const collapseAllBtn = document.getElementById("collapseAllBtn");
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener("click", () => this.collapseAll());
    }

    // Expand all button
    const expandAllBtn = document.getElementById("expandAllBtn");
    if (expandAllBtn) {
      expandAllBtn.addEventListener("click", () => this.expandAll());
    }

    // Copy JSON button
    const copyBtn = document.getElementById("copyJsonBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => this.copyJsonToClipboard());
    }
  }

  /**
   * Bind view toggle (Diagram/Map)
   */
  bindViewToggle() {
    const viewBtns = document.querySelectorAll(".direction-view-toggle .view-btn");
    viewBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        viewBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const viewName = btn.getAttribute("data-view");
        document.querySelectorAll(".direction-view").forEach((view) => {
          view.classList.remove("active");
        });
        document.getElementById(`${viewName}View`).classList.add("active");

        if (viewName === "map") {
          this.initializeMap();
          this.renderMap();
        }
      });
    });
  }

  /**
   * Handle GTFS file upload
   */
  async handleGtfsUpload() {
    const fileInput = document.getElementById("directionGtfsUpload");
    const urlInput = document.getElementById("directionGtfsUrl");
    const statusEl = document.getElementById("directionUploadStatus");

    const file = fileInput.files[0];
    const url = urlInput.value.trim();

    if (!file && !url) {
      this.showStatus(statusEl, "Please select a file or enter a URL", "error");
      return;
    }

    try {
      this.showStatus(statusEl, "Loading GTFS data...", "");

      let gtfsData;
      if (file) {
        gtfsData = await this.parseGtfsFile(file);
      } else {
        gtfsData = await this.loadGtfsFromUrl(url);
      }

      this.gtfsData = gtfsData;
      this.processStops();
      this.showStatus(statusEl, `Loaded ${this.stops.length} stops`, "success");
      this.showEditor();
    } catch (error) {
      console.error("GTFS upload error:", error);
      this.showStatus(statusEl, `Error: ${error.message}`, "error");
    }
  }

  /**
   * Parse GTFS zip file
   */
  async parseGtfsFile(file) {
    const zip = await JSZip.loadAsync(file);
    const gtfsData = {};

    for (const [filename, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      if (filename.startsWith("__MACOSX/") || filename.startsWith("._")) continue;

      const baseName = filename.split("/").pop();
      if (baseName.endsWith(".txt")) {
        const content = await zipEntry.async("text");
        gtfsData[baseName] = this.parseCSV(content);
      }
    }

    return gtfsData;
  }

  /**
   * Load GTFS from URL
   */
  async loadGtfsFromUrl(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const blob = await response.blob();
    return this.parseGtfsFile(blob);
  }

  /**
   * Parse CSV content
   */
  parseCSV(content) {
    const lines = content.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return [];

    const headers = this.parseCSVLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      data.push(row);
    }

    return data;
  }

  /**
   * Parse a single CSV line handling quotes
   */
  parseCSVLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  }

  /**
   * Process stops from GTFS data and group by name
   */
  processStops() {
    const stopsData = this.gtfsData["stops.txt"] || [];
    this.stops = stopsData;
    this.stopsByName = {};

    stopsData.forEach((stop) => {
      const name = stop.stop_name || stop.stop_id;
      if (!this.stopsByName[name]) {
        this.stopsByName[name] = [];
      }
      this.stopsByName[name].push(stop);
    });
  }

  /**
   * Handle JSON import
   */
  handleJsonImport() {
    const textarea = document.getElementById("directionJsonImport");
    const statusEl = document.getElementById("directionUploadStatus");
    const jsonText = textarea.value.trim();

    if (!jsonText) {
      this.showStatus(statusEl, "Please paste JSON configuration", "error");
      return;
    }

    try {
      const config = JSON.parse(jsonText);
      this.importConfig(config);
      this.showStatus(statusEl, "Configuration imported successfully", "success");
      this.showEditor();
    } catch (error) {
      console.error("JSON import error:", error);
      this.showStatus(statusEl, `Invalid JSON: ${error.message}`, "error");
    }
  }

  /**
   * Import configuration from JSON
   */
  importConfig(config) {
    const routeConfigs = config.directionConfigurationsByRouteKey;
    if (!routeConfigs) {
      throw new Error("Missing directionConfigurationsByRouteKey");
    }

    const routeKeys = Object.keys(routeConfigs);
    if (routeKeys.length === 0) {
      throw new Error("No route configurations found");
    }

    // Import first route
    this.routeKey = routeKeys[0];
    document.getElementById("routeKeyInput").value = this.routeKey;

    const directions = routeConfigs[this.routeKey];
    this.directions = directions.map((dir) => ({
      directionKey: dir.directionKey || "",
      directionId: dir.directionId || 0,
      tripDirectionHeadsignPattern: dir.tripDirectionHeadsignPattern || "",
      tripMergedHeadsignPattern: dir.tripMergedHeadsignPattern || "{tripHeadsign}",
      fallbackStopMergedHeadsignPattern:
        dir.fallbackStopMergedHeadsignPattern || "{stopHeadsign}",
      idFrom: dir.idFrom || "raw_stop_id",
      nodes: (dir.directionNodeConfigurationsByRowIndex || []).map((node) => ({
        id: this.nodeIdCounter++,
        ids: node.ids || [],
        name: node.name || "",
        column: node.column || 0,
        key: node.key || null,
        links: node.links || [],
        stopDirectionHeadsignPattern: node.stopDirectionHeadsignPattern || null,
      })),
    }));

    this.currentDirectionIndex = 0;
    this.updateDirectionSelector();
    this.loadDirectionSettings();
    this.renderDiagram();
    this.updateJsonOutput();
  }

  /**
   * Show status message
   */
  showStatus(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = "upload-status";
    if (type) {
      element.classList.add(type);
    }
  }

  /**
   * Show the editor panel
   */
  showEditor() {
    const editorPanel = document.getElementById("directionEditorPanel");
    const jsonPanel = document.getElementById("jsonOutputPanel");

    if (editorPanel) {
      editorPanel.style.display = "block";
    }
    if (jsonPanel) {
      jsonPanel.style.display = "block";
    }

    // Initialize with one direction if none exist
    if (this.directions.length === 0) {
      this.addDirection();
    } else {
      this.updateDirectionSelector();
      this.loadDirectionSettings();
      this.renderDiagram();
    }

    this.updateJsonOutput();
  }

  /**
   * Add a new direction
   */
  addDirection() {
    const newDirection = {
      directionKey: this.directions.length === 0 ? "West" : "East",
      directionId: this.directions.length,
      tripDirectionHeadsignPattern: "",
      tripMergedHeadsignPattern: "{tripHeadsign}",
      fallbackStopMergedHeadsignPattern: "{stopHeadsign}",
      idFrom: "raw_stop_id",
      nodes: [],
    };

    this.directions.push(newDirection);
    this.currentDirectionIndex = this.directions.length - 1;
    this.updateDirectionSelector();
    this.loadDirectionSettings();
    this.renderDiagram();
    this.updateJsonOutput();
  }

  /**
   * Delete current direction
   */
  deleteDirection() {
    if (this.directions.length <= 1) {
      alert("Cannot delete the only direction");
      return;
    }

    if (!confirm("Are you sure you want to delete this direction?")) {
      return;
    }

    this.directions.splice(this.currentDirectionIndex, 1);
    this.currentDirectionIndex = Math.min(
      this.currentDirectionIndex,
      this.directions.length - 1
    );
    this.updateDirectionSelector();
    this.loadDirectionSettings();
    this.renderDiagram();
    this.updateJsonOutput();
  }

  /**
   * Update direction selector dropdown
   */
  updateDirectionSelector() {
    const select = document.getElementById("directionSelect");
    if (!select) return;

    select.innerHTML = this.directions
      .map(
        (dir, index) =>
          `<option value="${index}" ${index === this.currentDirectionIndex ? "selected" : ""}>${dir.directionKey || `Direction ${index + 1}`}</option>`
      )
      .join("");

    // Show/hide delete button
    const deleteBtn = document.getElementById("deleteDirectionBtn");
    if (deleteBtn) {
      deleteBtn.style.display = this.directions.length > 1 ? "inline-block" : "none";
    }
  }

  /**
   * Load current direction settings into form
   */
  loadDirectionSettings() {
    const dir = this.directions[this.currentDirectionIndex];
    if (!dir) return;

    document.getElementById("directionKeyInput").value = dir.directionKey || "";
    document.getElementById("directionIdSelect").value = dir.directionId || 0;
    document.getElementById("tripHeadsignPattern").value =
      dir.tripDirectionHeadsignPattern || "";
    document.getElementById("idFromSelect").value = dir.idFrom || "raw_stop_id";
  }

  /**
   * Save current direction settings from form
   */
  saveDirectionSettings() {
    const dir = this.directions[this.currentDirectionIndex];
    if (!dir) return;

    dir.directionKey = document.getElementById("directionKeyInput").value;
    dir.directionId = parseInt(document.getElementById("directionIdSelect").value);
    dir.tripDirectionHeadsignPattern = document.getElementById("tripHeadsignPattern").value;
    dir.idFrom = document.getElementById("idFromSelect").value;

    this.updateDirectionSelector();
    this.updateJsonOutput();
  }

  /**
   * Get current direction
   */
  getCurrentDirection() {
    return this.directions[this.currentDirectionIndex];
  }

  /**
   * Add a stop node to current direction
   */
  addStopNode(column = null) {
    const dir = this.getCurrentDirection();
    if (!dir) return;

    // Determine column
    const columns = this.getColumns();
    const targetColumn = column !== null ? column : columns.length > 0 ? 0 : 0;

    const newNode = {
      id: this.nodeIdCounter++,
      ids: [],
      name: "",
      column: targetColumn,
      key: null,
      links: dir.nodes.length > 0 ? ["-1"] : [],
      stopDirectionHeadsignPattern: null,
    };

    dir.nodes.push(newNode);
    this.renderDiagram();
    this.updateJsonOutput();
  }

  /**
   * Add a new branch (column)
   */
  addBranch() {
    const dir = this.getCurrentDirection();
    if (!dir) return;

    const columns = this.getColumns();
    const newColumn = columns.length > 0 ? Math.max(...columns) + 1 : 1;

    const newNode = {
      id: this.nodeIdCounter++,
      ids: [],
      name: "",
      column: newColumn,
      key: null,
      links: [],
      stopDirectionHeadsignPattern: null,
    };

    dir.nodes.push(newNode);
    this.renderDiagram();
    this.updateJsonOutput();

    // Select the new branch in the dropdown
    const select = document.getElementById("addToColumnSelect");
    if (select) {
      select.value = newColumn;
    }
  }

  /**
   * Get unique columns in current direction
   */
  getColumns() {
    const dir = this.getCurrentDirection();
    if (!dir || !dir.nodes) return [];
    const columns = [...new Set(dir.nodes.map((n) => n.column || 0))];
    return columns.sort((a, b) => a - b);
  }

  /**
   * Delete a stop node
   */
  deleteStopNode(nodeId) {
    const dir = this.getCurrentDirection();
    if (!dir) return;

    const nodeIndex = dir.nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) return;

    const node = dir.nodes[nodeIndex];

    // Update links in other nodes that reference this node's key
    if (node.key) {
      dir.nodes.forEach((n) => {
        n.links = n.links.filter((link) => link !== node.key);
      });
    }

    dir.nodes.splice(nodeIndex, 1);
    this.renderDiagram();
    this.updateJsonOutput();
  }

  /**
   * Collapse all stop nodes
   */
  collapseAll() {
    const dir = this.getCurrentDirection();
    if (!dir) return;

    dir.nodes.forEach((node) => {
      this.collapsedNodes.add(node.id);
    });

    document.querySelectorAll(".stop-node").forEach((el) => {
      el.classList.add("collapsed");
    });
  }

  /**
   * Expand all stop nodes
   */
  expandAll() {
    this.collapsedNodes.clear();

    document.querySelectorAll(".stop-node").forEach((el) => {
      el.classList.remove("collapsed");
    });
  }

  /**
   * Update a stop node
   */
  updateStopNode(nodeId, updates) {
    const dir = this.getCurrentDirection();
    if (!dir) return;

    const node = dir.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    Object.assign(node, updates);
    this.updateJsonOutput();

    // Re-render if name changed (affects dropdowns)
    if ("name" in updates) {
      this.renderDiagram();
    }
  }

  /**
   * Render the diagram view
   */
  renderDiagram() {
    const container = document.getElementById("diagramContainer");
    if (!container) return;

    const dir = this.getCurrentDirection();
    if (!dir) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📍</div>
          <p>No direction selected. Add a direction to get started.</p>
        </div>
      `;
      this.updateColumnSelector();
      return;
    }

    const columns = this.getColumns();
    if (columns.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📍</div>
          <p>No stops added yet. Click "Add Stop" to begin.</p>
        </div>
      `;
      this.updateColumnSelector();
      return;
    }

    // Group nodes by column
    const nodesByColumn = {};
    columns.forEach((col) => {
      nodesByColumn[col] = dir.nodes.filter((n) => (n.column || 0) === col);
    });

    // Render columns with transit line visualization
    container.innerHTML = columns
      .map(
        (col) => `
        <div class="diagram-column" data-column="${col}">
          <div class="column-header">
            <span>Branch ${col}</span>
            <span class="column-number">${col}</span>
          </div>
          <div class="column-nodes">
            ${nodesByColumn[col].map((node, idx, arr) => this.renderStopWithLine(node, idx, arr.length, col)).join("")}
          </div>
        </div>
      `
      )
      .join("");

    // Bind node events
    this.bindNodeEvents();

    // Update column selector
    this.updateColumnSelector();
  }

  /**
   * Update the column selector dropdown with current columns
   */
  updateColumnSelector() {
    const select = document.getElementById("addToColumnSelect");
    if (!select) return;

    const columns = this.getColumns();
    const currentValue = select.value;

    // Always have at least column 0
    const availableColumns = columns.length > 0 ? columns : [0];

    select.innerHTML = availableColumns
      .map((col) => `<option value="${col}">Branch ${col}</option>`)
      .join("");

    // Restore previous selection if still valid
    if (availableColumns.includes(parseInt(currentValue))) {
      select.value = currentValue;
    }
  }

  /**
   * Render a stop with transit line visualization
   */
  renderStopWithLine(node, index, totalInColumn, column) {
    const isFirst = index === 0;
    const isLast = index === totalInColumn - 1;
    const hasKey = node.key && node.key.length > 0;
    const isMergePoint = node.links && node.links.length > 1;

    return `
      <div class="transit-line-container" data-node-id="${node.id}">
        <div class="transit-line-visual">
          ${!isFirst ? `<div class="transit-line-segment column-${column}"></div>` : '<div class="transit-line-segment first column-' + column + '"></div>'}
          <div class="transit-stop-marker column-${column} ${hasKey ? 'has-key' : ''} ${isMergePoint ? 'merge-point' : ''}"
               data-node-id="${node.id}"
               title="${node.name || 'Unnamed stop'}${hasKey ? ' [' + node.key + ']' : ''}${isMergePoint ? ' (merge point)' : ''}"></div>
          ${!isLast ? `<div class="transit-line-segment column-${column}"></div>` : '<div class="transit-line-segment last column-' + column + '"></div>'}
        </div>
        <div class="stop-form-container">
          ${this.renderStopNode(node, index)}
        </div>
      </div>
    `;
  }

  /**
   * Render a single stop node
   */
  renderStopNode(node, index) {
    const stopNames = Object.keys(this.stopsByName).sort();
    const selectedStops = node.name ? this.stopsByName[node.name] || [] : [];
    const hasKey = node.key && node.key.length > 0;
    const isMergePoint = node.links && node.links.length > 1;
    const isCollapsed = this.collapsedNodes && this.collapsedNodes.has(node.id);

    return `
      <div class="stop-node ${hasKey ? "has-key" : ""} ${isMergePoint ? "merge-point" : ""} ${isCollapsed ? "collapsed" : ""}" data-node-id="${node.id}">
        <div class="stop-node-header" data-toggle="${node.id}">
          <div class="stop-node-header-left">
            <button class="stop-node-toggle" data-toggle="${node.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <span class="stop-node-index">${index + 1}</span>
            <span class="stop-node-name">${node.name || "Select stop..."}</span>
            ${hasKey ? `<span class="stop-node-key-badge">${node.key}</span>` : ""}
          </div>
          <div class="stop-node-header-right">
            <button class="stop-node-delete" data-delete="${node.id}">&times;</button>
          </div>
        </div>

        <div class="stop-node-body">
          <div class="stop-field">
            <label>Stop Name:</label>
            <div class="stop-search-container">
              <input type="text" class="stop-search-input"
                data-node-id="${node.id}"
                value="${node.name || ""}"
                placeholder="Search stops...">
              <div class="stop-search-dropdown">
                ${stopNames.map((name) => `<div class="stop-search-option" data-name="${name}">${name}</div>`).join("")}
              </div>
            </div>
          </div>

          <div class="stop-field">
            <label>Stop IDs:</label>
            <div class="stop-ids-container">
              ${
                selectedStops.length > 0
                  ? selectedStops
                      .map(
                        (stop) => `
                    <div class="stop-id-checkbox">
                      <input type="checkbox"
                        id="stop-${node.id}-${stop.stop_id}"
                        data-node-id="${node.id}"
                        data-stop-id="${stop.stop_id}"
                        ${node.ids.includes(stop.stop_id) ? "checked" : ""}>
                      <label for="stop-${node.id}-${stop.stop_id}">${stop.stop_id}</label>
                    </div>
                  `
                      )
                      .join("")
                  : '<span style="font-size: 11px; color: #999;">Select a stop name first</span>'
              }
            </div>
          </div>

          <div class="stop-field">
            <label>Key (for branching):</label>
            <input type="text" class="key-input"
              data-node-id="${node.id}"
              value="${node.key || ""}"
              placeholder="e.g., IGEL">
          </div>

          <div class="stop-field">
            <label>Column/Branch:</label>
            <input type="number" class="column-input"
              data-node-id="${node.id}"
              value="${node.column || 0}"
              min="0" max="5">
          </div>

          <div class="links-section">
            <label>Links (connects from):</label>
            <div class="link-tags">
              ${(node.links || [])
                .map(
                  (link) => `
                <span class="link-tag ${link === "-1" ? "link-previous" : ""}">
                  ${link === "-1" ? "Previous" : link}
                  <button class="remove-link" data-node-id="${node.id}" data-link="${link}">&times;</button>
                </span>
              `
                )
                .join("")}
              <button class="add-link-btn" data-node-id="${node.id}">+ Add</button>
            </div>
          </div>

          <div class="headsign-field stop-field">
            <label>Stop Headsign Pattern (optional):</label>
            <input type="text" class="headsign-input"
              data-node-id="${node.id}"
              value="${node.stopDirectionHeadsignPattern || ""}"
              placeholder="e.g., Igelboda•Henriksdal">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Bind events for stop nodes
   */
  bindNodeEvents() {
    // Toggle collapse/expand
    document.querySelectorAll(".stop-node-header").forEach((header) => {
      header.addEventListener("click", (e) => {
        // Don't toggle if clicking delete button
        if (e.target.closest(".stop-node-delete")) return;

        const nodeId = parseInt(header.getAttribute("data-toggle"));
        if (isNaN(nodeId)) return;

        const stopNode = header.closest(".stop-node");
        if (this.collapsedNodes.has(nodeId)) {
          this.collapsedNodes.delete(nodeId);
          stopNode.classList.remove("collapsed");
        } else {
          this.collapsedNodes.add(nodeId);
          stopNode.classList.add("collapsed");
        }
      });
    });

    // Delete buttons
    document.querySelectorAll(".stop-node-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent toggle
        const nodeId = parseInt(e.target.getAttribute("data-delete"));
        this.deleteStopNode(nodeId);
      });
    });

    // Stop search inputs
    document.querySelectorAll(".stop-search-input").forEach((input) => {
      const dropdown = input.parentElement.querySelector(".stop-search-dropdown");

      input.addEventListener("focus", () => {
        dropdown.classList.add("active");
        this.filterStopDropdown(input, dropdown);
      });

      input.addEventListener("input", () => {
        this.filterStopDropdown(input, dropdown);
      });

      input.addEventListener("blur", () => {
        setTimeout(() => dropdown.classList.remove("active"), 150);
      });

      // Dropdown option clicks
      dropdown.querySelectorAll(".stop-search-option").forEach((option) => {
        option.addEventListener("click", () => {
          const name = option.getAttribute("data-name");
          const nodeId = parseInt(input.getAttribute("data-node-id"));
          input.value = name;

          // Auto-select all IDs for this stop name
          const stops = this.stopsByName[name] || [];
          const ids = stops.map((s) => s.stop_id);

          this.updateStopNode(nodeId, { name, ids });
        });
      });
    });

    // Stop ID checkboxes
    document.querySelectorAll('.stop-ids-container input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const nodeId = parseInt(e.target.getAttribute("data-node-id"));
        const stopId = e.target.getAttribute("data-stop-id");
        const dir = this.getCurrentDirection();
        const node = dir.nodes.find((n) => n.id === nodeId);

        if (node) {
          if (e.target.checked) {
            if (!node.ids.includes(stopId)) {
              node.ids.push(stopId);
            }
          } else {
            node.ids = node.ids.filter((id) => id !== stopId);
          }
          this.updateJsonOutput();
        }
      });
    });

    // Display name inputs
    document.querySelectorAll(".display-name-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const nodeId = parseInt(e.target.getAttribute("data-node-id"));
        this.updateStopNode(nodeId, { name: e.target.value });
      });
    });

    // Key inputs
    document.querySelectorAll(".key-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const nodeId = parseInt(e.target.getAttribute("data-node-id"));
        const key = e.target.value.trim() || null;
        this.updateStopNode(nodeId, { key });
        this.renderDiagram(); // Re-render to update styling
      });
    });

    // Column inputs
    document.querySelectorAll(".column-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const nodeId = parseInt(e.target.getAttribute("data-node-id"));
        const column = parseInt(e.target.value) || 0;
        this.updateStopNode(nodeId, { column });
        this.renderDiagram(); // Re-render to reorganize columns
      });
    });

    // Headsign inputs
    document.querySelectorAll(".headsign-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const nodeId = parseInt(e.target.getAttribute("data-node-id"));
        const value = e.target.value.trim() || null;
        this.updateStopNode(nodeId, { stopDirectionHeadsignPattern: value });
      });
    });

    // Remove link buttons
    document.querySelectorAll(".remove-link").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nodeId = parseInt(e.target.getAttribute("data-node-id"));
        const link = e.target.getAttribute("data-link");
        this.removeLink(nodeId, link);
      });
    });

    // Add link buttons
    document.querySelectorAll(".add-link-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const nodeId = parseInt(e.target.getAttribute("data-node-id"));
        this.showLinkModal(nodeId);
      });
    });
  }

  /**
   * Filter stop dropdown based on search input
   */
  filterStopDropdown(input, dropdown) {
    const searchTerm = input.value.toLowerCase();
    const options = dropdown.querySelectorAll(".stop-search-option");

    options.forEach((option) => {
      const name = option.getAttribute("data-name").toLowerCase();
      option.style.display = name.includes(searchTerm) ? "block" : "none";
    });
  }

  /**
   * Remove a link from a node
   */
  removeLink(nodeId, link) {
    const dir = this.getCurrentDirection();
    const node = dir.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.links = node.links.filter((l) => l !== link);
      this.renderDiagram();
      this.updateJsonOutput();
    }
  }

  /**
   * Show modal for adding links
   */
  showLinkModal(nodeId) {
    const dir = this.getCurrentDirection();
    const node = dir.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Get available link options
    const options = [
      { value: "-1", label: "Previous Stop (in same column)" },
    ];

    // Add nodes with keys
    dir.nodes.forEach((n) => {
      if (n.id !== nodeId && n.key) {
        options.push({ value: n.key, label: `${n.name} (${n.key})` });
      }
    });

    // Create modal
    const modal = document.createElement("div");
    modal.className = "link-modal-overlay";
    modal.innerHTML = `
      <div class="link-modal">
        <h4>Add Link to: ${node.name || "Stop"}</h4>
        ${options
          .map(
            (opt) => `
          <div class="link-option" data-value="${opt.value}">
            <input type="checkbox" ${node.links.includes(opt.value) ? "checked" : ""}>
            <span>${opt.label}</span>
          </div>
        `
          )
          .join("")}
        <div class="link-modal-actions">
          <button class="secondary-btn cancel-btn">Cancel</button>
          <button class="primary-btn save-btn">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle option clicks
    modal.querySelectorAll(".link-option").forEach((option) => {
      option.addEventListener("click", () => {
        const checkbox = option.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        option.classList.toggle("selected", checkbox.checked);
      });
    });

    // Cancel button
    modal.querySelector(".cancel-btn").addEventListener("click", () => {
      modal.remove();
    });

    // Save button
    modal.querySelector(".save-btn").addEventListener("click", () => {
      const selectedLinks = [];
      modal.querySelectorAll(".link-option").forEach((option) => {
        const checkbox = option.querySelector('input[type="checkbox"]');
        if (checkbox.checked) {
          selectedLinks.push(option.getAttribute("data-value"));
        }
      });
      node.links = selectedLinks;
      this.renderDiagram();
      this.updateJsonOutput();
      modal.remove();
    });

    // Close on overlay click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Initialize the map
   */
  initializeMap() {
    if (this.map) return;

    const container = document.getElementById("directionMapContainer");
    if (!container) return;

    this.map = L.map(container).setView([0, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(this.map);
  }

  /**
   * Render stops on map
   */
  renderMap() {
    if (!this.map) return;

    // Clear existing markers and lines
    this.mapMarkers.forEach((m) => this.map.removeLayer(m));
    this.mapLines.forEach((l) => this.map.removeLayer(l));
    this.mapMarkers = [];
    this.mapLines = [];

    const dir = this.getCurrentDirection();
    if (!dir || !dir.nodes || dir.nodes.length === 0) return;

    const bounds = [];
    const nodePositions = {};

    // Column colors
    const columnColors = ["#2c5aa0", "#4caf50", "#ff9800", "#9c27b0", "#f44336"];

    // Create markers for each node
    dir.nodes.forEach((node, index) => {
      if (!node.ids || node.ids.length === 0) return;

      // Get first stop with coordinates
      let lat, lng;
      for (const id of node.ids) {
        const stop = this.stops.find((s) => s.stop_id === id);
        if (stop && stop.stop_lat && stop.stop_lon) {
          lat = parseFloat(stop.stop_lat);
          lng = parseFloat(stop.stop_lon);
          break;
        }
      }

      if (!lat || !lng) return;

      bounds.push([lat, lng]);
      nodePositions[node.id] = [lat, lng];

      const color = columnColors[node.column % columnColors.length];

      const marker = L.circleMarker([lat, lng], {
        radius: 10,
        fillColor: color,
        color: "white",
        weight: 3,
        fillOpacity: 0.9,
      }).addTo(this.map);

      marker.bindPopup(`
        <strong>${node.name}</strong><br>
        Column: ${node.column}<br>
        ${node.key ? `Key: ${node.key}<br>` : ""}
        IDs: ${node.ids.join(", ")}
      `);

      this.mapMarkers.push(marker);

      // Add label
      const label = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "stop-label",
          html: `<div style="background:white;padding:2px 6px;border-radius:3px;font-size:11px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${index + 1}. ${node.name}</div>`,
          iconSize: [100, 20],
          iconAnchor: [50, -10],
        }),
      }).addTo(this.map);
      this.mapMarkers.push(label);
    });

    // Draw connection lines based on links
    dir.nodes.forEach((node, index) => {
      if (!nodePositions[node.id]) return;

      node.links.forEach((link) => {
        let fromPos;

        if (link === "-1") {
          // Find previous node in same column
          const sameColumnNodes = dir.nodes.filter((n) => n.column === node.column);
          const myIndex = sameColumnNodes.indexOf(node);
          if (myIndex > 0) {
            const prevNode = sameColumnNodes[myIndex - 1];
            fromPos = nodePositions[prevNode.id];
          }
        } else {
          // Find node with matching key
          const linkedNode = dir.nodes.find((n) => n.key === link);
          if (linkedNode) {
            fromPos = nodePositions[linkedNode.id];
          }
        }

        if (fromPos && nodePositions[node.id]) {
          const line = L.polyline([fromPos, nodePositions[node.id]], {
            color: link === "-1" ? "#666" : "#ff9800",
            weight: 3,
            opacity: 0.7,
          }).addTo(this.map);
          this.mapLines.push(line);
        }
      });
    });

    // Fit bounds
    if (bounds.length > 0) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  /**
   * Generate JSON output
   */
  generateJson() {
    const output = {
      directionConfigurationsByRouteKey: {},
    };

    if (this.routeKey) {
      output.directionConfigurationsByRouteKey[this.routeKey] = this.directions.map(
        (dir) => {
          const result = {
            directionKey: dir.directionKey,
            tripDirectionHeadsignPattern: dir.tripDirectionHeadsignPattern,
            directionId: dir.directionId,
            tripMergedHeadsignPattern: dir.tripMergedHeadsignPattern || "{tripHeadsign}",
            fallbackStopMergedHeadsignPattern:
              dir.fallbackStopMergedHeadsignPattern || "{stopHeadsign}",
            idFrom: dir.idFrom || "raw_stop_id",
            directionNodeConfigurationsByRowIndex: dir.nodes.map((node) => {
              const nodeConfig = {
                ids: node.ids,
                links: node.links,
                name: node.name,
              };

              // Only include optional fields if they have values
              if (node.column !== undefined && node.column !== 0) {
                nodeConfig.column = node.column;
              }
              if (node.key) {
                nodeConfig.key = node.key;
              }
              if (node.stopDirectionHeadsignPattern) {
                nodeConfig.stopDirectionHeadsignPattern = node.stopDirectionHeadsignPattern;
              }

              return nodeConfig;
            }),
          };

          return result;
        }
      );
    }

    return output;
  }

  /**
   * Update JSON output panel
   */
  updateJsonOutput() {
    const outputEl = document.getElementById("jsonOutput");
    if (!outputEl) return;

    const json = this.generateJson();
    outputEl.textContent = JSON.stringify(json, null, 2);
  }

  /**
   * Copy JSON to clipboard
   */
  async copyJsonToClipboard() {
    const json = this.generateJson();
    const text = JSON.stringify(json, null, 2);

    try {
      await navigator.clipboard.writeText(text);
      alert("JSON copied to clipboard!");
    } catch (err) {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      alert("JSON copied to clipboard!");
    }
  }
}

// Global instance
window.directionConfigEditor = new DirectionConfigEditor();
