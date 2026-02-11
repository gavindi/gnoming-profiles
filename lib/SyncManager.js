/*
 * SyncManager.js - Coordinates all sync operations and backup/restore logic
 * Part of Gnoming Profiles extension
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * Manages all sync operations including backup creation and restoration
 */
export class SyncManager {
    // Timing constants
    static QUEUE_PROCESS_DELAY_MS = 1000;
    static MONITORING_RESTORE_DELAY_MS = 2000;
    
    // HTTP status codes
    static HTTP_NOT_FOUND = 404;
    
    constructor(githubAPI, wallpaperManager, settings) {
        this.githubAPI = githubAPI;
        this.wallpaperManager = wallpaperManager;
        this.settings = settings;
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
            console.warn(`Sync Manager: Operation "${operationType}" blocked: another sync in progress`);
            
            if (allowQueue) {
                // Queue the operation for later
                this._syncQueue.push({ operationType, syncFunction });
                console.log(`Sync Manager: Operation "${operationType}" queued`);
                return Promise.resolve('queued');
            } else {
                // Reject the operation
                console.warn(`Sync Manager: Operation "${operationType}" rejected: not queueing`);
                throw new Error('Sync operation already in progress');
            }
        }
        
        // Acquire sync lock
        this._isSyncing = true;
        console.log(`Sync Manager: Starting sync operation: ${operationType}`);
        
