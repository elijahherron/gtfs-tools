/**
 * GTFS & GTFS-rt Validator
 * Validates static GTFS feeds, GTFS realtime feeds, and their cross-compatibility
 */
class GTFSValidator {
  constructor() {
    this.staticGtfsData = null;
    this.realtimeData = null;
    this.staticValidationResults = [];
    this.realtimeValidationResults = [];
    this.combinedValidationResults = [];
  }

  /**
   * Initialize the validator and bind event listeners
   */
  initialize() {
    this.bindStaticValidation();
    this.bindRealtimeValidation();
    this.bindCombinedValidation();
    this.bindProxyToggle();
    this.updateCombinedSources();
  }

  /**
   * Bind proxy checkbox toggle
   */
  bindProxyToggle() {
    const checkbox = document.getElementById("useProxyCheckbox");
    const proxyRow = document.getElementById("proxyUrlRow");
    if (checkbox && proxyRow) {
      checkbox.addEventListener("change", () => {
        proxyRow.style.display = checkbox.checked ? "flex" : "none";
      });
    }
  }

  /**
   * Update combined validation source indicators
   */
  updateCombinedSources() {
    // Watch for changes in static inputs
    const staticFile = document.getElementById("staticGtfsUpload");
    const staticUrl = document.getElementById("staticGtfsUrl");
    const realtimeUrl = document.getElementById("realtimeUrl");

    if (staticFile) {
      staticFile.addEventListener("change", () => this.refreshCombinedIndicators());
    }
    if (staticUrl) {
      staticUrl.addEventListener("input", () => this.refreshCombinedIndicators());
    }
    if (realtimeUrl) {
      realtimeUrl.addEventListener("input", () => this.refreshCombinedIndicators());
    }

    this.refreshCombinedIndicators();
  }

  /**
   * Refresh the combined section indicators
   */
  refreshCombinedIndicators() {
    const staticFile = document.getElementById("staticGtfsUpload");
    const staticUrl = document.getElementById("staticGtfsUrl");
    const realtimeUrl = document.getElementById("realtimeUrl");

    const staticValue = document.getElementById("combinedStaticValue");
    const staticIndicator = document.getElementById("combinedStaticIndicator");
    const realtimeValue = document.getElementById("combinedRealtimeValue");
    const realtimeIndicator = document.getElementById("combinedRealtimeIndicator");

    // Static source
    if (staticValue && staticIndicator) {
      if (this.staticGtfsData) {
        const fileCount = Object.keys(this.staticGtfsData).length;
        staticValue.textContent = `Loaded (${fileCount} files)`;
        staticIndicator.className = "source-status ready";
        staticIndicator.textContent = "Ready";
      } else if (staticFile && staticFile.files[0]) {
        staticValue.textContent = staticFile.files[0].name;
        staticIndicator.className = "source-status pending";
        staticIndicator.textContent = "Pending";
      } else if (staticUrl && staticUrl.value.trim()) {
        const url = staticUrl.value.trim();
        staticValue.textContent = url.length > 40 ? url.substring(0, 40) + "..." : url;
        staticIndicator.className = "source-status pending";
        staticIndicator.textContent = "Pending";
      } else {
        staticValue.textContent = "Not loaded - enter above";
        staticIndicator.className = "source-status";
        staticIndicator.textContent = "";
      }
    }

    // Realtime source
    if (realtimeValue && realtimeIndicator) {
      if (this.realtimeData) {
        const entityCount = this.realtimeData.entity ? this.realtimeData.entity.length : 0;
        realtimeValue.textContent = `Loaded (${entityCount} entities)`;
        realtimeIndicator.className = "source-status ready";
        realtimeIndicator.textContent = "Ready";
      } else if (realtimeUrl && realtimeUrl.value.trim()) {
        const url = realtimeUrl.value.trim();
        realtimeValue.textContent = url.length > 40 ? url.substring(0, 40) + "..." : url;
        realtimeIndicator.className = "source-status pending";
        realtimeIndicator.textContent = "Pending";
      } else {
        realtimeValue.textContent = "Not loaded - enter above";
        realtimeIndicator.className = "source-status";
        realtimeIndicator.textContent = "";
      }
    }
  }

  /**
   * Bind static GTFS validation events
   */
  bindStaticValidation() {
    const validateBtn = document.getElementById("validateStaticBtn");
    if (validateBtn) {
      validateBtn.addEventListener("click", () => this.validateStaticGtfs());
    }
  }

  /**
   * Bind realtime validation events
   */
  bindRealtimeValidation() {
    const validateBtn = document.getElementById("validateRealtimeBtn");
    if (validateBtn) {
      validateBtn.addEventListener("click", () => this.validateRealtimeGtfs());
    }
  }

  /**
   * Bind combined validation events
   */
  bindCombinedValidation() {
    const validateBtn = document.getElementById("validateCombinedBtn");
    if (validateBtn) {
      validateBtn.addEventListener("click", () => this.validateCombined());
    }
  }

  /**
   * Get the proxy URL if enabled
   */
  getProxyUrl() {
    const useProxy = document.getElementById("useProxyCheckbox");
    const proxyUrl = document.getElementById("proxyUrl");
    if (useProxy && useProxy.checked && proxyUrl && proxyUrl.value.trim()) {
      return proxyUrl.value.trim();
    }
    return null;
  }

  /**
   * Build the fetch URL with optional proxy
   */
  buildFetchUrl(targetUrl) {
    const proxy = this.getProxyUrl();
    if (proxy) {
      // Encode the target URL and append to proxy
      return proxy + encodeURIComponent(targetUrl);
    }
    return targetUrl;
  }

  // ============================================
  // STATIC GTFS VALIDATION
  // ============================================

