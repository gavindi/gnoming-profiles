/*
 * FileMonitor.js - File system monitoring for configuration files
 * Part of Gnoming Profiles extension
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * Monitors configuration files for changes
 */
export class FileMonitor {
    constructor() {
        this._monitors = new Map();
        this._changeCallback = null;
    }
    
    /**
     * Set the callback function for when changes are detected
     * @param {Function} callback - Function to call when files change
     */
    setChangeCallback(callback) {
        this._changeCallback = callback;
    }
    
    /**
     * Start monitoring a file for changes
     * @param {string} filePath - Path to the file to monitor
     */
    addFile(filePath) {
        try {
            const expandedPath = filePath.replace('~', GLib.get_home_dir());
            const file = Gio.File.new_for_path(expandedPath);
            
            // Create parent directory monitor if file doesn't exist yet
            let monitorFile = file;
            if (!file.query_exists(null)) {
                const parent = file.get_parent();
                if (parent && parent.query_exists(null)) {
                    monitorFile = parent;
                }
            }
            
            const monitor = monitorFile.monitor(Gio.FileMonitorFlags.NONE, null);
            monitor.connect('changed', (monitor, file, otherFile, eventType) => {
                this._onFileChanged(filePath, file, eventType, expandedPath);
            });
            
            this._monitors.set(filePath, monitor);
            log(`File Monitor: Now monitoring ${filePath}`);
            
        } catch (e) {
            log(`File Monitor: Failed to setup monitor for ${filePath}: ${e.message}`);
        }
    }
    
    /**
     * Stop monitoring a file
     * @param {string} filePath - Path to the file to stop monitoring
     */
    removeFile(filePath) {
        const monitor = this._monitors.get(filePath);
        if (monitor) {
            try {
                monitor.cancel();
                this._monitors.delete(filePath);
                log(`File Monitor: Stopped monitoring ${filePath}`);
            } catch (e) {
                log(`File Monitor: Error stopping monitor for ${filePath}: ${e.message}`);
            }
        }
    }
    
    /**
     * Handle file change events
     */
    _onFileChanged(originalPath, changedFile, eventType, targetPath) {
        // Only trigger on actual file changes, not temporary files
        if (eventType === Gio.FileMonitorEvent.CHANGED || 
            eventType === Gio.FileMonitorEvent.CREATED ||
            eventType === Gio.FileMonitorEvent.DELETED) {
            
            // Check if the change is for our target file
            const changedPath = changedFile.get_path();
            if (changedPath === targetPath || 
                changedPath.endsWith(Gio.File.new_for_path(targetPath).get_basename())) {
                
                log(`File Monitor: File changed: ${originalPath}`);
                
                if (this._changeCallback) {
                    this._changeCallback(`File: ${originalPath}`);
                }
            }
        }
    }
    
    /**
     * Update the list of monitored files
     * @param {string[]} filePaths - Array of file paths to monitor
     */
    updateFiles(filePaths) {
        // Remove monitors for files no longer in the list
        const currentPaths = Array.from(this._monitors.keys());
        for (const path of currentPaths) {
            if (!filePaths.includes(path)) {
                this.removeFile(path);
            }
        }
        
        // Add monitors for new files
        for (const path of filePaths) {
            if (!this._monitors.has(path)) {
                this.addFile(path);
            }
        }
    }
    
    /**
     * Get the list of currently monitored files
     * @returns {string[]} Array of monitored file paths
     */
    getMonitoredFiles() {
        return Array.from(this._monitors.keys());
    }
    
    /**
     * Get the number of active file monitors
     * @returns {number} Number of monitors
     */
    getMonitorCount() {
        return this._monitors.size;
    }
    
    /**
     * Check if a file is being monitored
     * @param {string} filePath - Path to check
     * @returns {boolean} True if file is monitored
     */
    isMonitoring(filePath) {
        return this._monitors.has(filePath);
    }
    
    /**
     * Stop all file monitoring
     */
    stopAll() {
        for (const [path, monitor] of this._monitors) {
            try {
                monitor.cancel();
            } catch (e) {
                log(`File Monitor: Error canceling monitor for ${path}: ${e.message}`);
            }
        }
        this._monitors.clear();
        log('File Monitor: Stopped all file monitoring');
    }
    
    /**
     * Get status information about file monitoring
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            isActive: this._monitors.size > 0,
            monitorCount: this._monitors.size,
            monitoredFiles: this.getMonitoredFiles(),
            hasCallback: !!this._changeCallback
        };
    }
}