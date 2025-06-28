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
        
        // Create menu items
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        let syncItem = new PopupMenu.PopupMenuItem(_('Sync Now'));
        syncItem.connect('activate', () => {
            this._extension.syncNow();
        });
        this.menu.addMenuItem(syncItem);
        
        let statusItem = new PopupMenu.PopupMenuItem(_('Last sync: Never'));
        statusItem.reactive = false;
        this.menu.addMenuItem(statusItem);
        this._statusItem = statusItem;
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        let monitoringItem = new PopupMenu.PopupMenuItem(_('Change monitoring: Off'));
        monitoringItem.reactive = false;
        this.menu.addMenuItem(monitoringItem);
        this._monitoringItem = monitoringItem;
        
        let pollingItem = new PopupMenu.PopupMenuItem(_('GitHub polling: Off'));
        pollingItem.reactive = false;
        this.menu.addMenuItem(pollingItem);
        this._pollingItem = pollingItem;
        
        let remoteChangesItem = new PopupMenu.PopupMenuItem(_('Pull Remote Changes'));
        remoteChangesItem.visible = false;
        this.menu.addMenuItem(remoteChangesItem);
        this._remoteChangesItem = remoteChangesItem;
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
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
            this._pollingItem.label.text = _(`GitHub polling: Every ${intervalMinutes} min`);
            this._icon.add_style_class_name('monitoring-active');
        } else {
            this._pollingItem.label.text = _('GitHub polling: Off');
            this._icon.remove_style_class_name('monitoring-active');
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
        this._loginId = null;
        this._logoutId = null;
        
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
        
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        
        // Connect to session manager for login/logout events
        this._setupSessionHandlers();
        
        // Setup change monitoring
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
        
        // Initial sync on enable
        if (this._settings.get_boolean('auto-sync-on-login')) {
            this._indicator.startSyncAnimation();
            this._indicator.updateStatus(_('Initial sync...'));
            
            this._syncFromGitHub().then(() => {
                this._indicator.stopSyncAnimation();
                this._indicator.updateStatus(_('Extension loaded: ') + new Date().toLocaleTimeString());
            }).catch(error => {
                this._indicator.stopSyncAnimation();
                this._indicator.updateStatus(_('Initial sync failed: ') + error.message);
            });
        }
        
        log('Gnoming Profiles extension enabled (v2.7)');
    }
    
    disable() {
        // Stop change monitoring
        this._stopChangeMonitoring();
        
        // Stop GitHub polling (before destroying indicator)
        this._stopGitHubPolling();
        
        if (this._logoutId) {
            this._sessionManager.disconnect(this._logoutId);
            this._logoutId = null;
        }
        
        if (this._loginId) {
            this._sessionManager.disconnect(this._loginId);
            this._loginId = null;
        }
        
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        
        this._settings = null;
        this._sessionManager = null;
        this._wallpaperData.clear();
        
        log('Gnoming Profiles extension disabled');
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
        for (const schema of allSchemas) {
            try {
                const schemaSource = Gio.SettingsSchemaSource.get_default();
                const schemaObj = schemaSource.lookup(schema, false);
                if (schemaObj) {
                    availableSchemaCount++;
                }
            } catch (e) {
                // Schema doesn't exist, skip counting
            }
        }
        
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
        this._indicator.updateMonitoringStatus(true, this._fileMonitors.size, this._settingsMonitors.size);
        
        log(`Change monitoring enabled: ${this._fileMonitors.size} files, ${this._settingsMonitors.size} schemas (wallpapers: ${syncWallpapers})`);
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
            const schemaObj = schemaSource.lookup(schema, false);
            
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
        
        this._indicator.updateStatus(_('Syncing changes...'));
        this._indicator.startSyncAnimation();
        
        // Only backup to GitHub on changes (don't restore from GitHub)
        this._syncToGitHub().then(() => {
            this._indicator.stopSyncAnimation();
            this._indicator.updateStatus(_('Change synced: ') + new Date().toLocaleTimeString());
        }).catch(error => {
            this._indicator.stopSyncAnimation();
            this._indicator.updateStatus(_('Change sync failed: ') + error.message);
            log(`Change sync error: ${error.message}`);
        });
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
                    const schemaObj = schemaSource.lookup(schema, false);
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
        
        log(`GitHub polling: Starting for ${username}/${repo} every ${intervalMinutes} minutes`);
        
        // Get initial commit hash (but don't require it to succeed)
        this._updateLastKnownCommit().then(() => {
            log('GitHub polling: Initial commit hash retrieved');
        }).catch(error => {
            log(`GitHub polling: Failed to get initial commit hash: ${error.message}`);
            // Continue anyway - we'll detect it on first poll
        }).finally(() => {
            // Start polling regardless
            this._scheduleNextPoll(intervalMs);
            if (this._indicator) {
                this._indicator.updatePollingStatus(true, intervalMinutes);
            }
            log(`GitHub polling: Successfully enabled`);
        });
    }
    
    _scheduleNextPoll(intervalMs) {
        if (!this._isPolling) {
            log('GitHub polling: Not scheduling next poll - polling disabled');
            return;
        }
        
        log(`GitHub polling: Scheduling next poll in ${intervalMs / 1000} seconds`);
        
        this._pollingTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
            if (!this._isPolling) {
                log('GitHub polling: Timer fired but polling disabled');
                return GLib.SOURCE_REMOVE;
            }
            
            log('GitHub polling: Timer fired, starting poll');
            this._pollGitHubForChanges().then(() => {
                log('GitHub polling: Poll completed, scheduling next');
                // Schedule next poll
                this._scheduleNextPoll(intervalMs);
            }).catch(error => {
                log(`GitHub polling error: ${error.message}`);
                // Still schedule next poll to retry
                log('GitHub polling: Scheduling retry poll');
                this._scheduleNextPoll(intervalMs);
            });
            
            return GLib.SOURCE_REMOVE;
        });
        
        log(`GitHub polling: Timer scheduled with ID ${this._pollingTimeout}`);
    }
    
    async _pollGitHubForChanges() {
        const token = this._settings.get_string('github-token');
        const repo = this._settings.get_string('github-repo');
        const username = this._settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            log('GitHub polling: Missing credentials');
            return;
        }
        
        try {
            log(`GitHub polling: Checking ${username}/${repo} for changes...`);
            
            // Get latest commit info
            const response = await this._makeGitHubRequest(
                `https://api.github.com/repos/${username}/${repo}/commits?per_page=1`,
                'GET',
                token
            );
            
            if (!response.ok) {
                if (response.status === 404) {
                    log('GitHub polling: Repository not found or empty');
                    return;
                } else if (response.status === 401) {
                    log('GitHub polling: Authentication failed - check your token');
                    return;
                } else if (response.status === 403) {
                    log('GitHub polling: Access forbidden - check repository permissions');
                    return;
                }
                throw new Error(`GitHub API error: ${response.status} - ${response.data}`);
            }
            
            const commits = JSON.parse(response.data);
            if (commits.length === 0) {
                log('GitHub polling: No commits found in repository');
                return;
            }
            
            const latestCommit = commits[0];
            const latestCommitSha = latestCommit.sha;
            const commitMessage = latestCommit.commit.message;
            
            log(`GitHub polling: Latest commit ${latestCommitSha.substring(0, 7)}: ${commitMessage}`);
            log(`GitHub polling: Last known commit was ${this._lastKnownCommit ? this._lastKnownCommit.substring(0, 7) : 'none'}`);
            
            // Check if this is a new commit (or if we don't have a last known commit yet)
            if (!this._lastKnownCommit) {
                log('GitHub polling: No previous commit known, storing current as baseline');
                this._lastKnownCommit = latestCommitSha;
                return;
            }
            
            if (this._lastKnownCommit !== latestCommitSha) {
                log(`GitHub polling: New commit detected! ${latestCommitSha.substring(0, 7)}`);
                
                // For initial testing, let's sync on ANY new commit
                // Later we can add back the file filtering if needed
                log('GitHub polling: Triggering remote changes detection');
                this._onRemoteChangesDetected(latestCommit);
                
                // Update our known commit
                this._lastKnownCommit = latestCommitSha;
            } else {
                log('GitHub polling: No new commits detected');
            }
            
        } catch (error) {
            log(`GitHub polling error: ${error.message}`);
            // Don't throw the error to prevent polling from stopping
        }
    }
    
    async _checkCommitAffectsConfig(commit, token, username, repo) {
        try {
            // Check if commit has a URL field, otherwise construct it
            let commitUrl = commit.url;
            if (!commitUrl) {
                commitUrl = `https://api.github.com/repos/${username}/${repo}/commits/${commit.sha}`;
            }
            
            // Get commit details to see what files were changed
            const response = await this._makeGitHubRequest(
                commitUrl,
                'GET',
                token
            );
            
            if (!response.ok) {
                // If we can't get details, assume it affects config to be safe
                log(`Failed to get commit details (${response.status}), assuming config change`);
                return true;
            }
            
            const commitData = JSON.parse(response.data);
            const changedFiles = commitData.files || [];
            
            // Check if any of our config files were changed
            for (const file of changedFiles) {
                if (!file.filename) continue;
                
                if (file.filename === 'config-backup.json' || 
                    file.filename.startsWith('files/') ||
                    file.filename.startsWith('wallpapers/')) {
                    log(`Config file changed: ${file.filename}`);
                    return true;
                }
            }
            
            log(`No config files changed in commit ${commit.sha.substring(0, 7)}`);
            return false;
            
        } catch (error) {
            log(`Failed to check commit details: ${error.message}`);
            // If we can't check, assume it affects config to be safe
            return true;
        }
    }
    
    _onRemoteChangesDetected(commit) {
        this._remoteChangesDetected = true;
        
        const shortSha = commit.sha.substring(0, 7);
        const commitMsg = commit.commit.message.split('\n')[0]; // First line only
        
        log(`GitHub polling: Remote changes detected in commit ${shortSha}: ${commitMsg}`);
        
        // Safely show remote changes
        if (this._indicator) {
            this._indicator.showRemoteChanges(commit);
        }
        
        // Check auto-sync setting with better error handling
        let autoSyncRemote = true; // Default to true for better UX
        try {
            autoSyncRemote = this._settings.get_boolean('auto-sync-remote-changes');
            log(`GitHub polling: Auto-sync remote changes setting: ${autoSyncRemote}`);
        } catch (e) {
            log('auto-sync-remote-changes setting not found, defaulting to true');
        }
        
        if (autoSyncRemote) {
            log('GitHub polling: Starting auto-sync of remote changes');
            if (this._indicator) {
                this._indicator.updateStatus(_('Remote changes detected, syncing...'));
                this._indicator.startSyncAnimation();
            }
            
            this._syncFromGitHub().then(() => {
                log('GitHub polling: Remote sync completed successfully');
                if (this._indicator) {
                    this._indicator.stopSyncAnimation();
                    this._indicator.updateStatus(_('Remote sync complete: ') + new Date().toLocaleTimeString());
                    this._indicator.clearRemoteChanges();
                }
                this._remoteChangesDetected = false;
            }).catch(error => {
                log(`GitHub polling: Remote sync failed: ${error.message}`);
                if (this._indicator) {
                    this._indicator.stopSyncAnimation();
                    this._indicator.updateStatus(_('Remote sync failed: ') + error.message);
                }
                // Keep the remote changes indicator visible so user can manually sync
            });
        } else {
            log('GitHub polling: Auto-sync disabled, showing manual pull option');
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
            log('GitHub polling: Cannot get initial commit - credentials missing');
            return;
        }
        
        try {
            log(`GitHub polling: Getting initial commit hash for ${username}/${repo}`);
            const response = await this._makeGitHubRequest(
                `https://api.github.com/repos/${username}/${repo}/commits?per_page=1`,
                'GET',
                token
            );
            
            if (response.ok) {
                const commits = JSON.parse(response.data);
                if (commits.length > 0) {
                    this._lastKnownCommit = commits[0].sha;
                    const commitMsg = commits[0].commit.message.split('\n')[0];
                    log(`GitHub polling: Initial commit hash set to ${this._lastKnownCommit.substring(0, 7)}: ${commitMsg}`);
                } else {
                    log('GitHub polling: Repository has no commits');
                    this._lastKnownCommit = null;
                }
            } else {
                log(`GitHub polling: Failed to get initial commit (${response.status}): ${response.data}`);
                throw new Error(`GitHub API error: ${response.status}`);
            }
        } catch (error) {
            log(`GitHub polling: Failed to get initial commit hash: ${error.message}`);
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
        
        if (this._indicator) {
            this._indicator.updatePollingStatus(false, 0);
            this._indicator.clearRemoteChanges();
        }
        
        log('GitHub polling stopped');
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
            
            // Listen for session state changes
            this._sessionManager.connect('g-signal', (proxy, sender, signal, params) => {
                if (signal === 'SessionRunning') {
                    this._onLogin();
                } else if (signal === 'SessionEnding') {
                    this._onLogout();
                }
            });
            
        } catch (e) {
            log(`Failed to setup session handlers: ${e.message}`);
        }
    }
    
    _onLogin() {
        log('Session login detected');
        if (this._settings.get_boolean('auto-sync-on-login')) {
            this._indicator.startSyncAnimation();
            this._indicator.updateStatus(_('Auto-syncing on login...'));
            
            this._syncFromGitHub().then(() => {
                this._indicator.stopSyncAnimation();
                this._indicator.updateStatus(_('Login sync complete: ') + new Date().toLocaleTimeString());
            }).catch(error => {
                this._indicator.stopSyncAnimation();
                this._indicator.updateStatus(_('Login sync failed: ') + error.message);
            });
        }
    }
    
    _onLogout() {
        log('Session logout detected');
        if (this._settings.get_boolean('auto-sync-on-logout')) {
            this._indicator.startSyncAnimation();
            this._indicator.updateStatus(_('Auto-syncing on logout...'));
            
            this._syncToGitHub().then(() => {
                this._indicator.stopSyncAnimation();
                log('Logout sync complete');
            }).catch(error => {
                this._indicator.stopSyncAnimation();
                log(`Logout sync failed: ${error.message}`);
            });
        }
    }
    
    syncNow() {
        this._indicator.updateStatus(_('Syncing...'));
        this._indicator.startSyncAnimation();
        
        // First backup current config, then sync from GitHub
        this._syncToGitHub().then(() => {
            return this._syncFromGitHub();
        }).then(() => {
            this._indicator.stopSyncAnimation();
            this._indicator.updateStatus(_('Last sync: ') + new Date().toLocaleTimeString());
        }).catch(error => {
            this._indicator.stopSyncAnimation();
            this._indicator.updateStatus(_('Sync failed: ') + error.message);
            log(`Sync error: ${error.message}`);
        });
    }
    
    syncFromRemote() {
        if (!this._indicator) {
            log('Cannot sync from remote: indicator not available');
            return;
        }
        
        this._indicator.updateStatus(_('Pulling remote changes...'));
        this._indicator.startSyncAnimation();
        
        // Only sync from GitHub (don't backup first)
        this._syncFromGitHub().then(() => {
            if (this._indicator) {
                this._indicator.stopSyncAnimation();
                this._indicator.updateStatus(_('Remote sync complete: ') + new Date().toLocaleTimeString());
                this._indicator.clearRemoteChanges();
            }
            this._remoteChangesDetected = false;
        }).catch(error => {
            if (this._indicator) {
                this._indicator.stopSyncAnimation();
                this._indicator.updateStatus(_('Remote sync failed: ') + error.message);
            }
            log(`Remote sync error: ${error.message}`);
        });
    }
    
    async _syncToGitHub() {
        const token = this._settings.get_string('github-token');
        const repo = this._settings.get_string('github-repo');
        const username = this._settings.get_string('github-username');
        
        if (!token || !repo || !username) {
            throw new Error('GitHub credentials not configured');
        }
        
        try {
            // Create backup data (without wallpapers in main config)
            const backupData = await this._createBackup();
            
            // Upload gsettings as JSON (no wallpapers included)
            await this._uploadToGitHub(backupData, token, username, repo);
            
            // Upload individual files
            await this._uploadFilesToGitHub(token, username, repo);
            
            // Upload wallpapers separately if enabled
            const syncWallpapers = this._settings.get_boolean('sync-wallpapers');
            if (syncWallpapers) {
                await this._uploadWallpapersToGitHub(token, username, repo);
            }
            
            log('Successfully synced to GitHub');
        } catch (error) {
            log(`Failed to sync to GitHub: ${error.message}`);
            throw error;
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
        log(`Wallpaper syncing enabled: ${syncWallpapers}`);
        
        // Get base schemas from settings
        const schemas = this._settings.get_strv('gsettings-schemas');
        
        // Add wallpaper schemas if wallpaper syncing is enabled
        const allSchemas = [...schemas];
        if (syncWallpapers) {
            allSchemas.push('org.gnome.desktop.background');
            allSchemas.push('org.gnome.desktop.screensaver');
        }
        
        log(`Backing up ${allSchemas.length} gsettings schemas`);
        
        for (const schema of allSchemas) {
            try {
                // Check if schema exists before trying to access it
                const schemaSource = Gio.SettingsSchemaSource.get_default();
                const schemaObj = schemaSource.lookup(schema, false);
                
                if (!schemaObj) {
                    log(`Schema ${schema} not found during backup, skipping (extension may not be installed)`);
                    continue;
                }
                
                const settings = new Gio.Settings({schema: schema});
                const keys = settings.list_keys();
                backup.gsettings[schema] = {};
                
                for (const key of keys) {
                    try {
                        const variant = settings.get_value(key);
                        backup.gsettings[schema][key] = variant.print(true);
                        
                        // Store wallpaper info separately for uploading (only if wallpaper syncing is enabled)
                        if (syncWallpapers && this._isWallpaperKey(schema, key)) {
                            await this._trackWallpaperForUpload(schema, key, settings);
                        }
                    } catch (e) {
                        log(`Failed to backup ${schema}.${key}: ${e.message}`);
                    }
                }
                log(`Backed up schema ${schema} with ${Object.keys(backup.gsettings[schema]).length} keys`);
            } catch (e) {
                log(`Failed to access schema ${schema}: ${e.message}`);
            }
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
                
                // Read the wallpaper file
                const [success, contents] = file.load_contents(null);
                if (!success) {
                    log(`Failed to read wallpaper file: ${filePath}`);
                    return;
                }
                
                // Store wallpaper info for upload
                const fileName = file.get_basename();
                const wallpaperKey = `${schema}-${key}`;
                
                this._wallpaperData.set(wallpaperKey, {
                    originalPath: filePath,
                    fileName: fileName,
                    content: GLib.base64_encode(contents),
                    size: contents.length,
                    schema: schema,
                    key: key
                });
                
                log(`Tracked wallpaper for upload: ${fileName} (${contents.length} bytes) for ${wallpaperKey}`);
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
                    const schemaObj = schemaSource.lookup(schema, false);
                    
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
    
    async _uploadToGitHub(data, token, username, repo) {
        // Upload only gsettings to the main config file (no wallpapers)
        const configData = {
            timestamp: data.timestamp,
            gsettings: data.gsettings
        };
        
        const content = JSON.stringify(configData, null, 2);
        const encodedContent = GLib.base64_encode(new TextEncoder().encode(content));
        
        // Get current file SHA if it exists
        let sha = null;
        try {
            const getResponse = await this._makeGitHubRequest(
                `https://api.github.com/repos/${username}/${repo}/contents/config-backup.json`,
                'GET',
                token
            );
            
            if (getResponse.ok) {
                const fileData = JSON.parse(getResponse.data);
                sha = fileData.sha;
            }
        } catch (e) {
            // File doesn't exist, which is fine
        }
        
        // Upload/update main config file
        const uploadData = {
            message: `Config backup ${new Date().toISOString()}`,
            content: encodedContent,
            ...(sha && { sha })
        };
        
        const response = await this._makeGitHubRequest(
            `https://api.github.com/repos/${username}/${repo}/contents/config-backup.json`,
            'PUT',
            token,
            uploadData
        );
        
        if (!response.ok) {
            throw new Error(`GitHub upload failed: ${response.status} - ${response.data}`);
        }
        
        log('Config backup uploaded to GitHub (wallpapers handled separately)');
    }
    
    async _uploadWallpapersToGitHub(token, username, repo) {
        if (this._wallpaperData.size === 0) {
            log('No wallpapers to upload');
            return;
        }
        
        log(`Uploading ${this._wallpaperData.size} wallpapers to GitHub`);
        
        for (const [wallpaperKey, wallpaperData] of this._wallpaperData) {
            try {
                const githubPath = `wallpapers/${wallpaperData.fileName}`;
                log(`Uploading wallpaper: ${wallpaperData.fileName} to ${githubPath}`);
                
                // Get current file SHA if it exists
                let sha = null;
                try {
                    const getResponse = await this._makeGitHubRequest(
                        `https://api.github.com/repos/${username}/${repo}/contents/${githubPath}`,
                        'GET',
                        token
                    );
                    
                    if (getResponse.ok) {
                        const fileData = JSON.parse(getResponse.data);
                        sha = fileData.sha;
                    }
                } catch (e) {
                    // File doesn't exist, which is fine
                }
                
                // Upload wallpaper file (already base64 encoded)
                const uploadData = {
                    message: `Upload wallpaper ${wallpaperData.fileName} - ${new Date().toISOString()}`,
                    content: wallpaperData.content,
                    ...(sha && { sha })
                };
                
                const response = await this._makeGitHubRequest(
                    `https://api.github.com/repos/${username}/${repo}/contents/${githubPath}`,
                    'PUT',
                    token,
                    uploadData
                );
                
                if (!response.ok) {
                    log(`Failed to upload wallpaper ${wallpaperData.fileName}: ${response.status} - ${response.data}`);
                } else {
                    log(`Successfully uploaded wallpaper: ${wallpaperData.fileName}`);
                }
                
            } catch (e) {
                log(`Failed to upload wallpaper ${wallpaperKey}: ${e.message}`);
            }
        }
        
        // Clear wallpaper data after upload
        this._wallpaperData.clear();
    }
    
    async _downloadAndRestoreWallpapers(token, username, repo) {
        try {
            // Get list of wallpapers from GitHub
            const response = await this._makeGitHubRequest(
                `https://api.github.com/repos/${username}/${repo}/contents/wallpapers`,
                'GET',
                token
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
            
            // Download each wallpaper file
            for (const fileInfo of wallpaperFiles) {
                if (fileInfo.type !== 'file') continue;
                
                try {
                    log(`Downloading wallpaper: ${fileInfo.name}`);
                    
                    const fileResponse = await this._makeGitHubRequest(
                        fileInfo.download_url || fileInfo.url,
                        'GET',
                        token
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
    
    async _uploadFilesToGitHub(token, username, repo) {
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
                
                // Create GitHub path (replace ~ with home and remove leading slash)
                const githubPath = `files${filePath.replace('~', '/home')}`;
                
                log(`Uploading file ${filePath} to ${githubPath}`);
                
                // Upload file to GitHub
                await this._uploadFileToGitHub(githubPath, content, token, username, repo);
                
                log(`Successfully uploaded ${filePath}`);
                
            } catch (e) {
                log(`Failed to upload file ${filePath}: ${e.message}`);
            }
        }
    }
    
    async _uploadFileToGitHub(path, content, token, username, repo) {
        const encodedContent = GLib.base64_encode(new TextEncoder().encode(content));
        
        // Get current file SHA if it exists
        let sha = null;
        try {
            const getResponse = await this._makeGitHubRequest(
                `https://api.github.com/repos/${username}/${repo}/contents/${path}`,
                'GET',
                token
            );
            
            if (getResponse.ok) {
                const fileData = JSON.parse(getResponse.data);
                sha = fileData.sha;
            }
        } catch (e) {
            // File doesn't exist, which is fine
        }
        
        // Upload/update file
        const uploadData = {
            message: `Update ${path} - ${new Date().toISOString()}`,
            content: encodedContent,
            ...(sha && { sha })
        };
        
        const response = await this._makeGitHubRequest(
            `https://api.github.com/repos/${username}/${repo}/contents/${path}`,
            'PUT',
            token,
            uploadData
        );
        
        if (!response.ok) {
            throw new Error(`GitHub file upload failed: ${response.status} - ${response.data}`);
        }
    }
    
    async _downloadFromGitHub(token, username, repo) {
        const response = await this._makeGitHubRequest(
            `https://api.github.com/repos/${username}/${repo}/contents/config-backup.json`,
            'GET',
            token
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
                
                const response = await this._makeGitHubRequest(
                    `https://api.github.com/repos/${username}/${repo}/contents/${githubPath}`,
                    'GET',
                    token
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
    
    _makeGitHubRequest(url, method, token, data = null) {
        return new Promise((resolve, reject) => {
            try {
                const session = new Soup.Session();
                const message = Soup.Message.new(method, url);
                
                // Set headers
                message.request_headers.append('Authorization', `token ${token}`);
                message.request_headers.append('Accept', 'application/vnd.github.v3+json');
                message.request_headers.append('User-Agent', 'GNOME-Config-Sync/2.7');
                
                if (data) {
                    const json = JSON.stringify(data);
                    message.set_request_body_from_bytes(
                        'application/json',
                        GLib.Bytes.new(new TextEncoder().encode(json))
                    );
                }
                
                session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);
                        const data = new TextDecoder().decode(bytes.get_data());
                        
                        resolve({
                            ok: message.status_code >= 200 && message.status_code < 300,
                            status: message.status_code,
                            data: data
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
            const uuid = this.metadata.uuid;
            Gio.Subprocess.new(
                ['gnome-extensions', 'prefs', uuid],
                Gio.SubprocessFlags.NONE
            );
        } catch (error) {
            log(`Failed to open preferences: ${error.message}`);
        }
    }
}