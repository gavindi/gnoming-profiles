/*
 * Gnoming Profiles extension for Gnome 46+
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
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

// Import our modular components
import { RequestQueue } from './lib/RequestQueue.js';
import { ETagManager } from './lib/ETagManager.js';
import { GitHubAPI } from './lib/GitHubAPI.js';
import { FileMonitor } from './lib/FileMonitor.js';
import { SettingsMonitor } from './lib/SettingsMonitor.js';
import { WallpaperManager } from './lib/WallpaperManager.js';
import { SyncManager } from './lib/SyncManager.js';
import { PanelIndicator } from './lib/PanelIndicator.js';

/**
 * Main extension class that orchestrates all components
 */
export default class ConfigSyncExtension extends Extension {
    // Timing constants
    static MILLISECONDS_PER_SECOND = 1000;
    static SECONDS_PER_MINUTE = 60;
    static STATUS_UPDATE_INTERVAL_MS = 2000;
    
    // HTTP status codes
    static HTTP_NOT_FOUND = 404;
    static HTTP_NOT_MODIFIED = 304;
    
    constructor(metadata) {
        super(metadata);
        
        // Core components
        this._indicator = null;
        this._settings = null;
        this._sessionManager = null;
        this._sessionSignalId = null;
        
        // Modular components
        this._requestQueue = null;
        this._etagManager = null;
        this._githubAPI = null;
        this._fileMonitor = null;
        this._settingsMonitor = null;
        this._wallpaperManager = null;
        this._syncManager = null;
        
        // State management
        this._debounceTimeout = null;
        this._pendingChanges = false;
        this._pollingTimeout = null;
        this._isPolling = false;
        this._lastKnownCommit = null;
        this._remoteChangesDetected = false;
        
        // Status update timer
        this._statusUpdateTimer = null;
    }
    
