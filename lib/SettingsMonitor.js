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
        console.log(`Settings Monitor: ${enabled ? 'Enabled' : 'Disabled'} change monitoring`);
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
                console.warn(`Settings Monitor: Schema ${schema} not found, skipping (extension may not be installed)`);
                return false;
            }
            
            const settings = new Gio.Settings({schema: schema});
            
            const handlerId = settings.connect('changed', (settings, key) => {
                this._onSettingChanged(schema, key);
            });
            
            this._monitors.set(schema, {settings, handlerId});
            console.log(`Settings Monitor: Now monitoring GSettings schema: ${schema}`);
            return true;
            
        } catch (e) {
            console.error(`Settings Monitor: Failed to setup monitor for ${schema}: ${e.message}`);
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
                console.log(`Settings Monitor: Stopped monitoring ${schema}`);
            } catch (e) {
                console.error(`Settings Monitor: Error stopping monitor for ${schema}: ${e.message}`);
            }
        }
    }
    
    /**
     * Handle GSettings change events
     */
    _onSettingChanged(schema, key) {
        if (!this._isEnabled) {
            console.log(`Settings Monitor: Change ignored (monitoring disabled): ${schema}.${key}`);
            return;
        }
        
        console.log(`Settings Monitor: GSettings changed: ${schema}.${key}`);
        
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
                console.error('Settings Monitor: Could not get default schema source');
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
            console.error(`Settings Monitor: Error checking schema availability: ${e.message}`);
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
                console.error(`Settings Monitor: Error disconnecting monitor for ${schema}: ${e.message}`);
            }
        }
        this._monitors.clear();
        console.log('Settings Monitor: Stopped all GSettings monitoring');
    }
    
}