// GTFS Editor - Handles the UI for editing GTFS data
class GTFSEditor {
    constructor() {
        this.parser = new GTFSParser();
        this.currentFile = null;
        this.selectedRows = new Set();
        this.mapEditor = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // File upload
        document.getElementById('uploadBtn').addEventListener('click', () => this.handleFileUpload());
        
        // Create new feed
        document.getElementById('createNewBtn').addEventListener('click', () => this.createNewFeed());
        
        // Editor actions
        document.getElementById('addRowBtn').addEventListener('click', () => this.addRow());
        document.getElementById('deleteRowBtn').addEventListener('click', () => this.deleteSelectedRows());
        document.getElementById('validateBtn').addEventListener('click', () => this.validateFeed());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadFeed());
    }

    async handleFileUpload() {
        const fileInput = document.getElementById('gtfsUpload');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showStatus('Please select a GTFS file', 'error');
            return;
        }

        if (!file.name.endsWith('.zip')) {
            this.showStatus('Please select a ZIP file', 'error');
            return;
        }

        this.showStatus('Uploading and parsing GTFS file...', 'loading');

        try {
            const result = await this.parser.parseGTFSFile(file);
            
            if (result.success) {
                this.showStatus(`Successfully loaded GTFS with ${result.files.length} files`, 'success');
                this.showEditor(result.files);
                this.currentFile = result.files[0]; // Default to first file
                this.displayFileContent(this.currentFile);
            } else {
                this.showStatus(`Error: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showStatus(`Error: ${error.message}`, 'error');
        }
    }

    createNewFeed() {
        const result = this.parser.createEmptyFeed();
        if (result.success) {
            this.showStatus('Created new empty GTFS feed', 'success');
            this.showEditor(result.files);
            this.currentFile = result.files[0];
            this.displayFileContent(this.currentFile);
        }
    }

    showEditor(files) {
        document.getElementById('editorSection').style.display = 'block';
        this.createFileTabs(files);
        
        // Initialize map editor if not already done
        if (!this.mapEditor) {
            this.mapEditor = new MapEditor(this);
            // Make it globally accessible for popup callbacks
            window.mapEditor = this.mapEditor;
        }
    }

    createFileTabs(files) {
        const tabsContainer = document.getElementById('fileTabs');
        tabsContainer.innerHTML = '';

        files.forEach((filename, index) => {
            const tab = document.createElement('div');
            tab.className = 'file-tab';
            tab.textContent = filename.replace('.txt', '');
            tab.addEventListener('click', () => this.switchFile(filename));
            
            if (index === 0) {
                tab.classList.add('active');
            }
            
            tabsContainer.appendChild(tab);
        });
    }

    switchFile(filename) {
        this.currentFile = filename;
        this.selectedRows.clear();
        
        // Update active tab
        document.querySelectorAll('.file-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.textContent === filename.replace('.txt', '')) {
                tab.classList.add('active');
            }
        });
        
        this.displayFileContent(filename);
    }

    displayFileContent(filename) {
        const data = this.parser.getFileData(filename);
        const spec = GTFS_SPEC.files[filename];
        const container = document.getElementById('tableContainer');

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
            spec.required_fields.forEach(field => headers.add(field));
            spec.optional_fields.forEach(field => headers.add(field));
        }
        data.forEach(row => {
            Object.keys(row).forEach(key => headers.add(key));
        });
        headers = Array.from(headers);

        // Create table
        const table = document.createElement('table');
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Add checkbox column
        const checkboxHeader = document.createElement('th');
        checkboxHeader.innerHTML = '<input type="checkbox" id="selectAll">';
        checkboxHeader.style.width = '40px';
        headerRow.appendChild(checkboxHeader);
        
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            
            // Mark required fields
            if (spec && spec.required_fields.includes(header)) {
                th.style.backgroundColor = '#fff3cd';
                th.title = 'Required field';
            }
            
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');
        
        data.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.dataset.index = index;
            
            // Add checkbox
            const checkboxCell = document.createElement('td');
            checkboxCell.innerHTML = `<input type="checkbox" class="row-checkbox" data-index="${index}">`;
            tr.appendChild(checkboxCell);
            
            headers.forEach(header => {
                const td = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'text';
                input.value = row[header] || '';
                input.dataset.field = header;
                input.dataset.index = index;
                input.addEventListener('change', (e) => this.updateCell(filename, index, header, e.target.value));
                td.appendChild(input);
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        container.innerHTML = '';
        container.appendChild(table);

        // Add event listeners
        document.getElementById('selectAll').addEventListener('change', (e) => this.toggleAllRows(e.target.checked));
        document.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.toggleRow(parseInt(e.target.dataset.index), e.target.checked));
        });
    }

    updateCell(filename, rowIndex, field, value) {
        this.parser.updateCell(filename, rowIndex, field, value);
    }

    addRow() {
        if (!this.currentFile) return;
        
        const newRow = this.parser.addRow(this.currentFile);
        this.displayFileContent(this.currentFile);
        this.showStatus('Row added', 'success');
    }

    deleteSelectedRows() {
        if (this.selectedRows.size === 0) {
            this.showStatus('No rows selected', 'error');
            return;
        }

        // Sort indices in descending order to delete from end to beginning
        const indices = Array.from(this.selectedRows).sort((a, b) => b - a);
        
        indices.forEach(index => {
            this.parser.deleteRow(this.currentFile, index);
        });

        this.selectedRows.clear();
        this.displayFileContent(this.currentFile);
        this.showStatus(`Deleted ${indices.length} row(s)`, 'success');
    }

    toggleRow(index, checked) {
        if (checked) {
            this.selectedRows.add(index);
        } else {
            this.selectedRows.delete(index);
        }
    }

    toggleAllRows(checked) {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            const index = parseInt(checkbox.dataset.index);
            if (checked) {
                this.selectedRows.add(index);
            } else {
                this.selectedRows.delete(index);
            }
        });
    }

    validateFeed() {
        const validation = this.parser.validateFeed();
        const resultsContainer = document.getElementById('validationResults');
        
        let html = '<h3>Validation Results</h3>';
        
        if (validation.errors.length === 0 && validation.warnings.length === 0) {
            html += '<div class="validation-success">✓ GTFS feed is valid!</div>';
        } else {
            if (validation.errors.length > 0) {
                html += '<h4>Errors:</h4>';
                validation.errors.forEach(error => {
                    html += `<div class="validation-error">• ${error}</div>`;
                });
            }
            
            if (validation.warnings.length > 0) {
                html += '<h4>Warnings:</h4>';
                validation.warnings.forEach(warning => {
                    html += `<div class="validation-warning">• ${warning}</div>`;
                });
            }
        }
        
        resultsContainer.innerHTML = html;
        resultsContainer.style.display = 'block';
    }

    async downloadFeed() {
        try {
            this.showStatus('Generating GTFS file...', 'loading');
            const zipBlob = await this.parser.exportAsZip();
            
            // Create download link
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'gtfs-feed.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showStatus('GTFS file downloaded', 'success');
        } catch (error) {
            this.showStatus(`Error generating file: ${error.message}`, 'error');
        }
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('uploadStatus');
        statusElement.className = type;
        statusElement.style.display = 'block';
        
        if (type === 'loading') {
            statusElement.innerHTML = `<span class="loading"></span> ${message}`;
        } else {
            statusElement.textContent = message;
        }
        
        if (type !== 'loading') {
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
    }
}