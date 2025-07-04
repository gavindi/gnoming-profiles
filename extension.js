/*
 * Gnoming Profiles extension for Gnome 45+
 * Copyright 2025 Gavin Graham (gavindi)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPLv2)
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Soup from 'gi://Soup';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

// Request queue implementation for managing GitHub API calls
class RequestQueue {
    constructor(maxConcurrency = 3) {
        this.maxConcurrency = maxConcurrency;
        this.running = 0;
        this.queue = [];
    }
    
    async add(requestFunction) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                fn: requestFunction,
                resolve: resolve,
                reject: reject
            });
            this._processQueue();
        });
    }
    
    async _processQueue() {
        if (this.running >= this.maxConcurrency || this.queue.length === 0) {
            return;
        }
        
        this.running++;
        const item = this.queue.shift();
        
        try {
            const result = await item.fn();
            item.resolve(result);
        } catch (error) {
            item.reject(error);
        } finally {
            this.running--;
            // Process next item
            this._processQueue();
        }
    }
    
    clear() {
        // Reject all pending requests
        for (const item of this.queue) {
            item.reject(new Error('Queue cleared'));
        }
        this.queue = [];
    }
    
    get pendingCount() {
        return this.queue.length;
    }
    
    get activeCount() {
        return this.running;
    }
}

const ConfigSyncIndicator = GObject.registerClass(
class ConfigSyncIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Gnoming Profiles');
        
        this._icon = new St.Icon({
            icon_name: 'system-switch-user-symbolic',
            style_class: 'system-status-icon'
        });
        this.add_child(this._icon);
        
        // Animation state
        this._isAnimating = false;
        this._animationTimeout = null;
        this._animationStep = 0;
        this._syncIcons = [
            'system-switch-user-symbolic',
            'emblem-synchronizing-symbolic', 
            'view-refresh-symbolic',
            'network-transmit-receive-symbolic'
        ];
        
        // Create menu items in organized structure
        
        // 1. Extension name at top
        let titleItem = new PopupMenu.PopupMenuItem(_('Gnoming Profiles'));
        titleItem.reactive = false;
        titleItem.add_style_class_name('popup-menu-item');
        this.menu.addMenuItem(titleItem);
        
        // 2. Separator after title
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // 3. Status items (stats)
        let statusItem = new PopupMenu.PopupMenuItem(_('Last sync: Never'));
        statusItem.reactive = false;
        this.menu.addMenuItem(statusItem);
        this._statusItem = statusItem;
        
        let monitoringItem = new PopupMenu.PopupMenuItem(_('Change monitoring: Off'));
        monitoringItem.reactive = false;
        this.menu.addMenuItem(monitoringItem);
        this._monitoringItem = monitoringItem;
        
        let pollingItem = new PopupMenu.PopupMenuItem(_('GitHub polling: Off'));
        pollingItem.reactive = false;
        this.menu.addMenuItem(pollingItem);
        this._pollingItem = pollingItem;
        
        let queueItem = new PopupMenu.PopupMenuItem(_('Request queue: 0 pending'));
        queueItem.reactive = false;
        this.menu.addMenuItem(queueItem);
        this._queueItem = queueItem;
        
        let etagItem = new PopupMenu.PopupMenuItem(_('ETag polling: Not cached'));
        etagItem.reactive = false;
        this.menu.addMenuItem(etagItem);
        this._etagItem = etagItem;
        
        let remoteChangesItem = new PopupMenu.PopupMenuItem(_('Pull Remote Changes'));
        remoteChangesItem.visible = false;
        this.menu.addMenuItem(remoteChangesItem);
        this._remoteChangesItem = remoteChangesItem;
        
        // 4. Separator before action items
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // 5. Action items (Sync and Settings) at bottom
        let syncItem = new PopupMenu.PopupMenuItem(_('Sync Now'));
        syncItem.connect('activate', () => {
            this._extension.syncNow();
        });
        this.menu.addMenuItem(syncItem);
        this._syncItem = syncItem;
        
        let settingsItem = new PopupMenu.PopupMenuItem(_('Settings'));
        settingsItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(settingsItem);
    }
    
    startSyncAnimation() {
        if (this._isAnimating) return;
        
        this._isAnimating = true;
        this._animationStep = 0;
        
        // Add pulsing CSS class
        this._icon.add_style_class_name('syncing');
        
        this._animationTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            if (!this._isAnimating) return GLib.SOURCE_REMOVE;
            
            // Cycle through different sync-related icons
            this._animationStep = (this._animationStep + 1) % this._syncIcons.length;
            this._icon.icon_name = this._syncIcons[this._animationStep];
            
            return GLib.SOURCE_CONTINUE;
        });
        
        log('Started sync animation');
    }
    
    stopSyncAnimation() {
        if (!this._isAnimating) return;
        
        this._isAnimating = false;
        
        if (this._animationTimeout) {
            GLib.source_remove(this._animationTimeout);
            this._animationTimeout = null;
        }
        
        // Remove CSS class and reset icon
        this._icon.remove_style_class_name('syncing');
        this._icon.icon_name = 'system-switch-user-symbolic';
        
        log('Stopped sync animation');
    }
    
    updateStatus(message) {
        this._statusItem.label.text = message;
    }
    
    updateSyncItemSensitivity(sensitive) {
        if (this._syncItem) {
            this._syncItem.sensitive = sensitive;
            this._syncItem.label.text = sensitive ? _('Sync Now') : _('Sync in Progress...');
        }
    }
    
    updateMonitoringStatus(isMonitoring, fileCount, schemaCount) {
        if (isMonitoring) {
            this._monitoringItem.label.text = _(`Monitoring: ${fileCount} files, ${schemaCount} schemas`);
            this._icon.add_style_class_name('monitoring-active');
        } else {
            this._monitoringItem.label.text = _(`Configured: ${fileCount} files, ${schemaCount} schemas (monitoring off)`);
            this._icon.remove_style_class_name('monitoring-active');
        }
    }
    
    updatePollingStatus(isPolling, intervalMinutes) {
        if (isPolling) {
            this._pollingItem.label.text = _(`GitHub polling: Every ${intervalMinutes} min (ETag)`);
            this._icon.add_style_class_name('monitoring-active');
        } else {
            this._pollingItem.label.text = _('GitHub polling: Off');
            this._icon.remove_style_class_name('monitoring-active');
        }
    }
    
    updateQueueStatus(pending, active) {
        this._queueItem.label.text = _(`Request queue: ${pending} pending, ${active} active`);
    }
    
    updateETagStatus(hasETag, wasModified) {
        if (hasETag) {
            if (wasModified === null) {
                this._etagItem.label.text = _('ETag polling: Cached');
            } else if (wasModified) {
                this._etagItem.label.text = _('ETag polling: Changes detected');
            } else {
                this._etagItem.label.text = _('ETag polling: No changes (304)');
            }
        } else {
            this._etagItem.label.text = _('ETag polling: Not cached');
        }
    }
    
    showRemoteChanges(commit) {
        this._remoteChangesItem.visible = true;
        const shortSha = commit.sha.substring(0, 7);
        const shortMessage = commit.commit.message.substring(0, 30);
        this._remoteChangesItem.label.text = _(`⬇ Pull Changes (${shortSha}: ${shortMessage}...)`);
        
        // Add visual indicator for remote changes
        this._icon.add_style_class_name('remote-changes');
    }
    
    clearRemoteChanges() {
        this._remoteChangesItem.visible = false;
        this._icon.remove_style_class_name('remote-changes');
    }
    
    setExtension(extension) {
        this._extension = extension;
        
        // Now we can safely set up the remote changes callback
        this._remoteChangesItem.connect('activate', () => {
            this._extension.syncFromRemote();
        });
    }
    
    destroy() {
        this.stopSyncAnimation();
        super.destroy();
    }
});

export default class ConfigSyncExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
        this._settings = null;
        this._sessionManager = null;
        this._sessionSignalId = null;
        
        // Sync lock to prevent concurrent operations
        this._isSyncing = false;
        this._syncQueue = [];
        
        // Performance improvements for v2.9
        this._requestQueue = new RequestQueue(3); // Max 3 concurrent requests
        this._shaCache = new Map(); // Cache file SHAs to avoid unnecessary uploads
        this._contentHashCache = new Map(); // Cache content hashes
        this._httpSession = null; // Reuse HTTP session
        
        // NEW: ETag caching for improved polling efficiency
        this._etagCache = new Map(); // Store ETags for different endpoints
        this._lastPollResult = null; // Track last polling result
        
        // Change monitoring
        this._fileMonitors = new Map();
        this._settingsMonitors = new Map();
        this._debounceTimeout = null;
        this._pendingChanges = false;
        this._isMonitoring = false;
        
        // GitHub polling
        this._pollingTimeout = null;
        this._isPolling = false;
        this._lastKnownCommit = null;
        this._remoteChangesDetected = false;
        
        // Wallpaper tracking
        this._wallpaperData = new Map();
    }
    
    enable() {
        this._settings = this.getSettings();
        this._indicator = new ConfigSyncIndicator();
        this._indicator.setExtension(this);
        
        // Initialize HTTP session for reuse
        this._httpSession = new Soup.Session();
        this._httpSession.timeout = 30;
        this._httpSession.max_conns = 10;
        this._httpSession.user_agent = 'GNOME-Config-Sync/2.9.0-ETag';
        
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        
        // Connect to session manager for login/logout events
        this._setupSessionHandlers();
        
        // Setup initial monitoring status (before any sync attempts)
        this._setupChangeMonitoring();
        
        // Setup GitHub polling
        this._setupGitHubPolling();
        
        // Listen for settings changes that affect monitoring and polling
        this._settings.connect('changed::auto-sync-on-change', () => {
            this._setupChangeMonitoring();
        });
        this._settings.connect('changed::sync-files', () => {
            this._setupChangeMonitoring();
        });
        this._settings.connect('changed::gsettings-schemas', () => {
            this._setupChangeMonitoring();
        });
        this._settings.connect('changed::sync-wallpapers', () => {
            this._setupChangeMonitoring();
        });
        this._settings.connect('changed::github-polling-enabled', () => {
            this._setupGitHubPolling();
        });
        this._settings.connect('changed::github-polling-interval', () => {
            this._setupGitHubPolling();
        });
        this._settings.connect('changed::trigger-initial-sync', () => {
            this._onTriggerInitialSync();
        });
        
        // Setup queue status update timer
        this._setupQueueStatusUpdater();
        
        // Initial setup and sync on enable
        if (this._settings.get_boolean('auto-sync-on-login')) {
            this._performSyncOperation('initial', async () => {
                // First try to restore from GitHub, then backup current config
                await this._syncFromGitHub();
                // Also create an initial backup after restore
                await this._syncToGitHub();
                return 'Extension loaded';
            });
        }
        
        log('Gnoming Profiles extension enabled (v2.9.0) with GitHub Tree API batching and ETag polling');
    }
    
    disable() {
        // Clear request queue
        if (this._requestQueue) {
            this._requestQueue.clear();
        }
        
        // Stop change monitoring
        this._stopChangeMonitoring();
        
        // Stop GitHub polling (before destroying indicator)
        this._stopGitHubPolling();
        
        // Clean up session manager connections
        if (this._sessionSignalId && this._sessionManager) {
            try {
                this._sessionManager.disconnect(this._sessionSignalId);
                this._sessionSignalId = null;
                log('Session manager signal disconnected');
            } catch (e) {
                log(`Error disconnecting session manager signal: ${e.message}`);
            }
        }
        
        // Dispose of the session manager proxy
        if (this._sessionManager) {
            try {
                this._sessionManager = null;
                log('Session manager proxy cleaned up');
            } catch (e) {
                log(`Error cleaning up session manager proxy: ${e.message}`);
                this._sessionManager = null;
            }
        }
        
        // Clean up HTTP session
        if (this._httpSession) {
            this._httpSession = null;
        }
        
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        
        this._settings = null;
        this._wallpaperData.clear();
        
        // Clear caches
        this._shaCache.clear();
        this._contentHashCache.clear();
        this._etagCache.clear();
        
        // Clear sync lock and queue
        this._isSyncing = false;
        this._syncQueue = [];
        
        log('Gnoming Profiles extension disabled');
    }
    
    _setupQueueStatusUpdater() {
        // Update queue status every 2 seconds when queue is active
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            if (this._indicator && this._requestQueue) {
                this._indicator.updateQueueStatus(
                    this._requestQueue.pendingCount,
                    this._requestQueue.activeCount
                );
                
                // Update ETag status
                const commitsETag = this._etagCache.get('commits');
                this._indicator.updateETagStatus(!!commitsETag, this._lastPollResult);
            }
            return GLib.SOURCE_CONTINUE;
        });
    }
    
    /**
     * Centralized sync operation wrapper that implements locking
     * @param {string} operationType - Description of the operation (for logging/UI)
     * @param {Function} syncFunction - Async function that performs the actual sync
     * @param {boolean} allowQueue - Whether to queue this operation if another is in progress
     */
    async _performSyncOperation(operationType, syncFunction, allowQueue = false) {
        // Check if sync is already in progress
        if (this._isSyncing) {
            log(`Sync operation "${operationType}" blocked: another sync in progress`);
            
            if (allowQueue) {
                // Queue the operation for later
                this._syncQueue.push({ operationType, syncFunction });
                log(`Sync operation "${operationType}" queued`);
                this._indicator.updateStatus(_('Sync queued: ') + operationType);
                return;
            } else {
                // Reject the operation
                this._indicator.updateStatus(_('Sync blocked: operation in progress'));
                log(`Sync operation "${operationType}" rejected: not queueing`);
                return;
            }
        }
        
        // Acquire sync lock
        this._isSyncing = true;
        this._indicator.updateSyncItemSensitivity(false);
        this._indicator.startSyncAnimation();
        this._indicator.updateStatus(_('Syncing: ') + operationType);
        
        log(`Starting sync operation: ${operationType}`);
        
        try {
            // Perform the actual sync operation
            const result = await syncFunction();
            
            // Success
            this._indicator.stopSyncAnimation();
            const successMessage = result || `${operationType} complete`;
            this._indicator.updateStatus(successMessage + ': ' + new Date().toLocaleTimeString());
            log(`Sync operation completed successfully: ${operationType}`);
            
        } catch (error) {
            // Handle errors
            this._indicator.stopSyncAnimation();
            this._indicator.updateStatus(_(`${operationType} failed: `) + error.message);
            log(`Sync operation failed: ${operationType} - ${error.message}`);
            
        } finally {
            // Always release the lock
            this._isSyncing = false;
            this._indicator.updateSyncItemSensitivity(true);
            
            // Update monitoring status after sync completes
            this._setupChangeMonitoring();
            
            // Process any queued operations
            this._processNextQueuedSync();
        }
    }
    
    /**
     * Process the next queued sync operation if any
     */
    _processNextQueuedSync() {
        if (this._syncQueue.length === 0) {
            return;
        }
        
        const nextOperation = this._syncQueue.shift();
        log(`Processing next queued sync operation: ${nextOperation.operationType}`);
        
        // Use a small delay to prevent immediate re-execution
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this._performSyncOperation(nextOperation.operationType, nextOperation.syncFunction, false);
            return GLib.SOURCE_REMOVE;
        });
    }
    
    _setupChangeMonitoring() {
        // Stop existing monitoring
        this._stopChangeMonitoring();
        
        const changeMonitoringEnabled = this._settings.get_boolean('auto-sync-on-change');
        
        // Get configured items for status display
        const filePaths = this._settings.get_strv('sync-files');
        const baseSchemas = this._settings.get_strv('gsettings-schemas');
        const allSchemas = [...baseSchemas];
        
        const syncWallpapers = this._settings.get_boolean('sync-wallpapers');
        if (syncWallpapers) {
            allSchemas.push('org.gnome.desktop.background');
            allSchemas.push('org.gnome.desktop.screensaver');
        }
        
        // Count available schemas (ones that actually exist)
        let availableSchemaCount = 0;
        log(`Checking ${allSchemas.length} total schemas (including ${syncWallpapers ? 'wallpapers' : 'no wallpapers'})`);
        
        try {
            const schemaSource = Gio.SettingsSchemaSource.get_default();
            if (!schemaSource) {
                log('ERROR: Could not get default schema source');
                this._indicator.updateMonitoringStatus(false, filePaths.length, 0);
                return;
            }
            
            for (const schema of allSchemas) {
                try {
                    const schemaObj = schemaSource.lookup(schema, true);
                    if (schemaObj) {
                        availableSchemaCount++;
                        log(`✓ Schema available: ${schema}`);
                    } else {
                        log(`✗ Schema not found: ${schema}`);
                    }
                } catch (e) {
                    log(`ERROR checking schema ${schema}: ${e.message}`);
                }
            }
        } catch (e) {
            log(`ERROR getting schema source: ${e.message}`);
            this._indicator.updateMonitoringStatus(false, filePaths.length, 0);
            return;
        }
        
        log(`Total configured schemas: ${allSchemas.length}, available: ${availableSchemaCount}`);
        
        if (!changeMonitoringEnabled) {
            this._indicator.updateMonitoringStatus(false, filePaths.length, availableSchemaCount);
            log(`Change monitoring disabled. Configured: ${filePaths.length} files, ${availableSchemaCount}/${allSchemas.length} schemas available (wallpapers: ${syncWallpapers})`);
            return;
        }
        
        // Setup file monitoring
        for (const filePath of filePaths) {
            this._setupFileMonitor(filePath);
        }
        
        if (syncWallpapers) {
            log('Wallpaper syncing enabled, monitoring wallpaper schemas');
        }
        
        // Setup gsettings monitoring for all schemas
        for (const schema of allSchemas) {
            this._setupGSettingsMonitor(schema);
        }
        
        this._isMonitoring = true;
        // Use available schema count instead of _settingsMonitors.size for consistency
        this._indicator.updateMonitoringStatus(true, this._fileMonitors.size, availableSchemaCount);
        
        log(`Change monitoring enabled: ${this._fileMonitors.size} files, ${this._settingsMonitors.size} active monitors, ${availableSchemaCount} available schemas (wallpapers: ${syncWallpapers})`);
    }
    
    _setupFileMonitor(filePath) {
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
                // Only trigger on actual file changes, not temporary files
                if (eventType === Gio.FileMonitorEvent.CHANGED || 
                    eventType === Gio.FileMonitorEvent.CREATED ||
                    eventType === Gio.FileMonitorEvent.DELETED) {
                    
                    // Check if the change is for our target file
                    const changedPath = file.get_path();
                    if (changedPath === expandedPath || 
                        (monitorFile !== file && changedPath.endsWith(file.get_basename()))) {
                        
                        log(`File changed: ${filePath}`);
                        this._onChangeDetected(`File: ${filePath}`);
                    }
                }
            });
            
            this._fileMonitors.set(filePath, monitor);
            log(`Monitoring file: ${filePath}`);
            
        } catch (e) {
            log(`Failed to setup file monitor for ${filePath}: ${e.message}`);
        }
    }
    
    _setupGSettingsMonitor(schema) {
        try {
            // Check if schema exists before trying to access it
            const schemaSource = Gio.SettingsSchemaSource.get_default();
            const schemaObj = schemaSource.lookup(schema, true);
            
            if (!schemaObj) {
                log(`Schema ${schema} not found, skipping (extension may not be installed)`);
                return;
            }
            
            const settings = new Gio.Settings({schema: schema});
            
            const handlerId = settings.connect('changed', (settings, key) => {
                log(`GSettings changed: ${schema}.${key}`);
                this._onChangeDetected(`Schema: ${schema}.${key}`);
            });
            
            this._settingsMonitors.set(schema, {settings, handlerId});
            log(`Monitoring GSettings schema: ${schema}`);
            
        } catch (e) {
            log(`Failed to setup GSettings monitor for ${schema}: ${e.message}`);
        }
    }
    
    _onChangeDetected(source) {
        // Debounce changes to avoid excessive syncing
        if (this._debounceTimeout) {
            GLib.source_remove(this._debounceTimeout);
        }
        
        this._pendingChanges = true;
        const debounceDelay = this._settings.get_int('change-sync-delay') * 1000; // Convert to milliseconds
        
        this._debounceTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, debounceDelay, () => {
            if (this._pendingChanges) {
                log(`Triggering sync due to change: ${source}`);
                this._syncOnChange();
                this._pendingChanges = false;
            }
            this._debounceTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
        
        log(`Change detected from ${source}, sync scheduled in ${debounceDelay}ms`);
    }
    
    _syncOnChange() {
        if (!this._settings.get_boolean('auto-sync-on-change')) {
            return;
        }
        
        // Use the centralized sync operation with queueing enabled for change-based syncs
        this._performSyncOperation('changes', async () => {
            // Only backup to GitHub on changes (don't restore from GitHub)
            await this._syncToGitHub();
            return 'Change synced';
        }, true); // Allow queueing for change-based syncs
    }
    
    _stopChangeMonitoring() {
        // Stop file monitors
        for (const [path, monitor] of this._fileMonitors) {
            try {
                monitor.cancel();
            } catch (e) {
                log(`Error canceling file monitor for ${path}: ${e.message}`);
            }
        }
        this._fileMonitors.clear();
        
        // Stop GSettings monitors
        for (const [schema, {settings, handlerId}] of this._settingsMonitors) {
            try {
                settings.disconnect(handlerId);
            } catch (e) {
                log(`Error disconnecting GSettings monitor for ${schema}: ${e.message}`);
            }
        }
        this._settingsMonitors.clear();
        
        // Clear debounce timeout
        if (this._debounceTimeout) {
            GLib.source_remove(this._debounceTimeout);
            this._debounceTimeout = null;
        }
        
        this._isMonitoring = false;
        this._pendingChanges = false;
        
        // Update status to show configured items even when monitoring is off
        if (this._indicator) {
            const filePaths = this._settings.get_strv('sync-files');
            const baseSchemas = this._settings.get_strv('gsettings-schemas');
            const allSchemas = [...baseSchemas];
            
            const syncWallpapers = this._settings.get_boolean('sync-wallpapers');
            if (syncWallpapers) {
                allSchemas.push('org.gnome.desktop.background');
                allSchemas.push('org.gnome.desktop.screensaver');
            }
            
            // Count available schemas
            let availableSchemaCount = 0;
            for (const schema of allSchemas) {
                try {
                    const schemaSource = Gio.SettingsSchemaSource.get_default();
                    const schemaObj = schemaSource.lookup(schema, true);
                    if (schemaObj) {
                        availableSchemaCount++;
                    }
                } catch (e) {
                    // Schema doesn't exist, skip counting
                }
            }
            
            this._indicator.updateMonitoringStatus(false, filePaths.length, availableSchemaCount);
        }
        
        log('Change monitoring stopped');
    }
    
    _setupGitHubPolling() {
        // Stop existing polling
        this._stopGitHubPolling();
        
        // Check if polling is enabled in settings
        let pollingEnabled = false;
        try {
            pollingEnabled = this._settings.get_boolean('github-polling-enabled');
            log(`GitHub polling setting: ${pollingEnabled}`);
        } catch (e) {
            log('github-polling-enabled setting not found, assuming disabled');
            if (this._indicator) {
                this._indicator.updatePollingStatus(false, 0);
            }
            return;
        }
        
        if (!pollingEnabled) {
            log('GitHub polling disabled in settings');
            if (this._indicator) {
                this._indicator.updatePollingStatus(false, 0);
            }
            return;
        }
        
        // Check if GitHub credentials are configured
        const token = this._settings.get_string('github-token');
        const repo = this._settings.get_string('github-repo');
        const username = this._settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            log('GitHub polling: Credentials not configured');
            log(`  Token: ${token ? 'present' : 'missing'}`);
            log(`  Repo: ${repo || 'missing'}`);
            log(`  Username: ${username || 'missing'}`);
            if (this._indicator) {
                this._indicator.updatePollingStatus(false, 0);
            }
            return;
        }
        
        // Get polling interval with fallback
        let intervalMinutes = 15; // default
        try {
            intervalMinutes = this._settings.get_int('github-polling-interval');
            log(`GitHub polling interval: ${intervalMinutes} minutes`);
        } catch (e) {
            log('github-polling-interval setting not found, using default 15 minutes');
        }
        
        this._isPolling = true;
        const intervalMs = intervalMinutes * 60 * 1000; // Convert to milliseconds
        
        log(`GitHub ETag polling: Starting for ${username}/${repo} every ${intervalMinutes} minutes`);
        
        // Start polling immediately
        this._scheduleNextPoll(intervalMs);
        if (this._indicator) {
            this._indicator.updatePollingStatus(true, intervalMinutes);
        }
        log(`GitHub ETag polling: Successfully enabled`);
    }
    
    _scheduleNextPoll(intervalMs) {
        if (!this._isPolling) {
            log('GitHub polling: Not scheduling next poll - polling disabled');
            return;
        }
        
        log(`GitHub ETag polling: Scheduling next poll in ${intervalMs / 1000} seconds`);
        
        this._pollingTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
            if (!this._isPolling) {
                log('GitHub polling: Timer fired but polling disabled');
                return GLib.SOURCE_REMOVE;
            }
            
            log('GitHub ETag polling: Timer fired, starting poll');
            this._pollGitHubForChanges().then(() => {
                log('GitHub ETag polling: Poll completed, scheduling next');
                // Schedule next poll
                this._scheduleNextPoll(intervalMs);
            }).catch(error => {
                log(`GitHub ETag polling error: ${error.message}`);
                // Still schedule next poll to retry
                log('GitHub ETag polling: Scheduling retry poll');
                this._scheduleNextPoll(intervalMs);
            });
            
            return GLib.SOURCE_REMOVE;
        });
        
        log(`GitHub ETag polling: Timer scheduled with ID ${this._pollingTimeout}`);
    }
    
    /**
     * NEW: ETag-based polling for improved efficiency
     */
    async _pollGitHubForChanges() {
        const token = this._settings.get_string('github-token');
        const repo = this._settings.get_string('github-repo');
        const username = this._settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            log('GitHub ETag polling: Missing credentials');
            return;
        }
        
        try {
            log(`GitHub ETag polling: Checking ${username}/${repo} for changes...`);
            
            const commitsUrl = `https://api.github.com/repos/${username}/${repo}/commits?per_page=1`;
            const cachedETag = this._etagCache.get('commits');
            
            if (cachedETag) {
                log(`GitHub ETag polling: Using cached ETag: ${cachedETag}`);
            } else {
                log('GitHub ETag polling: No cached ETag, performing initial request');
            }
            
            // Make conditional request with ETag
            const response = await this._requestQueue.add(() => 
                this._makeGitHubRequest(
                    commitsUrl,
                    'GET',
                    token,
                    null,
                    cachedETag // Pass ETag for conditional request
                )
            );
            
            // Handle 304 Not Modified response
            if (response.status === 304) {
                log('GitHub ETag polling: No changes detected (304 Not Modified)');
                this._lastPollResult = false; // No changes
                return;
            }
            
            if (!response.ok) {
                if (response.status === 404) {
                    log('GitHub ETag polling: Repository not found or empty');
                    return;
                } else if (response.status === 401) {
                    log('GitHub ETag polling: Authentication failed - check your token');
                    return;
                } else if (response.status === 403) {
                    log('GitHub ETag polling: Access forbidden - check repository permissions');
                    return;
                }
                throw new Error(`GitHub API error: ${response.status} - ${response.data}`);
            }
            
            // Store new ETag for future requests
            if (response.etag) {
                this._etagCache.set('commits', response.etag);
                log(`GitHub ETag polling: Cached new ETag: ${response.etag}`);
            }
            
            const commits = JSON.parse(response.data);
            if (commits.length === 0) {
                log('GitHub ETag polling: No commits found in repository');
                this._lastPollResult = false;
                return;
            }
            
            const latestCommit = commits[0];
            const latestCommitSha = latestCommit.sha;
            const commitMessage = latestCommit.commit.message;
            
            log(`GitHub ETag polling: Latest commit ${latestCommitSha.substring(0, 7)}: ${commitMessage}`);
            log(`GitHub ETag polling: Last known commit was ${this._lastKnownCommit ? this._lastKnownCommit.substring(0, 7) : 'none'}`);
            
            // Check if this is a new commit (or if we don't have a last known commit yet)
            if (!this._lastKnownCommit) {
                log('GitHub ETag polling: No previous commit known, storing current as baseline');
                this._lastKnownCommit = latestCommitSha;
                this._lastPollResult = false; // No changes to process
                return;
            }
            
            if (this._lastKnownCommit !== latestCommitSha) {
                log(`GitHub ETag polling: New commit detected! ${latestCommitSha.substring(0, 7)}`);
                this._lastPollResult = true; // Changes detected
                
                // Trigger remote changes detection
                log('GitHub ETag polling: Triggering remote changes detection');
                this._onRemoteChangesDetected(latestCommit);
                
                // Update our known commit
                this._lastKnownCommit = latestCommitSha;
            } else {
                log('GitHub ETag polling: No new commits detected');
                this._lastPollResult = false; // No changes
            }
            
        } catch (error) {
            log(`GitHub ETag polling error: ${error.message}`);
            this._lastPollResult = null; // Error state
            // Don't throw the error to prevent polling from stopping
        }
    }
    
    _onRemoteChangesDetected(commit) {
        this._remoteChangesDetected = true;
        
        const shortSha = commit.sha.substring(0, 7);
        const commitMsg = commit.commit.message.split('\n')[0]; // First line only
        
        log(`GitHub ETag polling: Remote changes detected in commit ${shortSha}: ${commitMsg}`);
        
        // Safely show remote changes
        if (this._indicator) {
            this._indicator.showRemoteChanges(commit);
        }
        
        // Check auto-sync setting with better error handling
        let autoSyncRemote = true; // Default to true for better UX
        try {
            autoSyncRemote = this._settings.get_boolean('auto-sync-remote-changes');
            log(`GitHub ETag polling: Auto-sync remote changes setting: ${autoSyncRemote}`);
        } catch (e) {
            log('auto-sync-remote-changes setting not found, defaulting to true');
        }
        
        if (autoSyncRemote) {
            log('GitHub ETag polling: Starting auto-sync of remote changes');
            
            this._performSyncOperation('remote changes', async () => {
                await this._syncFromGitHub();
                if (this._indicator) {
                    this._indicator.clearRemoteChanges();
                }
                this._remoteChangesDetected = false;
                return 'Remote sync complete';
            }, true); // Allow queueing for remote sync
        } else {
            log('GitHub ETag polling: Auto-sync disabled, showing manual pull option');
            if (this._indicator) {
                this._indicator.updateStatus(_('Remote changes available - check menu to pull'));
            }
        }
    }
    
    async _updateLastKnownCommit() {
        const token = this._settings.get_string('github-token');
        const repo = this._settings.get_string('github-repo');
        const username = this._settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            log('GitHub ETag polling: Cannot get initial commit - credentials missing');
            return;
        }
        
        try {
            log(`GitHub ETag polling: Getting initial commit hash for ${username}/${repo}`);
            const response = await this._requestQueue.add(() =>
                this._makeGitHubRequest(
                    `https://api.github.com/repos/${username}/${repo}/commits?per_page=1`,
                    'GET',
                    token
                )
            );
            
            if (response.ok) {
                // Store initial ETag
                if (response.etag) {
                    this._etagCache.set('commits', response.etag);
                    log(`GitHub ETag polling: Stored initial ETag: ${response.etag}`);
                }
                
                const commits = JSON.parse(response.data);
                if (commits.length > 0) {
                    this._lastKnownCommit = commits[0].sha;
                    const commitMsg = commits[0].commit.message.split('\n')[0];
                    log(`GitHub ETag polling: Initial commit hash set to ${this._lastKnownCommit.substring(0, 7)}: ${commitMsg}`);
                } else {
                    log('GitHub ETag polling: Repository has no commits');
                    this._lastKnownCommit = null;
                }
            } else {
                log(`GitHub ETag polling: Failed to get initial commit (${response.status}): ${response.data}`);
                throw new Error(`GitHub API error: ${response.status}`);
            }
        } catch (error) {
            log(`GitHub ETag polling: Failed to get initial commit hash: ${error.message}`);
            this._lastKnownCommit = null; // Reset so we'll detect the first commit
            throw error;
        }
    }
    
    _stopGitHubPolling() {
        if (this._pollingTimeout) {
            GLib.source_remove(this._pollingTimeout);
            this._pollingTimeout = null;
        }
        
        this._isPolling = false;
        this._lastKnownCommit = null;
        this._remoteChangesDetected = false;
        this._lastPollResult = null;
        
        if (this._indicator) {
            this._indicator.updatePollingStatus(false, 0);
            this._indicator.clearRemoteChanges();
        }
        
        log('GitHub ETag polling stopped');
    }
    
    _setupSessionHandlers() {
        try {
            // Connect to GNOME Session Manager
            this._sessionManager = new Gio.DBusProxy({
                g_connection: Gio.DBus.session,
                g_name: 'org.gnome.SessionManager',
                g_object_path: '/org/gnome/SessionManager',
                g_interface_name: 'org.gnome.SessionManager'
            });
            
            // Listen for session state changes and store the signal ID
            this._sessionSignalId = this._sessionManager.connect('g-signal', (proxy, sender, signal, params) => {
                if (signal === 'SessionRunning') {
                    this._onLogin();
                } else if (signal === 'SessionEnding') {
                    this._onLogout();
                }
            });
            
            log('Session handlers setup complete');
            
        } catch (e) {
            log(`Failed to setup session handlers: ${e.message}`);
        }
    }
    
    _onLogin() {
        log('Session login detected');
        if (this._settings.get_boolean('auto-sync-on-login')) {
            this._performSyncOperation('login', async () => {
                await this._syncFromGitHub();
                return 'Login sync complete';
            });
        }
    }
    
    _onLogout() {
        log('Session logout detected');
        if (this._settings.get_boolean('auto-sync-on-logout')) {
            this._performSyncOperation('logout', async () => {
                await this._syncToGitHub();
                return 'Logout sync complete';
            });
        }
    }
    
    _onTriggerInitialSync() {
        // Check if the flag was set to true
        if (!this._settings.get_boolean('trigger-initial-sync')) {
            return;
        }
        
        // Reset the flag immediately
        this._settings.set_boolean('trigger-initial-sync', false);
        
        log('Manual initial sync triggered from preferences');
        
        if (!this._indicator) {
            log('Cannot perform initial sync: indicator not available');
            return;
        }
        
        // Check if credentials are configured
        const token = this._settings.get_string('github-token');
        const repo = this._settings.get_string('github-repo');
        const username = this._settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            this._indicator.updateStatus(_('Initial sync failed: GitHub credentials not configured'));
            log('Initial sync failed: GitHub credentials not configured');
            return;
        }
        
        this._performSyncOperation('manual initial sync', async () => {
            // Perform initial backup (create backup of current settings)
            await this._syncToGitHub();
            return 'Initial sync complete';
        });
    }
    
    syncNow() {
        this._performSyncOperation('manual sync', async () => {
            // First backup current config, then sync from GitHub
            await this._syncToGitHub();
            await this._syncFromGitHub();
            return 'Manual sync complete';
        });
    }
    
    syncFromRemote() {
        this._performSyncOperation('remote pull', async () => {
            // Only sync from GitHub (don't backup first)
            await this._syncFromGitHub();
            if (this._indicator) {
                this._indicator.clearRemoteChanges();
            }
            this._remoteChangesDetected = false;
            return 'Remote pull complete';
        });
    }
    
    /**
     * GitHub Tree API based sync - batches all file changes into a single commit
     */
    async _syncToGitHub() {
        const token = this._settings.get_string('github-token');
        const repo = this._settings.get_string('github-repo');
        const username = this._settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            throw new Error('GitHub credentials not configured');
        }
        
        try {
            log('Starting GitHub Tree API batch sync');
            
            // Create backup data (without wallpapers in main config)
            const backupData = await this._createBackup();
            
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
                log('Added config-backup.json to batch');
            } else {
                log('Skipping config-backup.json - content unchanged');
            }
            
            // 2. Add individual files
            const filePaths = this._settings.get_strv('sync-files');
            for (const filePath of filePaths) {
                try {
                    const expandedPath = filePath.replace('~', GLib.get_home_dir());
                    const file = Gio.File.new_for_path(expandedPath);
                    
                    if (!file.query_exists(null)) {
                        log(`File ${filePath} does not exist, skipping`);
                        continue;
                    }
                    
                    // Read file content
                    const [success, contents] = file.load_contents(null);
                    if (!success) {
                        log(`Failed to read file ${filePath}`);
                        continue;
                    }
                    
                    // Check if file is likely text (basic check)
                    const content = new TextDecoder('utf-8', { fatal: false }).decode(contents);
                    if (content.includes('\uFFFD')) {
                        log(`Skipping ${filePath}: appears to be binary`);
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
                        log(`Added ${githubPath} to batch`);
                    } else {
                        log(`Skipping ${githubPath} - content unchanged`);
                    }
                    
                } catch (e) {
                    log(`Failed to prepare file ${filePath} for batch: ${e.message}`);
                }
            }
            
            // 3. Add wallpapers if enabled
            const syncWallpapers = this._settings.get_boolean('sync-wallpapers');
            if (syncWallpapers && this._wallpaperData.size > 0) {
                for (const [wallpaperKey, wallpaperData] of this._wallpaperData) {
                    try {
                        const wallpaperContent = await this._getWallpaperContent(wallpaperKey);
                        if (wallpaperContent) {
                            const githubPath = `wallpapers/${wallpaperContent.fileName}`;
                            
                            // For wallpapers, we need to check content hash differently since it's base64
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
                                log(`Added wallpaper ${githubPath} to batch`);
                            } else {
                                log(`Skipping wallpaper ${githubPath} - content unchanged`);
                            }
                        }
                    } catch (e) {
                        log(`Failed to prepare wallpaper ${wallpaperKey} for batch: ${e.message}`);
                    }
                }
            }
            
            // If no changes to upload, skip the commit
            if (treeChanges.length === 0) {
                log('No changes detected, skipping GitHub commit');
                return;
            }
            
            log(`Batching ${treeChanges.length} changes into single commit`);
            
            // Upload using GitHub Tree API
            await this._uploadBatchedChanges(treeChanges, token, username, repo);
            
            // Clear wallpaper data after upload
            this._wallpaperData.clear();
            
            log(`Successfully synced ${treeChanges.length} changes to GitHub using Tree API`);
        } catch (error) {
            log(`Failed to sync to GitHub: ${error.message}`);
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
     * Upload batched changes using GitHub Tree API
     */
    async _uploadBatchedChanges(treeChanges, token, username, repo) {
        try {
            // 1. Get current commit SHA using request queue
            log('Getting current commit SHA');
            const branchResponse = await this._requestQueue.add(() =>
                this._makeGitHubRequest(
                    `https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`,
                    'GET',
                    token
                )
            );
            
            let currentCommitSha;
            if (branchResponse.ok) {
                const branchData = JSON.parse(branchResponse.data);
                currentCommitSha = branchData.object.sha;
                log(`Current commit SHA: ${currentCommitSha}`);
            } else if (branchResponse.status === 404) {
                // Repository is empty, we'll create the first commit
                log('Repository is empty, will create initial commit');
                currentCommitSha = null;
            } else {
                throw new Error(`Failed to get current commit: ${branchResponse.status}`);
            }
            
            // 2. Get current tree SHA (if we have a current commit)
            let currentTreeSha = null;
            if (currentCommitSha) {
                log('Getting current tree SHA');
                const commitResponse = await this._requestQueue.add(() =>
                    this._makeGitHubRequest(
                        `https://api.github.com/repos/${username}/${repo}/git/commits/${currentCommitSha}`,
                        'GET',
                        token
                    )
                );
                
                if (commitResponse.ok) {
                    const commitData = JSON.parse(commitResponse.data);
                    currentTreeSha = commitData.tree.sha;
                    log(`Current tree SHA: ${currentTreeSha}`);
                } else {
                    throw new Error(`Failed to get current tree: ${commitResponse.status}`);
                }
            }
            
            // 3. Create blobs for all content first
            log('Creating blobs for changed content');
            const treeEntries = [];
            
            for (const change of treeChanges) {
                try {
                    const blobData = {
                        content: change.content,
                        encoding: change.encoding || 'utf-8'
                    };
                    
                    const blobResponse = await this._requestQueue.add(() =>
                        this._makeGitHubRequest(
                            `https://api.github.com/repos/${username}/${repo}/git/blobs`,
                            'POST',
                            token,
                            blobData
                        )
                    );
                    
                    if (blobResponse.ok) {
                        const blob = JSON.parse(blobResponse.data);
                        treeEntries.push({
                            path: change.path,
                            mode: change.mode,
                            type: 'blob',
                            sha: blob.sha
                        });
                        log(`Created blob for ${change.path}: ${blob.sha}`);
                    } else {
                        log(`Failed to create blob for ${change.path}: ${blobResponse.status}`);
                    }
                } catch (e) {
                    log(`Error creating blob for ${change.path}: ${e.message}`);
                }
            }
            
            if (treeEntries.length === 0) {
                throw new Error('No blobs were created successfully');
            }
            
            // 4. Create new tree
            log(`Creating new tree with ${treeEntries.length} entries`);
            const treeData = {
                tree: treeEntries,
                ...(currentTreeSha && { base_tree: currentTreeSha })
            };
            
            const treeResponse = await this._requestQueue.add(() =>
                this._makeGitHubRequest(
                    `https://api.github.com/repos/${username}/${repo}/git/trees`,
                    'POST',
                    token,
                    treeData
                )
            );
            
            if (!treeResponse.ok) {
                throw new Error(`Failed to create tree: ${treeResponse.status} - ${treeResponse.data}`);
            }
            
            const newTree = JSON.parse(treeResponse.data);
            log(`Created new tree: ${newTree.sha}`);
            
            // 5. Create commit
            const commitMessage = `Batch sync ${treeEntries.length} files - ${new Date().toISOString()}`;
            log(`Creating commit: ${commitMessage}`);
            
            const commitData = {
                message: commitMessage,
                tree: newTree.sha,
                ...(currentCommitSha && { parents: [currentCommitSha] })
            };
            
            const commitResponse = await this._requestQueue.add(() =>
                this._makeGitHubRequest(
                    `https://api.github.com/repos/${username}/${repo}/git/commits`,
                    'POST',
                    token,
                    commitData
                )
            );
            
            if (!commitResponse.ok) {
                throw new Error(`Failed to create commit: ${commitResponse.status} - ${commitResponse.data}`);
            }
            
            const newCommit = JSON.parse(commitResponse.data);
            log(`Created commit: ${newCommit.sha}`);
            
            // 6. Update branch reference
            log('Updating branch reference');
            const refData = {
                sha: newCommit.sha,
                force: false
            };
            
            const refResponse = await this._requestQueue.add(() =>
                this._makeGitHubRequest(
                    `https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`,
                    'PATCH',
                    token,
                    refData
                )
            );
            
            if (!refResponse.ok) {
                throw new Error(`Failed to update branch: ${refResponse.status} - ${refResponse.data}`);
            }
            
            // Clear commits ETag cache since we just made changes
            this._etagCache.delete('commits');
            log('Cleared commits ETag cache after upload');
            
            log(`Successfully uploaded batch of ${treeEntries.length} files in single commit ${newCommit.sha.substring(0, 7)}`);
            
        } catch (error) {
            log(`Batch upload failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Load wallpaper content on-demand instead of storing in memory
     */
    async _getWallpaperContent(wallpaperKey) {
        const wallpaperData = this._wallpaperData.get(wallpaperKey);
        if (!wallpaperData || !wallpaperData.filePath) {
            return null;
        }
        
        try {
            const file = Gio.File.new_for_path(wallpaperData.filePath);
            const [success, contents] = file.load_contents(null);
            
            if (!success) {
                log(`Failed to read wallpaper: ${wallpaperData.filePath}`);
                return null;
            }
            
            return {
                content: GLib.base64_encode(contents),
                size: contents.length,
                ...wallpaperData
            };
        } catch (e) {
            log(`Error reading wallpaper ${wallpaperKey}: ${e.message}`);
            return null;
        }
    }
    
    async _syncFromGitHub() {
        const token = this._settings.get_string('github-token');
        const repo = this._settings.get_string('github-repo');
        const username = this._settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            log('GitHub credentials not configured, skipping sync from GitHub');
            return;
        }
        
        try {
            // Download gsettings from GitHub
            const backupData = await this._downloadFromGitHub(token, username, repo);
            
            // Download individual files
            await this._downloadFilesFromGitHub(token, username, repo);
            
            // Download and restore wallpapers separately if enabled
            const syncWallpapers = this._settings.get_boolean('sync-wallpapers');
            if (syncWallpapers) {
                await this._downloadAndRestoreWallpapers(token, username, repo);
            }
            
            // Restore configuration
            if (backupData) {
                await this._restoreBackup(backupData);
            }
            
            log('Successfully synced from GitHub');
        } catch (error) {
            log(`Failed to sync from GitHub: ${error.message}`);
            throw error;
        }
    }
    
    async _createBackup() {
        const backup = {
            timestamp: new Date().toISOString(),
            gsettings: {}
        };
        
        // Check if wallpaper syncing is enabled
        const syncWallpapers = this._settings.get_boolean('sync-wallpapers');
        log(`Creating backup - wallpaper syncing enabled: ${syncWallpapers}`);
        
        // Get base schemas from settings
        const schemas = this._settings.get_strv('gsettings-schemas');
        
        // Add wallpaper schemas if wallpaper syncing is enabled
        const allSchemas = [...schemas];
        if (syncWallpapers) {
            allSchemas.push('org.gnome.desktop.background');
            allSchemas.push('org.gnome.desktop.screensaver');
        }
        
        log(`Backing up ${allSchemas.length} gsettings schemas`);
        log(`Schema list: ${allSchemas.join(', ')}`);
        
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
                        log(`Schema ${schema} not found during backup, skipping (extension may not be installed)`);
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
                            
                            // Store wallpaper info separately for uploading (only if wallpaper syncing is enabled)
                            if (syncWallpapers && this._isWallpaperKey(schema, key)) {
                                await this._trackWallpaperForUpload(schema, key, settings);
                            }
                        } catch (e) {
                            log(`Failed to backup ${schema}.${key}: ${e.message}`);
                        }
                    }
                    
                    if (keyCount > 0) {
                        successfulBackups++;
                        log(`✓ Backed up schema ${schema} with ${keyCount} keys`);
                    } else {
                        log(`✗ No keys found for schema ${schema}`);
                        delete backup.gsettings[schema]; // Remove empty schema
                    }
                } catch (e) {
                    log(`Failed to access schema ${schema}: ${e.message}`);
                }
            }
        } catch (e) {
            log(`Critical error during backup: ${e.message}`);
            throw e;
        }
        
        log(`Backup complete: ${successfulBackups} schemas successfully backed up`);
        log(`Total backup size: ${Object.keys(backup.gsettings).length} schemas with data`);
        
        if (successfulBackups === 0) {
            log('WARNING: No schemas were successfully backed up!');
        }
        
        return backup;
    }
    
    _isWallpaperKey(schema, key) {
        return (schema === 'org.gnome.desktop.background' && 
                (key === 'picture-uri' || key === 'picture-uri-dark')) ||
               (schema === 'org.gnome.desktop.screensaver' && key === 'picture-uri');
    }
    
    async _trackWallpaperForUpload(schema, key, settings) {
        try {
            const uri = settings.get_string(key);
            if (uri && uri.startsWith('file://')) {
                const filePath = uri.replace('file://', '');
                const file = Gio.File.new_for_path(filePath);
                
                if (!file.query_exists(null)) {
                    log(`Wallpaper file not found: ${filePath}`);
                    return;
                }
                
                // Store file info instead of content (load on-demand)
                const fileName = file.get_basename();
                const wallpaperKey = `${schema}-${key}`;
                
                this._wallpaperData.set(wallpaperKey, {
                    filePath: filePath,
                    fileName: fileName,
                    schema: schema,
                    key: key
                    // Don't store content here - load when needed
                });
                
                log(`Tracked wallpaper for upload: ${fileName} for ${wallpaperKey}`);
            }
        } catch (e) {
            log(`Failed to track wallpaper ${schema}.${key}: ${e.message}`);
        }
    }
    
    async _restoreBackup(backup) {
        if (!backup || !backup.gsettings) {
            throw new Error('Invalid backup data');
        }
        
        log(`Restoring backup from ${backup.timestamp}`);
        
        // Check if wallpaper syncing is enabled
        const syncWallpapers = this._settings.get_boolean('sync-wallpapers');
        log(`Wallpaper syncing enabled during restore: ${syncWallpapers}`);
        
        // Temporarily disable change monitoring during restore
        const wasMonitoring = this._isMonitoring;
        if (wasMonitoring) {
            this._stopChangeMonitoring();
        }
        
        try {
            // Restore gsettings
            for (const [schema, keys] of Object.entries(backup.gsettings)) {
                // Skip wallpaper schemas if wallpaper syncing is disabled
                if (!syncWallpapers && (schema === 'org.gnome.desktop.background' || schema === 'org.gnome.desktop.screensaver')) {
                    log(`Skipping wallpaper schema ${schema} (wallpaper syncing disabled)`);
                    continue;
                }
                
                try {
                    // Check if schema exists before trying to access it
                    const schemaSource = Gio.SettingsSchemaSource.get_default();
                    const schemaObj = schemaSource.lookup(schema, true);
                    
                    if (!schemaObj) {
                        log(`Schema ${schema} not found during restore, skipping (extension may not be installed)`);
                        continue;
                    }
                    
                    const settings = new Gio.Settings({schema: schema});
                    let restoredKeys = 0;
                    
                    for (const [key, value] of Object.entries(keys)) {
                        try {
                            // Special handling for wallpaper URIs (only if wallpaper syncing is enabled)
                            if (syncWallpapers && this._isWallpaperKey(schema, key)) {
                                const updatedValue = this._updateWallpaperUri(value, schema, key);
                                const variant = GLib.Variant.parse(null, updatedValue, null, null);
                                settings.set_value(key, variant);
                                restoredKeys++;
                            } else {
                                const variant = GLib.Variant.parse(null, value, null, null);
                                settings.set_value(key, variant);
                                restoredKeys++;
                            }
                        } catch (e) {
                            log(`Failed to restore ${schema}.${key}: ${e.message}`);
                        }
                    }
                    
                    log(`Restored ${restoredKeys} keys for schema ${schema}`);
                } catch (e) {
                    log(`Failed to access schema ${schema} for restore: ${e.message}`);
                }
            }
            
            log('GSettings restoration complete');
        } finally {
            // Re-enable change monitoring if it was enabled
            if (wasMonitoring) {
                // Add a small delay to avoid immediate triggers from the restore
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                    this._setupChangeMonitoring();
                    return GLib.SOURCE_REMOVE;
                });
            }
        }
    }
    
    _updateWallpaperUri(originalValue, schema, key) {
        // Parse the original value to extract the URI
        const match = originalValue.match(/'([^']*)'/);
        if (!match) {
            return originalValue;
        }
        
        const originalUri = match[1];
        const wallpaperKey = `${schema}-${key}`;
        const wallpaperData = this._wallpaperData.get(wallpaperKey);
        
        if (wallpaperData && wallpaperData.newPath) {
            const newUri = `file://${wallpaperData.newPath}`;
            const updatedValue = originalValue.replace(originalUri, newUri);
            log(`Updated wallpaper URI for ${wallpaperKey}: ${originalUri} -> ${newUri}`);
            return updatedValue;
        }
        
        return originalValue;
    }
    
    async _downloadFromGitHub(token, username, repo) {
        const response = await this._requestQueue.add(() =>
            this._makeGitHubRequest(
                `https://api.github.com/repos/${username}/${repo}/contents/config-backup.json`,
                'GET',
                token
            )
        );
        
        if (!response.ok) {
            if (response.status === 404) {
                log('No backup found on GitHub, skipping restore');
                return null;
            }
            throw new Error(`GitHub download failed: ${response.status}`);
        }
        
        const fileData = JSON.parse(response.data);
        const content = new TextDecoder().decode(GLib.base64_decode(fileData.content));
        const backup = JSON.parse(content);
        
        log('Downloaded main config from GitHub (wallpapers handled separately)');
        return backup;
    }
    
    async _downloadFilesFromGitHub(token, username, repo) {
        const filePaths = this._settings.get_strv('sync-files');
        
        for (const filePath of filePaths) {
            try {
                // Create GitHub path
                const githubPath = `files${filePath.replace('~', '/home')}`;
                
                log(`Downloading file from ${githubPath} to ${filePath}`);
                
                const response = await this._requestQueue.add(() =>
                    this._makeGitHubRequest(
                        `https://api.github.com/repos/${username}/${repo}/contents/${githubPath}`,
                        'GET',
                        token
                    )
                );
                
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
                    
                    log(`Successfully restored file ${filePath}`);
                } else if (response.status === 404) {
                    log(`File ${githubPath} not found in repository, skipping`);
                } else {
                    log(`Failed to download ${githubPath}: ${response.status}`);
                }
                
            } catch (e) {
                log(`Failed to download file ${filePath}: ${e.message}`);
            }
        }
    }
    
    async _downloadAndRestoreWallpapers(token, username, repo) {
        try {
            // Get list of wallpapers from GitHub
            const response = await this._requestQueue.add(() =>
                this._makeGitHubRequest(
                    `https://api.github.com/repos/${username}/${repo}/contents/wallpapers`,
                    'GET',
                    token
                )
            );
            
            if (!response.ok) {
                if (response.status === 404) {
                    log('No wallpapers folder found in repository');
                    return;
                }
                throw new Error(`Failed to list wallpapers: ${response.status}`);
            }
            
            const wallpaperFiles = JSON.parse(response.data);
            if (!Array.isArray(wallpaperFiles) || wallpaperFiles.length === 0) {
                log('No wallpapers found in repository');
                return;
            }
            
            log(`Found ${wallpaperFiles.length} wallpapers in repository`);
            
            // Create wallpaper directory if it doesn't exist
            const wallpaperDir = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'gnoming-profiles', 'wallpapers']);
            const wallpaperDirFile = Gio.File.new_for_path(wallpaperDir);
            if (!wallpaperDirFile.query_exists(null)) {
                try {
                    wallpaperDirFile.make_directory_with_parents(null);
                    log(`Created wallpaper directory: ${wallpaperDir}`);
                } catch (e) {
                    log(`Failed to create wallpaper directory: ${e.message}`);
                    return;
                }
            }
            
            // Download each wallpaper file using request queue
            for (const fileInfo of wallpaperFiles) {
                if (fileInfo.type !== 'file') continue;
                
                try {
                    log(`Downloading wallpaper: ${fileInfo.name}`);
                    
                    const fileResponse = await this._requestQueue.add(() =>
                        this._makeGitHubRequest(
                            fileInfo.download_url || fileInfo.url,
                            'GET',
                            token
                        )
                    );
                    
                    if (fileResponse.ok) {
                        const fileData = JSON.parse(fileResponse.data);
                        const content = GLib.base64_decode(fileData.content);
                        
                        // Save wallpaper file
                        const newPath = GLib.build_filenamev([wallpaperDir, fileInfo.name]);
                        const file = Gio.File.new_for_path(newPath);
                        
                        file.replace_contents(
                            content,
                            null,
                            false,
                            Gio.FileCreateFlags.REPLACE_DESTINATION,
                            null
                        );
                        
                        log(`Restored wallpaper: ${fileInfo.name} to ${newPath}`);
                        
                        // Store the mapping for URI updates
                        this._wallpaperData.set(fileInfo.name, {
                            newPath: newPath,
                            fileName: fileInfo.name
                        });
                        
                    } else {
                        log(`Failed to download wallpaper ${fileInfo.name}: ${fileResponse.status}`);
                    }
                    
                } catch (e) {
                    log(`Failed to download wallpaper ${fileInfo.name}: ${e.message}`);
                }
            }
            
        } catch (error) {
            log(`Failed to download wallpapers: ${error.message}`);
        }
    }
    
    /**
     * NEW: Enhanced GitHub request method with ETag support
     */
    _makeGitHubRequest(url, method, token, data = null, etag = null) {
        return new Promise((resolve, reject) => {
            try {
                const message = Soup.Message.new(method, url);
                
                // Set headers
                message.request_headers.append('Authorization', `token ${token}`);
                message.request_headers.append('Accept', 'application/vnd.github.v3+json');
                
                // Add ETag for conditional requests
                if (etag && method === 'GET') {
                    message.request_headers.append('If-None-Match', etag);
                    log(`GitHub request: Adding If-None-Match header: ${etag}`);
                }
                
                if (data) {
                    const json = JSON.stringify(data);
                    message.set_request_body_from_bytes(
                        'application/json',
                        GLib.Bytes.new(new TextEncoder().encode(json))
                    );
                }
                
                // Reuse HTTP session
                this._httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);
                        const data = new TextDecoder().decode(bytes.get_data());
                        
                        // Extract ETag from response headers
                        let responseETag = null;
                        if (message.response_headers) {
                            responseETag = message.response_headers.get_one('ETag');
                        }
                        
                        resolve({
                            ok: message.status_code >= 200 && message.status_code < 300,
                            status: message.status_code,
                            data: data,
                            etag: responseETag
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
    
    openPreferences() {
        try {
            // Use the built-in Extension class method to open preferences
            super.openPreferences();
        } catch (error) {
            log(`Failed to open preferences: ${error.message}`);
        }
    }
}