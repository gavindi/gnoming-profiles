/*
 * PanelIndicator.js - Panel indicator UI for Gnoming Profiles
 * Part of Gnoming Profiles extension
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

/**
 * Panel indicator for the Gnoming Profiles extension
 */
export const PanelIndicator = GObject.registerClass(
class PanelIndicator extends PanelMenu.Button {
    // Animation and UI timing constants
    static ANIMATION_INTERVAL_MS = 500;
    static CHANGE_DETECTED_DISPLAY_MS = 1500;
    static ETAG_EFFICIENCY_DISPLAY_MS = 2000;
    
    // HTTP status codes
    static HTTP_NOT_MODIFIED = 304;
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
        
        // Additional timers for temporary visual effects
        this._changeDetectedTimeout = null;
        this._etagEfficiencyTimeout = null;
        
        // Extension reference
        this._extension = null;
        
        this._createMenu();
    }
    
    /**
     * Create the popup menu structure
     */
    _createMenu() {
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
        this.menu.addMenuItem(syncItem);
        this._syncItem = syncItem;
        
        let settingsItem = new PopupMenu.PopupMenuItem(_('Settings'));
        this.menu.addMenuItem(settingsItem);
        this._settingsItem = settingsItem;
    }
    
    /**
     * Set the extension reference for callbacks
     * @param {Object} extension - The main extension instance
     */
    setExtension(extension) {
        this._extension = extension;
        
        // Connect action item callbacks
        this._syncItem.connect('activate', () => {
            if (this._extension) {
                this._extension.syncNow();
            }
        });
        
        this._settingsItem.connect('activate', () => {
            if (this._extension) {
                this._extension.openPreferences();
            }
        });
        
        this._remoteChangesItem.connect('activate', () => {
            if (this._extension) {
                this._extension.syncFromRemote();
            }
        });
    }
    
    /**
     * Start sync animation with proper timer management
     */
    startSyncAnimation() {
        if (this._isAnimating) return;
        
        this._isAnimating = true;
        this._animationStep = 0;
        
        // Add pulsing CSS class
        this._icon.add_style_class_name('syncing');
        
        // Clear any existing animation timer
        if (this._animationTimeout) {
            GLib.source_remove(this._animationTimeout);
            this._animationTimeout = null;
        }
        
        this._animationTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, PanelIndicator.ANIMATION_INTERVAL_MS, () => {
            if (!this._isAnimating) {
                this._animationTimeout = null;
                return GLib.SOURCE_REMOVE;
            }
            
            // Cycle through different sync-related icons
            this._animationStep = (this._animationStep + 1) % this._syncIcons.length;
            this._icon.icon_name = this._syncIcons[this._animationStep];
            
            return GLib.SOURCE_CONTINUE;
        });
        
        console.log('Panel Indicator: Started sync animation');
    }
    
    /**
     * Stop sync animation with proper cleanup
     */
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
        
        console.log('Panel Indicator: Stopped sync animation');
    }
    
    /**
     * Update status message
     * @param {string} message - Status message
     */
    updateStatus(message) {
        if (this._statusItem) {
            this._statusItem.label.text = message;
        }
    }
    
    /**
     * Update sync item sensitivity
     * @param {boolean} sensitive - Whether sync item should be sensitive
     */
    updateSyncItemSensitivity(sensitive) {
        if (this._syncItem) {
            this._syncItem.sensitive = sensitive;
            this._syncItem.label.text = sensitive ? _('Sync Now') : _('Sync in Progress...');
        }
    }
    
    /**
     * Update monitoring status
     * @param {boolean} isMonitoring - Whether monitoring is active
     * @param {number} fileCount - Number of monitored files
     * @param {number} schemaCount - Number of monitored schemas
     */
    updateMonitoringStatus(isMonitoring, fileCount, schemaCount) {
        if (isMonitoring) {
            this._monitoringItem.label.text = _(`Monitoring: ${fileCount} files, ${schemaCount} schemas`);
            this._icon.add_style_class_name('monitoring-active');
        } else {
            this._monitoringItem.label.text = _(`Configured: ${fileCount} files, ${schemaCount} schemas (monitoring off)`);
            this._icon.remove_style_class_name('monitoring-active');
        }
    }
    
    /**
     * Update polling status
     * @param {boolean} isPolling - Whether polling is active
     * @param {number} intervalMinutes - Polling interval in minutes
     */
    updatePollingStatus(isPolling, intervalMinutes) {
        if (isPolling) {
            this._pollingItem.label.text = _(`GitHub polling: Every ${intervalMinutes} min (ETag)`);
            this._icon.add_style_class_name('monitoring-active');
        } else {
            this._pollingItem.label.text = _('GitHub polling: Off');
            this._icon.remove_style_class_name('monitoring-active');
        }
    }
    
    /**
     * Update request queue status
     * @param {number} pending - Number of pending requests
     * @param {number} active - Number of active requests
     */
    updateQueueStatus(pending, active) {
        if (this._queueItem) {
            this._queueItem.label.text = _(`Request queue: ${pending} pending, ${active} active`);
        }
    }
    
    /**
     * Update ETag status
     * @param {boolean} hasETag - Whether ETag is cached
     * @param {boolean|null} wasModified - Last poll result
     */
    updateETagStatus(hasETag, wasModified) {
        if (!this._etagItem) return;
        
        if (hasETag) {
            if (wasModified === null) {
                this._etagItem.label.text = _('ETag polling: Cached');
            } else if (wasModified) {
                this._etagItem.label.text = _('ETag polling: Changes detected');
            } else {
                this._etagItem.label.text = _(`ETag polling: No changes (${PanelIndicator.HTTP_NOT_MODIFIED})`);
            }
        } else {
            this._etagItem.label.text = _('ETag polling: Not cached');
        }
    }
    
    /**
     * Show remote changes available
     * @param {Object} commit - Commit information
     */
    showRemoteChanges(commit) {
        if (!this._remoteChangesItem) return;
        
        this._remoteChangesItem.visible = true;
        const shortSha = commit.sha.substring(0, 7);
        const shortMessage = commit.commit.message.substring(0, 30);
        this._remoteChangesItem.label.text = _(`⬇ Pull Changes (${shortSha}: ${shortMessage}...)`);
        
        // Add visual indicator for remote changes
        this._icon.add_style_class_name('remote-changes');
    }
    
    /**
     * Clear remote changes indicator
     */
    clearRemoteChanges() {
        if (this._remoteChangesItem) {
            this._remoteChangesItem.visible = false;
        }
        this._icon.remove_style_class_name('remote-changes');
    }
    
    
    /**
     * Show change detected indicator with proper timer management
     */
    showChangeDetected() {
        this._icon.add_style_class_name('change-detected');
        
        // Clear any existing timeout first
        if (this._changeDetectedTimeout) {
            GLib.source_remove(this._changeDetectedTimeout);
            this._changeDetectedTimeout = null;
        }
        
        // Remove the class after animation
        this._changeDetectedTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, PanelIndicator.CHANGE_DETECTED_DISPLAY_MS, () => {
            this._icon.remove_style_class_name('change-detected');
            this._changeDetectedTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
    }
    
    /**
     * Show ETag efficiency indicator with proper timer management
     */
    showETagEfficiency() {
        this._icon.add_style_class_name('etag-not-modified');
        
        // Clear any existing timeout first
        if (this._etagEfficiencyTimeout) {
            GLib.source_remove(this._etagEfficiencyTimeout);
            this._etagEfficiencyTimeout = null;
        }
        
        // Remove the class after animation
        this._etagEfficiencyTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, PanelIndicator.ETAG_EFFICIENCY_DISPLAY_MS, () => {
            this._icon.remove_style_class_name('etag-not-modified');
            this._etagEfficiencyTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
    }
    
    
    /**
     * Cleanup and destroy with proper timer management
     */
    destroy() {
        console.log('Panel Indicator: Starting cleanup');
        
        // Stop sync animation
        this.stopSyncAnimation();
        
        // Clear all remaining timers
        if (this._changeDetectedTimeout) {
            GLib.source_remove(this._changeDetectedTimeout);
            this._changeDetectedTimeout = null;
        }
        
        if (this._etagEfficiencyTimeout) {
            GLib.source_remove(this._etagEfficiencyTimeout);
            this._etagEfficiencyTimeout = null;
        }
        
        // Clear extension reference
        this._extension = null;
        
        // Clear menu item references
        this._statusItem = null;
        this._monitoringItem = null;
        this._pollingItem = null;
        this._queueItem = null;
        this._etagItem = null;
        this._remoteChangesItem = null;
        this._syncItem = null;
        this._settingsItem = null;
        
        // Clear icon reference
        this._icon = null;
        
        console.log('Panel Indicator: Cleanup complete');
        
        // Call parent destroy
        super.destroy();
    }
});