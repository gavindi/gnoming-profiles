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
        this._schemaSource = null;
        this._schemaSourceError = null;
    }

    /**
     * Get cached schema source (lazy initialization)
     * @returns {Gio.SettingsSchemaSource|null}
     */
    _getSchemaSource() {
        if (this._schemaSourceError) {
            return null;
        }
        if (this._schemaSource === null) {
            try {
                this._schemaSource = Gio.SettingsSchemaSource.get_default();
                if (!this._schemaSource) {
                    this._schemaSourceError = 'Could not get default GSettings schema source';
                    console.error(`Settings Monitor: ${this._schemaSourceError}`);
                    return null;
                }
            } catch (e) {
                this._schemaSourceError = e.message;
                console.error(`Settings Monitor: Failed to get schema source: ${e.message}`);
                return null;
            }
        }
        return this._schemaSource;
    }

    /**
     * Get or create a cached Gio.Settings instance for a schema
     * @param {string} schema - Schema ID
     * @returns {Gio.Settings|null}
     */
    getSettings(schema) {
        const monitor = this._monitors.get(schema);
        if (monitor) {
            return monitor.settings;
        }
        
        const schemaSource = this._getSchemaSource();
        if (!schemaSource) {
            return null;
        }
        
        const schemaObj = schemaSource.lookup(schema, true);
        if (!schemaObj) {
            return null;
        }
        
        return new Gio.Settings({ schema });
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
    }
    
    /**
     * Start monitoring a GSettings schema
     * @param {string} schema - Schema ID to monitor
     */
    addSchema(schema) {
        try {
            const schemaSource = this._getSchemaSource();
            if (!schemaSource) {
                return false;
            }
            
            const schemaObj = schemaSource.lookup(schema, true);
            if (!schemaObj) {
                return false;
            }
            
            const settings = new Gio.Settings({schema: schema});
            
            const handlerId = settings.connect('changed', (settings, key) => {
                this._onSettingChanged(schema, key);
            });
            
            this._monitors.set(schema, {settings, handlerId});
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
            return;
        }
        
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
        
        const schemaSource = this._getSchemaSource();
        if (!schemaSource) {
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
    }
    
}