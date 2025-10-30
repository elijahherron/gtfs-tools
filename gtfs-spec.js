// GTFS Specification - File structures and validation rules
const GTFS_SPEC = {
    // Required files
    required_files: [
        'agency.txt',
        'stops.txt',
        'routes.txt',
        'trips.txt',
        'stop_times.txt'
    ],
    
    // Optional files
    optional_files: [
        'calendar.txt',
        'calendar_dates.txt',
        'fare_attributes.txt',
        'fare_rules.txt',
        'shapes.txt',
        'frequencies.txt',
        'transfers.txt',
        'feed_info.txt',
        'pathways.txt',
        'levels.txt',
        'translations.txt',
        'attributions.txt'
    ],
    
    // Field specifications for each file
    files: {
        'agency.txt': {
            required_fields: ['agency_id', 'agency_name', 'agency_url', 'agency_timezone'],
            optional_fields: ['agency_lang', 'agency_phone', 'agency_fare_url', 'agency_email'],
            key_field: 'agency_id'
        },
        'stops.txt': {
            required_fields: ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'],
            optional_fields: ['stop_code', 'stop_desc', 'zone_id', 'stop_url', 'location_type', 'parent_station', 'stop_timezone', 'wheelchair_boarding', 'level_id', 'platform_code'],
            key_field: 'stop_id'
        },
        'routes.txt': {
            required_fields: ['route_id', 'route_short_name', 'route_long_name', 'route_type'],
            optional_fields: ['agency_id', 'route_desc', 'route_url', 'route_color', 'route_text_color', 'route_sort_order', 'continuous_pickup', 'continuous_drop_off'],
            key_field: 'route_id'
        },
        'trips.txt': {
            required_fields: ['route_id', 'service_id', 'trip_id'],
            optional_fields: ['trip_headsign', 'trip_short_name', 'direction_id', 'block_id', 'shape_id', 'wheelchair_accessible', 'bikes_allowed'],
            key_field: 'trip_id'
        },
        'stop_times.txt': {
            required_fields: ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'],
            optional_fields: ['stop_headsign', 'pickup_type', 'drop_off_type', 'continuous_pickup', 'continuous_drop_off', 'shape_dist_traveled', 'timepoint'],
            key_field: null // Composite key: trip_id + stop_sequence
        },
        'calendar.txt': {
            required_fields: ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
            optional_fields: [],
            key_field: 'service_id'
        },
        'calendar_dates.txt': {
            required_fields: ['service_id', 'date', 'exception_type'],
            optional_fields: [],
            key_field: null // Composite key: service_id + date
        },
        'fare_attributes.txt': {
            required_fields: ['fare_id', 'price', 'currency_type', 'payment_method', 'transfers'],
            optional_fields: ['agency_id', 'transfer_duration'],
            key_field: 'fare_id'
        },
        'fare_rules.txt': {
            required_fields: ['fare_id'],
            optional_fields: ['route_id', 'origin_id', 'destination_id', 'contains_id'],
            key_field: null
        },
        'shapes.txt': {
            required_fields: ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence'],
            optional_fields: ['shape_dist_traveled'],
            key_field: null // Composite key: shape_id + shape_pt_sequence
        },
        'frequencies.txt': {
            required_fields: ['trip_id', 'start_time', 'end_time', 'headway_secs'],
            optional_fields: ['exact_times'],
            key_field: null // Composite key: trip_id + start_time
        },
        'transfers.txt': {
            required_fields: ['transfer_type'],
            optional_fields: ['from_stop_id', 'to_stop_id', 'from_trip_id', 'to_trip_id', 'min_transfer_time'],
            key_field: null // Composite key: from_stop_id + to_stop_id + from_trip_id + to_trip_id
        },
        'feed_info.txt': {
            required_fields: ['feed_publisher_name', 'feed_publisher_url', 'feed_lang'],
            optional_fields: ['default_lang', 'feed_start_date', 'feed_end_date', 'feed_version', 'feed_contact_email', 'feed_contact_url'],
            key_field: null
        }
    },
    
    // Route types (GTFS specification)
    route_types: {
        0: 'Tram, Streetcar, Light rail',
        1: 'Subway, Metro',
        2: 'Rail',
        3: 'Bus',
        4: 'Ferry',
        5: 'Cable tram',
        6: 'Aerial lift, suspended cable car',
        7: 'Funicular',
        11: 'Trolleybus',
        12: 'Monorail'
    },
    
    // Location types for stops
    location_types: {
        0: 'Stop/platform',
        1: 'Station',
        2: 'Entrance/exit',
        3: 'Generic node',
        4: 'Boarding area'
    },

    // Transfer types for transfers.txt
    transfer_types: {
        0: 'Recommended transfer point',
        1: 'Timed transfer (vehicle waits)',
        2: 'Minimum transfer time required',
        3: 'Transfer not possible',
        4: 'In-seat transfer allowed (passengers stay on vehicle)',
        5: 'In-seat transfer not allowed (passengers must alight and re-board)'
    },
    
    // Validation functions
    validators: {
        required_field: (value) => value !== undefined && value !== null && value !== '',
        
        numeric: (value) => !isNaN(parseFloat(value)) && isFinite(value),
        
        integer: (value) => Number.isInteger(parseFloat(value)),
        
        latitude: (value) => {
            const lat = parseFloat(value);
            return !isNaN(lat) && lat >= -90 && lat <= 90;
        },
        
        longitude: (value) => {
            const lon = parseFloat(value);
            return !isNaN(lon) && lon >= -180 && lon <= 180;
        },
        
        time: (value) => {
            // GTFS time format: H:MM:SS, HH:MM:SS or HHH:MM:SS (24+ hour format allowed)
            const timePattern = /^([0-9]{1,3}):([0-5][0-9]):([0-5][0-9])$/;
            return timePattern.test(value);
        },
        
        date: (value) => {
            // GTFS date format: YYYYMMDD
            const datePattern = /^[0-9]{8}$/;
            if (!datePattern.test(value)) return false;
            
            const year = parseInt(value.substr(0, 4));
            const month = parseInt(value.substr(4, 2));
            const day = parseInt(value.substr(6, 2));
            
            const date = new Date(year, month - 1, day);
            return date.getFullYear() === year && 
                   date.getMonth() === month - 1 && 
                   date.getDate() === day;
        },
        
        url: (value) => {
            try {
                new URL(value);
                return true;
            } catch {
                return false;
            }
        },
        
        email: (value) => {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailPattern.test(value);
        },
        
        color: (value) => {
            // 6-character hex color without #
            const colorPattern = /^[0-9A-Fa-f]{6}$/;
            return colorPattern.test(value);
        },
        
        currency: (value) => {
            // ISO 4217 currency codes (3 letters)
            const currencyPattern = /^[A-Z]{3}$/;
            return currencyPattern.test(value);
        },
        
        binary: (value) => value === '0' || value === '1',
        
        route_type: (value) => Object.keys(GTFS_SPEC.route_types).includes(value),
        
        location_type: (value) => Object.keys(GTFS_SPEC.location_types).includes(value)
    }
};