  /**
   * Validate static GTFS feed
   */
  async validateStaticGtfs() {
    const fileInput = document.getElementById("staticGtfsUpload");
    const urlInput = document.getElementById("staticGtfsUrl");
    const statusEl = document.getElementById("staticValidationStatus");
    const resultsEl = document.getElementById("staticValidationResults");
    const summaryEl = document.getElementById("staticSummary");
    const detailsEl = document.getElementById("staticDetails");

    const file = fileInput.files[0];
    const url = urlInput.value.trim();

    if (!file && !url) {
      this.showStatus(statusEl, "Please select a file or enter a URL", "error");
      return;
    }

    try {
      this.showStatus(statusEl, "Loading GTFS data...", "loading");
      resultsEl.style.display = "none";

      let gtfsData;
      if (file) {
        gtfsData = await this.parseGtfsFile(file);
      } else {
        gtfsData = await this.loadGtfsFromUrl(url);
      }

      this.staticGtfsData = gtfsData;
      this.showStatus(statusEl, "Validating GTFS data...", "loading");

      // Run validation
      this.staticValidationResults = [];
      this.validateRequiredFiles(gtfsData);
      this.validateRequiredFields(gtfsData);
      this.validateFieldFormats(gtfsData);
      this.validateFeedExpiry(gtfsData);
      this.validateReferentialIntegrity(gtfsData);
      this.validateDataQuality(gtfsData);

      // Display results
      this.displayStaticResults(summaryEl, detailsEl);
      resultsEl.style.display = "block";
      this.showStatus(statusEl, "Validation complete", "success");
      this.refreshCombinedIndicators();
    } catch (error) {
      console.error("Static GTFS validation error:", error);
      this.showStatus(statusEl, `Error: ${error.message}`, "error");
    }
  }

  /**
   * Validate required GTFS files exist
   */
  validateRequiredFiles(gtfsData) {
    const requiredFiles = GTFS_SPEC.required_files;
    const presentFiles = Object.keys(gtfsData);

    requiredFiles.forEach((file) => {
      if (presentFiles.includes(file)) {
        this.staticValidationResults.push({
          type: "pass",
          category: "Required Files",
          message: `Required file present: ${file}`,
          file: file,
        });
      } else {
        this.staticValidationResults.push({
          type: "error",
          category: "Required Files",
          message: `Missing required file: ${file}`,
          file: file,
        });
      }
    });

    // Check for optional files (informational)
    GTFS_SPEC.optional_files.forEach((file) => {
      if (presentFiles.includes(file)) {
        this.staticValidationResults.push({
          type: "info",
          category: "Optional Files",
          message: `Optional file present: ${file}`,
          file: file,
        });
      }
    });
  }

  /**
   * Validate required fields in each file
   */
  validateRequiredFields(gtfsData) {
    Object.entries(GTFS_SPEC.files).forEach(([fileName, spec]) => {
      const data = gtfsData[fileName];
      if (!data || data.length === 0) return;

      const headers = Object.keys(data[0] || {});

      // Check required fields exist in headers
      spec.required_fields.forEach((field) => {
        if (headers.includes(field)) {
          this.staticValidationResults.push({
            type: "pass",
            category: "Required Fields",
            message: `Required field present: ${field}`,
            file: fileName,
          });
        } else {
          this.staticValidationResults.push({
            type: "error",
            category: "Required Fields",
            message: `Missing required field: ${field}`,
            file: fileName,
          });
        }
      });

      // Check required fields have values (sample first 100 rows)
      const sampleSize = Math.min(data.length, 100);
      const emptyFieldCounts = {};

      for (let i = 0; i < sampleSize; i++) {
        const row = data[i];
        spec.required_fields.forEach((field) => {
          if (row[field] === undefined || row[field] === null || row[field] === "") {
            const key = `${fileName}:${field}`;
            emptyFieldCounts[key] = (emptyFieldCounts[key] || 0) + 1;
          }
        });
      }

      // Report empty field errors
      Object.entries(emptyFieldCounts).forEach(([key, count]) => {
        const [file, field] = key.split(":");
        if (count <= 3) {
          this.staticValidationResults.push({
            type: "error",
            category: "Required Fields",
            message: `Empty required field: ${field} (${count} occurrences)`,
            file: file,
          });
        } else {
          this.staticValidationResults.push({
            type: "error",
            category: "Required Fields",
            message: `Empty required field: ${field} (${count}+ occurrences in sample)`,
            file: file,
          });
        }
      });
    });
  }

  /**
   * Validate field formats
   */
  validateFieldFormats(gtfsData) {
    const FIELD_VALIDATIONS = {
      stop_lat: { validator: "latitude", message: "Invalid latitude" },
      stop_lon: { validator: "longitude", message: "Invalid longitude" },
      shape_pt_lat: { validator: "latitude", message: "Invalid latitude" },
      shape_pt_lon: { validator: "longitude", message: "Invalid longitude" },
      arrival_time: { validator: "time", message: "Invalid time format (expected H:MM:SS)" },
      departure_time: { validator: "time", message: "Invalid time format (expected H:MM:SS)" },
      start_time: { validator: "time", message: "Invalid time format" },
      end_time: { validator: "time", message: "Invalid time format" },
      start_date: { validator: "date", message: "Invalid date format (expected YYYYMMDD)" },
      end_date: { validator: "date", message: "Invalid date format (expected YYYYMMDD)" },
      date: { validator: "date", message: "Invalid date format (expected YYYYMMDD)" },
      agency_url: { validator: "url", message: "Invalid URL" },
      route_url: { validator: "url", message: "Invalid URL", optional: true },
      stop_url: { validator: "url", message: "Invalid URL", optional: true },
      agency_email: { validator: "email", message: "Invalid email", optional: true },
      route_color: { validator: "color", message: "Invalid color (expected 6-char hex)", optional: true },
      route_text_color: { validator: "color", message: "Invalid color (expected 6-char hex)", optional: true },
      route_type: { validator: "route_type", message: "Invalid route type" },
    };

    Object.entries(gtfsData).forEach(([fileName, data]) => {
      if (!data || data.length === 0) return;

      const sampleSize = Math.min(data.length, 100); // Sample for performance
      const errorCounts = {};

      for (let i = 0; i < sampleSize; i++) {
        const row = data[i];
        Object.entries(row).forEach(([field, value]) => {
          const validation = FIELD_VALIDATIONS[field];
          if (!validation) return;
          if (validation.optional && (!value || value === "")) return;
          if (!value || value === "") return;

          const validator = GTFS_SPEC.validators[validation.validator];
          if (validator && !validator(value)) {
            const key = `${fileName}:${field}`;
            errorCounts[key] = (errorCounts[key] || 0) + 1;
          }
        });
      }

      // Report field format errors (aggregated)
      Object.entries(errorCounts).forEach(([key, count]) => {
        const [file, field] = key.split(":");
        this.staticValidationResults.push({
          type: "error",
          category: "Field Format",
          message: `${FIELD_VALIDATIONS[field].message}: ${count} invalid values in ${field}`,
          file: file,
          field: field,
        });
      });
    });

    // If no format errors, add pass
    if (this.staticValidationResults.filter((r) => r.category === "Field Format").length === 0) {
      this.staticValidationResults.push({
        type: "pass",
        category: "Field Format",
        message: "All field formats are valid",
      });
    }
  }