    enable() {
        console.log('Gnoming Profiles extension enabling (v3.0.0) with binary-safe wallpaper syncing');
        
        // Initialize settings
        this._settings = this.getSettings();
        
        // Initialize core components
        this._initializeComponents();
        
        // Create and setup panel indicator
        this._indicator = new PanelIndicator();
        this._indicator.setExtension(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        
        // Setup session handlers
        this._setupSessionHandlers();
        
        // Setup monitoring and polling
        this._setupChangeMonitoring();
        this._setupGitHubPolling();
        
        // Setup settings change listeners
        this._setupSettingsListeners();
        
        // Setup status update timer
        this._setupStatusUpdateTimer();
        
        // Initial sync if enabled
        if (this._settings.get_boolean('auto-sync-on-login')) {
            this._performInitialSync();
        }
        
        console.log('Gnoming Profiles extension enabled successfully');
    }
    
    disable() {
        console.log('Gnoming Profiles extension disabling');
        
        // Stop all monitoring and polling
        this._stopChangeMonitoring();
        this._stopGitHubPolling();
        
        // Stop status updates with proper cleanup
        this._stopStatusUpdateTimer();
        
        // Clean up session manager connections
        this._cleanupSessionHandlers();
        
        // Clean up panel indicator
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        
        // Clean up all components
        this._cleanupComponents();
        
        // Clear settings reference
        this._settings = null;
        
        console.log('Gnoming Profiles extension disabled');
    }
    
    /**
     * Initialize all modular components
     */
    _initializeComponents() {
        // Core infrastructure
        this._requestQueue = new RequestQueue(3);
        this._etagManager = new ETagManager();
        this._githubAPI = new GitHubAPI(this._requestQueue, this._etagManager);
        
        // Monitoring components
        this._fileMonitor = new FileMonitor();
        this._settingsMonitor = new SettingsMonitor();
        
        // Management components
        this._wallpaperManager = new WallpaperManager(this._githubAPI);
        this._syncManager = new SyncManager(this._githubAPI, this._wallpaperManager, this._settings);
        
        // Set up change callbacks
        this._fileMonitor.setChangeCallback((source) => this._onChangeDetected(source));
        this._settingsMonitor.setChangeCallback((source) => this._onChangeDetected(source));
        
        console.log('All components initialized successfully');
    }
    
    /**
     * Clean up all components with proper memory management
     */
    _cleanupComponents() {
        if (this._githubAPI) {
            this._githubAPI.cleanup();
            this._githubAPI = null;
        }
        
        if (this._fileMonitor) {
            this._fileMonitor.stopAll();
            this._fileMonitor = null;
        }
        
        if (this._settingsMonitor) {
            this._settingsMonitor.stopAll();
            this._settingsMonitor = null;
        }
        
        if (this._requestQueue) {
            this._requestQueue.clear();
            this._requestQueue = null;
        }
        
        if (this._wallpaperManager) {
            this._wallpaperManager.destroy();
            this._wallpaperManager = null;
        }
        
        if (this._syncManager) {
            this._syncManager.destroy();
            this._syncManager = null;
        }
        
        // Clear remaining references
        this._etagManager = null;
        
        console.log('All components cleaned up successfully');
    }
    
    /**
     * Setup session event handlers
     */
    _setupSessionHandlers() {
        try {
            // Connect to GNOME Session Manager
            this._sessionManager = new Gio.DBusProxy({
                g_connection: Gio.DBus.session,
                g_name: 'org.gnome.SessionManager',
                g_object_path: '/org/gnome/SessionManager',
                g_interface_name: 'org.gnome.SessionManager'
            });
            
            // Listen for session state changes
            this._sessionSignalId = this._sessionManager.connect('g-signal', (proxy, sender, signal, params) => {
                if (signal === 'SessionRunning') {
                    this._onLogin();
                } else if (signal === 'SessionEnding') {
                    this._onLogout();
                }
            });
            
            console.log('Session handlers setup complete');
        } catch (e) {
            console.error(`Failed to setup session handlers: ${e.message}`);
        }
    }
    
    /**
     * Clean up session handlers with improved error handling
     */
    _cleanupSessionHandlers() {
        if (this._sessionSignalId && this._sessionManager) {
            try {
                this._sessionManager.disconnect(this._sessionSignalId);
                console.log('Session manager signal disconnected');
            } catch (e) {
                console.error(`Error disconnecting session manager signal: ${e.message}`);
            } finally {
                this._sessionSignalId = null;
            }
        }
        
        if (this._sessionManager) {
            try {
                // Clear the proxy reference
                this._sessionManager = null;
                console.log('Session manager proxy cleaned up');
            } catch (e) {
                console.error(`Error cleaning up session manager proxy: ${e.message}`);
            } finally {
                this._sessionManager = null;
            }
        }
    }
    
    /**
     * Setup change monitoring for files and GSettings
     */
    _setupChangeMonitoring() {
        const changeMonitoringEnabled = this._settings.get_boolean('auto-sync-on-change');
        
        // Get configured items
        const filePaths = this._settings.get_strv('sync-files');
        const baseSchemas = this._settings.get_strv('gsettings-schemas');
        const allSchemas = [...baseSchemas];
        
        // Add wallpaper schemas if enabled
        const syncWallpapers = this._settings.get_boolean('sync-wallpapers');
        if (syncWallpapers) {
            allSchemas.push(...this._wallpaperManager.getWallpaperSchemas());
        }
        
        // Check schema availability
        const { available: availableSchemas } = this._settingsMonitor.checkSchemaAvailability(allSchemas);
        
        if (!changeMonitoringEnabled) {
            this._indicator.updateMonitoringStatus(false, filePaths.length, availableSchemas.length);
            console.log(`Change monitoring disabled. Configured: ${filePaths.length} files, ${availableSchemas.length}/${allSchemas.length} schemas available`);
            return;
        }
        
        // Update file monitoring
        this._fileMonitor.updateFiles(filePaths);
        
        // Update schema monitoring
        const successfulSchemas = this._settingsMonitor.updateSchemas(allSchemas);
        
        // Update indicator
        this._indicator.updateMonitoringStatus(true, this._fileMonitor.getMonitorCount(), successfulSchemas);
        
        console.log(`Change monitoring enabled: ${this._fileMonitor.getMonitorCount()} files, ${successfulSchemas} schemas monitored`);
    }
    
    /**
     * Stop change monitoring with proper cleanup
     */
    _stopChangeMonitoring() {
        if (this._fileMonitor) {
            this._fileMonitor.stopAll();
        }
        
        if (this._settingsMonitor) {
            this._settingsMonitor.stopAll();
        }
        
        // Clear debounce timeout with proper nullification
        if (this._debounceTimeout) {
            GLib.source_remove(this._debounceTimeout);
            this._debounceTimeout = null;
        }
        
        this._pendingChanges = false;
        
        console.log('Change monitoring stopped');
    }
    
    /**
     * Handle detected changes
     */
    _onChangeDetected(source) {
        // Show visual indicator
        if (this._indicator) {
            this._indicator.showChangeDetected();
        }
        
        // Debounce changes with proper cleanup
        if (this._debounceTimeout) {
            GLib.source_remove(this._debounceTimeout);
            this._debounceTimeout = null;
        }
        
        this._pendingChanges = true;
        const debounceDelay = this._settings.get_int('change-sync-delay') * ConfigSyncExtension.MILLISECONDS_PER_SECOND;
        
        this._debounceTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, debounceDelay, () => {
            if (this._pendingChanges) {
                console.log(`Triggering sync due to change: ${source}`);
                this._syncOnChange();
                this._pendingChanges = false;
            }
            this._debounceTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
        
        console.log(`Change detected from ${source}, sync scheduled in ${debounceDelay}ms`);
    }
    
    /**
     * Perform sync when changes are detected
     */
    _syncOnChange() {
        if (!this._settings.get_boolean('auto-sync-on-change')) {
            return;
        }
        
        this._performSyncOperation('changes', async () => {
            await this._syncManager.syncToGitHub();
            return 'Change synced';
        }, true);
    }
    
    /**
     * Setup GitHub polling with ETag support
     */
    _setupGitHubPolling() {
        // Stop existing polling
        this._stopGitHubPolling();
        
        const pollingEnabled = this._settings.get_boolean('github-polling-enabled');
        if (!pollingEnabled) {
            this._indicator.updatePollingStatus(false, 0);
            return;
        }
        
        // Check credentials
        const token = this._settings.get_string('github-token');
        const repo = this._settings.get_string('github-repo');
        const username = this._settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            console.warn('GitHub polling: Credentials not configured');
            this._indicator.updatePollingStatus(false, 0);
            return;
        }
        
        const intervalMinutes = this._settings.get_int('github-polling-interval');
        this._isPolling = true;
        
        console.log(`GitHub ETag polling: Starting for ${username}/${repo} every ${intervalMinutes} minutes`);
        
        // Start polling
        this._scheduleNextPoll(intervalMinutes * ConfigSyncExtension.SECONDS_PER_MINUTE * ConfigSyncExtension.MILLISECONDS_PER_SECOND);
        this._indicator.updatePollingStatus(true, intervalMinutes);
    }
    
    /**
     * Schedule the next polling operation with proper cleanup
     */
    _scheduleNextPoll(intervalMs) {
        if (!this._isPolling) return;
        
        // Clear any existing timeout first
        if (this._pollingTimeout) {
            GLib.source_remove(this._pollingTimeout);
            this._pollingTimeout = null;
        }
        
        this._pollingTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
            if (!this._isPolling) {
                this._pollingTimeout = null;
                return GLib.SOURCE_REMOVE;
            }
            
            this._pollGitHubForChanges().then(() => {
                if (this._isPolling) {
                    this._scheduleNextPoll(intervalMs);
                }
            }).catch(error => {
                console.error(`GitHub ETag polling error: ${error.message}`);
                if (this._isPolling) {
                    this._scheduleNextPoll(intervalMs);
                }
            });
            
            this._pollingTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
    }
    
    /**
     * Poll GitHub for changes using ETag-based requests
     */
    async _pollGitHubForChanges() {
        const token = this._settings.get_string('github-token');
        const repo = this._settings.get_string('github-repo');
        const username = this._settings.get_string('github-username');
        
        try {
            console.log(`GitHub ETag polling: Checking ${username}/${repo} for changes...`);
            
            const result = await this._githubAPI.pollForChanges(username, repo, token);
            
            if (result.etag304) {
                console.log('GitHub ETag polling: No changes detected (304 Not Modified)');
                if (this._indicator) {
                    this._indicator.showETagEfficiency();
                }
                return;
            }
            
            if (!result.hasChanges || result.commits.length === 0) {
                console.log('GitHub ETag polling: No commits found');
                return;
            }
            
            const latestCommit = result.commits[0];
            const latestCommitSha = latestCommit.sha;
            
            console.log(`GitHub ETag polling: Latest commit ${latestCommitSha.substring(0, 7)}`);
            
            // Check for new commits
            if (!this._lastKnownCommit) {
                this._lastKnownCommit = latestCommitSha;
                return;
            }
            
            if (this._lastKnownCommit !== latestCommitSha) {
                console.log(`GitHub ETag polling: New commit detected! ${latestCommitSha.substring(0, 7)}`);
                this._onRemoteChangesDetected(latestCommit);
                this._lastKnownCommit = latestCommitSha;
            }
            
        } catch (error) {
            console.error(`GitHub ETag polling error: ${error.message}`);
        }
    }
    
    /**
     * Handle detected remote changes
     */
    _onRemoteChangesDetected(commit) {
        this._remoteChangesDetected = true;
        
        if (this._indicator) {
            this._indicator.showRemoteChanges(commit);
        }
        
        const autoSyncRemote = this._settings.get_boolean('auto-sync-remote-changes');
        
        if (autoSyncRemote) {
            console.log('GitHub ETag polling: Starting auto-sync of remote changes');
            
            this._performSyncOperation('remote changes', async () => {
                const result = await this._syncManager.syncFromGitHub();
                if (result && result.requiresRestore) {
                    await this._syncManager.restoreBackup(result.backupData, (enabled) => {
                        this._settingsMonitor.setEnabled(enabled);
                    });
                }
                
                if (this._indicator) {
                    this._indicator.clearRemoteChanges();
                }
                this._remoteChangesDetected = false;
                return 'Remote sync complete';
            }, true);
        } else {
            console.log('GitHub ETag polling: Auto-sync disabled, showing manual pull option');
            if (this._indicator) {
                this._indicator.updateStatus(_('Remote changes available - check menu to pull'));
            }
        }
    }
    
    /**
     * Stop GitHub polling with proper cleanup
     */
    _stopGitHubPolling() {
        if (this._pollingTimeout) {
            GLib.source_remove(this._pollingTimeout);
            this._pollingTimeout = null;
        }
        
        this._isPolling = false;
        this._lastKnownCommit = null;
        this._remoteChangesDetected = false;
        
        if (this._indicator) {
            this._indicator.updatePollingStatus(false, 0);
            this._indicator.clearRemoteChanges();
        }
        
        console.log('GitHub ETag polling stopped');
    }
    
    /**
     * Setup settings change listeners
     */
    _setupSettingsListeners() {
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
    }
    
    /**
     * Setup status update timer with proper management
     */
    _setupStatusUpdateTimer() {
        // Clear any existing timer first
        this._stopStatusUpdateTimer();
        
        this._statusUpdateTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ConfigSyncExtension.STATUS_UPDATE_INTERVAL_MS, () => {
            if (this._indicator && this._requestQueue && this._etagManager) {
                // Update queue status
                this._indicator.updateQueueStatus(
                    this._requestQueue.pendingCount,
                    this._requestQueue.activeCount
                );
                
                // Update ETag status
                const etagStatus = this._etagManager.getStatus('commits');
                this._indicator.updateETagStatus(etagStatus.hasETag, etagStatus.lastResult);
            }
            return GLib.SOURCE_CONTINUE;
        });
    }
    