        try {
            // Perform the actual sync operation
            const result = await syncFunction();
            console.log(`Sync Manager: Operation completed successfully: ${operationType}`);
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
        console.log(`Sync Manager: Processing next queued operation: ${nextOperation.operationType}`);
        
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
        console.log(`Sync Manager: Creating backup - wallpaper syncing enabled: ${syncWallpapers}`);
        
        // Get base schemas from settings
        const schemas = this.settings.get_strv('gsettings-schemas');
        
        // Add wallpaper schemas if wallpaper syncing is enabled
        const allSchemas = [...schemas];
        if (syncWallpapers) {
            allSchemas.push(...this.wallpaperManager.getWallpaperSchemas());
        }
        
        console.log(`Sync Manager: Backing up ${allSchemas.length} gsettings schemas`);
        
        let successfulBackups = 0;
        
        try {
            const schemaSource = Gio.SettingsSchemaSource.get_default();
            if (!schemaSource) {
                throw new Error('Could not get default GSettings schema source');
            }
            
            for (const schema of allSchemas) {
                try {
                    // Check if schema exists before trying to access it
                    const schemaObj = schemaSource.lookup(schema, true);
                    
                    if (!schemaObj) {
                        console.warn(`Sync Manager: Schema ${schema} not found during backup, skipping`);
                        continue;
                    }
                    
                    const settings = new Gio.Settings({schema: schema});
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
                        console.log(`Sync Manager: ✓ Backed up schema ${schema} with ${keyCount} keys`);
                    } else {
                        console.warn(`Sync Manager: ✗ No keys found for schema ${schema}`);
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
        
        console.log(`Sync Manager: Backup complete: ${successfulBackups} schemas successfully backed up`);
        
        if (successfulBackups === 0) {
            console.warn('Sync Manager: WARNING: No schemas were successfully backed up!');
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
        
        console.log(`Sync Manager: Restoring backup from ${backup.timestamp}`);
        
        // Check if wallpaper syncing is enabled
        const syncWallpapers = this.settings.get_boolean('sync-wallpapers');
        console.log(`Sync Manager: Wallpaper syncing enabled during restore: ${syncWallpapers}`);
        
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
                    console.log(`Sync Manager: Skipping wallpaper schema ${schema} (wallpaper syncing disabled)`);
                    continue;
                }
                
                try {
                    // Check if schema exists before trying to access it
                    const schemaSource = Gio.SettingsSchemaSource.get_default();
                    const schemaObj = schemaSource.lookup(schema, true);
                    
                    if (!schemaObj) {
                        console.warn(`Sync Manager: Schema ${schema} not found during restore, skipping`);
                        continue;
                    }
                    
                    const settings = new Gio.Settings({schema: schema});
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
                    
                    console.log(`Sync Manager: Restored ${restoredKeys} keys for schema ${schema}`);
                } catch (e) {
                    console.error(`Sync Manager: Failed to access schema ${schema} for restore: ${e.message}`);
                }
            }
            
            console.log('Sync Manager: GSettings restoration complete');
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
     * Sync configuration to GitHub using Tree API batching
     * @returns {Promise} Promise that resolves when sync completes
     */
    async syncToGitHub() {
        const token = this.settings.get_string('github-token');
        const repo = this.settings.get_string('github-repo');
        const username = this.settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            throw new Error('GitHub credentials not configured');
        }
        
        try {
            console.log('Sync Manager: Starting GitHub Tree API batch sync');
            
            // Create backup data (without wallpapers in main config)
            const backupData = await this.createBackup();
            
            // Prepare all changes for batching
            const treeChanges = [];
            
            // 1. Add main config file
            const configContent = JSON.stringify({
                timestamp: backupData.timestamp,
                gsettings: backupData.gsettings
            }, null, 2);
            
            if (await this._shouldUploadContent('config-backup.json', configContent)) {
                treeChanges.push({
                    path: 'config-backup.json',
                    mode: '100644',
                    type: 'blob',
                    content: configContent
                });
                console.log('Sync Manager: Added config-backup.json to batch');
            } else {
                console.log('Sync Manager: Skipping config-backup.json - content unchanged');
            }
            
            // 2. Add individual files
            await this._addFilesToBatch(treeChanges);
            
            // 3. Add wallpapers if enabled
            await this._addWallpapersToBatch(treeChanges);
            
            // If no changes to upload, skip the commit
            if (treeChanges.length === 0) {
                console.log('Sync Manager: No changes detected, skipping GitHub commit');
                return;
            }
            
            console.log(`Sync Manager: Batching ${treeChanges.length} changes into single commit`);
            
            // Upload using GitHub Tree API
            await this._uploadBatchedChanges(treeChanges, token, username, repo);
            
            // Clear wallpaper data after upload
            this.wallpaperManager.clear();
            
            console.log(`Sync Manager: Successfully synced ${treeChanges.length} changes to GitHub using Tree API`);
        } catch (error) {
            console.error(`Sync Manager: Failed to sync to GitHub: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Sync configuration from GitHub
     * @returns {Promise} Promise that resolves when sync completes
     */
    async syncFromGitHub() {
        const token = this.settings.get_string('github-token');
        const repo = this.settings.get_string('github-repo');
        const username = this.settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            console.warn('Sync Manager: GitHub credentials not configured, skipping sync from GitHub');
            return;
        }
        
        try {
            // Download gsettings from GitHub
            const backupData = await this._downloadFromGitHub(token, username, repo);
            
            // Download individual files
            await this._downloadFilesFromGitHub(token, username, repo);
            
            // Download and restore wallpapers separately if enabled
            const syncWallpapers = this.settings.get_boolean('sync-wallpapers');
            if (syncWallpapers) {
                await this.wallpaperManager.downloadAndRestoreWallpapers(token, username, repo);
            }
            
            // Restore configuration (callback will be provided by extension)
            if (backupData) {
                return { backupData, requiresRestore: true };
            }
            
            console.log('Sync Manager: Successfully synced from GitHub');
        } catch (error) {
            console.error(`Sync Manager: Failed to sync from GitHub: ${error.message}`);
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
     * Add individual files to the batch
     */
    async _addFilesToBatch(treeChanges) {
        const filePaths = this.settings.get_strv('sync-files');
        for (const filePath of filePaths) {
            try {
                const expandedPath = filePath.replace('~', GLib.get_home_dir());
                const file = Gio.File.new_for_path(expandedPath);
                
                if (!file.query_exists(null)) {
                    console.warn(`Sync Manager: File ${filePath} does not exist, skipping`);
                    continue;
                }
                
                // Read file content
                const [success, contents] = file.load_contents(null);
                if (!success) {
                    console.error(`Sync Manager: Failed to read file ${filePath}`);
                    continue;
                }
                
                // Check if file is likely text (basic check)
                const content = new TextDecoder('utf-8', { fatal: false }).decode(contents);
                if (content.includes('\uFFFD')) {
                    console.warn(`Sync Manager: Skipping ${filePath}: appears to be binary`);
                    continue;
                }
                
                // Create GitHub path
                const githubPath = `files${filePath.replace('~', '/home')}`;
                
                if (await this._shouldUploadContent(githubPath, content)) {
                    treeChanges.push({
                        path: githubPath,
                        mode: '100644',
                        type: 'blob',
                        content: content
                    });
                    console.log(`Sync Manager: Added ${githubPath} to batch`);
                } else {
                    console.log(`Sync Manager: Skipping ${githubPath} - content unchanged`);
                }
                
            } catch (e) {
                console.error(`Sync Manager: Failed to prepare file ${filePath} for batch: ${e.message}`);
            }
        }
    }
    
    /**
     * Add wallpapers to the batch
     */
    async _addWallpapersToBatch(treeChanges) {
        const syncWallpapers = this.settings.get_boolean('sync-wallpapers');
        if (!syncWallpapers) return;
        
        const wallpaperData = this.wallpaperManager.getWallpaperData();
        if (wallpaperData.size === 0) return;
        
        for (const [wallpaperKey, wallpaperInfo] of wallpaperData) {
            try {
                const wallpaperContent = await this.wallpaperManager.getWallpaperContent(wallpaperKey);
                if (wallpaperContent) {
                    const githubPath = `wallpapers/${wallpaperContent.fileName}`;
                    
                    // For wallpapers, check content hash differently since it's base64
                    const contentHash = GLib.compute_checksum_for_string(
                        GLib.ChecksumType.SHA256, wallpaperContent.content, -1
                    );
                    
                    if (this._contentHashCache.get(githubPath) !== contentHash) {
                        treeChanges.push({
                            path: githubPath,
                            mode: '100644',
                            type: 'blob',
                            content: wallpaperContent.content,
                            encoding: 'base64'
                        });
                        this._contentHashCache.set(githubPath, contentHash);
                        console.log(`Sync Manager: Added wallpaper ${githubPath} to batch`);
                    } else {
                        console.log(`Sync Manager: Skipping wallpaper ${githubPath} - content unchanged`);
                    }
                }
            } catch (e) {
                console.error(`Sync Manager: Failed to prepare wallpaper ${wallpaperKey} for batch: ${e.message}`);
            }
        }
    }
    
    /**
     * Upload batched changes using GitHub Tree API
     */
    async _uploadBatchedChanges(treeChanges, token, username, repo) {
        try {
            // 0. Detect the default branch name
            const branch = await this.githubAPI.getDefaultBranch(username, repo, token);

            // 1. Get current commit SHA
            console.log('Sync Manager: Getting current commit SHA');
            const branchResponse = await this.githubAPI.getBranch(username, repo, token, branch);
            
            let currentCommitSha;
            if (branchResponse.ok) {
                const branchData = JSON.parse(branchResponse.data);
                currentCommitSha = branchData.object.sha;
                console.log(`Sync Manager: Current commit SHA: ${currentCommitSha}`);
            } else if (branchResponse.status === SyncManager.HTTP_NOT_FOUND) {
                console.log('Sync Manager: Repository is empty, will create initial commit');
                currentCommitSha = null;
            } else {
                throw new Error(`Failed to get current commit: ${branchResponse.status}`);
            }
            
            // 2. Get current tree SHA (if we have a current commit)
            let currentTreeSha = null;
            if (currentCommitSha) {
                console.log('Sync Manager: Getting current tree SHA');
                const commitResponse = await this.githubAPI.getCommit(username, repo, currentCommitSha, token);
                
                if (commitResponse.ok) {
                    const commitData = JSON.parse(commitResponse.data);
                    currentTreeSha = commitData.tree.sha;
                    console.log(`Sync Manager: Current tree SHA: ${currentTreeSha}`);
                } else {
                    throw new Error(`Failed to get current tree: ${commitResponse.status}`);
                }
            }
            
            // 3. Create blobs for all content
            console.log('Sync Manager: Creating blobs for changed content');
            const treeEntries = [];
            
            for (const change of treeChanges) {
                try {
                    const blobData = {
                        content: change.content,
                        encoding: change.encoding || 'utf-8'
                    };
                    
                    const blobResponse = await this.githubAPI.createBlob(username, repo, token, blobData);
                    
                    if (blobResponse.ok) {
                        const blob = JSON.parse(blobResponse.data);
                        treeEntries.push({
                            path: change.path,
                            mode: change.mode,
                            type: 'blob',
                            sha: blob.sha
                        });
                        console.log(`Sync Manager: Created blob for ${change.path}: ${blob.sha}`);
                    } else {
                        console.error(`Sync Manager: Failed to create blob for ${change.path}: ${blobResponse.status}`);
                    }
                } catch (e) {
                    console.error(`Sync Manager: Error creating blob for ${change.path}: ${e.message}`);
                }
            }
            
            if (treeEntries.length === 0) {
                throw new Error('No blobs were created successfully');
            }
            
            // 4. Create new tree
            console.log(`Sync Manager: Creating new tree with ${treeEntries.length} entries`);
            const treeData = {
                tree: treeEntries,
                ...(currentTreeSha && { base_tree: currentTreeSha })
            };
            
            const treeResponse = await this.githubAPI.createTree(username, repo, token, treeData);
            
            if (!treeResponse.ok) {
                throw new Error(`Failed to create tree: ${treeResponse.status} - ${treeResponse.data}`);
            }
            
            const newTree = JSON.parse(treeResponse.data);
            console.log(`Sync Manager: Created new tree: ${newTree.sha}`);
            
            // 5. Create commit
            const commitMessage = `Batch sync ${treeEntries.length} files - ${new Date().toISOString()}`;
            console.log(`Sync Manager: Creating commit: ${commitMessage}`);
            
            const commitData = {
                message: commitMessage,
                tree: newTree.sha,
                ...(currentCommitSha && { parents: [currentCommitSha] })
            };
            
            const commitResponse = await this.githubAPI.createCommit(username, repo, token, commitData);
            
            if (!commitResponse.ok) {
                throw new Error(`Failed to create commit: ${commitResponse.status} - ${commitResponse.data}`);
            }
            
            const newCommit = JSON.parse(commitResponse.data);
            console.log(`Sync Manager: Created commit: ${newCommit.sha}`);
            
            // 6. Update branch reference
            console.log('Sync Manager: Updating branch reference');
            const refData = {
                sha: newCommit.sha,
                force: false
            };
            
            const refResponse = await this.githubAPI.updateRef(username, repo, token, refData, branch);
            
            if (!refResponse.ok) {
                throw new Error(`Failed to update branch: ${refResponse.status} - ${refResponse.data}`);
            }
            
            // Clear ETag cache since we just made changes
            this.githubAPI.clearETagCache();
            
            console.log(`Sync Manager: Successfully uploaded batch of ${treeEntries.length} files in single commit ${newCommit.sha.substring(0, 7)}`);
            
        } catch (error) {
            console.error(`Sync Manager: Batch upload failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Download main config file from GitHub
     */
    async _downloadFromGitHub(token, username, repo) {
        const response = await this.githubAPI.getContents(username, repo, 'config-backup.json', token);
        
        if (!response.ok) {
            if (response.status === SyncManager.HTTP_NOT_FOUND) {
                console.warn('Sync Manager: No backup found on GitHub, skipping restore');
                return null;
            }
            throw new Error(`GitHub download failed: ${response.status}`);
        }
        
        const fileData = JSON.parse(response.data);
        const content = new TextDecoder().decode(GLib.base64_decode(fileData.content));
        const backup = JSON.parse(content);
        
        console.log('Sync Manager: Downloaded main config from GitHub');
        return backup;
    }
    
    /**
     * Download individual files from GitHub
     */
    async _downloadFilesFromGitHub(token, username, repo) {
        const filePaths = this.settings.get_strv('sync-files');
        
        for (const filePath of filePaths) {
            try {
                // Create GitHub path
                const githubPath = `files${filePath.replace('~', '/home')}`;
                
                console.log(`Sync Manager: Downloading file from ${githubPath} to ${filePath}`);
                
                const response = await this.githubAPI.getContents(username, repo, githubPath, token);
                
                if (response.ok) {
                    const fileData = JSON.parse(response.data);
                    const content = new TextDecoder().decode(GLib.base64_decode(fileData.content));
                    
                    // Restore file
                    const expandedPath = filePath.replace('~', GLib.get_home_dir());
                    const file = Gio.File.new_for_path(expandedPath);
                    
                    // Create directory if it doesn't exist
                    const parent = file.get_parent();
                    if (!parent.query_exists(null)) {
                        parent.make_directory_with_parents(null);
                    }
                    
                    file.replace_contents(
                        new TextEncoder().encode(content),
                        null,
                        false,
                        Gio.FileCreateFlags.REPLACE_DESTINATION,
                        null
                    );
                    
                    console.log(`Sync Manager: Successfully restored file ${filePath}`);
                } else if (response.status === SyncManager.HTTP_NOT_FOUND) {
                    console.warn(`Sync Manager: File ${githubPath} not found in repository, skipping`);
                } else {
                    console.error(`Sync Manager: Failed to download ${githubPath}: ${response.status}`);
                }
                
            } catch (e) {
                console.error(`Sync Manager: Failed to download file ${filePath}: ${e.message}`);
            }
        }
    }
    
    
    /**
     * Clear the content hash cache
     */
    clearCache() {
        this._contentHashCache.clear();
        console.log('Sync Manager: Cleared content hash cache');
    }
    
    /**
     * Destroy and cleanup with proper timer management
     */
    destroy() {
        console.log('Sync Manager: Starting cleanup');
        
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
        this.githubAPI = null;
        this.wallpaperManager = null;
        this.settings = null;
        
        // Reset state
        this._isSyncing = false;
        
        console.log('Sync Manager: Cleanup complete');
    }
}