  /**
   * Validate feed expiry dates
   */
  validateFeedExpiry(gtfsData) {
    const today = new Date();
    const todayStr = this.formatDate(today);
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysStr = this.formatDate(thirtyDaysFromNow);

    // Check feed_info.txt
    const feedInfo = gtfsData["feed_info.txt"];
    if (feedInfo && feedInfo.length > 0) {
      const info = feedInfo[0];
      if (info.feed_end_date) {
        const endDate = info.feed_end_date;
        if (endDate < todayStr) {
          this.staticValidationResults.push({
            type: "error",
            category: "Feed Expiry",
            message: `Feed has expired! End date: ${this.formatDateDisplay(endDate)}`,
            file: "feed_info.txt",
          });
        } else if (endDate < thirtyDaysStr) {
          this.staticValidationResults.push({
            type: "warning",
            category: "Feed Expiry",
            message: `Feed expires soon: ${this.formatDateDisplay(endDate)}`,
            file: "feed_info.txt",
          });
        } else {
          this.staticValidationResults.push({
            type: "pass",
            category: "Feed Expiry",
            message: `Feed valid until: ${this.formatDateDisplay(endDate)}`,
            file: "feed_info.txt",
          });
        }
      }

      if (info.feed_start_date) {
        const startDate = info.feed_start_date;
        if (startDate > todayStr) {
          this.staticValidationResults.push({
            type: "warning",
            category: "Feed Expiry",
            message: `Feed not yet active. Start date: ${this.formatDateDisplay(startDate)}`,
            file: "feed_info.txt",
          });
        }
      }
    }

    // Check calendar.txt
    const calendar = gtfsData["calendar.txt"];
    if (calendar && calendar.length > 0) {
      let hasActiveService = false;
      let latestEndDate = "00000000";
      let earliestStartDate = "99999999";

      calendar.forEach((service) => {
        if (service.end_date >= todayStr && service.start_date <= todayStr) {
          hasActiveService = true;
        }
        if (service.end_date > latestEndDate) {
          latestEndDate = service.end_date;
        }
        if (service.start_date < earliestStartDate) {
          earliestStartDate = service.start_date;
        }
      });

      if (!hasActiveService) {
        this.staticValidationResults.push({
          type: "warning",
          category: "Feed Expiry",
          message: "No currently active service in calendar.txt",
          file: "calendar.txt",
        });
      }

      if (latestEndDate < todayStr) {
        this.staticValidationResults.push({
          type: "error",
          category: "Feed Expiry",
          message: `All calendar services have ended. Latest end: ${this.formatDateDisplay(latestEndDate)}`,
          file: "calendar.txt",
        });
      } else if (latestEndDate < thirtyDaysStr) {
        this.staticValidationResults.push({
          type: "warning",
          category: "Feed Expiry",
          message: `Calendar services ending soon. Latest end: ${this.formatDateDisplay(latestEndDate)}`,
          file: "calendar.txt",
        });
      }
    }
  }

  /**
   * Validate referential integrity between files
   */
  validateReferentialIntegrity(gtfsData) {
    // Build lookup sets
    const agencyIds = new Set((gtfsData["agency.txt"] || []).map((a) => a.agency_id));
    const stopIds = new Set((gtfsData["stops.txt"] || []).map((s) => s.stop_id));
    const routeIds = new Set((gtfsData["routes.txt"] || []).map((r) => r.route_id));
    const tripIds = new Set((gtfsData["trips.txt"] || []).map((t) => t.trip_id));
    const serviceIds = new Set([
      ...(gtfsData["calendar.txt"] || []).map((c) => c.service_id),
      ...(gtfsData["calendar_dates.txt"] || []).map((c) => c.service_id),
    ]);
    const shapeIds = new Set((gtfsData["shapes.txt"] || []).map((s) => s.shape_id));

    let hasErrors = false;

    // Validate routes -> agency
    if (gtfsData["routes.txt"] && agencyIds.size > 1) {
      let missingAgency = 0;
      gtfsData["routes.txt"].forEach((route) => {
        if (route.agency_id && !agencyIds.has(route.agency_id)) {
          missingAgency++;
        }
      });
      if (missingAgency > 0) {
        hasErrors = true;
        this.staticValidationResults.push({
          type: "error",
          category: "Referential Integrity",
          message: `${missingAgency} routes reference non-existent agency_id`,
          file: "routes.txt",
        });
      }
    }

    // Validate trips -> routes, services, shapes
    if (gtfsData["trips.txt"]) {
      let missingRoute = 0, missingService = 0, missingShape = 0;
      gtfsData["trips.txt"].forEach((trip) => {
        if (!routeIds.has(trip.route_id)) missingRoute++;
        if (!serviceIds.has(trip.service_id)) missingService++;
        if (trip.shape_id && shapeIds.size > 0 && !shapeIds.has(trip.shape_id)) missingShape++;
      });

      if (missingRoute > 0) {
        hasErrors = true;
        this.staticValidationResults.push({
          type: "error",
          category: "Referential Integrity",
          message: `${missingRoute} trips reference non-existent route_id`,
          file: "trips.txt",
        });
      }
      if (missingService > 0) {
        hasErrors = true;
        this.staticValidationResults.push({
          type: "error",
          category: "Referential Integrity",
          message: `${missingService} trips reference non-existent service_id`,
          file: "trips.txt",
        });
      }
      if (missingShape > 0) {
        this.staticValidationResults.push({
          type: "warning",
          category: "Referential Integrity",
          message: `${missingShape} trips reference non-existent shape_id`,
          file: "trips.txt",
        });
      }
    }

    // Validate stop_times -> trips, stops (sample)
    if (gtfsData["stop_times.txt"]) {
      let missingTrip = 0, missingStop = 0;
      const sampleSize = Math.min(gtfsData["stop_times.txt"].length, 1000);

      for (let i = 0; i < sampleSize; i++) {
        const stopTime = gtfsData["stop_times.txt"][i];
        if (!tripIds.has(stopTime.trip_id)) missingTrip++;
        if (!stopIds.has(stopTime.stop_id)) missingStop++;
      }

      if (missingTrip > 0) {
        hasErrors = true;
        this.staticValidationResults.push({
          type: "error",
          category: "Referential Integrity",
          message: `${missingTrip} stop_times reference non-existent trip_id (in sample)`,
          file: "stop_times.txt",
        });
      }
      if (missingStop > 0) {
        hasErrors = true;
        this.staticValidationResults.push({
          type: "error",
          category: "Referential Integrity",
          message: `${missingStop} stop_times reference non-existent stop_id (in sample)`,
          file: "stop_times.txt",
        });
      }
    }

    if (!hasErrors) {
      this.staticValidationResults.push({
        type: "pass",
        category: "Referential Integrity",
        message: "All file cross-references are valid",
      });
    }
  }