// Field validation mapping
const FIELD_VALIDATIONS = {
    'stop_lat': ['required_field', 'latitude'],
    'stop_lon': ['required_field', 'longitude'],
    'route_type': ['required_field', 'route_type'],
    'location_type': ['location_type'],
    'arrival_time': ['required_field', 'time'],
    'departure_time': ['required_field', 'time'],
    'start_time': ['required_field', 'time'],
    'end_time': ['required_field', 'time'],
    'headway_secs': ['required_field', 'integer'],
    'exact_times': ['binary'],
    'start_date': ['required_field', 'date'],
    'end_date': ['required_field', 'date'],
    'date': ['required_field', 'date'],
    'agency_url': ['required_field', 'url'],
    'route_url': ['url'],
    'stop_url': ['url'],
    'feed_publisher_url': ['required_field', 'url'],
    'feed_contact_url': ['url'],
    'agency_email': ['email'],
    'feed_contact_email': ['email'],
    'route_color': ['color'],
    'route_text_color': ['color'],
    'price': ['required_field', 'numeric'],
    'currency_type': ['required_field', 'currency'],
    'monday': ['required_field', 'binary'],
    'tuesday': ['required_field', 'binary'],
    'wednesday': ['required_field', 'binary'],
    'thursday': ['required_field', 'binary'],
    'friday': ['required_field', 'binary'],
    'saturday': ['required_field', 'binary'],
    'sunday': ['required_field', 'binary'],
    'wheelchair_boarding': ['binary'],
    'wheelchair_accessible': ['binary'],
    'bikes_allowed': ['binary']
};