    /**
     * Stop status update timer with proper cleanup
     */
    _stopStatusUpdateTimer() {
        if (this._statusUpdateTimer) {
            GLib.source_remove(this._statusUpdateTimer);
            this._statusUpdateTimer = null;
        }
    }
    
    /**
     * Perform a sync operation with proper locking and UI feedback
     */
    async _performSyncOperation(operationType, syncFunction, allowQueue = false) {
        if (!this._syncManager || !this._indicator) {
            console.error(`Cannot perform sync operation: components not initialized`);
            return;
        }
        
        // Update UI
        this._indicator.updateSyncItemSensitivity(false);
        this._indicator.startSyncAnimation();
        this._indicator.updateStatus(_('Syncing: ') + operationType);
        
        try {
            await this._syncManager.performSyncOperation(operationType, syncFunction, allowQueue);
            
            // Success
            this._indicator.stopSyncAnimation();
            this._indicator.updateStatus(`${operationType} complete: ` + new Date().toLocaleTimeString());
            console.log(`Sync operation completed successfully: ${operationType}`);
            
        } catch (error) {
            // Handle errors
            this._indicator.stopSyncAnimation();
            this._indicator.updateStatus(_(`${operationType} failed: `) + error.message);
            console.error(`Sync operation failed: ${operationType} - ${error.message}`);
            
        } finally {
            // Always update UI
            this._indicator.updateSyncItemSensitivity(true);
            
            // Update monitoring status after sync completes
            this._setupChangeMonitoring();
        }
    }
    