  /**
   * Validate data quality
   */
  validateDataQuality(gtfsData) {
    // Check for duplicate IDs
    const checkDuplicates = (data, keyField, fileName) => {
      if (!data || !keyField) return false;
      const seen = new Set();
      const duplicates = new Set();
      data.forEach((row) => {
        const key = row[keyField];
        if (seen.has(key)) {
          duplicates.add(key);
        }
        seen.add(key);
      });
      if (duplicates.size > 0) {
        this.staticValidationResults.push({
          type: "error",
          category: "Data Quality",
          message: `${duplicates.size} duplicate ${keyField} values found`,
          file: fileName,
        });
        return true;
      }
      return false;
    };

    let hasDuplicates = false;
    Object.entries(GTFS_SPEC.files).forEach(([fileName, spec]) => {
      if (spec.key_field && gtfsData[fileName]) {
        if (checkDuplicates(gtfsData[fileName], spec.key_field, fileName)) {
          hasDuplicates = true;
        }
      }
    });

    if (!hasDuplicates) {
      this.staticValidationResults.push({
        type: "pass",
        category: "Data Quality",
        message: "No duplicate IDs found",
      });
    }

    // Record counts (informational)
    Object.entries(gtfsData).forEach(([fileName, data]) => {
      if (data && data.length > 0) {
        this.staticValidationResults.push({
          type: "info",
          category: "Statistics",
          message: `${fileName}: ${data.length.toLocaleString()} records`,
          file: fileName,
        });
      }
    });
  }

  /**
   * Display static validation results
   */
  displayStaticResults(summaryEl, detailsEl) {
    this.displayResults(this.staticValidationResults, summaryEl, detailsEl);
  }

  // ============================================
  // GTFS REALTIME VALIDATION
  // ============================================

  /**
   * Validate GTFS realtime feed
   */
  async validateRealtimeGtfs() {
    const urlInput = document.getElementById("realtimeUrl");
    const feedTypeSelect = document.getElementById("feedTypeSelect");
    const feedType = feedTypeSelect ? feedTypeSelect.value : "trip_update";
    const statusEl = document.getElementById("realtimeValidationStatus");
    const resultsEl = document.getElementById("realtimeValidationResults");
    const summaryEl = document.getElementById("realtimeSummary");
    const detailsEl = document.getElementById("realtimeDetails");

    const url = urlInput.value.trim();

    if (!url) {
      this.showStatus(statusEl, "Please enter a GTFS-rt feed URL", "error");
      return;
    }

    try {
      this.showStatus(statusEl, "Fetching GTFS-rt feed...", "loading");
      resultsEl.style.display = "none";

      const data = await this.fetchRealtimeFeed(url);
      this.realtimeData = data;

      this.showStatus(statusEl, "Validating GTFS-rt feed...", "loading");

      // Run validation
      this.realtimeValidationResults = [];
      this.validateRealtimeHeader(data);
      this.validateRealtimeEntities(data, feedType);
      this.validateRealtimeTimestamps(data);

      // Display results
      this.displayRealtimeResults(summaryEl, detailsEl);
      resultsEl.style.display = "block";
      this.showStatus(statusEl, "Validation complete", "success");
      this.refreshCombinedIndicators();
    } catch (error) {
      console.error("GTFS-rt validation error:", error);
      this.showStatus(statusEl, `Error: ${error.message}`, "error");
    }
  }

