// Main application entry point
document.addEventListener("DOMContentLoaded", function () {
  // Initialize sidebar navigation as early as possible so the UI is responsive
  // even if other libraries (like JSZip) are still loading.
  initializeSidebarNavigation();

  // Check if required libraries are available. If JSZip is missing we
  // load it asynchronously; the loader will create the editor when it's ready.
  if (typeof JSZip === "undefined") {
    console.error("JSZip library not found. Loading from CDN...");
    loadJSZip();
    // don't return here; sidebar is already initialized and loadJSZip's onload
    // will create the editor and set window.editor when ready.
  } else if (typeof L === "undefined") {
    console.error(
      "Leaflet library not found. Please check your internet connection."
    );
    alert(
      "Failed to load map library. Please refresh the page or check your internet connection."
    );
    return;
  } else {
    // Initialize the GTFS Editor now that required libs are present
    const editor = new GTFSEditor();
    window.editor = editor; // Make editor globally accessible
    console.log("GTFS Editor initialized");
    console.log("Leaflet version:", L.version);
  }

  // Initialize drag and drop functionality
  const uploadSection = document.querySelector(".upload-section");
  if (uploadSection) {
    // Prevent default drag behaviors
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      uploadSection.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop area when item is dragged over it
    ["dragenter", "dragover"].forEach((eventName) => {
      uploadSection.addEventListener(eventName, highlight, false);
    });

    ["dragleave", "drop"].forEach((eventName) => {
      uploadSection.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    uploadSection.addEventListener("drop", handleDrop, false);
  } else {
    console.warn(
      "Upload section (.upload-section) not found in DOM; drag-and-drop disabled"
    );
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight(e) {
    uploadSection.style.backgroundColor = "#e3f2fd";
    uploadSection.style.border = "2px dashed #2c5aa0";
  }

  function unhighlight(e) {
    uploadSection.style.backgroundColor = "";
    uploadSection.style.border = "";
  }

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
      const fileInput = document.getElementById("gtfsUpload");
      if (fileInput) {
        try {
          fileInput.files = files;
        } catch (err) {
          console.warn("Could not assign dropped files to file input:", err);
        }
      } else {
        console.warn("gtfsUpload input not found; dropped files not assigned");
      }

      // Trigger upload if it's a zip file and upload button exists
      if (files[0].name.endsWith(".zip")) {
        const uploadBtn = document.getElementById("uploadBtn");
        if (uploadBtn) uploadBtn.click();
      }
    }
  }

  // Add keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Ctrl/Cmd + S to download
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      const downloadBtn = document.getElementById("downloadBtn");
      if (downloadBtn && !downloadBtn.disabled) {
        downloadBtn.click();
      }
    }

    // Delete key to delete selected rows
    if (e.key === "Delete" || e.key === "Backspace") {
      const activeElement = document.activeElement;
      // Only trigger if not in an input field
      if (activeElement.tagName !== "INPUT") {
        e.preventDefault();
        const deleteBtn = document.getElementById("deleteRowBtn");
        if (deleteBtn && !deleteBtn.disabled) {
          deleteBtn.click();
        }
      }
    }

    // Ctrl/Cmd + A to select all rows
    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      const selectAllCheckbox = document.getElementById("selectAll");
      if (selectAllCheckbox) {
        e.preventDefault();
        selectAllCheckbox.checked = true;
        selectAllCheckbox.dispatchEvent(new Event("change"));
      }
    }

    // Ctrl/Cmd + Z to undo last shape point
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      // Only prevent default and handle undo if we're in map view and creating a trip
      const mapViewEl = document.getElementById("mapView");
      if (
        window.mapEditor &&
        window.mapEditor.isCreatingTrip &&
        mapViewEl &&
        mapViewEl.style.display !== "none"
      ) {
        e.preventDefault();
        window.mapEditor.undoLastShapePoint();
      }
    }
  });

  // Add toggle button for route creator panel
  const toggleCreatorBtn = document.getElementById("toggleCreatorBtn");
  if (toggleCreatorBtn) {
    toggleCreatorBtn.addEventListener("click", function (e) {
      // Stop the event from propagating to the map
      e.stopPropagation();
      e.preventDefault();

      const mapToolbar = document.querySelector(".map-toolbar");
      if (mapToolbar) {
        const isCollapsed = mapToolbar.classList.contains("collapsed");
        mapToolbar.classList.toggle("collapsed");
        // Update arrow direction: collapsed = → (show), open = ← (hide)
        toggleCreatorBtn.textContent = isCollapsed ? "←" : "→";
        toggleCreatorBtn.title = isCollapsed ? "Hide Route Creator" : "Show Route Creator";
      }
    });
  }

  // Floating sidebar toggle (right side)
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  const routeInfoSidebar = document.getElementById("routeInfoSidebar");

  if (toggleSidebarBtn && routeInfoSidebar) {
    toggleSidebarBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isCollapsed = routeInfoSidebar.classList.contains("collapsed");
      if (isCollapsed) {
        routeInfoSidebar.classList.remove("collapsed");
        routeInfoSidebar.classList.add("open");
        // Update arrow direction: collapsed = ← (show), open = → (hide)
        toggleSidebarBtn.textContent = "→";
        toggleSidebarBtn.title = "Hide Route Info";
      } else {
        routeInfoSidebar.classList.add("collapsed");
        routeInfoSidebar.classList.remove("open");
        toggleSidebarBtn.textContent = "←";
        toggleSidebarBtn.title = "Show Route Info";
      }
    });
  }

  // Initialize floating instructions panel
  const floatingInstructions = document.getElementById("floatingInstructions");
  const closeInstructionsBtn = document.getElementById("closeInstructions");
  const collapseInstructionsBtn = document.getElementById("collapseInstructions");
  const instructionsContent = document.getElementById("instructionsWindowContent");

  if (closeInstructionsBtn) {
    closeInstructionsBtn.addEventListener("click", () => {
      if (floatingInstructions) {
        floatingInstructions.style.display = "none";
      }
    });
  }

  if (collapseInstructionsBtn && instructionsContent) {
    collapseInstructionsBtn.addEventListener("click", () => {
      instructionsContent.classList.toggle("collapsed");
      collapseInstructionsBtn.textContent = instructionsContent.classList.contains("collapsed") ? "−" : "+";
    });
  }

  // Make floating instructions panel draggable
  if (floatingInstructions) {
    const dragHandle = floatingInstructions.querySelector(".drag-handle");

    if (dragHandle) {
      let isDragging = false;
      let currentX;
      let currentY;
      let initialX;
      let initialY;
      let xOffset = 0;
      let yOffset = 0;

      dragHandle.addEventListener("mousedown", dragStart);
      document.addEventListener("mousemove", drag);
      document.addEventListener("mouseup", dragEnd);

      function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === dragHandle || dragHandle.contains(e.target)) {
          isDragging = true;
          dragHandle.style.cursor = "grabbing";
        }
      }

      function drag(e) {
        if (isDragging) {
          e.preventDefault();
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;
          xOffset = currentX;
          yOffset = currentY;

          setTranslate(currentX, currentY, floatingInstructions);
        }
      }

      function dragEnd(e) {
        if (isDragging) {
          initialX = currentX;
          initialY = currentY;
          isDragging = false;
          dragHandle.style.cursor = "grab";
        }
      }

      function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
      }
    }
  }

  // Add error handling for uncaught errors
  window.addEventListener("error", function (e) {
    console.error("Application error:", e.error);
  });

  window.addEventListener("unhandledrejection", function (e) {
    console.error("Unhandled promise rejection:", e.reason);
  });
});