    /**
     * Handle session login
     */
    _onLogin() {
        console.log('Session login detected');
        if (this._settings.get_boolean('auto-sync-on-login')) {
            this._performSyncOperation('login', async () => {
                const result = await this._syncManager.syncFromGitHub();
                if (result && result.requiresRestore) {
                    await this._syncManager.restoreBackup(result.backupData, (enabled) => {
                        this._settingsMonitor.setEnabled(enabled);
                    });
                }
                return 'Login sync complete';
            });
        }
    }
    
    /**
     * Handle session logout
     */
    _onLogout() {
        console.log('Session logout detected');
        if (this._settings.get_boolean('auto-sync-on-logout')) {
            this._performSyncOperation('logout', async () => {
                await this._syncManager.syncToGitHub();
                return 'Logout sync complete';
            });
        }
    }
    
    /**
     * Handle initial sync trigger from preferences
     */
    _onTriggerInitialSync() {
        if (!this._settings.get_boolean('trigger-initial-sync')) {
            return;
        }
        
        this._settings.set_boolean('trigger-initial-sync', false);
        
        console.log('Manual initial sync triggered from preferences');
        
        // Check credentials
        const token = this._settings.get_string('github-token');
        const repo = this._settings.get_string('github-repo');
        const username = this._settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            if (this._indicator) {
                this._indicator.updateStatus(_('Initial sync failed: GitHub credentials not configured'));
            }
            return;
        }
        
