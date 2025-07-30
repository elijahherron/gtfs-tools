// Main application entry point
document.addEventListener('DOMContentLoaded', function() {
    // Check if required libraries are available
    if (typeof JSZip === 'undefined') {
        console.error('JSZip library not found. Loading from CDN...');
        loadJSZip();
        return;
    }
    
    if (typeof L === 'undefined') {
        console.error('Leaflet library not found. Please check your internet connection.');
        alert('Failed to load map library. Please refresh the page or check your internet connection.');
        return;
    }
    
    // Initialize the GTFS Editor
    const editor = new GTFSEditor();
    console.log('GTFS Editor initialized');
    console.log('Leaflet version:', L.version);
});

// Load JSZip library if not available
function loadJSZip() {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = function() {
        console.log('JSZip loaded from CDN');
        const editor = new GTFSEditor();
        console.log('GTFS Editor initialized');
    };
    script.onerror = function() {
        console.error('Failed to load JSZip library');
        alert('Failed to load required libraries. Please check your internet connection.');
    };
    document.head.appendChild(script);
}

// Add drag and drop functionality
document.addEventListener('DOMContentLoaded', function() {
    const uploadSection = document.querySelector('.upload-section');
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadSection.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadSection.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadSection.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    uploadSection.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight(e) {
        uploadSection.style.backgroundColor = '#e3f2fd';
        uploadSection.style.border = '2px dashed #2c5aa0';
    }
    
    function unhighlight(e) {
        uploadSection.style.backgroundColor = '';
        uploadSection.style.border = '';
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            const fileInput = document.getElementById('gtfsUpload');
            fileInput.files = files;
            
            // Trigger upload if it's a zip file
            if (files[0].name.endsWith('.zip')) {
                document.getElementById('uploadBtn').click();
            }
        }
    }
});

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + S to download
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn && !downloadBtn.disabled) {
            downloadBtn.click();
        }
    }
    
    // Delete key to delete selected rows
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeElement = document.activeElement;
        // Only trigger if not in an input field
        if (activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            const deleteBtn = document.getElementById('deleteRowBtn');
            if (deleteBtn && !deleteBtn.disabled) {
                deleteBtn.click();
            }
        }
    }
    
    // Ctrl/Cmd + A to select all rows
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            e.preventDefault();
            selectAllCheckbox.checked = true;
            selectAllCheckbox.dispatchEvent(new Event('change'));
        }
    }
});

// Add error handling for uncaught errors
window.addEventListener('error', function(e) {
    console.error('Application error:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
});