// Load JSZip library if not available
function loadJSZip() {
  const script = document.createElement("script");
  script.src =
    "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  script.onload = function () {
    console.log("JSZip loaded from CDN");
    // Create the GTFS editor now that JSZip is available. Make it global
    // so other parts of the app (preview, sidebar handlers) can reference it.
    try {
      const editor = new GTFSEditor();
      window.editor = editor;
      console.log("GTFS Editor initialized (after JSZip load)");
    } catch (err) {
      console.error("Failed to initialize GTFS Editor after JSZip load:", err);
    }
  };
  script.onerror = function () {
    console.error("Failed to load JSZip library");
    alert(
      "Failed to load required libraries. Please check your internet connection."
    );
  };
  document.head.appendChild(script);
}

// Initialize sidebar navigation
function initializeSidebarNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".content-section");

  console.log("Initializing sidebar navigation...");
  console.log("Found nav items:", navItems.length);
  console.log("Found sections:", sections.length);

  // View toggle element (Table/Map buttons) should only be visible in
  // certain sections (import/edit and create). Hide it by default and
  // toggle visibility when sections change.
  // There may be view-toggle controls inside specific sections (import/create).
  // Find all of them and only show the one that lives inside the active section.
  const allViewToggles = Array.from(document.querySelectorAll(".view-toggle"));
  const updateViewToggleForSection = (sectionName) => {
    // Hide all toggles first
    allViewToggles.forEach((vt) => (vt.style.display = "none"));

    // Don't automatically show toggles - they should only be shown
    // when data is loaded via setViewButtonsEnabled(true)
    // This prevents toggles from appearing in empty sections
  };

  // Set initial visibility based on currently active nav item (if any)
  const initialActive = document.querySelector(".nav-item.active");
  if (initialActive) {
    updateViewToggleForSection(initialActive.getAttribute("data-section"));
  } else if (navItems.length > 0) {
    // Default to the first nav item if none marked active
    updateViewToggleForSection(navItems[0].getAttribute("data-section"));
  }

  navItems.forEach((navItem) => {
    navItem.addEventListener("click", function () {
      const sectionName = this.getAttribute("data-section");
      console.log("Clicked section:", sectionName);

      // Special handling for instructions - show floating modal only
      if (sectionName === "instructions") {
        const floatingInstructions = document.getElementById("floatingInstructions");
        if (floatingInstructions) {
          floatingInstructions.style.display = "block";
          const content = document.getElementById("instructionsWindowContent");
          if (content) {
            content.classList.remove("collapsed");
          }
        }
        // Don't change navigation state
        return;
      }

      // Remove active class from all nav items
      navItems.forEach((item) => item.classList.remove("active"));

      // Add active class to clicked nav item
      this.classList.add("active");

      // Hide all sections
      sections.forEach((section) => section.classList.remove("active"));

      // Show selected section
      const targetSection = document.getElementById(`${sectionName}-section`);
      console.log("Target section:", targetSection);
      if (targetSection) {
        targetSection.classList.add("active");
        console.log("Activated section:", sectionName);
      } else {
        console.error("Section not found:", `${sectionName}-section`);
      }

      // Update the visibility of the view toggle buttons based on section
      updateViewToggleForSection(sectionName);

      // Diagnostic: log layout info for each section to detect hidden/zero-size content
      console.log("--- section layout diagnostics ---");
      sections.forEach((s) => {
        try {
          const id = s.id || "(no-id)";
          const style = window.getComputedStyle(s);
          const rect = s.getBoundingClientRect();
          console.log(
            `section=${id} display=${style.display} visibility=${
              style.visibility
            } children=${s.childElementCount} rect=${rect.width}x${
              rect.height
            } @(${rect.x.toFixed(0)},${rect.y.toFixed(0)})`
          );
        } catch (err) {
          console.warn("diagnostic failed for section", s, err);
        }
      });
      console.log("--- end diagnostics ---");

      // Special handling for create section with map - ensure map is properly sized
      if (sectionName === "create") {
        // Don't auto-show any subsection - let the user choose via createNewBtn or nav subitems
        // Only invalidate map if it exists
        setTimeout(() => {
          if (window.mapEditor && window.mapEditor.map) {
            window.mapEditor.map.invalidateSize();
          }
        }, 100);
      }

      // Special handling for preview section - update preview data
      if (sectionName === "preview") {
        if (
          window.editor &&
          typeof window.editor.updatePreview === "function"
        ) {
          window.editor.updatePreview();
        }
      }
    });
  });

  // Handle subsection navigation (Create section: Build/Table/Preview)
  const navSubitems = document.querySelectorAll(".nav-subitem");
  const showCreateSubsection = (subsectionName) => {
    console.log("Showing create subsection:", subsectionName);

    // Special handling for modal-only subsections (preview & export)
    if (subsectionName === "preview") {
      if (window.editor && window.editor.previewGTFS) {
        window.editor.previewGTFS();
      }
      return; // Don't try to show a subsection
    }

    if (subsectionName === "export") {
      const exportWindow = document.getElementById("floatingExportWindow");
      if (exportWindow) {
        exportWindow.style.display = "flex";
      }
      return; // Don't try to show a subsection
    }

    // Hide all subsections
    const subsections = document.querySelectorAll(".create-subsection");
    subsections.forEach((sub) => (sub.style.display = "none"));

    // Show selected subsection
    const targetSubsection = document.getElementById(
      `${subsectionName}Subsection`
    );
    if (targetSubsection) {
      targetSubsection.style.display = "block";
      console.log("Showed subsection:", subsectionName);

      // Special handling for build subsection
      if (subsectionName === "build") {
        setTimeout(() => {
          if (window.mapEditor) {
            if (window.mapEditor.map) {
              console.log("Invalidating map size for build subsection");
              window.mapEditor.map.invalidateSize();
            } else {
              console.log("Map not initialized, initializing now");
              window.mapEditor.initializeMap("mapContainer");
            }
            // Show mode selection screen
            if (window.mapEditor.showModeSelection) {
              window.mapEditor.showModeSelection();
            }
          }
        }, 300);
      }

      // Special handling for table subsection
      if (subsectionName === "table" && window.mapEditor) {
        window.mapEditor.populateCreateTableView();
      }
    }
  };

  // Make showCreateSubsection available globally
  window.showCreateSubsection = showCreateSubsection;

  navSubitems.forEach((subitem) => {
    subitem.addEventListener("click", function () {
      const subsectionName = this.getAttribute("data-subsection");
      console.log("Clicked subsection:", subsectionName);

      // Remove active class from all subitems
      navSubitems.forEach((item) => item.classList.remove("active"));

      // Add active class to clicked subitem
      this.classList.add("active");

      // Show the subsection
      showCreateSubsection(subsectionName);
    });
  });
}

