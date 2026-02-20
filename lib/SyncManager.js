/*
 * SyncManager.js - Coordinates all sync operations and backup/restore logic
 * Part of Gnoming Profiles extension
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * Manages all sync operations including backup creation and restoration.
 * Works with any StorageProvider implementation (GitHub, Nextcloud, etc.).
 */
export class SyncManager {
    // Timing constants
    static QUEUE_PROCESS_DELAY_MS = 1000;
    static MONITORING_RESTORE_DELAY_MS = 2000;

    // HTTP status codes
    static HTTP_NOT_FOUND = 404;

    constructor(storageProvider, wallpaperManager, settings, settingsMonitor = null) {
        this.storageProvider = storageProvider;
        this.wallpaperManager = wallpaperManager;
        this.settings = settings;
        this.settingsMonitor = settingsMonitor;
        this._contentHashCache = new Map();

        // Sync lock to prevent concurrent operations
        this._isSyncing = false;
        this._syncQueue = [];

        // Queue processing timeout management
        this._queueProcessTimeout = null;

        // Monitoring restore timeout management
        this._monitoringRestoreTimeout = null;
    }
    
    /**
     * Perform a sync operation with locking
     * @param {string} operationType - Description of the operation
     * @param {Function} syncFunction - Async function that performs the sync
     * @param {boolean} allowQueue - Whether to queue if another sync is in progress
     * @returns {Promise} Promise that resolves when sync completes
     */
    async performSyncOperation(operationType, syncFunction, allowQueue = false) {
        // Check if sync is already in progress
        if (this._isSyncing) {
            
            if (allowQueue) {
                // Queue the operation for later
                this._syncQueue.push({ operationType, syncFunction });
                return Promise.resolve('queued');
            } else {
                // Reject the operation
                throw new Error('Sync operation already in progress');
            }
        }
        
        // Acquire sync lock
        this._isSyncing = true;
        
        try {
            // Perform the actual sync operation
            const result = await syncFunction();
            return result;
            
        } catch (error) {
            console.error(`Sync Manager: Operation failed: ${operationType} - ${error.message}`);
            throw error;
            
        } finally {
            // Always release the lock
            this._isSyncing = false;
            
            // Process any queued operations
            this._processNextQueuedSync();
        }
    }
    