        this._performSyncOperation('manual initial sync', async () => {
            await this._syncManager.syncToGitHub();
            return 'Initial sync complete';
        });
    }
    
    /**
     * Perform initial sync on extension enable
     */
    _performInitialSync() {
        this._performSyncOperation('initial', async () => {
            // First restore, then backup
            const result = await this._syncManager.syncFromGitHub();
            if (result && result.requiresRestore) {
                await this._syncManager.restoreBackup(result.backupData, (enabled) => {
                    this._settingsMonitor.setEnabled(enabled);
                });
            }
            await this._syncManager.syncToGitHub();
            return 'Extension loaded';
        });
    }
    
    /**
     * Public API methods for panel indicator
     */
    
    syncNow() {
        this._performSyncOperation('manual sync', async () => {
            // First backup, then restore
            await this._syncManager.syncToGitHub();
            const result = await this._syncManager.syncFromGitHub();
            if (result && result.requiresRestore) {
                await this._syncManager.restoreBackup(result.backupData, (enabled) => {
                    this._settingsMonitor.setEnabled(enabled);
                });
            }
            return 'Manual sync complete';
        });
    }
    
    syncFromRemote() {
        this._performSyncOperation('remote pull', async () => {
            const result = await this._syncManager.syncFromGitHub();
            if (result && result.requiresRestore) {
                await this._syncManager.restoreBackup(result.backupData, (enabled) => {
                    this._settingsMonitor.setEnabled(enabled);
                });
            }
            
            if (this._indicator) {
                this._indicator.clearRemoteChanges();
            }
            this._remoteChangesDetected = false;
            return 'Remote pull complete';
        });
    }
    
    openPreferences() {
        try {
            super.openPreferences();
        } catch (error) {
            console.error(`Failed to open preferences: ${error.message}`);
        }
    }
}