// Diagnostic runner: automatically log editor/map DOM diagnostics once after load
document.addEventListener("DOMContentLoaded", () => {
  // Run slightly after initial load to allow any initialization to run
  setTimeout(() => {
    try {
      console.log("AUTO EDITOR DIAGNOSTICS (startup) ---");
      const ids = [
        "import-section",
        "editorSection",
        "editorTitle",
        "fileTabs",
        "tableView",
        "tableContainer",
        "mapEditorSection",
        "mapView",
        "mapContainer",
      ];

      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) {
          console.log(`${id}: MISSING`);
          return;
        }
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        console.log(
          `${id}: display=${s.display}, visibility=${s.visibility}, children=${
            el.childElementCount
          }, rect=${Math.round(r.width)}x${Math.round(r.height)}@(${Math.round(
            r.x
          )},${Math.round(r.y)})`
        );
      });

      const tableContainer = document.getElementById("tableContainer");
      console.log(
        "tableContainer innerHTML length:",
        tableContainer ? tableContainer.innerHTML.length : "missing"
      );

      const imp = document.getElementById("import-section");
      const ed = document.getElementById("editorSection");
      console.log(
        "Is editorSection inside import-section?",
        imp && ed ? imp.contains(ed) : "unknown"
      );

      // Parent chain diagnostics for import-section and editorSection
      const parentChain = (el) => {
        if (!el) return "missing";
        const parts = [];
        let cur = el;
        while (cur) {
          const id = cur.id ? `#${cur.id}` : "";
          const cls = cur.className
            ? `.${cur.className.toString().split(" ").join(".")}`
            : "";
          parts.push(`${cur.tagName.toLowerCase()}${id}${cls}`);
          cur = cur.parentElement;
        }
        return parts.join(" > ");
      };

      console.log("import-section parent chain:", parentChain(imp));
      console.log("editorSection parent chain:", parentChain(ed));

      console.log(
        "Active content sections:",
        Array.from(document.querySelectorAll(".content-section")).map((s) => ({
          id: s.id,
          active: s.classList.contains("active"),
          display: window.getComputedStyle(s).display,
          children: s.childElementCount,
        }))
      );
      console.log("AUTO EDITOR DIAGNOSTICS (startup) --- end");
    } catch (err) {
      console.error("Auto diagnostics failed:", err);
    }
  }, 600);
});
