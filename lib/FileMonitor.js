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
        this._isEnabled = true;
    }

    /**
     * Temporarily disable/enable monitoring (useful during restore operations)
     * @param {boolean} enabled - Whether monitoring should be enabled
     */
    setEnabled(enabled) {
        this._isEnabled = enabled;
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
            console.log(`File Monitor: Now monitoring ${filePath}`);
            
        } catch (e) {
            console.error(`File Monitor: Failed to setup monitor for ${filePath}: ${e.message}`);
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
                console.log(`File Monitor: Stopped monitoring ${filePath}`);
            } catch (e) {
                console.error(`File Monitor: Error stopping monitor for ${filePath}: ${e.message}`);
            }
        }
    }
    
    /**
     * Handle file change events
     */
    _onFileChanged(originalPath, changedFile, eventType, targetPath) {
        if (!this._isEnabled) return;

        // Only trigger on actual file changes, not temporary files
        if (eventType === Gio.FileMonitorEvent.CHANGED ||
            eventType === Gio.FileMonitorEvent.CREATED ||
            eventType === Gio.FileMonitorEvent.DELETED) {
            
            // Check if the change is for our target file
            const changedPath = changedFile.get_path();
            if (changedPath === targetPath || 
                changedPath.endsWith(Gio.File.new_for_path(targetPath).get_basename())) {
                
                console.log(`File Monitor: File changed: ${originalPath}`);
                
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
     * Stop all file monitoring
     */
    stopAll() {
        for (const [path, monitor] of this._monitors) {
            try {
                monitor.cancel();
            } catch (e) {
                console.error(`File Monitor: Error canceling monitor for ${path}: ${e.message}`);
            }
        }
        this._monitors.clear();
        console.log('File Monitor: Stopped all file monitoring');
    }
    
}