  /**
   * Fetch and parse GTFS-rt feed
   */
  async fetchRealtimeFeed(url) {
    const fetchUrl = this.buildFetchUrl(url);

    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";

      // Try to parse as JSON if it looks like JSON
      if (contentType.includes("application/json") || contentType.includes("text/json")) {
        return await response.json();
      }

      // Get as array buffer for binary/protobuf
      const buffer = await response.arrayBuffer();
      return this.parseProtobuf(buffer);
    } catch (error) {
      if (error.message.includes("Failed to fetch") || error.name === "TypeError") {
        const proxy = this.getProxyUrl();
        if (!proxy) {
          throw new Error(
            "Unable to fetch feed due to CORS restrictions. Enable 'Use CORS proxy' option above."
          );
        }
        throw new Error(
          `Unable to fetch feed. The CORS proxy may be unavailable or the URL may be invalid. Original error: ${error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Parse Protocol Buffer data (simplified parser)
   */
  parseProtobuf(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length === 0) {
      throw new Error("Empty response received");
    }

    // Check for common JSON start characters (in case it's actually JSON)
    if (bytes[0] === 123 || bytes[0] === 91) {
      const text = new TextDecoder().decode(buffer);
      return JSON.parse(text);
    }

    // Return a structure indicating protobuf data was received
    // In production, you'd use protobuf.js to decode this
    return {
      _protobuf: true,
      _size: bytes.length,
      header: {
        gtfs_realtime_version: "2.0 (protobuf - limited parsing)",
        timestamp: Math.floor(Date.now() / 1000),
      },
      entity: [],
    };
  }

  /**
   * Validate GTFS-rt header
   */
  validateRealtimeHeader(data) {
    if (!data) {
      this.realtimeValidationResults.push({
        type: "error",
        category: "Feed Structure",
        message: "No data received from feed",
      });
      return;
    }

    if (data._protobuf) {
      this.realtimeValidationResults.push({
        type: "info",
        category: "Feed Format",
        message: `Received Protocol Buffer data (${data._size.toLocaleString()} bytes). Full validation requires protobuf.js library.`,
      });
      this.realtimeValidationResults.push({
        type: "pass",
        category: "Feed Format",
        message: "Feed is accessible and returning data",
      });
      return;
    }

    // Check for header
    const header = data.header;
    if (!header) {
      this.realtimeValidationResults.push({
        type: "error",
        category: "Feed Structure",
        message: "Missing feed header",
      });
    } else {
      // Version
      if (header.gtfs_realtime_version) {
        this.realtimeValidationResults.push({
          type: "pass",
          category: "Feed Header",
          message: `GTFS-rt version: ${header.gtfs_realtime_version}`,
        });
      } else {
        this.realtimeValidationResults.push({
          type: "warning",
          category: "Feed Header",
          message: "Missing gtfs_realtime_version in header",
        });
      }

      // Timestamp
      if (header.timestamp) {
        const feedTime = new Date(header.timestamp * 1000);
        const now = new Date();
        const ageMinutes = (now - feedTime) / (1000 * 60);

        if (ageMinutes < 0) {
          this.realtimeValidationResults.push({
            type: "warning",
            category: "Feed Header",
            message: `Feed timestamp is in the future: ${feedTime.toISOString()}`,
          });
        } else if (ageMinutes > 5) {
          this.realtimeValidationResults.push({
            type: "warning",
            category: "Feed Header",
            message: `Feed is ${Math.round(ageMinutes)} minutes old (timestamp: ${feedTime.toISOString()})`,
          });
        } else {
          this.realtimeValidationResults.push({
            type: "pass",
            category: "Feed Header",
            message: `Feed timestamp: ${feedTime.toISOString()} (${Math.round(ageMinutes)} min ago)`,
          });
        }
      } else {
        this.realtimeValidationResults.push({
          type: "warning",
          category: "Feed Header",
          message: "Missing timestamp in header",
        });
      }

      // Incrementality
      if (header.incrementality !== undefined) {
        const incrementalityMap = { 0: "FULL_DATASET", 1: "DIFFERENTIAL" };
        this.realtimeValidationResults.push({
          type: "info",
          category: "Feed Header",
          message: `Incrementality: ${incrementalityMap[header.incrementality] || header.incrementality}`,
        });
      }
    }
  }

  /**
   * Validate GTFS-rt entities
   */
  validateRealtimeEntities(data, expectedType) {
    if (data._protobuf) return;

    const entities = data.entity || [];

    if (entities.length === 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category: "Entities",
        message: "Feed contains no entities",
      });
      return;
    }

    this.realtimeValidationResults.push({
      type: "info",
      category: "Statistics",
      message: `Feed contains ${entities.length.toLocaleString()} entities`,
    });

    // Count entity types
    let tripUpdates = 0, vehiclePositions = 0, alerts = 0, missingIds = 0;

    entities.forEach((entity) => {
      if (!entity.id) missingIds++;
      if (entity.trip_update || entity.tripUpdate) tripUpdates++;
      if (entity.vehicle || entity.vehiclePosition) vehiclePositions++;
      if (entity.alert) alerts++;
    });

    if (missingIds > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category: "Entity Structure",
        message: `${missingIds} entities missing required 'id' field`,
      });
    }

    // Report entity type counts
    if (tripUpdates > 0) {
      this.realtimeValidationResults.push({
        type: expectedType === "trip_update" ? "pass" : "info",
        category: "Entity Types",
        message: `${tripUpdates.toLocaleString()} Trip Update entities`,
      });
      this.validateTripUpdates(entities);
    }

    if (vehiclePositions > 0) {
      this.realtimeValidationResults.push({
        type: expectedType === "vehicle_position" ? "pass" : "info",
        category: "Entity Types",
        message: `${vehiclePositions.toLocaleString()} Vehicle Position entities`,
      });
      this.validateVehiclePositions(entities);
    }

    if (alerts > 0) {
      this.realtimeValidationResults.push({
        type: expectedType === "service_alert" ? "pass" : "info",
        category: "Entity Types",
        message: `${alerts.toLocaleString()} Service Alert entities`,
      });
    }

    // Warn if expected type not found
    if (expectedType === "trip_update" && tripUpdates === 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category: "Entity Types",
        message: "No Trip Update entities found in feed",
      });
    }
    if (expectedType === "vehicle_position" && vehiclePositions === 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category: "Entity Types",
        message: "No Vehicle Position entities found in feed",
      });
    }
    if (expectedType === "service_alert" && alerts === 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category: "Entity Types",
        message: "No Service Alert entities found in feed",
      });
    }
  }

  /**
   * Validate Trip Update entities
   */
  validateTripUpdates(entities) {
    let missingTrip = 0, missingStopUpdates = 0;

    entities.forEach((entity) => {
      const tripUpdate = entity.trip_update || entity.tripUpdate;
      if (!tripUpdate) return;

      const trip = tripUpdate.trip;
      if (!trip || (!trip.trip_id && !trip.tripId)) {
        missingTrip++;
      }

      const stopTimeUpdates = tripUpdate.stop_time_update || tripUpdate.stopTimeUpdate || [];
      if (stopTimeUpdates.length === 0) {
        missingStopUpdates++;
      }
    });

    if (missingTrip > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category: "Trip Updates",
        message: `${missingTrip} trip updates missing trip descriptor or trip_id`,
      });
    } else {
      this.realtimeValidationResults.push({
        type: "pass",
        category: "Trip Updates",
        message: "All trip updates have valid trip descriptors",
      });
    }

    if (missingStopUpdates > 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category: "Trip Updates",
        message: `${missingStopUpdates} trip updates have no stop_time_updates`,
      });
    }
  }

  /**
   * Validate Vehicle Position entities
   */
  validateVehiclePositions(entities) {
    let missingPosition = 0, missingVehicle = 0;

    entities.forEach((entity) => {
      const vehicle = entity.vehicle || entity.vehiclePosition;
      if (!vehicle) return;

      const position = vehicle.position;
      if (!position || position.latitude === undefined || position.longitude === undefined) {
        missingPosition++;
      }

      const vehicleDesc = vehicle.vehicle;
      if (!vehicleDesc || (!vehicleDesc.id && !vehicleDesc.label)) {
        missingVehicle++;
      }
    });

    if (missingPosition > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category: "Vehicle Positions",
        message: `${missingPosition} vehicles missing position data`,
      });
    } else {
      this.realtimeValidationResults.push({
        type: "pass",
        category: "Vehicle Positions",
        message: "All vehicles have valid position data",
      });
    }

    if (missingVehicle > 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category: "Vehicle Positions",
        message: `${missingVehicle} vehicles missing vehicle descriptor`,
      });
    }
  }

  /**
   * Validate timestamps in GTFS-rt
   */
  validateRealtimeTimestamps(data) {
    if (data._protobuf) return;

    const entities = data.entity || [];
    const now = Math.floor(Date.now() / 1000);
    let futureTimestamps = 0, staleTimestamps = 0;

    entities.forEach((entity) => {
      const tripUpdate = entity.trip_update || entity.tripUpdate;
      if (tripUpdate && tripUpdate.timestamp) {
        const ts = tripUpdate.timestamp;
        if (ts > now + 60) futureTimestamps++;
        if (ts < now - 3600) staleTimestamps++;
      }

      const vehicle = entity.vehicle || entity.vehiclePosition;
      if (vehicle && vehicle.timestamp) {
        const ts = vehicle.timestamp;
        if (ts > now + 60) futureTimestamps++;
        if (ts < now - 300) staleTimestamps++;
      }
    });

    if (futureTimestamps > 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category: "Timestamps",
        message: `${futureTimestamps} entities have timestamps in the future`,
      });
    }

    if (staleTimestamps > 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category: "Timestamps",
        message: `${staleTimestamps} entities have stale timestamps`,
      });
    }

    if (futureTimestamps === 0 && staleTimestamps === 0 && entities.length > 0) {
      this.realtimeValidationResults.push({
        type: "pass",
        category: "Timestamps",
        message: "All entity timestamps are within acceptable range",
      });
    }
  }

  /**
   * Display realtime validation results
   */
  displayRealtimeResults(summaryEl, detailsEl) {
    this.displayResults(this.realtimeValidationResults, summaryEl, detailsEl);
  }

  // ============================================
  // COMBINED VALIDATION
  // ============================================

  /**
   * Validate combined GTFS + GTFS-rt
   */
  async validateCombined() {
    const staticFileInput = document.getElementById("staticGtfsUpload");
    const staticUrlInput = document.getElementById("staticGtfsUrl");
    const realtimeUrlInput = document.getElementById("realtimeUrl");
    const feedTypeSelect = document.getElementById("feedTypeSelect");
    const statusEl = document.getElementById("combinedValidationStatus");
    const resultsEl = document.getElementById("combinedValidationResults");
    const summaryEl = document.getElementById("combinedSummary");
    const detailsEl = document.getElementById("combinedDetails");

    const staticFile = staticFileInput ? staticFileInput.files[0] : null;
    const staticUrl = staticUrlInput ? staticUrlInput.value.trim() : "";
    const realtimeUrl = realtimeUrlInput ? realtimeUrlInput.value.trim() : "";
    const feedType = feedTypeSelect ? feedTypeSelect.value : "trip_update";

    // Check if we have static data already loaded or need to load it
    const hasStaticSource = staticFile || staticUrl || this.staticGtfsData;
    const hasRealtimeSource = realtimeUrl || this.realtimeData;

    if (!hasStaticSource) {
      this.showStatus(statusEl, "Please load a static GTFS file or URL in the Static GTFS section above", "error");
      return;
    }

    if (!hasRealtimeSource) {
      this.showStatus(statusEl, "Please enter a GTFS-rt feed URL in the GTFS Realtime section above", "error");
      return;
    }

    try {
      resultsEl.style.display = "none";
      this.combinedValidationResults = [];

      let gtfsData = this.staticGtfsData;
      let realtimeData = this.realtimeData;

      // Load static GTFS if not already loaded
      if (!gtfsData) {
        this.showStatus(statusEl, "Loading static GTFS...", "loading");
        if (staticFile) {
          gtfsData = await this.parseGtfsFile(staticFile);
        } else {
          gtfsData = await this.loadGtfsFromUrl(staticUrl);
        }
        this.staticGtfsData = gtfsData;
      }

      // Load GTFS-rt if not already loaded
      if (!realtimeData) {
        this.showStatus(statusEl, "Loading GTFS-rt feed...", "loading");
        realtimeData = await this.fetchRealtimeFeed(realtimeUrl);
        this.realtimeData = realtimeData;
      }

      // Run combined validation
      this.showStatus(statusEl, "Comparing feeds...", "loading");

      this.validateTripIdMatching(gtfsData, realtimeData);
      this.validateRouteIdMatching(gtfsData, realtimeData);
      this.validateStopIdMatching(gtfsData, realtimeData);
      this.validateScheduleRelationships(gtfsData, realtimeData, feedType);

      // Display results
      this.displayCombinedResults(summaryEl, detailsEl);
      resultsEl.style.display = "block";
      this.showStatus(statusEl, "Comparison complete", "success");
      this.refreshCombinedIndicators();
    } catch (error) {
      console.error("Combined validation error:", error);
      this.showStatus(statusEl, `Error: ${error.message}`, "error");
    }
  }

  /**
   * Validate trip_id matching between static and realtime
   */
  validateTripIdMatching(gtfsData, realtimeData) {
    if (realtimeData._protobuf) {
      this.combinedValidationResults.push({
        type: "warning",
        category: "Trip ID Matching",
        message: "Cannot validate trip IDs - GTFS-rt feed requires protobuf parsing for full validation",
      });
      return;
    }

    const staticTripIds = new Set((gtfsData["trips.txt"] || []).map((t) => t.trip_id));
    const entities = realtimeData.entity || [];

    let matched = 0, unmatched = 0;
    const unmatchedIds = new Set();

    entities.forEach((entity) => {
      const tripUpdate = entity.trip_update || entity.tripUpdate;
      const vehicle = entity.vehicle || entity.vehiclePosition;

      let tripId = null;
      if (tripUpdate && tripUpdate.trip) {
        tripId = tripUpdate.trip.trip_id || tripUpdate.trip.tripId;
      }
      if (!tripId && vehicle && vehicle.trip) {
        tripId = vehicle.trip.trip_id || vehicle.trip.tripId;
      }

      if (tripId) {
        if (staticTripIds.has(tripId)) {
          matched++;
        } else {
          unmatched++;
          if (unmatchedIds.size < 5) unmatchedIds.add(tripId);
        }
      }
    });

    const total = matched + unmatched;
    if (total === 0) {
      this.combinedValidationResults.push({
        type: "info",
        category: "Trip ID Matching",
        message: "No trip IDs found in realtime feed to validate",
      });
      return;
    }

    const matchRate = ((matched / total) * 100).toFixed(1);

    if (unmatched === 0) {
      this.combinedValidationResults.push({
        type: "pass",
        category: "Trip ID Matching",
        message: `All ${matched.toLocaleString()} realtime trip IDs match static GTFS (100%)`,
      });
    } else if (parseFloat(matchRate) >= 90) {
      this.combinedValidationResults.push({
        type: "warning",
        category: "Trip ID Matching",
        message: `${matched.toLocaleString()}/${total.toLocaleString()} trip IDs match (${matchRate}%). ${unmatched} unmatched.`,
      });
    } else {
      this.combinedValidationResults.push({
        type: "error",
        category: "Trip ID Matching",
        message: `Only ${matched.toLocaleString()}/${total.toLocaleString()} trip IDs match (${matchRate}%). ${unmatched} unmatched.`,
      });
    }

    if (unmatchedIds.size > 0) {
      this.combinedValidationResults.push({
        type: "info",
        category: "Trip ID Matching",
        message: `Sample unmatched: ${[...unmatchedIds].join(", ")}${unmatched > 5 ? ` (+${unmatched - 5} more)` : ""}`,
      });
    }
  }

  /**
   * Validate route_id matching
   */
  validateRouteIdMatching(gtfsData, realtimeData) {
    if (realtimeData._protobuf) return;

    const staticRouteIds = new Set((gtfsData["routes.txt"] || []).map((r) => r.route_id));
    const entities = realtimeData.entity || [];

    let matched = 0, unmatched = 0;
    const unmatchedIds = new Set();

    entities.forEach((entity) => {
      const tripUpdate = entity.trip_update || entity.tripUpdate;
      const vehicle = entity.vehicle || entity.vehiclePosition;

      let routeId = null;
      if (tripUpdate && tripUpdate.trip) {
        routeId = tripUpdate.trip.route_id || tripUpdate.trip.routeId;
      }
      if (!routeId && vehicle && vehicle.trip) {
        routeId = vehicle.trip.route_id || vehicle.trip.routeId;
      }

      if (routeId) {
        if (staticRouteIds.has(routeId)) {
          matched++;
        } else {
          unmatched++;
          if (unmatchedIds.size < 5) unmatchedIds.add(routeId);
        }
      }
    });

    const total = matched + unmatched;
    if (total === 0) {
      this.combinedValidationResults.push({
        type: "info",
        category: "Route ID Matching",
        message: "No route IDs found in realtime feed to validate",
      });
      return;
    }

    if (unmatched === 0) {
      this.combinedValidationResults.push({
        type: "pass",
        category: "Route ID Matching",
        message: `All ${matched.toLocaleString()} realtime route IDs match static GTFS`,
      });
    } else {
      this.combinedValidationResults.push({
        type: "error",
        category: "Route ID Matching",
        message: `${unmatched} route IDs in realtime feed not found in static GTFS`,
      });
      if (unmatchedIds.size > 0) {
        this.combinedValidationResults.push({
          type: "info",
          category: "Route ID Matching",
          message: `Unmatched: ${[...unmatchedIds].join(", ")}`,
        });
      }
    }
  }

  /**
   * Validate stop_id matching
   */
  validateStopIdMatching(gtfsData, realtimeData) {
    if (realtimeData._protobuf) return;

    const staticStopIds = new Set((gtfsData["stops.txt"] || []).map((s) => s.stop_id));
    const entities = realtimeData.entity || [];

    let matched = 0, unmatched = 0;
    const unmatchedIds = new Set();

    entities.forEach((entity) => {
      const tripUpdate = entity.trip_update || entity.tripUpdate;
      if (tripUpdate) {
        const stopTimeUpdates = tripUpdate.stop_time_update || tripUpdate.stopTimeUpdate || [];
        stopTimeUpdates.forEach((stu) => {
          const stopId = stu.stop_id || stu.stopId;
          if (stopId) {
            if (staticStopIds.has(stopId)) {
              matched++;
            } else {
              unmatched++;
              if (unmatchedIds.size < 5) unmatchedIds.add(stopId);
            }
          }
        });
      }

      const vehicle = entity.vehicle || entity.vehiclePosition;
      if (vehicle) {
        const stopId = vehicle.stop_id || vehicle.stopId;
        if (stopId) {
          if (staticStopIds.has(stopId)) {
            matched++;
          } else {
            unmatched++;
            if (unmatchedIds.size < 5) unmatchedIds.add(stopId);
          }
        }
      }
    });

    const total = matched + unmatched;
    if (total === 0) {
      this.combinedValidationResults.push({
        type: "info",
        category: "Stop ID Matching",
        message: "No stop IDs found in realtime feed to validate",
      });
      return;
    }

    const matchRate = ((matched / total) * 100).toFixed(1);

    if (unmatched === 0) {
      this.combinedValidationResults.push({
        type: "pass",
        category: "Stop ID Matching",
        message: `All ${matched.toLocaleString()} realtime stop IDs match static GTFS (100%)`,
      });
    } else if (parseFloat(matchRate) >= 95) {
      this.combinedValidationResults.push({
        type: "warning",
        category: "Stop ID Matching",
        message: `${matched.toLocaleString()}/${total.toLocaleString()} stop IDs match (${matchRate}%). ${unmatched} unmatched.`,
      });
    } else {
      this.combinedValidationResults.push({
        type: "error",
        category: "Stop ID Matching",
        message: `${matched.toLocaleString()}/${total.toLocaleString()} stop IDs match (${matchRate}%). ${unmatched} unmatched.`,
      });
    }

    if (unmatchedIds.size > 0) {
      this.combinedValidationResults.push({
        type: "info",
        category: "Stop ID Matching",
        message: `Sample unmatched: ${[...unmatchedIds].join(", ")}`,
      });
    }
  }

  /**
   * Validate schedule relationships
   */
  validateScheduleRelationships(gtfsData, realtimeData, feedType) {
    if (realtimeData._protobuf) return;

    const entities = realtimeData.entity || [];
    const scheduleRelationships = {
      SCHEDULED: 0, ADDED: 0, UNSCHEDULED: 0, CANCELED: 0, REPLACEMENT: 0, DUPLICATED: 0,
    };

    entities.forEach((entity) => {
      const tripUpdate = entity.trip_update || entity.tripUpdate;
      if (tripUpdate && tripUpdate.trip) {
        const sr = tripUpdate.trip.schedule_relationship || tripUpdate.trip.scheduleRelationship;
        if (sr !== undefined) {
          const srName = typeof sr === "string" ? sr : ["SCHEDULED", "ADDED", "UNSCHEDULED", "CANCELED", "REPLACEMENT", "DUPLICATED"][sr];
          if (scheduleRelationships[srName] !== undefined) {
            scheduleRelationships[srName]++;
          }
        } else {
          scheduleRelationships.SCHEDULED++;
        }
      }
    });

    const usedRelationships = Object.entries(scheduleRelationships).filter(([, count]) => count > 0);

    if (usedRelationships.length > 0) {
      this.combinedValidationResults.push({
        type: "info",
        category: "Schedule Relationships",
        message: `Schedule relationships: ${usedRelationships.map(([name, count]) => `${name}: ${count}`).join(", ")}`,
      });
    }

    if (scheduleRelationships.ADDED > 0) {
      this.combinedValidationResults.push({
        type: "info",
        category: "Schedule Relationships",
        message: `${scheduleRelationships.ADDED} ADDED trips - these are not expected to match static GTFS`,
      });
    }
  }

  /**
   * Display combined validation results
   */
  displayCombinedResults(summaryEl, detailsEl) {
    this.displayResults(this.combinedValidationResults, summaryEl, detailsEl, "Feeds Are Compatible", "Compatibility Issues Found");
  }

  // ============================================
  // SHARED DISPLAY METHODS
  // ============================================

  /**
   * Display validation results (shared method)
   */
  displayResults(results, summaryEl, detailsEl, passTitle = "Validation Passed", failTitle = "Issues Found") {
    const errors = results.filter((r) => r.type === "error").length;
    const warnings = results.filter((r) => r.type === "warning").length;
    const passes = results.filter((r) => r.type === "pass").length;
    const infos = results.filter((r) => r.type === "info").length;

    summaryEl.innerHTML = `
      <div class="summary-card ${errors > 0 ? "has-errors" : "no-errors"}">
        <div class="summary-status">${errors > 0 ? failTitle : passTitle}</div>
        <div class="summary-stats">
          <span class="stat error">${errors} Errors</span>
          <span class="stat warning">${warnings} Warnings</span>
          <span class="stat pass">${passes} Passed</span>
          <span class="stat info">${infos} Info</span>
        </div>
      </div>
    `;

    // Group by category
    const grouped = {};
    results.forEach((r) => {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push(r);
    });

    detailsEl.innerHTML = Object.entries(grouped)
      .map(([category, items]) => `
        <div class="result-category">
          <h4 class="category-header" data-expanded="true">
            <span class="category-toggle">▼</span>
            ${category}
            <span class="category-counts">
              ${items.filter((i) => i.type === "error").length > 0 ? `<span class="count error">${items.filter((i) => i.type === "error").length}</span>` : ""}
              ${items.filter((i) => i.type === "warning").length > 0 ? `<span class="count warning">${items.filter((i) => i.type === "warning").length}</span>` : ""}
              ${items.filter((i) => i.type === "pass").length > 0 ? `<span class="count pass">${items.filter((i) => i.type === "pass").length}</span>` : ""}
            </span>
          </h4>
          <div class="category-items">
            ${items.map((item) => `
              <div class="result-item ${item.type}">
                <span class="result-icon ${item.type}"></span>
                <span class="result-message">${item.message}</span>
                ${item.file ? `<span class="result-file">${item.file}</span>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      `)
      .join("");

    // Bind collapse/expand
    detailsEl.querySelectorAll(".category-header").forEach((header) => {
      header.addEventListener("click", () => {
        const expanded = header.getAttribute("data-expanded") === "true";
        header.setAttribute("data-expanded", !expanded);
        header.querySelector(".category-toggle").textContent = expanded ? "▶" : "▼";
        header.nextElementSibling.style.display = expanded ? "none" : "block";
      });
    });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

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
   * Show status message
   */
  showStatus(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = "validation-status";
    if (type) element.classList.add(type);
  }

  /**
   * Show inline status message
   */
  showInlineStatus(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = "inline-status";
    if (type) element.classList.add(type);
  }

  /**
   * Format date as YYYYMMDD
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  /**
   * Format YYYYMMDD date for display
   */
  formatDateDisplay(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.substr(0, 4)}-${dateStr.substr(4, 2)}-${dateStr.substr(6, 2)}`;
  }
}

// Global instance
window.gtfsValidator = new GTFSValidator();
