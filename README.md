# GTFS Tools

A web-based GTFS (General Transit Feed Specification) editor and creator with visual map interface.

## Features

- **Upload & Edit**: Load existing GTFS feeds from ZIP files
- **Create from Scratch**: Build new GTFS feeds using the visual map editor
- **Interactive Map**: Create routes and trips by clicking on the map
- **Table View**: Edit GTFS data in spreadsheet-like tables
- **Validation**: Built-in validation with MobilityData validator integration
- **Export**: Download completed GTFS feeds as ZIP files

## Usage

1. **Upload GTFS Feed**: Click "Upload GTFS" to load an existing feed
2. **Switch to Map View**: Use the "Map View" button to access the visual editor
3. **Create Routes**: 
   - Enter route details (name, type, color)
   - Search for starting location
   - Click "Create Route" or select existing route
4. **Create Trips**:
   - Set trip headsign and direction
   - Configure service calendar (days of operation)
   - Choose timing method (auto-calculate or manual)
   - Click "Start Creating Trip"
   - Click on the map to add stops in sequence
   - Edit stop details in popups (name, times)
   - Click "Finish Trip" when complete

## Map Controls

- **Click**: Add stops when creating a trip
- **Drag**: Move existing stops to adjust locations
- **Popup Editing**: Click markers to edit stop/route details
- **Drawing Tools**: Use polyline tool to draw route shapes
- **Location Search**: Find starting locations by address/city

## Known Issues & Fixes

### Map Alignment Issues
- Map container properly sized and positioned
- Leaflet map invalidation handled on view switches
- Responsive design for mobile devices

### Stop Creation Visualization  
- Only current stop being created is highlighted
- Previous stops show in muted colors during trip creation
- Clear visual feedback for active editing state

## File Structure

- `index.html`: Main interface
- `app.js`: Application controller
- `gtfs-parser.js`: GTFS file parsing logic
- `gtfs-editor.js`: Table editing functionality  
- `map-editor.js`: Visual map editing features
- `gtfs-spec.js`: GTFS specification definitions
- `styles.css`: UI styling and layout