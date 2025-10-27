// GTFS Parser - Handles uploading, parsing, and processing GTFS files
class GTFSParser {
    constructor() {
        this.gtfsData = {};
        this.fileList = [];
    }

    // Parse uploaded GTFS ZIP file
    async parseGTFSFile(file) {
        try {
            const zip = await JSZip.loadAsync(file);
            const gtfsData = {};
            const fileList = [];

            // Process each file in the ZIP
            for (const [filename, zipEntry] of Object.entries(zip.files)) {
                if (zipEntry.dir) continue; // Skip directories

                // Skip macOS metadata files
                if (filename.startsWith('__MACOSX/') || filename.startsWith('._')) continue;

                if (filename.endsWith('.txt')) {
                    const content = await zipEntry.async('text');
                    const parsedData = this.parseCSV(content);
                    gtfsData[filename] = parsedData;
                    fileList.push(filename);
                }
            }

            this.gtfsData = gtfsData;
            this.fileList = fileList;
            return { success: true, data: gtfsData, files: fileList };
        } catch (error) {
            console.error('Error parsing GTFS file:', error);
            return { success: false, error: error.message };
        }
    }

    // Parse CSV content into array of objects
    parseCSV(csvContent) {
        const lines = csvContent.trim().split('\n');
        if (lines.length === 0) return [];

        const headers = this.parseCSVLine(lines[0]);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }

