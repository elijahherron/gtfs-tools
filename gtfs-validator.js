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
   * Bind proxy toggle (no-op now - proxies are always enabled)
   */
  bindProxyToggle() {
    // Proxy is now always enabled automatically
  }

  /**
   * Update combined validation source indicators
   */
  updateCombinedSources() {
    // Watch for changes in static inputs
    const staticFile = document.getElementById("staticGtfsUpload");
    const staticUrl = document.getElementById("staticGtfsUrl");
    const realtimeTU = document.getElementById("realtimeTripUpdatesUrl");
    const realtimeVP = document.getElementById("realtimeVehiclePositionsUrl");
    const realtimeSA = document.getElementById("realtimeServiceAlertsUrl");

    if (staticFile) {
      staticFile.addEventListener("change", () => this.refreshCombinedIndicators());
    }
    if (staticUrl) {
      staticUrl.addEventListener("input", () => this.refreshCombinedIndicators());
    }
    [realtimeTU, realtimeVP, realtimeSA].forEach(el => {
      if (el) el.addEventListener("input", () => this.refreshCombinedIndicators());
    });

    this.refreshCombinedIndicators();
  }

  /**
   * Refresh the combined section indicators
   */
  refreshCombinedIndicators() {
    const staticFile = document.getElementById("staticGtfsUpload");
    const staticUrl = document.getElementById("staticGtfsUrl");
    const realtimeTU = document.getElementById("realtimeTripUpdatesUrl");
    const realtimeVP = document.getElementById("realtimeVehiclePositionsUrl");
    const realtimeSA = document.getElementById("realtimeServiceAlertsUrl");

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

    // Realtime source - check all three URL fields
    const hasRealtimeUrls = [realtimeTU, realtimeVP, realtimeSA].some(el => el && el.value.trim());

    if (realtimeValue && realtimeIndicator) {
      if (this.realtimeData && Object.keys(this.realtimeData).length > 0) {
        const feedCount = Object.keys(this.realtimeData).length;
        const totalEntities = Object.values(this.realtimeData).reduce((sum, data) => {
          return sum + (data && data.entity ? data.entity.length : 0);
        }, 0);
        realtimeValue.textContent = `Loaded (${feedCount} feeds, ${totalEntities} entities)`;
        realtimeIndicator.className = "source-status ready";
        realtimeIndicator.textContent = "Ready";
      } else if (hasRealtimeUrls) {
        const urlCount = [realtimeTU, realtimeVP, realtimeSA].filter(el => el && el.value.trim()).length;
        realtimeValue.textContent = `${urlCount} feed URL${urlCount > 1 ? 's' : ''} entered`;
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
   * Get the proxy URL if enabled (returns "auto" or specific proxy URL)
   */
  getProxyUrl() {
    const useProxy = document.getElementById("useProxyCheckbox");
    if (!useProxy || !useProxy.checked) {
      return null;
    }

    const proxySelect = document.getElementById("proxySelect");
    const proxyCustom = document.getElementById("proxyUrlCustom");

    if (proxySelect) {
      if (proxySelect.value === "auto") {
        return "auto";
      }
      if (proxySelect.value === "custom" && proxyCustom) {
        return proxyCustom.value.trim() || "auto";
      }
      return proxySelect.value;
    }

    return "auto";
  }

  /**
   * Check if proxy is enabled (always true now - proxies are automatic)
   */
  isProxyEnabled() {
    return true;
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

  /**
   * Test fetch - call from console: gtfsValidator.testFetch('your-url')
   */
  async testFetch(url) {
    console.log("=== FETCH TEST ===");
    console.log("Target URL:", url);

    // Test 1: Direct fetch
    console.log("\n1. Trying DIRECT fetch...");
    try {
      const resp = await fetch(url, { mode: "cors", credentials: "omit" });
      console.log("   Direct SUCCESS! Status:", resp.status);
      const blob = await resp.blob();
      console.log("   Blob size:", blob.size);
      return { method: "direct", success: true, size: blob.size };
    } catch (e) {
      console.log("   Direct FAILED:", e.message);
    }

    // Test 2: corsproxy.io
    console.log("\n2. Trying corsproxy.io...");
    try {
      const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(url);
      console.log("   Proxy URL:", proxyUrl);
      const resp = await fetch(proxyUrl);
      console.log("   corsproxy.io Status:", resp.status);
      if (resp.ok) {
        const blob = await resp.blob();
        console.log("   Blob size:", blob.size);
        return { method: "corsproxy.io", success: true, size: blob.size };
      } else {
        console.log("   Response not OK");
      }
    } catch (e) {
      console.log("   corsproxy.io FAILED:", e.message);
    }

    // Test 3: allorigins.win
    console.log("\n3. Trying allorigins.win...");
    try {
      const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
      console.log("   Proxy URL:", proxyUrl);
      const resp = await fetch(proxyUrl);
      console.log("   allorigins.win Status:", resp.status);
      if (resp.ok) {
        const blob = await resp.blob();
        console.log("   Blob size:", blob.size);
        return { method: "allorigins.win", success: true, size: blob.size };
      } else {
        console.log("   Response not OK");
      }
    } catch (e) {
      console.log("   allorigins.win FAILED:", e.message);
    }

    // Test 4: corsproxy.org
    console.log("\n4. Trying corsproxy.org...");
    try {
      const proxyUrl = "https://corsproxy.org/?" + encodeURIComponent(url);
      console.log("   Proxy URL:", proxyUrl);
      const resp = await fetch(proxyUrl);
      console.log("   corsproxy.org Status:", resp.status);
      if (resp.ok) {
        const blob = await resp.blob();
        console.log("   Blob size:", blob.size);
        return { method: "corsproxy.org", success: true, size: blob.size };
      } else {
        console.log("   Response not OK");
      }
    } catch (e) {
      console.log("   corsproxy.org FAILED:", e.message);
    }

    // Test 5: codetabs
    console.log("\n5. Trying codetabs...");
    try {
      const proxyUrl = "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url);
      console.log("   Proxy URL:", proxyUrl);
      const resp = await fetch(proxyUrl);
      console.log("   codetabs Status:", resp.status);
      if (resp.ok) {
        const blob = await resp.blob();
        console.log("   Blob size:", blob.size);
        return { method: "codetabs", success: true, size: blob.size };
      } else {
        console.log("   Response not OK");
      }
    } catch (e) {
      console.log("   codetabs FAILED:", e.message);
    }

    // Test 6: allorigins JSON endpoint
    console.log("\n6. Trying allorigins.win JSON endpoint...");
    try {
      const proxyUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(url);
      console.log("   Proxy URL:", proxyUrl);
      const resp = await fetch(proxyUrl);
      console.log("   allorigins JSON Status:", resp.status);
      if (resp.ok) {
        const json = await resp.json();
        console.log("   Got JSON response, contents length:", json.contents?.length);
        return { method: "allorigins-json", success: true, size: json.contents?.length };
      }
    } catch (e) {
      console.log("   allorigins JSON FAILED:", e.message);
    }

    console.log("\n=== ALL METHODS FAILED ===");
    console.log("\nTroubleshooting suggestions:");
    console.log("1. Check if you have any browser extensions blocking requests");
    console.log("2. Try in an incognito/private window");
    console.log("3. Check browser console Network tab for more details");
    console.log("4. Try opening this URL directly to verify access:");
    console.log("   https://corsproxy.io/?" + encodeURIComponent(url));
    return { success: false };
  }

  /**
   * Verify GTFS Editor's exact fetch approach works
   * Call from console: gtfsValidator.testEditorApproach('your-url')
   */
  async testEditorApproach(url) {
    console.log("=== Testing GTFS Editor's exact approach ===");
    console.log("URL:", url);

    // Step 1: Try direct (should fail for most GTFS URLs)
    console.log("\n1. Direct fetch (expect CORS fail)...");
    try {
      const response = await fetch(url, {
        mode: "cors",
        credentials: "omit",
      });
      if (response.ok) {
        const blob = await response.blob();
        console.log("   DIRECT WORKED! Blob size:", blob.size);
        return { method: "direct", success: true };
      }
    } catch (e) {
      console.log("   Direct failed (expected):", e.message);
    }

    // Step 2: Use corsproxy.io exactly like GTFS Editor
    console.log("\n2. Using corsproxy.io (GTFS Editor method)...");
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    console.log("   Proxy URL:", proxyUrl);

    try {
      const response = await fetch(proxyUrl);
      console.log("   Response status:", response.status);
      console.log("   Response ok:", response.ok);
      console.log("   Response headers:");
      response.headers.forEach((v, k) => console.log(`     ${k}: ${v}`));

      if (response.ok) {
        const blob = await response.blob();
        console.log("   SUCCESS! Blob size:", blob.size);
        return { method: "corsproxy.io", success: true, size: blob.size };
      }
    } catch (e) {
      console.log("   FAILED:", e.message);
      console.log("   Error type:", e.name);
    }

    console.log("\n=== GTFS Editor approach also failed ===");
    return { success: false };
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
   * Validate GTFS realtime feeds (all provided URLs)
   */
  async validateRealtimeGtfs() {
    const tripUpdatesUrl = document.getElementById("realtimeTripUpdatesUrl")?.value.trim();
    const vehiclePositionsUrl = document.getElementById("realtimeVehiclePositionsUrl")?.value.trim();
    const serviceAlertsUrl = document.getElementById("realtimeServiceAlertsUrl")?.value.trim();
    const statusEl = document.getElementById("realtimeValidationStatus");
    const resultsEl = document.getElementById("realtimeValidationResults");
    const summaryEl = document.getElementById("realtimeSummary");
    const detailsEl = document.getElementById("realtimeDetails");

    const feeds = [
      { url: tripUpdatesUrl, type: "trip_update", name: "Trip Updates" },
      { url: vehiclePositionsUrl, type: "vehicle_position", name: "Vehicle Positions" },
      { url: serviceAlertsUrl, type: "service_alert", name: "Service Alerts" },
    ].filter(f => f.url);

    if (feeds.length === 0) {
      this.showStatus(statusEl, "Please enter at least one GTFS-rt feed URL", "error");
      return;
    }

    try {
      resultsEl.style.display = "none";
      this.realtimeValidationResults = [];
      this.realtimeData = {};

      // Fetch and validate each feed
      for (const feed of feeds) {
        this.showStatus(statusEl, `Fetching ${feed.name}...`, "loading");

        try {
          const data = await this.fetchRealtimeFeed(feed.url);
          this.realtimeData[feed.type] = data;

          this.showStatus(statusEl, `Validating ${feed.name}...`, "loading");

          // Add feed header to results
          this.realtimeValidationResults.push({
            type: "info",
            category: feed.name,
            message: `Feed URL: ${feed.url.length > 60 ? feed.url.substring(0, 60) + "..." : feed.url}`,
          });

          this.validateRealtimeHeader(data, feed.name);
          this.validateRealtimeEntities(data, feed.type, feed.name);
          this.validateRealtimeTimestamps(data, feed.name);
        } catch (error) {
          this.realtimeValidationResults.push({
            type: "error",
            category: feed.name,
            message: `Failed to fetch: ${error.message}`,
          });
        }
      }

      // Display results
      this.displayRealtimeResults(summaryEl, detailsEl);
      resultsEl.style.display = "block";
      this.showStatus(statusEl, `Validation complete (${feeds.length} feed${feeds.length > 1 ? 's' : ''})`, "success");
      this.refreshCombinedIndicators();
    } catch (error) {
      console.error("GTFS-rt validation error:", error);
      this.showStatus(statusEl, `Error: ${error.message}`, "error");
    }
  }

  /**
   * Fetch and parse GTFS-rt feed - tries direct fetch first, falls back to proxies
   */
  async fetchRealtimeFeed(url) {
    // First try direct fetch
    try {
      console.log("Attempting direct GTFS-rt fetch:", url);
      const response = await fetch(url, {
        mode: "cors",
        credentials: "omit",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await this.parseRealtimeResponse(response);
    } catch (directError) {
      console.log("Direct GTFS-rt fetch failed:", directError.message);

      // If direct fetch fails, try proxies
      if (!this.isProxyEnabled()) {
        throw new Error("CORS blocked. Enable 'Use CORS proxy' at the top of the page.");
      }

      const selectedProxy = this.getProxyUrl();

      // If a specific proxy is selected (not auto), try it first
      if (selectedProxy && selectedProxy !== "auto") {
        try {
          const proxyUrl = this.buildProxyUrl(selectedProxy, url);
          console.log("Trying selected proxy for GTFS-rt:", proxyUrl);
          const response = await fetch(proxyUrl);
          if (response.ok) {
            console.log("Selected proxy succeeded for GTFS-rt");
            return await this.parseRealtimeResponse(response);
          }
        } catch (e) {
          console.log("Selected proxy failed for GTFS-rt, trying others...");
        }
      }

      // Try all proxies
      try {
        const result = await this.fetchWithProxies(url, false);
        if (result.response) {
          return await this.parseRealtimeResponse(result.response);
        } else if (result.text) {
          // Handle JSON-wrapped text response
          return this.parseProtobuf(new TextEncoder().encode(result.text).buffer);
        }
        throw new Error("Unexpected proxy response format");
      } catch (proxyError) {
        console.error("All proxies failed:", proxyError.message);
        throw new Error(`Failed to fetch: ${proxyError.message}`);
      }
    }
  }

  /**
   * Parse the response from a GTFS-rt fetch
   */
  async parseRealtimeResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    // Try to parse as JSON if it looks like JSON
    if (contentType.includes("application/json") || contentType.includes("text/json")) {
      return await response.json();
    }

    // Get as array buffer for binary/protobuf
    const buffer = await response.arrayBuffer();
    return this.parseProtobuf(buffer);
  }

  /**
   * Parse Protocol Buffer data for GTFS-realtime
   * This is a simplified decoder for the GTFS-rt protobuf format
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

    // Decode GTFS-realtime protobuf format
    try {
      return this.decodeGtfsRealtime(bytes);
    } catch (e) {
      console.error("Protobuf decode error:", e);
      // Fallback: return limited info
      return {
        _protobuf: true,
        _parseError: e.message,
        _size: bytes.length,
        header: {
          gtfs_realtime_version: "unknown",
          timestamp: Math.floor(Date.now() / 1000),
        },
        entity: [],
      };
    }
  }

  /**
   * Simple GTFS-realtime protobuf decoder
   * Based on gtfs-realtime.proto field numbers
   */
  decodeGtfsRealtime(bytes) {
    const reader = { bytes, pos: 0 };
    const result = { header: {}, entity: [] };

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 2) {
        // header (embedded message)
        const len = this.readVarint(reader);
        const headerBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        result.header = this.decodeHeader(headerBytes);
        reader.pos += len;
      } else if (fieldNum === 2 && wireType === 2) {
        // entity (repeated embedded message)
        const len = this.readVarint(reader);
        const entityBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        const entity = this.decodeEntity(entityBytes);
        if (entity) result.entity.push(entity);
        reader.pos += len;
      } else {
        this.skipField(reader, wireType);
      }
    }

    return result;
  }

  decodeHeader(bytes) {
    const reader = { bytes, pos: 0 };
    const header = {};

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 2) {
        header.gtfs_realtime_version = this.readString(reader);
      } else if (fieldNum === 2 && wireType === 0) {
        header.incrementality = this.readVarint(reader);
      } else if (fieldNum === 3 && wireType === 0) {
        header.timestamp = this.readVarint(reader);
      } else {
        this.skipField(reader, wireType);
      }
    }

    return header;
  }

  decodeEntity(bytes) {
    const reader = { bytes, pos: 0 };
    const entity = {};

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 2) {
        entity.id = this.readString(reader);
      } else if (fieldNum === 2 && wireType === 0) {
        entity.is_deleted = this.readVarint(reader) !== 0;
      } else if (fieldNum === 3 && wireType === 2) {
        const len = this.readVarint(reader);
        const tripUpdateBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        entity.trip_update = this.decodeTripUpdate(tripUpdateBytes);
        reader.pos += len;
      } else if (fieldNum === 4 && wireType === 2) {
        const len = this.readVarint(reader);
        const vehicleBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        entity.vehicle = this.decodeVehiclePosition(vehicleBytes);
        reader.pos += len;
      } else if (fieldNum === 5 && wireType === 2) {
        const len = this.readVarint(reader);
        const alertBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        entity.alert = this.decodeAlert(alertBytes);
        reader.pos += len;
      } else {
        this.skipField(reader, wireType);
      }
    }

    return entity;
  }

  decodeTripUpdate(bytes) {
    const reader = { bytes, pos: 0 };
    const tripUpdate = { stop_time_update: [] };

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 2) {
        const len = this.readVarint(reader);
        const tripBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        tripUpdate.trip = this.decodeTripDescriptor(tripBytes);
        reader.pos += len;
      } else if (fieldNum === 2 && wireType === 2) {
        const len = this.readVarint(reader);
        const stuBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        const stu = this.decodeStopTimeUpdate(stuBytes);
        if (stu) tripUpdate.stop_time_update.push(stu);
        reader.pos += len;
      } else if (fieldNum === 4 && wireType === 0) {
        tripUpdate.timestamp = this.readVarint(reader);
      } else {
        this.skipField(reader, wireType);
      }
    }

    return tripUpdate;
  }

  decodeVehiclePosition(bytes) {
    const reader = { bytes, pos: 0 };
    const vehicle = {};

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 2) {
        const len = this.readVarint(reader);
        const tripBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        vehicle.trip = this.decodeTripDescriptor(tripBytes);
        reader.pos += len;
      } else if (fieldNum === 2 && wireType === 2) {
        const len = this.readVarint(reader);
        const posBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        vehicle.position = this.decodePosition(posBytes);
        reader.pos += len;
      } else if (fieldNum === 5 && wireType === 0) {
        vehicle.timestamp = this.readVarint(reader);
      } else if (fieldNum === 8 && wireType === 2) {
        const len = this.readVarint(reader);
        const vehBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        vehicle.vehicle = this.decodeVehicleDescriptor(vehBytes);
        reader.pos += len;
      } else {
        this.skipField(reader, wireType);
      }
    }

    return vehicle;
  }

  decodeTripDescriptor(bytes) {
    const reader = { bytes, pos: 0 };
    const trip = {};

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 2) {
        trip.trip_id = this.readString(reader);
      } else if (fieldNum === 2 && wireType === 2) {
        trip.start_time = this.readString(reader);
      } else if (fieldNum === 3 && wireType === 2) {
        trip.start_date = this.readString(reader);
      } else if (fieldNum === 4 && wireType === 0) {
        trip.schedule_relationship = this.readVarint(reader);
      } else if (fieldNum === 5 && wireType === 2) {
        trip.route_id = this.readString(reader);
      } else if (fieldNum === 6 && wireType === 0) {
        trip.direction_id = this.readVarint(reader);
      } else {
        this.skipField(reader, wireType);
      }
    }

    return trip;
  }

  decodeStopTimeUpdate(bytes) {
    const reader = { bytes, pos: 0 };
    const stu = {};

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 0) {
        stu.stop_sequence = this.readVarint(reader);
      } else if (fieldNum === 2 && wireType === 2) {
        const len = this.readVarint(reader);
        const arrBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        stu.arrival = this.decodeStopTimeEvent(arrBytes);
        reader.pos += len;
      } else if (fieldNum === 3 && wireType === 2) {
        const len = this.readVarint(reader);
        const depBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        stu.departure = this.decodeStopTimeEvent(depBytes);
        reader.pos += len;
      } else if (fieldNum === 4 && wireType === 2) {
        stu.stop_id = this.readString(reader);
      } else if (fieldNum === 5 && wireType === 0) {
        stu.schedule_relationship = this.readVarint(reader);
      } else {
        this.skipField(reader, wireType);
      }
    }

    return stu;
  }

  decodeStopTimeEvent(bytes) {
    const reader = { bytes, pos: 0 };
    const event = {};

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 0) {
        event.delay = this.readSignedVarint(reader);
      } else if (fieldNum === 2 && wireType === 0) {
        event.time = this.readVarint(reader);
      } else if (fieldNum === 3 && wireType === 0) {
        event.uncertainty = this.readVarint(reader);
      } else {
        this.skipField(reader, wireType);
      }
    }

    return event;
  }

  decodePosition(bytes) {
    const reader = { bytes, pos: 0 };
    const pos = {};

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 5) {
        pos.latitude = this.readFloat(reader);
      } else if (fieldNum === 2 && wireType === 5) {
        pos.longitude = this.readFloat(reader);
      } else if (fieldNum === 3 && wireType === 5) {
        pos.bearing = this.readFloat(reader);
      } else if (fieldNum === 4 && wireType === 1) {
        pos.odometer = this.readDouble(reader);
      } else if (fieldNum === 5 && wireType === 5) {
        pos.speed = this.readFloat(reader);
      } else {
        this.skipField(reader, wireType);
      }
    }

    return pos;
  }

  decodeVehicleDescriptor(bytes) {
    const reader = { bytes, pos: 0 };
    const veh = {};

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 2) {
        veh.id = this.readString(reader);
      } else if (fieldNum === 2 && wireType === 2) {
        veh.label = this.readString(reader);
      } else if (fieldNum === 3 && wireType === 2) {
        veh.license_plate = this.readString(reader);
      } else {
        this.skipField(reader, wireType);
      }
    }

    return veh;
  }

  decodeAlert(bytes) {
    const reader = { bytes, pos: 0 };
    const alert = { informed_entity: [] };

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 5 && wireType === 2) {
        const len = this.readVarint(reader);
        const ieBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        const ie = this.decodeEntitySelector(ieBytes);
        if (ie) alert.informed_entity.push(ie);
        reader.pos += len;
      } else if (fieldNum === 10 && wireType === 2) {
        const len = this.readVarint(reader);
        const txtBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        alert.header_text = this.decodeTranslatedString(txtBytes);
        reader.pos += len;
      } else if (fieldNum === 11 && wireType === 2) {
        const len = this.readVarint(reader);
        const txtBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        alert.description_text = this.decodeTranslatedString(txtBytes);
        reader.pos += len;
      } else {
        this.skipField(reader, wireType);
      }
    }

    return alert;
  }

  decodeEntitySelector(bytes) {
    const reader = { bytes, pos: 0 };
    const es = {};

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 2) {
        es.agency_id = this.readString(reader);
      } else if (fieldNum === 2 && wireType === 2) {
        es.route_id = this.readString(reader);
      } else if (fieldNum === 3 && wireType === 0) {
        es.route_type = this.readVarint(reader);
      } else if (fieldNum === 4 && wireType === 2) {
        const len = this.readVarint(reader);
        const tripBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        es.trip = this.decodeTripDescriptor(tripBytes);
        reader.pos += len;
      } else if (fieldNum === 5 && wireType === 2) {
        es.stop_id = this.readString(reader);
      } else {
        this.skipField(reader, wireType);
      }
    }

    return es;
  }

  decodeTranslatedString(bytes) {
    const reader = { bytes, pos: 0 };
    const ts = { translation: [] };

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 2) {
        const len = this.readVarint(reader);
        const transBytes = reader.bytes.slice(reader.pos, reader.pos + len);
        const trans = this.decodeTranslation(transBytes);
        if (trans) ts.translation.push(trans);
        reader.pos += len;
      } else {
        this.skipField(reader, wireType);
      }
    }

    return ts;
  }

  decodeTranslation(bytes) {
    const reader = { bytes, pos: 0 };
    const trans = {};

    while (reader.pos < reader.bytes.length) {
      const tag = this.readVarint(reader);
      const fieldNum = tag >> 3;
      const wireType = tag & 0x7;

      if (fieldNum === 1 && wireType === 2) {
        trans.text = this.readString(reader);
      } else if (fieldNum === 2 && wireType === 2) {
        trans.language = this.readString(reader);
      } else {
        this.skipField(reader, wireType);
      }
    }

    return trans;
  }

  // Protobuf reading helpers
  readVarint(reader) {
    let result = 0;
    let shift = 0;
    while (reader.pos < reader.bytes.length) {
      const b = reader.bytes[reader.pos++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    return result >>> 0;
  }

  readSignedVarint(reader) {
    const n = this.readVarint(reader);
    return (n >>> 1) ^ -(n & 1);
  }

  readString(reader) {
    const len = this.readVarint(reader);
    const strBytes = reader.bytes.slice(reader.pos, reader.pos + len);
    reader.pos += len;
    return new TextDecoder().decode(strBytes);
  }

  readFloat(reader) {
    const bytes = reader.bytes.slice(reader.pos, reader.pos + 4);
    reader.pos += 4;
    return new DataView(bytes.buffer, bytes.byteOffset, 4).getFloat32(0, true);
  }

  readDouble(reader) {
    const bytes = reader.bytes.slice(reader.pos, reader.pos + 8);
    reader.pos += 8;
    return new DataView(bytes.buffer, bytes.byteOffset, 8).getFloat64(0, true);
  }

  skipField(reader, wireType) {
    if (wireType === 0) {
      this.readVarint(reader);
    } else if (wireType === 1) {
      reader.pos += 8;
    } else if (wireType === 2) {
      const len = this.readVarint(reader);
      reader.pos += len;
    } else if (wireType === 5) {
      reader.pos += 4;
    }
  }

  /**
   * Validate GTFS-rt header (includes E001, E038, E048, E050 rules)
   */
  validateRealtimeHeader(data, categoryPrefix = "") {
    const category = categoryPrefix || "Feed Header";

    if (!data) {
      this.realtimeValidationResults.push({
        type: "error",
        category,
        message: "E: No data received from feed",
      });
      return;
    }

    if (data._protobuf) {
      this.realtimeValidationResults.push({
        type: "info",
        category,
        message: `Received Protocol Buffer data (${data._size.toLocaleString()} bytes)`,
      });
      this.realtimeValidationResults.push({
        type: "pass",
        category,
        message: "Feed is accessible and returning data",
      });
      return;
    }

    // Check for header
    const header = data.header;
    if (!header) {
      this.realtimeValidationResults.push({
        type: "error",
        category,
        message: "E: Missing feed header",
      });
      return;
    }

    // E038: Version check
    const version = header.gtfs_realtime_version || header.gtfsRealtimeVersion;
    if (version) {
      const validVersions = ["1.0", "2.0"];
      if (validVersions.includes(version)) {
        this.realtimeValidationResults.push({
          type: "pass",
          category,
          message: `GTFS-rt version: ${version}`,
        });
      } else {
        this.realtimeValidationResults.push({
          type: "warning",
          category,
          message: `E038: Unexpected gtfs_realtime_version "${version}" (expected 1.0 or 2.0)`,
        });
      }
    } else {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: "E048: Missing gtfs_realtime_version in header (required for v2.0+)",
      });
    }

    // Timestamp validation
    const timestamp = header.timestamp;
    if (timestamp) {
      // E001: Check if timestamp looks like milliseconds instead of seconds
      const now = Math.floor(Date.now() / 1000);
      if (timestamp > now * 100) {
        this.realtimeValidationResults.push({
          type: "error",
          category,
          message: `E001: Timestamp appears to be in milliseconds (${timestamp}), should be POSIX seconds`,
        });
      } else {
        const feedTime = new Date(timestamp * 1000);
        const ageSeconds = now - timestamp;
        const ageMinutes = ageSeconds / 60;

        // E050: Check for future timestamps
        if (ageSeconds < -60) {
          this.realtimeValidationResults.push({
            type: "error",
            category,
            message: `E050: Timestamp is ${Math.abs(Math.round(ageSeconds))}s in the future`,
          });
        } else if (ageSeconds < 0) {
          this.realtimeValidationResults.push({
            type: "warning",
            category,
            message: `Timestamp is slightly in the future (clock skew): ${feedTime.toISOString()}`,
          });
        } else if (ageSeconds > 65) {
          // W008: Header timestamp age warning
          this.realtimeValidationResults.push({
            type: "warning",
            category,
            message: `W008: Feed is ${ageMinutes > 1 ? Math.round(ageMinutes) + " minutes" : Math.round(ageSeconds) + " seconds"} old (should refresh every 35s)`,
          });
        } else {
          this.realtimeValidationResults.push({
            type: "pass",
            category,
            message: `Timestamp: ${feedTime.toISOString()} (${Math.round(ageSeconds)}s ago)`,
          });
        }
      }
    } else {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: "E048: Missing timestamp in header (required for v2.0+)",
      });
    }

    // E049: Check incrementality for v2.0+
    const incrementality = header.incrementality;
    if (version === "2.0" && incrementality === undefined) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: "E049: Missing incrementality in header (required for v2.0)",
      });
    }
  }

  /**
   * Validate GTFS-rt entities
   */
  validateRealtimeEntities(data, expectedType, categoryPrefix = "") {
    const category = categoryPrefix || "Entities";

    if (data._protobuf) return;

    const entities = data.entity || [];

    if (entities.length === 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: "Feed contains no entities",
      });
      return;
    }

    this.realtimeValidationResults.push({
      type: "info",
      category,
      message: `${entities.length.toLocaleString()} entities`,
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
        category,
        message: `${missingIds} entities missing required 'id' field`,
      });
    }

    // Report entity type counts and validate
    if (tripUpdates > 0) {
      this.realtimeValidationResults.push({
        type: expectedType === "trip_update" ? "pass" : "info",
        category,
        message: `${tripUpdates.toLocaleString()} Trip Update entities`,
      });
      this.validateTripUpdates(entities, category);
    }

    if (vehiclePositions > 0) {
      this.realtimeValidationResults.push({
        type: expectedType === "vehicle_position" ? "pass" : "info",
        category,
        message: `${vehiclePositions.toLocaleString()} Vehicle Position entities`,
      });
      this.validateVehiclePositions(entities, category);
    }

    if (alerts > 0) {
      this.realtimeValidationResults.push({
        type: expectedType === "service_alert" ? "pass" : "info",
        category,
        message: `${alerts.toLocaleString()} Service Alert entities`,
      });
      this.validateServiceAlerts(entities, category);
    }

    // Warn if expected type not found
    if (expectedType === "trip_update" && tripUpdates === 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: "No Trip Update entities found",
      });
    }
    if (expectedType === "vehicle_position" && vehiclePositions === 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: "No Vehicle Position entities found",
      });
    }
    if (expectedType === "service_alert" && alerts === 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: "No Service Alert entities found",
      });
    }
  }

  /**
   * Validate Trip Update entities (includes E040, E041, E022, E025, E043, E044 rules)
   */
  validateTripUpdates(entities, category = "Trip Updates") {
    let missingTrip = 0;
    let missingStopUpdates = 0;
    let missingStopRef = 0; // E040
    let sequenceNotSorted = 0; // E002
    let arrivalAfterDeparture = 0; // E025
    let missingTimeData = 0; // E043/E044
    let canceledWithUpdates = 0;
    let totalTripUpdates = 0;

    entities.forEach((entity) => {
      const tripUpdate = entity.trip_update || entity.tripUpdate;
      if (!tripUpdate) return;
      totalTripUpdates++;

      const trip = tripUpdate.trip;
      const scheduleRelationship = trip?.schedule_relationship || trip?.scheduleRelationship;
      const isCanceled = scheduleRelationship === "CANCELED" || scheduleRelationship === 3;

      // W006: Check for trip_id
      if (!trip || (!trip.trip_id && !trip.tripId)) {
        missingTrip++;
      }

      const stopTimeUpdates = tripUpdate.stop_time_update || tripUpdate.stopTimeUpdate || [];

      // E041: Non-canceled trips should have stop_time_updates
      if (stopTimeUpdates.length === 0 && !isCanceled) {
        missingStopUpdates++;
      }

      let lastSequence = -1;
      stopTimeUpdates.forEach((stu) => {
        const stopId = stu.stop_id || stu.stopId;
        const stopSequence = stu.stop_sequence || stu.stopSequence;
        const schedRel = stu.schedule_relationship || stu.scheduleRelationship;
        const isSkipped = schedRel === "SKIPPED" || schedRel === 1;
        const isNoData = schedRel === "NO_DATA" || schedRel === 2;

        // E040: Need stop_id or stop_sequence
        if (!stopId && stopSequence === undefined) {
          missingStopRef++;
        }

        // E002: Stop sequence should be sorted
        if (stopSequence !== undefined && stopSequence <= lastSequence) {
          sequenceNotSorted++;
        }
        if (stopSequence !== undefined) lastSequence = stopSequence;

        // E043: Non-skipped updates need arrival or departure
        const arrival = stu.arrival;
        const departure = stu.departure;
        if (!isSkipped && !isNoData && !arrival && !departure) {
          missingTimeData++;
        }

        // E025: Departure should not be before arrival
        if (arrival && departure) {
          const arrTime = arrival.time || arrival.delay;
          const depTime = departure.time || departure.delay;
          if (arrival.time && departure.time && departure.time < arrival.time) {
            arrivalAfterDeparture++;
          }
        }
      });
    });

    if (totalTripUpdates === 0) return;

    // Report results
    if (missingTrip > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category,
        message: `W006: ${missingTrip} trip updates missing trip_id`,
      });
    }

    if (missingStopUpdates > 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: `E041: ${missingStopUpdates} non-canceled trips have no stop_time_updates`,
      });
    }

    if (missingStopRef > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category,
        message: `E040: ${missingStopRef} stop_time_updates missing both stop_id and stop_sequence`,
      });
    }

    if (sequenceNotSorted > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category,
        message: `E002: ${sequenceNotSorted} stop_time_updates not sorted by stop_sequence`,
      });
    }

    if (arrivalAfterDeparture > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category,
        message: `E025: ${arrivalAfterDeparture} stop times have departure before arrival`,
      });
    }

    // Summary pass if no major issues
    const hasErrors = missingTrip > 0 || missingStopRef > 0 || sequenceNotSorted > 0 || arrivalAfterDeparture > 0;
    if (!hasErrors) {
      this.realtimeValidationResults.push({
        type: "pass",
        category,
        message: `All ${totalTripUpdates} trip updates have valid structure`,
      });
    }
  }

  /**
   * Validate Vehicle Position entities (includes E026, E027, W002, W004 rules)
   */
  validateVehiclePositions(entities, category = "Vehicle Positions") {
    let missingPosition = 0;
    let invalidCoords = 0; // E026
    let invalidBearing = 0; // E027
    let missingVehicleId = 0; // W002
    let highSpeed = 0; // W004
    let totalVehicles = 0;

    entities.forEach((entity) => {
      const vehicle = entity.vehicle || entity.vehiclePosition;
      if (!vehicle) return;
      totalVehicles++;

      // W002: Check for vehicle_id
      const vehicleDesc = vehicle.vehicle;
      if (!vehicleDesc || (!vehicleDesc.id && !vehicleDesc.label)) {
        missingVehicleId++;
      }

      const position = vehicle.position;
      if (!position) {
        missingPosition++;
        return;
      }

      const lat = position.latitude;
      const lon = position.longitude;

      // E026: Validate coordinates
      if (lat === undefined || lon === undefined) {
        missingPosition++;
      } else if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        invalidCoords++;
      }

      // E027: Validate bearing (0-360)
      const bearing = position.bearing;
      if (bearing !== undefined && (bearing < 0 || bearing > 360)) {
        invalidBearing++;
      }

      // W004: Check for high speed (>26 m/s ≈ 58 mph)
      const speed = position.speed;
      if (speed !== undefined && speed > 26) {
        highSpeed++;
      }
    });

    if (totalVehicles === 0) return;

    // Report results
    if (missingPosition > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category,
        message: `${missingPosition} vehicles missing position data`,
      });
    }

    if (invalidCoords > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category,
        message: `E026: ${invalidCoords} vehicles have invalid coordinates (lat must be -90 to 90, lon -180 to 180)`,
      });
    }

    if (invalidBearing > 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: `E027: ${invalidBearing} vehicles have invalid bearing (must be 0-360)`,
      });
    }

    if (missingVehicleId > 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: `W002: ${missingVehicleId} vehicles missing vehicle_id`,
      });
    }

    if (highSpeed > 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: `W004: ${highSpeed} vehicles reporting speed > 26 m/s (58 mph)`,
      });
    }

    // Summary pass if no major issues
    const hasErrors = missingPosition > 0 || invalidCoords > 0;
    if (!hasErrors) {
      this.realtimeValidationResults.push({
        type: "pass",
        category,
        message: `All ${totalVehicles} vehicle positions have valid coordinates`,
      });
    }
  }

  /**
   * Validate Service Alert entities (includes E032, E033 rules)
   */
  validateServiceAlerts(entities, category = "Service Alerts") {
    let missingInformedEntity = 0; // E032
    let emptyInformedEntity = 0; // E033
    let missingHeaderText = 0;
    let totalAlerts = 0;

    entities.forEach((entity) => {
      const alert = entity.alert;
      if (!alert) return;
      totalAlerts++;

      // E032: Must have at least one informed_entity
      const informedEntities = alert.informed_entity || alert.informedEntity || [];
      if (informedEntities.length === 0) {
        missingInformedEntity++;
      } else {
        // E033: Each informed_entity needs at least one specifier
        informedEntities.forEach(ie => {
          const hasAgency = ie.agency_id || ie.agencyId;
          const hasRoute = ie.route_id || ie.routeId;
          const hasTrip = ie.trip;
          const hasStop = ie.stop_id || ie.stopId;
          const hasRouteType = ie.route_type !== undefined || ie.routeType !== undefined;

          if (!hasAgency && !hasRoute && !hasTrip && !hasStop && !hasRouteType) {
            emptyInformedEntity++;
          }
        });
      }

      // Check for header text
      const headerText = alert.header_text || alert.headerText;
      if (!headerText || !headerText.translation || headerText.translation.length === 0) {
        missingHeaderText++;
      }
    });

    if (totalAlerts === 0) return;

    if (missingInformedEntity > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category,
        message: `E032: ${missingInformedEntity} alerts missing informed_entity`,
      });
    }

    if (emptyInformedEntity > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category,
        message: `E033: ${emptyInformedEntity} informed_entities have no specifier (route, trip, stop, etc.)`,
      });
    }

    if (missingHeaderText > 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: `${missingHeaderText} alerts missing header_text`,
      });
    }

    const hasErrors = missingInformedEntity > 0 || emptyInformedEntity > 0;
    if (!hasErrors) {
      this.realtimeValidationResults.push({
        type: "pass",
        category,
        message: `All ${totalAlerts} service alerts have valid structure`,
      });
    }
  }

  /**
   * Validate timestamps in GTFS-rt (includes E012, E050 for entities)
   */
  validateRealtimeTimestamps(data, categoryPrefix = "") {
    const category = categoryPrefix || "Timestamps";

    if (data._protobuf) return;

    const entities = data.entity || [];
    const now = Math.floor(Date.now() / 1000);
    const headerTimestamp = data.header?.timestamp;
    let futureTimestamps = 0;
    let staleTimestamps = 0;
    let afterHeaderTimestamp = 0; // E012

    entities.forEach((entity) => {
      const tripUpdate = entity.trip_update || entity.tripUpdate;
      if (tripUpdate && tripUpdate.timestamp) {
        const ts = tripUpdate.timestamp;
        if (ts > now + 60) futureTimestamps++;
        if (ts < now - 3600) staleTimestamps++;
        // E012: Entity timestamp should not exceed header timestamp
        if (headerTimestamp && ts > headerTimestamp) afterHeaderTimestamp++;
      }

      const vehicle = entity.vehicle || entity.vehiclePosition;
      if (vehicle && vehicle.timestamp) {
        const ts = vehicle.timestamp;
        if (ts > now + 60) futureTimestamps++;
        if (ts < now - 300) staleTimestamps++;
        if (headerTimestamp && ts > headerTimestamp) afterHeaderTimestamp++;
      }
    });

    if (afterHeaderTimestamp > 0) {
      this.realtimeValidationResults.push({
        type: "error",
        category,
        message: `E012: ${afterHeaderTimestamp} entities have timestamps after header timestamp`,
      });
    }

    if (futureTimestamps > 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: `E050: ${futureTimestamps} entities have timestamps >60s in the future`,
      });
    }

    if (staleTimestamps > 0) {
      this.realtimeValidationResults.push({
        type: "warning",
        category,
        message: `${staleTimestamps} entities have stale timestamps (>5-60 min old)`,
      });
    }

    if (afterHeaderTimestamp === 0 && futureTimestamps === 0 && staleTimestamps === 0 && entities.length > 0) {
      this.realtimeValidationResults.push({
        type: "pass",
        category,
        message: "Entity timestamps are valid",
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
    const tripUpdatesUrl = document.getElementById("realtimeTripUpdatesUrl")?.value.trim();
    const vehiclePositionsUrl = document.getElementById("realtimeVehiclePositionsUrl")?.value.trim();
    const serviceAlertsUrl = document.getElementById("realtimeServiceAlertsUrl")?.value.trim();
    const statusEl = document.getElementById("combinedValidationStatus");
    const resultsEl = document.getElementById("combinedValidationResults");
    const summaryEl = document.getElementById("combinedSummary");
    const detailsEl = document.getElementById("combinedDetails");

    const staticFile = staticFileInput ? staticFileInput.files[0] : null;
    const staticUrl = staticUrlInput ? staticUrlInput.value.trim() : "";

    // Check if we have static data already loaded or need to load it
    const hasStaticSource = staticFile || staticUrl || this.staticGtfsData;
    const hasRealtimeSource = tripUpdatesUrl || vehiclePositionsUrl || serviceAlertsUrl ||
      (this.realtimeData && Object.keys(this.realtimeData).length > 0);

    if (!hasStaticSource) {
      this.showStatus(statusEl, "Please load a static GTFS file or URL in the Static GTFS section above", "error");
      return;
    }

    if (!hasRealtimeSource) {
      this.showStatus(statusEl, "Please enter at least one GTFS-rt feed URL in the GTFS Realtime section above", "error");
      return;
    }

    try {
      resultsEl.style.display = "none";
      this.combinedValidationResults = [];

      let gtfsData = this.staticGtfsData;

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

      // Load GTFS-rt feeds if not already loaded
      if (!this.realtimeData || Object.keys(this.realtimeData).length === 0) {
        const feeds = [
          { url: tripUpdatesUrl, type: "trip_update", name: "Trip Updates" },
          { url: vehiclePositionsUrl, type: "vehicle_position", name: "Vehicle Positions" },
          { url: serviceAlertsUrl, type: "service_alert", name: "Service Alerts" },
        ].filter(f => f.url);

        this.realtimeData = {};
        for (const feed of feeds) {
          this.showStatus(statusEl, `Loading ${feed.name}...`, "loading");
          try {
            const data = await this.fetchRealtimeFeed(feed.url);
            this.realtimeData[feed.type] = data;
          } catch (error) {
            this.combinedValidationResults.push({
              type: "error",
              category: "Feed Loading",
              message: `Failed to load ${feed.name}: ${error.message}`,
            });
          }
        }
      }

      // Merge all realtime entities for comparison
      const allRealtimeEntities = [];
      Object.values(this.realtimeData).forEach(data => {
        if (data && data.entity) {
          allRealtimeEntities.push(...data.entity);
        }
      });

      const mergedRealtimeData = { entity: allRealtimeEntities };

      // Run combined validation
      this.showStatus(statusEl, "Comparing feeds...", "loading");

      this.validateTripIdMatching(gtfsData, mergedRealtimeData);
      this.validateRouteIdMatching(gtfsData, mergedRealtimeData);
      this.validateStopIdMatching(gtfsData, mergedRealtimeData);
      this.validateStopSequenceMatching(gtfsData, mergedRealtimeData);
      this.validateScheduleRelationships(gtfsData, mergedRealtimeData);

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
   * Validate stop_sequence matching (E051)
   */
  validateStopSequenceMatching(gtfsData, realtimeData) {
    if (realtimeData._protobuf) return;

    const stopTimes = gtfsData["stop_times.txt"] || [];
    if (stopTimes.length === 0) {
      this.combinedValidationResults.push({
        type: "info",
        category: "Stop Sequence Matching",
        message: "No stop_times.txt data to validate against",
      });
      return;
    }

    // Build lookup: trip_id -> Set of stop_sequences
    const tripStopSequences = new Map();
    stopTimes.forEach(st => {
      const tripId = st.trip_id;
      const seq = parseInt(st.stop_sequence, 10);
      if (!tripStopSequences.has(tripId)) {
        tripStopSequences.set(tripId, new Set());
      }
      tripStopSequences.get(tripId).add(seq);
    });

    const entities = realtimeData.entity || [];
    let matched = 0, unmatched = 0;
    const unmatchedSamples = [];

    entities.forEach((entity) => {
      const tripUpdate = entity.trip_update || entity.tripUpdate;
      if (!tripUpdate) return;

      const tripId = tripUpdate.trip?.trip_id || tripUpdate.trip?.tripId;
      if (!tripId) return;

      const validSequences = tripStopSequences.get(tripId);
      if (!validSequences) return; // Trip not in static, handled by trip_id validation

      const stopTimeUpdates = tripUpdate.stop_time_update || tripUpdate.stopTimeUpdate || [];
      stopTimeUpdates.forEach(stu => {
        const seq = stu.stop_sequence || stu.stopSequence;
        if (seq === undefined) return; // Only validate if stop_sequence is provided

        if (validSequences.has(seq)) {
          matched++;
        } else {
          unmatched++;
          if (unmatchedSamples.length < 3) {
            unmatchedSamples.push(`trip ${tripId} seq ${seq}`);
          }
        }
      });
    });

    const total = matched + unmatched;
    if (total === 0) {
      this.combinedValidationResults.push({
        type: "info",
        category: "Stop Sequence Matching",
        message: "No stop_sequences in realtime feed to validate",
      });
      return;
    }

    if (unmatched === 0) {
      this.combinedValidationResults.push({
        type: "pass",
        category: "Stop Sequence Matching",
        message: `All ${matched.toLocaleString()} stop_sequences match GTFS stop_times.txt`,
      });
    } else {
      const matchRate = ((matched / total) * 100).toFixed(1);
      // Downgrade to warning if match rate is high (>= 95%)
      const severityType = parseFloat(matchRate) >= 95 ? "warning" : "error";
      this.combinedValidationResults.push({
        type: severityType,
        category: "Stop Sequence Matching",
        message: `E051: ${unmatched} stop_sequences not found in GTFS (${matchRate}% match rate)`,
      });
      if (unmatchedSamples.length > 0) {
        this.combinedValidationResults.push({
          type: "info",
          category: "Stop Sequence Matching",
          message: `Samples: ${unmatchedSamples.join(", ")}`,
        });
      }
    }
  }

  /**
   * Validate schedule relationships
   */
  validateScheduleRelationships(gtfsData, realtimeData) {
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
   * List of CORS proxies to try in order
   * Note: corsproxy.io now blocks zip/binary files on free plan
   */
  getProxyList() {
    return [
      // These may work for binary files
      { name: "corsproxy.org", url: "https://corsproxy.org/?", encode: true, type: "raw" },
      { name: "codetabs", url: "https://api.codetabs.com/v1/proxy?quest=", encode: true, type: "raw" },
      { name: "allorigins-raw", url: "https://api.allorigins.win/raw?url=", encode: true, type: "raw" },
      // corsproxy.io blocks binary on free plan - try last
      { name: "corsproxy.io", url: "https://corsproxy.io/?", encode: true, type: "raw" },
    ];
  }

  /**
   * Build proxy URL - handles different proxy formats
   */
  buildProxyUrl(proxy, targetUrl, encode = true) {
    if (!encode || proxy.includes("cors.sh")) {
      return proxy + targetUrl;
    }
    return proxy + encodeURIComponent(targetUrl);
  }

  /**
   * Try fetching with multiple proxies until one works
   */
  async fetchWithProxies(url, returnBlob = false) {
    const proxies = this.getProxyList();
    const errors = [];

    for (const proxy of proxies) {
      const proxyUrl = this.buildProxyUrl(proxy.url, url, proxy.encode);
      console.log(`Trying ${proxy.name}:`, proxyUrl);

      try {
        const response = await fetch(proxyUrl);
        if (response.ok) {
          console.log(`${proxy.name} SUCCESS! Status:`, response.status);

          // Handle JSON-wrapped responses (like allorigins /get endpoint)
          if (proxy.type === "json") {
            const json = await response.json();
            if (json.contents) {
              console.log(`${proxy.name} returned JSON-wrapped content`);
              // Convert base64 or string content to blob
              if (returnBlob) {
                // For binary data, contents might be base64
                const blob = new Blob([json.contents]);
                return { blob, proxy: proxy.name };
              }
              return { text: json.contents, proxy: proxy.name };
            }
          }

          return { response, proxy: proxy.name };
        }
        console.log(`${proxy.name} returned status:`, response.status);
        errors.push(`${proxy.name}: HTTP ${response.status}`);
      } catch (e) {
        console.log(`${proxy.name} FAILED:`, e.message);
        errors.push(`${proxy.name}: ${e.message}`);
      }
    }

    throw new Error(`All proxies failed: ${errors.join("; ")}`);
  }

  /**
   * Load GTFS from URL - tries direct fetch first, falls back to proxies
   */
  async loadGtfsFromUrl(url) {
    // First try direct fetch
    try {
      console.log("Attempting direct fetch:", url);
      const response = await fetch(url, {
        mode: "cors",
        credentials: "omit",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log("Direct fetch succeeded, blob size:", blob.size);
      return this.parseGtfsFile(blob);
    } catch (directError) {
      console.log("Direct fetch failed:", directError.message);

      // If direct fetch fails, try proxies
      if (!this.isProxyEnabled()) {
        throw new Error("CORS blocked. Enable 'Use CORS proxy' at the top of the page.");
      }

      const selectedProxy = this.getProxyUrl();

      // If a specific proxy is selected (not auto), try it first
      if (selectedProxy && selectedProxy !== "auto") {
        try {
          const proxyUrl = this.buildProxyUrl(selectedProxy, url);
          console.log("Trying selected proxy:", proxyUrl);
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const blob = await response.blob();
            console.log("Selected proxy succeeded, blob size:", blob.size);
            return this.parseGtfsFile(blob);
          }
        } catch (e) {
          console.log("Selected proxy failed, trying others...");
        }
      }

      // Try all proxies
      try {
        const result = await this.fetchWithProxies(url, true);
        let blob;
        if (result.blob) {
          blob = result.blob;
        } else if (result.response) {
          blob = await result.response.blob();
        }
        console.log(`Proxy fetch succeeded via ${result.proxy}, blob size:`, blob.size);
        return this.parseGtfsFile(blob);
      } catch (proxyError) {
        console.error("All proxies failed:", proxyError.message);
        throw new Error(`Failed to fetch: ${proxyError.message}`);
      }
    }
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
