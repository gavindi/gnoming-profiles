/*
 * SettingsMonitor.js - GSettings schema monitoring
 * Part of Gnoming Profiles extension
 */

import Gio from 'gi://Gio';

/**
 * Monitors GSettings schemas for changes
 */
export class SettingsMonitor {
    constructor() {
        this._monitors = new Map();
        this._changeCallback = null;
        this._isEnabled = true;
    }
    
    /**
     * Set the callback function for when changes are detected
     * @param {Function} callback - Function to call when settings change
     */
    setChangeCallback(callback) {
        this._changeCallback = callback;
    }
    
    /**
     * Temporarily disable monitoring (useful during restore operations)
     * @param {boolean} enabled - Whether monitoring should be enabled
     */
    setEnabled(enabled) {
        this._isEnabled = enabled;
        log(`Settings Monitor: ${enabled ? 'Enabled' : 'Disabled'} change monitoring`);
    }
    
    /**
     * Start monitoring a GSettings schema
     * @param {string} schema - Schema ID to monitor
     */
    addSchema(schema) {
        try {
            // Check if schema exists before trying to access it
            const schemaSource = Gio.SettingsSchemaSource.get_default();
            const schemaObj = schemaSource.lookup(schema, true);
            
            if (!schemaObj) {
                log(`Settings Monitor: Schema ${schema} not found, skipping (extension may not be installed)`);
                return false;
            }
            
            const settings = new Gio.Settings({schema: schema});
            
            const handlerId = settings.connect('changed', (settings, key) => {
                this._onSettingChanged(schema, key);
            });
            
            this._monitors.set(schema, {settings, handlerId});
            log(`Settings Monitor: Now monitoring GSettings schema: ${schema}`);
            return true;
            
        } catch (e) {
            log(`Settings Monitor: Failed to setup monitor for ${schema}: ${e.message}`);
            return false;
        }
    }
    
    /**
     * Stop monitoring a GSettings schema
     * @param {string} schema - Schema ID to stop monitoring
     */
    removeSchema(schema) {
        const monitor = this._monitors.get(schema);
        if (monitor) {
            try {
                monitor.settings.disconnect(monitor.handlerId);
                this._monitors.delete(schema);
                log(`Settings Monitor: Stopped monitoring ${schema}`);
            } catch (e) {
                log(`Settings Monitor: Error stopping monitor for ${schema}: ${e.message}`);
            }
        }
    }
    
    /**
     * Handle GSettings change events
     */
    _onSettingChanged(schema, key) {
        if (!this._isEnabled) {
            log(`Settings Monitor: Change ignored (monitoring disabled): ${schema}.${key}`);
            return;
        }
        
        log(`Settings Monitor: GSettings changed: ${schema}.${key}`);
        
        if (this._changeCallback) {
            this._changeCallback(`Schema: ${schema}.${key}`);
        }
    }
    
    /**
     * Update the list of monitored schemas
     * @param {string[]} schemas - Array of schema IDs to monitor
     * @returns {number} Number of successfully added schemas
     */
    updateSchemas(schemas) {
        // Remove monitors for schemas no longer in the list
        const currentSchemas = Array.from(this._monitors.keys());
        for (const schema of currentSchemas) {
            if (!schemas.includes(schema)) {
                this.removeSchema(schema);
            }
        }
        
        // Add monitors for new schemas
        let successCount = 0;
        for (const schema of schemas) {
            if (!this._monitors.has(schema)) {
                if (this.addSchema(schema)) {
                    successCount++;
                }
            } else {
                successCount++; // Already monitoring
            }
        }
        
        return successCount;
    }
    
    /**
     * Get the list of currently monitored schemas
     * @returns {string[]} Array of monitored schema IDs
     */
    getMonitoredSchemas() {
        return Array.from(this._monitors.keys());
    }
    
    /**
     * Get the number of active schema monitors
     * @returns {number} Number of monitors
     */
    getMonitorCount() {
        return this._monitors.size;
    }
    
    /**
     * Check if a schema is being monitored
     * @param {string} schema - Schema ID to check
     * @returns {boolean} True if schema is monitored
     */
    isMonitoring(schema) {
        return this._monitors.has(schema);
    }
    
    /**
     * Check which schemas are available on the system
     * @param {string[]} schemas - Array of schema IDs to check
     * @returns {Object} Object with available and missing schemas
     */
    checkSchemaAvailability(schemas) {
        const available = [];
        const missing = [];
        
        try {
            const schemaSource = Gio.SettingsSchemaSource.get_default();
            if (!schemaSource) {
                log('Settings Monitor: Could not get default schema source');
                return { available: [], missing: schemas };
            }
            
            for (const schema of schemas) {
                try {
                    const schemaObj = schemaSource.lookup(schema, true);
                    if (schemaObj) {
                        available.push(schema);
                    } else {
                        missing.push(schema);
                    }
                } catch (e) {
                    missing.push(schema);
                }
            }
        } catch (e) {
            log(`Settings Monitor: Error checking schema availability: ${e.message}`);
            return { available: [], missing: schemas };
        }
        
        return { available, missing };
    }
    
    /**
     * Stop all schema monitoring
     */
    stopAll() {
        for (const [schema, {settings, handlerId}] of this._monitors) {
            try {
                settings.disconnect(handlerId);
            } catch (e) {
                log(`Settings Monitor: Error disconnecting monitor for ${schema}: ${e.message}`);
            }
        }
        this._monitors.clear();
        log('Settings Monitor: Stopped all GSettings monitoring');
    }
    
    /**
     * Get status information about settings monitoring
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            isActive: this._monitors.size > 0,
            isEnabled: this._isEnabled,
            monitorCount: this._monitors.size,
            monitoredSchemas: this.getMonitoredSchemas(),
            hasCallback: !!this._changeCallback
        };
    }
}