        return data;
    }

    // Parse a single CSV line, handling quoted values
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        // Add the last field
        result.push(current.trim());
        return result;
    }

    // Convert array of objects back to CSV
    arrayToCSV(data, filename) {
        if (!data || data.length === 0) return '';

        const spec = GTFS_SPEC.files[filename];
        let headers = [];
        
        if (spec) {
            // Use GTFS spec order for headers
            headers = [...spec.required_fields, ...spec.optional_fields];
            // Add any additional headers from the data
            const dataHeaders = Object.keys(data[0] || {});
            dataHeaders.forEach(header => {
                if (!headers.includes(header)) {
                    headers.push(header);
                }
            });
        } else {
            // Use headers from first row
            headers = Object.keys(data[0] || {});
        }

        const csvLines = [headers.join(',')];

        data.forEach(row => {
            const values = headers.map(header => {
                let value = row[header] || '';
                // Convert to string to ensure includes method works
                value = String(value);
                // Escape quotes and wrap in quotes if necessary
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
                return value;
            });
            csvLines.push(values.join(','));
        });

        return csvLines.join('\n');
    }

    // Create empty GTFS feed with required files
    createEmptyFeed() {
        const emptyData = {};
        const fileList = [];

        // Create required files with empty data but proper headers
        GTFS_SPEC.required_files.forEach(filename => {
            const spec = GTFS_SPEC.files[filename];
            if (spec) {
                emptyData[filename] = [];
                fileList.push(filename);
            }
        });

        // Also include commonly used optional files for new GTFS creation
        const includedOptionalFiles = ['calendar.txt', 'shapes.txt'];
        includedOptionalFiles.forEach(filename => {
            const spec = GTFS_SPEC.files[filename];
            if (spec) {
                emptyData[filename] = [];
                fileList.push(filename);
            }
        });

        this.gtfsData = emptyData;
        this.fileList = fileList;
        return { success: true, data: emptyData, files: fileList };
    }

    // Add a new row to a file
    addRow(filename, rowData = {}) {
        if (!this.gtfsData[filename]) {
            this.gtfsData[filename] = [];
        }

        // Ensure the file is tracked in fileList for export
        if (!this.fileList.includes(filename)) {
            this.fileList.push(filename);
            console.log(`Added ${filename} to fileList for export tracking`);
        }

        const spec = GTFS_SPEC.files[filename];
        const newRow = {};

        if (spec) {
            // Initialize with empty values for all spec fields
            [...spec.required_fields, ...spec.optional_fields].forEach(field => {
                newRow[field] = rowData[field] || '';
            });
        }

        // Add any additional fields from rowData
        Object.keys(rowData).forEach(key => {
            newRow[key] = rowData[key];
        });

        this.gtfsData[filename].push(newRow);
        return newRow;
    }

    // Delete a row from a file
    deleteRow(filename, index) {
        if (this.gtfsData[filename] && index >= 0 && index < this.gtfsData[filename].length) {
            this.gtfsData[filename].splice(index, 1);
            return true;
        }
        return false;
    }

    // Update a cell value
    updateCell(filename, rowIndex, field, value) {
        if (this.gtfsData[filename] && 
            rowIndex >= 0 && 
            rowIndex < this.gtfsData[filename].length) {
            this.gtfsData[filename][rowIndex][field] = value;
            return true;
        }
        return false;
    }

    // Get data for a specific file
    getFileData(filename) {
        return this.gtfsData[filename] || [];
    }

    // Get all GTFS data
    getAllData() {
        return this.gtfsData;
    }

    // Get list of available files
    getFileList() {
        return this.fileList;
    }

    // Validate GTFS data
    validateFeed() {
        const errors = [];
        const warnings = [];

        // Check for required files
        GTFS_SPEC.required_files.forEach(requiredFile => {
            if (!this.fileList.includes(requiredFile)) {
                errors.push(`Missing required file: ${requiredFile}`);
            }
        });

        // Validate each file
        this.fileList.forEach(filename => {
            const fileErrors = this.validateFile(filename);
            errors.push(...fileErrors.errors);
            warnings.push(...fileErrors.warnings);
        });

        return { errors, warnings };
    }

    // Validate a specific file
    validateFile(filename) {
        const errors = [];
        const warnings = [];
        const data = this.gtfsData[filename] || [];
        const spec = GTFS_SPEC.files[filename];

        if (!spec) {
            warnings.push(`Unknown file: ${filename}`);
            return { errors, warnings };
        }

        // Check if required file is empty
        if (GTFS_SPEC.required_files.includes(filename) && data.length === 0) {
            errors.push(`Required file ${filename} is empty`);
            return { errors, warnings };
        }

        // Validate each row
        data.forEach((row, index) => {
            // Check required fields
            spec.required_fields.forEach(field => {
                if (!row.hasOwnProperty(field) || row[field] === '' || row[field] === null || row[field] === undefined) {
                    errors.push(`${filename} row ${index + 1}: Missing required field '${field}'`);
                }
            });

            // Validate field values
            Object.keys(row).forEach(field => {
                const value = row[field];
                if (value !== '' && FIELD_VALIDATIONS[field]) {
                    const validations = FIELD_VALIDATIONS[field];
                    validations.forEach(validationType => {
                        if (validationType !== 'required_field') { // Skip required check (already done above)
                            if (!GTFS_SPEC.validators[validationType](value)) {
                                errors.push(`${filename} row ${index + 1}: Invalid value for '${field}': '${value}'`);
                            }
                        }
                    });
                }
            });
        });

        return { errors, warnings };
    }

    // Add frequency for a trip
    addFrequency(tripId, startTime, endTime, headwaySecs, exactTimes = 0) {
        console.log('addFrequency called with:', { tripId, startTime, endTime, headwaySecs, exactTimes });

        const frequency = {
            trip_id: tripId,
            start_time: startTime,
            end_time: endTime,
            headway_secs: headwaySecs.toString(),
            exact_times: exactTimes.toString()
        };

        console.log('Creating frequency object:', frequency);

        const result = this.addRow('frequencies.txt', frequency);

        console.log('After adding frequency, frequencies.txt data:', this.gtfsData['frequencies.txt']);
        console.log('Total frequencies count:', this.gtfsData['frequencies.txt']?.length || 0);

        return result;
    }

    // Get frequencies for a specific trip
    getFrequenciesForTrip(tripId) {
        if (!this.gtfsData['frequencies.txt']) {
            return [];
        }

        return this.gtfsData['frequencies.txt'].filter(freq => freq.trip_id === tripId);
    }

    // Delete frequency by trip and start time
    deleteFrequency(tripId, startTime) {
        console.log('deleteFrequency called with:', { tripId, startTime });

        if (!this.gtfsData['frequencies.txt']) {
            console.log('No frequencies.txt in gtfsData');
            return false;
        }

        console.log('Current frequencies:', this.gtfsData['frequencies.txt']);

        const index = this.gtfsData['frequencies.txt'].findIndex(
            freq => {
                console.log('Comparing:', {
                    freq_trip_id: freq.trip_id,
                    freq_start_time: freq.start_time,
                    tripId: tripId,
                    startTime: startTime,
                    match: freq.trip_id === tripId && freq.start_time === startTime
                });
                return freq.trip_id === tripId && freq.start_time === startTime;
            }
        );

        console.log('Found index:', index);

        if (index !== -1) {
            this.gtfsData['frequencies.txt'].splice(index, 1);
            console.log('Deleted frequency, remaining:', this.gtfsData['frequencies.txt']);
            return true;
        }
        console.log('Frequency not found for deletion');
        return false;
    }

    // Check if a trip uses frequency-based service
    tripUsesFrequencies(tripId) {
        return this.getFrequenciesForTrip(tripId).length > 0;
    }

    // Export GTFS data as ZIP file
    async exportAsZip() {
        const zip = new JSZip();

        console.log('Export debug - fileList before cleanup:', this.fileList);
        console.log('Export debug - gtfsData keys:', Object.keys(this.gtfsData));

        // Clean up fileList: remove duplicates and ensure proper format
        let cleanFileList = [];

        // Add files that exist in gtfsData and have .txt extension
        Object.keys(this.gtfsData).forEach(key => {
            if (key.endsWith('.txt') && this.gtfsData[key]) {
                cleanFileList.push(key);
            }
        });

        // Remove duplicates
        cleanFileList = [...new Set(cleanFileList)];

        // Update fileList
        this.fileList = cleanFileList;
        console.log('Export debug - cleaned fileList:', this.fileList);

        // Add each file to the ZIP
        this.fileList.forEach(filename => {
            const data = this.gtfsData[filename] || [];
            const csvContent = this.arrayToCSV(data, filename);
            console.log(`Adding ${filename} to ZIP, records: ${data.length}, content length: ${csvContent.length}`);
            zip.file(filename, csvContent);
        });

        // Generate ZIP file
        const content = await zip.generateAsync({ type: 'blob' });
        console.log('Generated ZIP size:', content.size);
        return content;
    }
}