    /**
     * Process the next queued sync operation with proper timeout management
     */
    _processNextQueuedSync() {
        if (this._syncQueue.length === 0) {
            return;
        }
        
        const nextOperation = this._syncQueue.shift();
        
        // Clear any existing queue processing timeout
        if (this._queueProcessTimeout) {
            GLib.source_remove(this._queueProcessTimeout);
            this._queueProcessTimeout = null;
        }
        
        // Use a small delay to prevent immediate re-execution
        this._queueProcessTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SyncManager.QUEUE_PROCESS_DELAY_MS, () => {
            this._queueProcessTimeout = null;
            this.performSyncOperation(nextOperation.operationType, nextOperation.syncFunction, false)
                .catch(error => {
                    console.error(`Sync Manager: Queued operation failed: ${nextOperation.operationType} - ${error.message}`);
                });
            return GLib.SOURCE_REMOVE;
        });
    }
    
    /**
     * Create a backup of current settings and files
     * @returns {Promise<Object>} Backup data object
     */
    async createBackup() {
        const backup = {
            timestamp: new Date().toISOString(),
            gsettings: {}
        };
        
        // Check if wallpaper syncing is enabled
        const syncWallpapers = this.settings.get_boolean('sync-wallpapers');
        
        // Get base schemas from settings
        const schemas = this.settings.get_strv('gsettings-schemas');
        
        // Add wallpaper schemas if wallpaper syncing is enabled
        const allSchemas = [...schemas];
        if (syncWallpapers) {
            allSchemas.push(...this.wallpaperManager.getWallpaperSchemas());
        }
        
        
        let successfulBackups = 0;
        
        try {
            let schemaSource = null;
            
            if (this.settingsMonitor) {
                schemaSource = this.settingsMonitor._getSchemaSource();
            }
            
            if (!schemaSource) {
                schemaSource = Gio.SettingsSchemaSource.get_default();
            }
            
            if (!schemaSource) {
                throw new Error('Could not get default GSettings schema source');
            }
            
            for (const schema of allSchemas) {
                try {
                    const schemaObj = schemaSource.lookup(schema, true);
                    
                    if (!schemaObj) {
                        continue;
                    }
                    
                    // Use cached settings from SettingsMonitor if available
                    let settings;
                    if (this.settingsMonitor) {
                        settings = this.settingsMonitor.getSettings(schema);
                    }
                    if (!settings) {
                        settings = new Gio.Settings({schema: schema});
                    }
                    
                    const keys = settings.list_keys();
                    backup.gsettings[schema] = {};
                    
                    let keyCount = 0;
                    for (const key of keys) {
                        try {
                            const variant = settings.get_value(key);
                            backup.gsettings[schema][key] = variant.print(true);
                            keyCount++;
                            
                            // Store wallpaper info separately for uploading
                            if (syncWallpapers && this.wallpaperManager.isWallpaperKey(schema, key)) {
                                await this.wallpaperManager.trackWallpaperForUpload(schema, key, settings);
                            }
                        } catch (e) {
                            console.error(`Sync Manager: Failed to backup ${schema}.${key}: ${e.message}`);
                        }
                    }
                    
                    if (keyCount > 0) {
                        successfulBackups++;
                    } else {
                        delete backup.gsettings[schema];
                    }
                } catch (e) {
                    console.error(`Sync Manager: Failed to access schema ${schema}: ${e.message}`);
                }
            }
        } catch (e) {
            console.error(`Sync Manager: Critical error during backup: ${e.message}`);
            throw e;
        }
        return backup;
    }
    
    /**
     * Restore settings from backup data with proper timeout management
     * @param {Object} backup - Backup data object
     * @param {Function} setMonitoringEnabled - Function to enable/disable monitoring
     */
    async restoreBackup(backup, setMonitoringEnabled) {
        if (!backup || !backup.gsettings) {
            throw new Error('Invalid backup data');
        }
        
        
        // Check if wallpaper syncing is enabled
        const syncWallpapers = this.settings.get_boolean('sync-wallpapers');
        
        // Temporarily disable change monitoring during restore
        if (setMonitoringEnabled) {
            setMonitoringEnabled(false);
        }
        
        // Store timeout ID for proper cleanup if needed
        // (using instance variable for proper cleanup)
        
        try {
            // Restore gsettings
            for (const [schema, keys] of Object.entries(backup.gsettings)) {
                // Skip wallpaper schemas if wallpaper syncing is disabled
                if (!syncWallpapers && this.wallpaperManager.getWallpaperSchemas().includes(schema)) {
                    continue;
                }
                
                try {
                    let schemaSource = null;
                    
                    if (this.settingsMonitor) {
                        schemaSource = this.settingsMonitor._getSchemaSource();
                    }
                    
                    if (!schemaSource) {
                        schemaSource = Gio.SettingsSchemaSource.get_default();
                    }
                    
                    const schemaObj = schemaSource.lookup(schema, true);
                    
                    if (!schemaObj) {
                        continue;
                    }
                    
                    // Use cached settings from SettingsMonitor if available
                    let settings;
                    if (this.settingsMonitor) {
                        settings = this.settingsMonitor.getSettings(schema);
                    }
                    if (!settings) {
                        settings = new Gio.Settings({schema: schema});
                    }
                    
                    let restoredKeys = 0;
                    
                    for (const [key, value] of Object.entries(keys)) {
                        try {
                            // Special handling for wallpaper URIs
                            if (syncWallpapers && this.wallpaperManager.isWallpaperKey(schema, key)) {
                                const updatedValue = this.wallpaperManager.updateWallpaperUri(value, schema, key);
                                const variant = GLib.Variant.parse(null, updatedValue, null, null);
                                settings.set_value(key, variant);
                                restoredKeys++;
                            } else {
                                const variant = GLib.Variant.parse(null, value, null, null);
                                settings.set_value(key, variant);
                                restoredKeys++;
                            }
                        } catch (e) {
                            console.error(`Sync Manager: Failed to restore ${schema}.${key}: ${e.message}`);
                        }
                    }
                    
                } catch (e) {
                    console.error(`Sync Manager: Failed to access schema ${schema} for restore: ${e.message}`);
                }
            }
            
        } finally {
            // Re-enable change monitoring if it was enabled
            if (setMonitoringEnabled) {
                // Clear any existing monitoring restore timeout first
                if (this._monitoringRestoreTimeout) {
                    GLib.source_remove(this._monitoringRestoreTimeout);
                    this._monitoringRestoreTimeout = null;
                }
                
                // Add a small delay to avoid immediate triggers from the restore
                this._monitoringRestoreTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SyncManager.MONITORING_RESTORE_DELAY_MS, () => {
                    setMonitoringEnabled(true);
                    this._monitoringRestoreTimeout = null;
                    return GLib.SOURCE_REMOVE;
                });
            }
        }
    }
    
    /**
     * Sync configuration to the remote storage provider
     * @returns {Promise} Promise that resolves when sync completes
     */
    async syncToRemote() {
        const credentials = this.storageProvider.getCredentials(this.settings);

        if (!this.storageProvider.hasValidCredentials(credentials)) {
            throw new Error(`${this.storageProvider.name} credentials not configured`);
        }

        try {

            // Create backup data (without wallpapers in main config)
            const backupData = await this.createBackup();

            // Prepare all changes for batching
            const changes = [];

            // 1. Add main config file
            const configContent = JSON.stringify({
                timestamp: backupData.timestamp,
                gsettings: backupData.gsettings
            }, null, 2);

            if (await this._shouldUploadContent('config-backup.json', configContent)) {
                changes.push({
                    path: 'config-backup.json',
                    mode: '100644',
                    type: 'blob',
                    content: configContent
                });
            }

            // 2. Add individual files
            await this._addFilesToBatch(changes);

            // 3. Add wallpapers if enabled
            await this._addWallpapersToBatch(changes);

            // If no changes to upload, skip
            if (changes.length === 0) {
                return;
            }

            // Upload via the storage provider
            await this.storageProvider.uploadBatch(changes, credentials);

            // Clear wallpaper data after upload
            this.wallpaperManager.clear();

        } catch (error) {
            console.error(`Sync Manager: Failed to sync to ${this.storageProvider.name}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sync configuration from the remote storage provider
     * @returns {Promise} Promise that resolves when sync completes
     */
    async syncFromRemote() {
        const credentials = this.storageProvider.getCredentials(this.settings);

        if (!this.storageProvider.hasValidCredentials(credentials)) {
            return;
        }

        try {
            // Download gsettings config
            const backupData = await this._downloadConfig(credentials);

            // Download individual files
            await this._downloadFiles(credentials);

            // Download and restore wallpapers separately if enabled
            const syncWallpapers = this.settings.get_boolean('sync-wallpapers');
            if (syncWallpapers) {
                await this.wallpaperManager.downloadAndRestoreWallpapers(credentials);
            }

            // Restore configuration (callback will be provided by extension)
            if (backupData) {
                return { backupData, requiresRestore: true };
            }

        } catch (error) {
            console.error(`Sync Manager: Failed to sync from ${this.storageProvider.name}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if content should be uploaded based on hash comparison
     */
    async _shouldUploadContent(path, content) {
        const contentHash = GLib.compute_checksum_for_string(
            GLib.ChecksumType.SHA256, content, -1
        );
        
        if (this._contentHashCache.get(path) === contentHash) {
            return false; // Content unchanged
        }
        
        // Update cache
        this._contentHashCache.set(path, contentHash);
        return true;
    }
    
    /**
     * Expand file paths and compute remote paths once
     * @returns {Array} Array of {original, expanded, remote} objects
     */
    _getExpandedFilePaths() {
        const filePaths = this.settings.get_strv('sync-files');
        const homeDir = GLib.get_home_dir();
        return filePaths.map(filePath => ({
            original: filePath,
            expanded: filePath.replace('~', homeDir),
            remote: `files${filePath.replace('~', '/home')}`
        }));
    }

    /**
     * Add individual files to the batch
     */
    async _addFilesToBatch(changes) {
        const expandedPaths = this._getExpandedFilePaths();
        
        for (const {original, expanded, remote} of expandedPaths) {
            try {
                const file = Gio.File.new_for_path(expanded);

                if (!file.query_exists(null)) {
                    continue;
                }

                const [success, contents] = file.load_contents(null);
                if (!success) {
                    console.error(`Sync Manager: Failed to read file ${original}`);
                    continue;
                }

                const content = new TextDecoder('utf-8', { fatal: false }).decode(contents);
                if (content.includes('\uFFFD')) {
                    continue;
                }

                if (await this._shouldUploadContent(remote, content)) {
                    changes.push({
                        path: remote,
                        mode: '100644',
                        type: 'blob',
                        content: content
                    });
                }
            } catch (e) {
                console.error(`Sync Manager: Failed to prepare file ${original} for batch: ${e.message}`);
            }
        }
    }

    /**
     * Add wallpapers to the batch
     */
    async _addWallpapersToBatch(changes) {
        const syncWallpapers = this.settings.get_boolean('sync-wallpapers');
        if (!syncWallpapers) return;

        const wallpaperData = this.wallpaperManager.getWallpaperData();
        if (wallpaperData.size === 0) return;

        for (const [wallpaperKey, wallpaperInfo] of wallpaperData) {
            try {
                const wallpaperContent = await this.wallpaperManager.getWallpaperContent(wallpaperKey);
                if (wallpaperContent) {
                    const remotePath = `wallpapers/${wallpaperContent.fileName}`;

                    const contentHash = GLib.compute_checksum_for_string(
                        GLib.ChecksumType.SHA256, wallpaperContent.content, -1
                    );

                    if (this._contentHashCache.get(remotePath) !== contentHash) {
                        changes.push({
                            path: remotePath,
                            mode: '100644',
                            type: 'blob',
                            content: wallpaperContent.content,
                            encoding: 'base64'
                        });
                        this._contentHashCache.set(remotePath, contentHash);
                    }
                }
            } catch (e) {
                console.error(`Sync Manager: Failed to prepare wallpaper ${wallpaperKey} for batch: ${e.message}`);
            }
        }
    }

    /**
     * Download main config file from the storage provider
     */
    async _downloadConfig(credentials) {
        const response = await this.storageProvider.downloadFile('config-backup.json', credentials);

        if (!response.ok) {
            if (response.status === SyncManager.HTTP_NOT_FOUND) {
                return null;
            }
            throw new Error(`Download failed: ${response.status}`);
        }

        const backup = JSON.parse(response.content);
        return backup;
    }

    /**
     * Download individual files from the storage provider
     */
    async _downloadFiles(credentials) {
        const expandedPaths = this._getExpandedFilePaths();

        for (const {original, expanded, remote} of expandedPaths) {
            try {
                const response = await this.storageProvider.downloadFile(remote, credentials);

                if (response.ok) {
                    const file = Gio.File.new_for_path(expanded);

                    const parent = file.get_parent();
                    if (!parent.query_exists(null)) {
                        parent.make_directory_with_parents(null);
                    }

                    file.replace_contents(
                        new TextEncoder().encode(response.content),
                        null,
                        false,
                        Gio.FileCreateFlags.REPLACE_DESTINATION,
                        null
                    );

                } else if (response.status !== SyncManager.HTTP_NOT_FOUND) {
                    console.error(`Sync Manager: Failed to download ${remote}: ${response.status}`);
                }
            } catch (e) {
                console.error(`Sync Manager: Failed to download file ${original}: ${e.message}`);
            }
        }
    }
    
    
    /**
     * Clear the content hash cache
     */
    clearCache() {
        this._contentHashCache.clear();
    }
    
    /**
     * Destroy and cleanup with proper timer management
     */
    destroy() {
        
        // Clear queue processing timeout
        if (this._queueProcessTimeout) {
            GLib.source_remove(this._queueProcessTimeout);
            this._queueProcessTimeout = null;
        }
        
        // Clear monitoring restore timeout
        if (this._monitoringRestoreTimeout) {
            GLib.source_remove(this._monitoringRestoreTimeout);
            this._monitoringRestoreTimeout = null;
        }
        
        // Clear sync queue
        this._syncQueue.length = 0;
        this._syncQueue = null;
        
        // Clear content cache
        this._contentHashCache.clear();
        this._contentHashCache = null;
        
        // Clear references
        this.storageProvider = null;
        this.wallpaperManager = null;
        this.settings = null;
        
        // Reset state
        this._isSyncing = false;
        
    }
}