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

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ConfigSyncPreferences extends ExtensionPreferences {
    // UI constants
    static BUTTON_RENABLE_DELAY_MS = 3000;
    static TEXT_VIEW_HEIGHT_PX = 120;
    static MAX_SYNC_DELAY_SECONDS = 300;
    static MAX_POLLING_INTERVAL_MINUTES = 1440;
    
    constructor(metadata) {
        super(metadata);
        
        // Track active timeouts for proper cleanup
        this._activeTimeouts = new Set();
    }
    
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        // Store settings reference for cleanup
        this._settings = settings;
        
        // Create General tab
        this._createGeneralTab(window, settings);
        
        // Create Sync tab
        this._createSyncTab(window, settings);
        
        // Create Content tab
        this._createContentTab(window, settings);
        
        // Create Help tab
        this._createHelpTab(window, settings);
        
        // Create About tab
        this._createAboutTab(window, settings);
        
        // Setup cleanup when window is destroyed
        window.connect('destroy', () => {
            this._cleanup();
        });
    }
    
    /**
     * Cleanup active timeouts and references
     */
    _cleanup() {
        console.log('ConfigSyncPreferences: Starting cleanup');

        // Stop any pending OAuth server
        if (this._gdriveOAuthServer) {
            this._gdriveOAuthServer.stop();
            this._gdriveOAuthServer.close();
            this._gdriveOAuthServer = null;
        }

        // Clear all active timeouts
        for (const timeoutId of this._activeTimeouts) {
            GLib.source_remove(timeoutId);
        }
        this._activeTimeouts.clear();

        // Clear settings reference
        this._settings = null;

        console.log('ConfigSyncPreferences: Cleanup complete');
    }
    
    /**
     * Add a timeout to the active set for tracking
     * @param {number} timeoutId - The timeout ID from GLib.timeout_add
     */
    _addActiveTimeout(timeoutId) {
        this._activeTimeouts.add(timeoutId);
    }
    
    /**
     * Remove a timeout from the active set
     * @param {number} timeoutId - The timeout ID to remove
     */
    _removeActiveTimeout(timeoutId) {
        this._activeTimeouts.delete(timeoutId);
    }
    
    _createGeneralTab(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        // Storage provider selection group
        const providerGroup = new Adw.PreferencesGroup({
            title: _('Storage Provider'),
            description: _('Choose where to store your synced profiles')
        });
        page.add(providerGroup);

        const providerRow = new Adw.ComboRow({
            title: _('Storage Backend'),
            subtitle: _('Select which service to use for syncing your profiles'),
            model: new Gtk.StringList()
        });
        providerRow.model.append(_('GitHub'));
        providerRow.model.append(_('Nextcloud (WebDAV)'));

        const currentProvider = settings.get_string('storage-provider');
        providerGroup.add(providerRow);

        // GitHub settings group
        const githubGroup = new Adw.PreferencesGroup({
            title: _('GitHub Repository'),
            description: _('Configure your private GitHub repository for syncing')
        });
        page.add(githubGroup);

        const usernameRow = new Adw.EntryRow({
            title: _('GitHub Username'),
            text: settings.get_string('github-username')
        });
        usernameRow.connect('changed', () => {
            settings.set_string('github-username', usernameRow.text);
        });
        githubGroup.add(usernameRow);

        const tokenRow = new Adw.PasswordEntryRow({
            title: _('Personal Access Token'),
            text: settings.get_string('github-token')
        });
        tokenRow.connect('changed', () => {
            settings.set_string('github-token', tokenRow.text);
        });
        githubGroup.add(tokenRow);

        const repoRow = new Adw.EntryRow({
            title: _('Repository Name'),
            text: settings.get_string('github-repo')
        });
        repoRow.connect('changed', () => {
            settings.set_string('github-repo', repoRow.text);
        });
        githubGroup.add(repoRow);

        // Nextcloud settings group
        const nextcloudGroup = new Adw.PreferencesGroup({
            title: _('Nextcloud Server'),
            description: _('Configure your Nextcloud server for WebDAV syncing')
        });
        page.add(nextcloudGroup);

        const ncUrlRow = new Adw.EntryRow({
            title: _('Server URL'),
            text: settings.get_string('nextcloud-url')
        });
        ncUrlRow.connect('changed', () => {
            settings.set_string('nextcloud-url', ncUrlRow.text);
        });
        nextcloudGroup.add(ncUrlRow);

        const ncUsernameRow = new Adw.EntryRow({
            title: _('Username'),
            text: settings.get_string('nextcloud-username')
        });
        ncUsernameRow.connect('changed', () => {
            settings.set_string('nextcloud-username', ncUsernameRow.text);
        });
        nextcloudGroup.add(ncUsernameRow);

        const ncPasswordRow = new Adw.PasswordEntryRow({
            title: _('App Password'),
            text: settings.get_string('nextcloud-password')
        });
        ncPasswordRow.connect('changed', () => {
            settings.set_string('nextcloud-password', ncPasswordRow.text);
        });
        nextcloudGroup.add(ncPasswordRow);

        const ncFolderRow = new Adw.EntryRow({
            title: _('Sync Folder'),
            text: settings.get_string('nextcloud-folder')
        });
        ncFolderRow.connect('changed', () => {
            settings.set_string('nextcloud-folder', ncFolderRow.text);
        });
        nextcloudGroup.add(ncFolderRow);

        const ncInfoRow = new Adw.ActionRow({
            title: _('Nextcloud Setup'),
            subtitle: _('Generate an App Password in Nextcloud: Settings > Security > Devices & sessions')
        });
        nextcloudGroup.add(ncInfoRow);

        // Google Drive settings group
        const gdriveGroup = new Adw.PreferencesGroup({
            title: _('Google Drive'),
            description: _('Configure Google Drive for syncing via OAuth2')
        });
        page.add(gdriveGroup);

        const gdriveClientIdRow = new Adw.EntryRow({
            title: _('Client ID'),
            text: settings.get_string('gdrive-client-id'),
        });
        gdriveClientIdRow.connect('changed', () => {
            settings.set_string('gdrive-client-id', gdriveClientIdRow.text);
        });
        gdriveGroup.add(gdriveClientIdRow);

        const gdriveClientSecretRow = new Adw.PasswordEntryRow({
            title: _('Client Secret'),
            text: settings.get_string('gdrive-client-secret'),
        });
        gdriveClientSecretRow.connect('changed', () => {
            settings.set_string('gdrive-client-secret', gdriveClientSecretRow.text);
        });
        gdriveGroup.add(gdriveClientSecretRow);

        const gdriveFolderRow = new Adw.EntryRow({
            title: _('Drive Folder Name'),
            text: settings.get_string('gdrive-folder-name'),
        });
        gdriveFolderRow.connect('changed', () => {
            settings.set_string('gdrive-folder-name', gdriveFolderRow.text);
        });
        gdriveGroup.add(gdriveFolderRow);

        const gdriveAuthRow = new Adw.ActionRow({
            title: _('Authorization'),
            subtitle: settings.get_string('gdrive-refresh-token')
                ? _('Authorized')
                : _('Not authorized'),
        });

        const gdriveAuthButton = new Gtk.Button({
            label: settings.get_string('gdrive-refresh-token')
                ? _('Re-authorize')
                : _('Authorize'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });

        gdriveAuthButton.connect('clicked', () => {
            gdriveAuthButton.sensitive = false;
            gdriveAuthButton.label = _('Waiting...');
            this._performGDriveOAuth(settings, gdriveAuthRow, gdriveAuthButton);
        });

        gdriveAuthRow.add_suffix(gdriveAuthButton);
        gdriveGroup.add(gdriveAuthRow);

        const gdriveSetupInfoRow = new Adw.ActionRow({
            title: _('Credentials Setup'),
            subtitle: _('1. Go to Google Cloud Console > APIs & Services > Credentials\n2. Create OAuth2 Client ID (Desktop app type)\n3. Add http://127.0.0.1:39587 as authorized redirect URI\n4. Enter Client ID and Secret above, then click Authorize'),
        });
        gdriveGroup.add(gdriveSetupInfoRow);

        // Add Google Drive to provider ComboRow
        providerRow.model.append(_('Google Drive'));

        // Show/hide provider groups based on selection
        const updateProviderVisibility = () => {
            githubGroup.visible = providerRow.selected === 0;
            nextcloudGroup.visible = providerRow.selected === 1;
            gdriveGroup.visible = providerRow.selected === 2;
        };

        providerRow.connect('notify::selected', () => {
            const values = ['github', 'nextcloud', 'googledrive'];
            settings.set_string('storage-provider', values[providerRow.selected] || 'github');
            updateProviderVisibility();
        });

        const currentProviderIdx = currentProvider === 'nextcloud' ? 1
            : currentProvider === 'googledrive' ? 2
            : 0;
        providerRow.selected = currentProviderIdx;
        updateProviderVisibility();

        // Session sync settings group
        const sessionGroup = new Adw.PreferencesGroup({
            title: _('Session Sync'),
            description: _('Configure automatic syncing during login and logout')
        });
        page.add(sessionGroup);

        const loginSyncRow = new Adw.SwitchRow({
            title: _('Auto-sync on Login'),
            subtitle: _('Automatically restore configuration when logging in')
        });
        settings.bind('auto-sync-on-login', loginSyncRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        sessionGroup.add(loginSyncRow);

        const logoutSyncRow = new Adw.SwitchRow({
            title: _('Auto-sync on Logout'),
            subtitle: _('Automatically backup configuration when logging out')
        });
        settings.bind('auto-sync-on-logout', logoutSyncRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        sessionGroup.add(logoutSyncRow);

        // Security info group
        const securityGroup = new Adw.PreferencesGroup({
            title: _('Security'),
            description: _('Important security information')
        });
        page.add(securityGroup);

        const securityRow = new Adw.ActionRow({
            title: _('Data Security'),
            subtitle: _('GitHub: Use private repositories only. Tokens stored via GSettings.\nNextcloud: Use app passwords. Data stored on your own server.\nGoogle Drive: Uses drive.file scope (only app-created files). Tokens stored via GSettings.\nAll providers: Only configured files and settings are synced.')
        });
        securityGroup.add(securityRow);
    }
    
    _createSyncTab(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('Sync'),
            icon_name: 'preferences-system-network-symbolic',
        });
        window.add(page);
        
        // Change monitoring group
        const changeGroup = new Adw.PreferencesGroup({
            title: _('Local Change Monitoring'),
            description: _('Detect changes made on THIS device and upload them to remote storage')
        });
        page.add(changeGroup);

        // Auto sync on change
        const changeSyncRow = new Adw.SwitchRow({
            title: _('Auto-upload Local Changes'),
            subtitle: _('When files or settings change on this device, automatically upload to remote storage')
        });
        settings.bind('auto-sync-on-change', changeSyncRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        changeGroup.add(changeSyncRow);
        
        // Change sync delay
        const delayRow = new Adw.SpinRow({
            title: _('Change Sync Delay'),
            subtitle: _('Seconds to wait after a change before syncing (prevents excessive syncing)'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: ConfigSyncPreferences.MAX_SYNC_DELAY_SECONDS,
                step_increment: 1,
                page_increment: 10,
                value: settings.get_int('change-sync-delay')
            })
        });
        settings.bind('change-sync-delay', delayRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        changeGroup.add(delayRow);
        
        // Sync direction for changes
        const syncDirectionRow = new Adw.ComboRow({
            title: _('Change Sync Direction'),
            subtitle: _('What to do when changes are detected'),
            model: new Gtk.StringList()
        });
        
        // Add options to the combo
        syncDirectionRow.model.append(_('Backup Only (Upload to Remote)'));
        syncDirectionRow.model.append(_('Backup and Restore (Bidirectional)'));
        
        // Set current selection
        const currentSyncDirection = settings.get_boolean('change-sync-bidirectional') ? 1 : 0;
        syncDirectionRow.selected = currentSyncDirection;
        
        syncDirectionRow.connect('notify::selected', () => {
            const isBidirectional = syncDirectionRow.selected === 1;
            settings.set_boolean('change-sync-bidirectional', isBidirectional);
        });
        
        changeGroup.add(syncDirectionRow);
        
        // Enable/disable delay and direction rows based on change sync setting
        const updateChangeRowSensitivity = () => {
            delayRow.sensitive = changeSyncRow.active;
            syncDirectionRow.sensitive = changeSyncRow.active;
        };
        changeSyncRow.connect('notify::active', updateChangeRowSensitivity);
        updateChangeRowSensitivity();
        
        // ETag-based remote polling group
        const pollingGroup = new Adw.PreferencesGroup({
            title: _('Remote Change Detection'),
            description: _('Periodically check remote storage for changes made by OTHER devices and download them')
        });
        page.add(pollingGroup);

        // Enable remote polling
        const pollingEnabledRow = new Adw.SwitchRow({
            title: _('Enable Remote Polling'),
            subtitle: _('Periodically check for changes uploaded by other devices (uses efficient ETag headers)')
        });
        settings.bind('polling-enabled', pollingEnabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        pollingGroup.add(pollingEnabledRow);

        // Polling interval
        const pollingIntervalRow = new Adw.SpinRow({
            title: _('Polling Interval'),
            subtitle: _('How often to check for remote changes (in minutes). ETags make frequent polling efficient.'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: ConfigSyncPreferences.MAX_POLLING_INTERVAL_MINUTES, // Max 24 hours
                step_increment: 1,
                page_increment: 10,
                value: settings.get_int('polling-interval')
            })
        });
        settings.bind('polling-interval', pollingIntervalRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        pollingGroup.add(pollingIntervalRow);
        
        // Auto-sync remote changes
        const autoSyncRemoteRow = new Adw.SwitchRow({
            title: _('Auto-apply Remote Changes'),
            subtitle: _('Automatically download and apply changes when detected (otherwise just notify)')
        });
        settings.bind('auto-sync-remote-changes', autoSyncRemoteRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        pollingGroup.add(autoSyncRemoteRow);
        
        // ETag efficiency info
        const etagInfoRow = new Adw.ActionRow({
            title: _('📊 ETag Efficiency'),
            subtitle: _('• Uses If-None-Match headers for conditional requests\n• 304 Not Modified responses save up to 95% bandwidth\n• ETags cached in memory during extension session\n• Check panel menu for real-time ETag status')
        });
        pollingGroup.add(etagInfoRow);
        
        // Enable/disable polling rows based on main setting
        const updatePollingRowSensitivity = () => {
            pollingIntervalRow.sensitive = pollingEnabledRow.active;
            autoSyncRemoteRow.sensitive = pollingEnabledRow.active;
        };
        pollingEnabledRow.connect('notify::active', updatePollingRowSensitivity);
        updatePollingRowSensitivity();
        
        // Performance tips (updated for v2.9 with ETag)
        const tipsGroup = new Adw.PreferencesGroup({
            title: _('Performance & Tips'),
        });
        page.add(tipsGroup);
        
        const changeMonitoringTipsRow = new Adw.ActionRow({
            title: _('💡 Change Monitoring Tips'),
            subtitle: _('• Files are monitored in real-time for changes\n• GSettings changes trigger immediate sync\n• Use sync delay to prevent excessive syncing\n• Binary files are automatically skipped')
        });
        tipsGroup.add(changeMonitoringTipsRow);
        
        const etagPollingTipsRow = new Adw.ActionRow({
            title: _('💡 ETag Polling Tips'),
            subtitle: _('• Uses HTTP ETags for ultra-efficient polling\n• 304 responses indicate no changes (saves bandwidth)\n• Can poll frequently without heavy API usage\n• ETags automatically cached and managed\n• Set 1-2 minutes for testing, 5-15 minutes for production')
        });
        tipsGroup.add(etagPollingTipsRow);
        
        const performanceV29Row = new Adw.ActionRow({
            title: _('🚀 Performance (v2.9 with ETags)'),
            subtitle: _('• ETag polling reduces bandwidth by up to 95%\n• GitHub Tree API batches all changes into single commits\n• Request queue manages GitHub API concurrency\n• Smart caching prevents uploading unchanged files\n• Dramatic reduction in API rate limit usage')
        });
        tipsGroup.add(performanceV29Row);
        
        // Initialize sync group
        const initGroup = new Adw.PreferencesGroup({
            title: _('Manual Initialization'),
            description: _('Force an initial backup to GitHub repository')
        });
        page.add(initGroup);
        
        // Initialize sync button with improved timeout management
        const initSyncRow = new Adw.ActionRow({
            title: _('Initialize Sync'),
            subtitle: _('Create an initial backup of all configured schemas and files to GitHub'),
            activatable: true
        });
        
        const initButton = new Gtk.Button({
            label: _('Initialize Sync'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action']
        });
        
        initButton.connect('clicked', () => {
            // Disable button temporarily
            initButton.sensitive = false;
            initButton.label = _('Initializing...');
            
            // Trigger the extension to perform initial sync by setting a flag
            settings.set_boolean('trigger-initial-sync', true);
            
            // Re-enable button after a delay with proper timeout management
            const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ConfigSyncPreferences.BUTTON_RENABLE_DELAY_MS, () => {
                // Check if button still exists and preferences hasn't been destroyed
                if (initButton && !initButton.is_destroyed && initButton.sensitive !== undefined) {
                    initButton.sensitive = true;
                    initButton.label = _('Initialize Sync');
                }
                
                // Remove from active timeouts
                this._removeActiveTimeout(timeoutId);
                
                return GLib.SOURCE_REMOVE;
            });
            
            // Track the timeout for cleanup
            this._addActiveTimeout(timeoutId);
        });
        
        initSyncRow.add_suffix(initButton);
        initGroup.add(initSyncRow);
        
        const initWarningRow = new Adw.ActionRow({
            title: _('Important'),
            subtitle: _('Make sure your storage provider credentials are configured before initializing. Check the panel menu and logs for status updates.')
        });
        initGroup.add(initWarningRow);
    }
    
    _createContentTab(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('Content'),
            icon_name: 'folder-documents-symbolic',
        });
        window.add(page);
        
        // Wallpaper sync group
        const wallpaperGroup = new Adw.PreferencesGroup({
            title: _('Wallpaper Syncing'),
            description: _('Sync desktop and lock screen wallpaper images')
        });
        page.add(wallpaperGroup);
        
        // Enable wallpaper syncing
        const wallpaperSyncRow = new Adw.SwitchRow({
            title: _('Sync Wallpapers'),
            subtitle: _('Include wallpaper image files in sync (batched with other files in v2.9+)')
        });
        settings.bind('sync-wallpapers', wallpaperSyncRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        wallpaperGroup.add(wallpaperSyncRow);
        
        // Wallpaper info row
        const wallpaperInfoRow = new Adw.ActionRow({
            title: _('📁 Wallpaper Storage'),
            subtitle: _('Wallpapers stored in ~/.local/share/gnoming-profiles/wallpapers/\nUploaded to wallpapers/ folder in remote storage')
        });
        wallpaperGroup.add(wallpaperInfoRow);
        
        const wallpaperSchemasRow = new Adw.ActionRow({
            title: _('🔧 Auto-added Schemas'),
            subtitle: _('org.gnome.desktop.background (desktop wallpaper)\norg.gnome.desktop.screensaver (lock screen)\nNote: Added automatically when wallpaper syncing is enabled')
        });
        wallpaperGroup.add(wallpaperSchemasRow);
        
        const wallpaperPerformanceRow = new Adw.ActionRow({
            title: _('⚡ Performance (v2.9)'),
            subtitle: _('• Wallpapers loaded on-demand to reduce memory usage\n• Included in batch commits with other file changes\n• Smart caching prevents re-uploading unchanged wallpapers')
        });
        wallpaperGroup.add(wallpaperPerformanceRow);
        
        // GSettings schemas group
        const schemasGroup = new Adw.PreferencesGroup({
            title: _('GSettings Schemas'),
            description: _('Configure which GSettings schemas to monitor and sync (one per line)')
        });
        page.add(schemasGroup);
        
        // Create schemas text area
        const schemasBuffer = new Gtk.TextBuffer();
        schemasBuffer.text = settings.get_strv('gsettings-schemas').join('\n');
        
        const schemasView = new Gtk.TextView({
            buffer: schemasBuffer,
            wrap_mode: Gtk.WrapMode.WORD,
            accepts_tab: false,
            height_request: ConfigSyncPreferences.TEXT_VIEW_HEIGHT_PX,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
            css_classes: ['card']
        });
        
        const schemasScrolled = new Gtk.ScrolledWindow({
            child: schemasView,
            height_request: ConfigSyncPreferences.TEXT_VIEW_HEIGHT_PX,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12
        });
        
        const schemasRow = new Adw.PreferencesRow({
            child: schemasScrolled
        });
        schemasGroup.add(schemasRow);
        
        // Connect buffer changed signal - use weak reference pattern
        const schemasChangedHandler = () => {
            if (settings && !settings.is_destroyed) {
                const text = schemasBuffer.text;
                const schemas = text.split('\n').filter(s => s.trim().length > 0);
                settings.set_strv('gsettings-schemas', schemas);
            }
        };
        schemasBuffer.connect('changed', schemasChangedHandler);
        
        // Core schemas info
        const coreSchemasRow = new Adw.ActionRow({
            title: _('🏠 Core Desktop Schemas'),
            subtitle: _('org.gnome.desktop.interface (themes, fonts)\norg.gnome.desktop.wm.preferences (window manager)\norg.gnome.shell (shell settings)')
        });
        schemasGroup.add(coreSchemasRow);
        
        // Multitasking schemas info
        const multitaskingSchemasRow = new Adw.ActionRow({
            title: _('🪟 Multitasking & Workspaces'),
            subtitle: _('org.gnome.mutter (workspace behavior)\norg.gnome.desktop.wm.keybindings (workspace shortcuts)\norg.gnome.shell.window-switcher (Alt+Tab)\norg.gnome.shell.app-switcher (Super+Tab)')
        });
        schemasGroup.add(multitaskingSchemasRow);
        
        // Ubuntu schemas info
        const ubuntuSchemasRow = new Adw.ActionRow({
            title: _('🟠 Ubuntu Desktop Extensions'),
            subtitle: _('org.gnome.shell.extensions.ubuntu-dock (Ubuntu dock)\norg.gnome.shell.extensions.ubuntu-appindicators (system tray)\norg.gnome.shell.extensions.desktop-icons-ng (desktop icons)\ncom.ubuntu.update-notifier (update settings)')
        });
        schemasGroup.add(ubuntuSchemasRow);
        
        // Files to sync group
        const filesGroup = new Adw.PreferencesGroup({
            title: _('Files to Monitor and Sync'),
            description: _('Configure which files to monitor for changes and sync (one per line, use ~ for home directory)')
        });
        page.add(filesGroup);
        
        // Create files text area
        const filesBuffer = new Gtk.TextBuffer();
        filesBuffer.text = settings.get_strv('sync-files').join('\n');
        
        const filesView = new Gtk.TextView({
            buffer: filesBuffer,
            wrap_mode: Gtk.WrapMode.WORD,
            accepts_tab: false,
            height_request: ConfigSyncPreferences.TEXT_VIEW_HEIGHT_PX,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
            css_classes: ['card']
        });
        
        const filesScrolled = new Gtk.ScrolledWindow({
            child: filesView,
            height_request: ConfigSyncPreferences.TEXT_VIEW_HEIGHT_PX,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12
        });
        
        const filesRow = new Adw.PreferencesRow({
            child: filesScrolled
        });
        filesGroup.add(filesRow);
        
        // Connect buffer changed signal - use weak reference pattern
        const filesChangedHandler = () => {
            if (settings && !settings.is_destroyed) {
                const text = filesBuffer.text;
                const files = text.split('\n').filter(f => f.trim().length > 0);
                settings.set_strv('sync-files', files);
            }
        };
        filesBuffer.connect('changed', filesChangedHandler);
        
        // Example files
        const exampleFilesRow = new Adw.ActionRow({
            title: _('📋 Example Files'),
            subtitle: _('~/.bashrc\n~/.gitconfig\n~/.config/gtk-3.0/settings.ini\n~/.config/Code/User/settings.json')
        });
        filesGroup.add(exampleFilesRow);
    }
    
    _createHelpTab(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('Help'),
            icon_name: 'help-faq-symbolic',
        });
        window.add(page);
        
        // Debug and logging group
        const debugGroup = new Adw.PreferencesGroup({
            title: _('Debug & Logging'),
            description: _('Troubleshooting and diagnostic information')
        });
        page.add(debugGroup);
        
        const logsRow = new Adw.ActionRow({
            title: _('🔍 View Extension Logs'),
            subtitle: _('Use this command to view real-time logs:\njournalctl -f -o cat /usr/bin/gnome-shell | grep "Gnoming Profiles"')
        });
        debugGroup.add(logsRow);
        
        const troubleshootingRow = new Adw.ActionRow({
            title: _('🚨 Troubleshooting Steps'),
            subtitle: _('1. Check GitHub credentials in General tab\n2. Verify repository exists and is private\n3. Check panel menu for schema/file counts\n4. Check ETag polling status in panel menu\n5. Check request queue status (v2.9+)\n6. Check logs for error messages\n7. Try disabling/re-enabling extension')
        });
        debugGroup.add(troubleshootingRow);
        
        // ETag troubleshooting group
        const etagTroubleshootingGroup = new Adw.PreferencesGroup({
            title: _('ETag Polling Troubleshooting'),
            description: _('Diagnosing ETag-based polling issues')
        });
        page.add(etagTroubleshootingGroup);
        
        const etagStatusRow = new Adw.ActionRow({
            title: _('🏷️ ETag Status Meanings'),
            subtitle: _('• "Not cached" - First poll or ETag unavailable\n• "Cached" - ETag stored, ready for efficient polling\n• "No changes (304)" - GitHub returned Not Modified\n• "Changes detected" - Content changed, new ETag cached')
        });
        etagTroubleshootingGroup.add(etagStatusRow);
        
        const etagIssuesRow = new Adw.ActionRow({
            title: _('🔧 Common ETag Issues'),
            subtitle: _('• High polling frequency may still hit rate limits\n• Network issues can prevent ETag caching\n• Repository changes clear ETags automatically\n• 304 responses are normal and efficient')
        });
        etagTroubleshootingGroup.add(etagIssuesRow);
        
        // Performance group (updated for v2.9 with ETags)
        const performanceGroup = new Adw.PreferencesGroup({
            title: _('Performance'),
            description: _('Settings that affect extension performance and efficiency')
        });
        page.add(performanceGroup);
        
        const performanceRow = new Adw.ActionRow({
            title: _('⚡ Performance Tips'),
            subtitle: _('• Increase Change Sync Delay for rapidly-changing files\n• Use "Backup Only" sync direction for better performance\n• Disable wallpaper syncing if not needed\n• Enable ETag polling for efficient remote monitoring\n• Review monitored files list regularly')
        });
        performanceGroup.add(performanceRow);
        
        const v29PerformanceRow = new Adw.ActionRow({
            title: _('🚀 v2.9 Performance Features'),
            subtitle: _('• ETag polling reduces bandwidth by up to 95%\n• GitHub Tree API reduces API calls by 90%\n• Request queue prevents rate limiting\n• Smart caching skips unchanged files\n• HTTP session reuse improves speed\n• On-demand wallpaper loading saves memory')
        });
        performanceGroup.add(v29PerformanceRow);
        
        const etagBenefitsRow = new Adw.ActionRow({
            title: _('🏷️ ETag Benefits'),
            subtitle: _('• Conditional requests minimize data transfer\n• 304 responses are lightning fast\n• Often don\'t count against API rate limits\n• Enables frequent polling without performance impact\n• Automatic cache management')
        });
        performanceGroup.add(etagBenefitsRow);
        
        // Repository info group
        const repoGroup = new Adw.PreferencesGroup({
            title: _('Repository Information'),
            description: _('Understanding your GitHub repository structure')
        });
        page.add(repoGroup);
        
        const repoStructureRow = new Adw.ActionRow({
            title: _('📂 Repository Structure'),
            subtitle: _('config-backup.json - Main GSettings backup\nfiles/ - Your configuration files\nwallpapers/ - Wallpaper images (if enabled)')
        });
        repoGroup.add(repoStructureRow);
        
        const repoAccessRow = new Adw.ActionRow({
            title: _('🔑 Token Permissions'),
            subtitle: _('Your Personal Access Token needs:\n• repo (Full control of private repositories)\n• No other permissions required')
        });
        repoGroup.add(repoAccessRow);
        
        const gitHistoryRow = new Adw.ActionRow({
            title: _('📊 Git History (v2.9)'),
            subtitle: _('• Single commits contain all changes\n• Cleaner repository history\n• Meaningful batch commit messages\n• Atomic operations (all succeed or fail)\n• ETag cache cleared after uploads')
        });
        repoGroup.add(gitHistoryRow);
        
        // Reset and maintenance group
        const maintenanceGroup = new Adw.PreferencesGroup({
            title: _('Maintenance'),
            description: _('Extension maintenance and reset options')
        });
        page.add(maintenanceGroup);
        
        const maintenanceRow = new Adw.ActionRow({
            title: _('🧹 Maintenance Tips'),
            subtitle: _('• Regularly review your repository contents\n• Clean up old wallpapers if not needed\n• Monitor repository size (GitHub has limits)\n• Keep your access token secure and rotate periodically\n• ETag cache resets automatically when needed')
        });
        maintenanceGroup.add(maintenanceRow);
    }
    
    _createAboutTab(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('About'),
            icon_name: 'help-about-symbolic',
        });
        window.add(page);
        
        // Extension info group
        const infoGroup = new Adw.PreferencesGroup({
            title: _('Gnoming Profiles'),
            description: _('Automatic GNOME configuration sync via GitHub, Nextcloud, or Google Drive with ETag-based polling')
        });
        page.add(infoGroup);
        
        const versionRow = new Adw.ActionRow({
            title: _('Version'),
            subtitle: _('3.3.2')
        });
        infoGroup.add(versionRow);
        
        const authorRow = new Adw.ActionRow({
            title: _('Author'),
            subtitle: _('Gavin Graham (gavindi)')
        });
        infoGroup.add(authorRow);
        
        const licenseRow = new Adw.ActionRow({
            title: _('License'),
            subtitle: _('GNU General Public License v2.0')
        });
        infoGroup.add(licenseRow);
        
        const descriptionRow = new Adw.ActionRow({
            title: _('Description'),
            subtitle: _('Automatically syncs your GNOME settings and configuration files to GitHub, Nextcloud, or Google Drive with real-time monitoring, high-performance batching, intelligent request management, and ultra-efficient ETag-based polling.')
        });
        infoGroup.add(descriptionRow);
        
        const dedicationRow = new Adw.ActionRow({
            title: _('💜 Dedicated to Jupiter 🐱💜'),
            subtitle: _('This extension is lovingly dedicated to Jupiter, my amazing cat companion who kept me company during countless hours of coding and debugging.')
        });
        infoGroup.add(dedicationRow);
        
        // Features group
        const featuresGroup = new Adw.PreferencesGroup({
            title: _('Key Features'),
        });
        page.add(featuresGroup);
        
        const featuresRow = new Adw.ActionRow({
            title: _('✨ What This Extension Does'),
            subtitle: _('• Real-time file and settings monitoring\n• ETag-based polling for ultra-efficient remote sync\n• High-performance GitHub Tree API batching\n• Intelligent request queue management\n• Smart content caching and change detection\n• Multi-device configuration sharing\n• Binary-safe wallpaper syncing (v3.0)\n• Session-based auto-sync\n• Remote change detection\n• Private repository security\n• Enhanced memory management & code cleanup (v3.0.2)')
        });
        featuresGroup.add(featuresRow);
        
        // Links group
        const linksGroup = new Adw.PreferencesGroup({
            title: _('Links & Support'),
        });
        page.add(linksGroup);
        
        const githubRow = new Adw.ActionRow({
            title: _('🐙 GitHub Repository'),
            subtitle: _('https://github.com/gavindi/gnoming-profiles'),
            activatable: true
        });
        githubRow.connect('activated', () => {
            Gio.AppInfo.launch_default_for_uri('https://github.com/gavindi/gnoming-profiles', null);
        });
        linksGroup.add(githubRow);
        
        const issuesRow = new Adw.ActionRow({
            title: _('🐛 Report Issues'),
            subtitle: _('https://github.com/gavindi/gnoming-profiles/issues'),
            activatable: true
        });
        issuesRow.connect('activated', () => {
            Gio.AppInfo.launch_default_for_uri('https://github.com/gavindi/gnoming-profiles/issues', null);
        });
        linksGroup.add(issuesRow);
        
        // Changelog group
        const changelogGroup = new Adw.PreferencesGroup({
            title: _('Recent Changes'),
        });
        page.add(changelogGroup);
        
        const v332Row = new Adw.ActionRow({
            title: _('v3.3.2'),
            subtitle: _('Google Drive storage backend with OAuth2 authorization')
        });
        changelogGroup.add(v332Row);

        const v331Row = new Adw.ActionRow({
            title: _('v3.3.1'),
            subtitle: _('Fixed Nextcloud polling and remote sync loop')
        });
        changelogGroup.add(v331Row);

        const v330Row = new Adw.ActionRow({
            title: _('v3.3.0'),
            subtitle: _('Nextcloud/WebDAV backend, StorageProvider abstraction, live provider switching')
        });
        changelogGroup.add(v330Row);

        const v304Row = new Adw.ActionRow({
            title: _('v3.0.4'),
            subtitle: _('Auto-detect repository default branch')
        });
        changelogGroup.add(v304Row);

        const v303Row = new Adw.ActionRow({
            title: _('v3.0.3'),
            subtitle: _('Added GNOME Shell 49 support')
        });
        changelogGroup.add(v303Row);
        
        // Help group
        const helpGroup = new Adw.PreferencesGroup({
            title: _('Getting Started'),
        });
        page.add(helpGroup);
        
        const setupRow = new Adw.ActionRow({
            title: _('🚀 Quick Setup'),
            subtitle: _('1. Create a private GitHub repository\n2. Generate a Personal Access Token (repo permissions)\n3. Configure credentials in General tab\n4. Add schemas and files in Content tab\n5. Enable monitoring and ETag polling in Sync tab')
        });
        helpGroup.add(setupRow);
        
        const firstSyncRow = new Adw.ActionRow({
            title: _('💾 First Sync'),
            subtitle: _('After setup, click the user icon in your top panel and select "Sync Now" to perform your first backup and test the connection.')
        });
        helpGroup.add(firstSyncRow);
        
        const performanceNoticeRow = new Adw.ActionRow({
            title: _('⚡ Performance Notice (v3.0)'),
            subtitle: _('This version includes comprehensive timer and memory management improvements, ensuring proper resource cleanup when the extension is disabled or GNOME Shell is restarted.')
        });
        helpGroup.add(performanceNoticeRow);
    }

    // ── Google Drive OAuth2 loopback flow ────────────────────────────

    static GDRIVE_OAUTH_PORT = 39587;
    static GDRIVE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    static GDRIVE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
    static GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
    static GDRIVE_OAUTH_TIMEOUT_MS = 120000;

    static _generatePKCE() {
        // Generate 32 random bytes for the code verifier
        const randomBytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            randomBytes[i] = GLib.random_int_range(0, 256);
        }
        // Base64url-encode (no padding) to get the verifier
        const verifier = GLib.base64_encode(randomBytes)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        // SHA-256 hash the verifier, then base64url-encode for the challenge
        const checksum = GLib.Checksum.new(GLib.ChecksumType.SHA256);
        checksum.update(new TextEncoder().encode(verifier));
        const digest = checksum.get_string();
        // Convert hex digest to bytes, then base64url-encode
        const hashBytes = new Uint8Array(digest.length / 2);
        for (let i = 0; i < digest.length; i += 2) {
            hashBytes[i / 2] = parseInt(digest.substring(i, i + 2), 16);
        }
        const challenge = GLib.base64_encode(hashBytes)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        return {verifier, challenge};
    }

    _performGDriveOAuth(settings, statusRow, authButton) {
        const clientId = settings.get_string('gdrive-client-id');
        const clientSecret = settings.get_string('gdrive-client-secret');

        if (!clientId || !clientSecret) {
            statusRow.subtitle = _('Please enter Client ID and Client Secret first');
            authButton.sensitive = true;
            authButton.label = _('Authorize');
            return;
        }

        const port = ConfigSyncPreferences.GDRIVE_OAUTH_PORT;
        const redirectUri = `http://127.0.0.1:${port}`;

        // Generate PKCE code verifier and challenge
        const pkce = ConfigSyncPreferences._generatePKCE();
        this._gdriveCodeVerifier = pkce.verifier;

        try {
            // Use Gio.SocketService for the loopback server (reliable across libsoup versions)
            const socketService = new Gio.SocketService();
            socketService.add_inet_port(port, null);
            this._gdriveOAuthServer = socketService;

            const codeVerifier = this._gdriveCodeVerifier;
            socketService.connect('incoming', (_service, connection) => {
                this._handleOAuthConnection(
                    connection, clientId, clientSecret, codeVerifier, redirectUri, settings, statusRow, authButton, socketService
                );
                return true;
            });

            socketService.start();
            statusRow.subtitle = _('Waiting for authorization in browser...');

            // Build auth URL and open browser
            const authUrl = `${ConfigSyncPreferences.GDRIVE_AUTH_URL}?` +
                `client_id=${encodeURIComponent(clientId)}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `response_type=code&` +
                `scope=${encodeURIComponent(ConfigSyncPreferences.GDRIVE_SCOPE)}&` +
                `access_type=offline&prompt=consent&` +
                `code_challenge=${encodeURIComponent(pkce.challenge)}&` +
                `code_challenge_method=S256`;

            Gio.AppInfo.launch_default_for_uri(authUrl, null);

            // Timeout: auto-stop server after 120 seconds
            const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ConfigSyncPreferences.GDRIVE_OAUTH_TIMEOUT_MS, () => {
                if (this._gdriveOAuthServer === socketService) {
                    socketService.stop();
                    socketService.close();
                    this._gdriveOAuthServer = null;
                    statusRow.subtitle = _('Authorization timed out. Please try again.');
                    authButton.sensitive = true;
                    authButton.label = _('Authorize');
                }
                this._removeActiveTimeout(timeoutId);
                return GLib.SOURCE_REMOVE;
            });
            this._addActiveTimeout(timeoutId);
        } catch (e) {
            console.error(`ConfigSyncPreferences: OAuth server error: ${e.message}`);
            statusRow.subtitle = _(`Failed to start authorization server: ${e.message}`);
            authButton.sensitive = true;
            authButton.label = _('Authorize');
            this._gdriveOAuthServer = null;
        }
    }

    _handleOAuthConnection(connection, clientId, clientSecret, codeVerifier, redirectUri, settings, statusRow, authButton, socketService) {
        const inputStream = connection.get_input_stream();
        const outputStream = connection.get_output_stream();

        // Read the HTTP request
        inputStream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, null, (_stream, result) => {
            try {
                const bytes = inputStream.read_bytes_finish(result);
                const requestText = new TextDecoder().decode(bytes.get_data());

                // Parse the GET request to extract query parameters
                const firstLine = requestText.split('\r\n')[0] || '';
                const urlMatch = firstLine.match(/GET\s+(\S+)/);
                if (!urlMatch) return;

                const requestUrl = urlMatch[1];
                const queryString = requestUrl.split('?')[1] || '';
                const params = {};
                for (const pair of queryString.split('&')) {
                    const [key, value] = pair.split('=');
                    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
                }

                let responseHtml;
                if (params.code) {
                    responseHtml = '<html><body style="font-family:sans-serif;text-align:center;padding:40px">' +
                        '<h1>Authorization Successful</h1>' +
                        '<p>You can close this tab and return to the extension preferences.</p></body></html>';

                    this._exchangeGDriveCodeForTokens(
                        clientId, clientSecret, codeVerifier, params.code, redirectUri, settings, statusRow, authButton
                    );
                } else if (params.error) {
                    responseHtml = `<html><body style="font-family:sans-serif;text-align:center;padding:40px">` +
                        `<h1>Authorization Failed</h1><p>${params.error}</p></body></html>`;
                    statusRow.subtitle = _(`Authorization failed: ${params.error}`);
                    authButton.sensitive = true;
                    authButton.label = _('Authorize');
                } else {
                    responseHtml = '<html><body><p>Unexpected request</p></body></html>';
                }

                // Send HTTP response
                const responseBody = new TextEncoder().encode(responseHtml);
                const httpResponse = `HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Length: ${responseBody.length}\r\nConnection: close\r\n\r\n`;
                const fullResponse = new Uint8Array(httpResponse.length + responseBody.length);
                fullResponse.set(new TextEncoder().encode(httpResponse), 0);
                fullResponse.set(responseBody, httpResponse.length);

                outputStream.write_bytes_async(
                    GLib.Bytes.new(fullResponse), GLib.PRIORITY_DEFAULT, null, (_out, writeResult) => {
                        try {
                            outputStream.write_bytes_finish(writeResult);
                        } catch (e) {
                            console.error(`ConfigSyncPreferences: Error writing OAuth response: ${e.message}`);
                        }
                        // Close connection and stop server
                        connection.close(null);
                        const stopId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                            if (this._gdriveOAuthServer === socketService) {
                                socketService.stop();
                                socketService.close();
                                this._gdriveOAuthServer = null;
                            }
                            this._removeActiveTimeout(stopId);
                            return GLib.SOURCE_REMOVE;
                        });
                        this._addActiveTimeout(stopId);
                    }
                );
            } catch (e) {
                console.error(`ConfigSyncPreferences: Error handling OAuth callback: ${e.message}`);
            }
        });
    }

    _exchangeGDriveCodeForTokens(clientId, clientSecret, codeVerifier, code, redirectUri, settings, statusRow, authButton) {
        const session = new Soup.Session();
        const body = `client_id=${encodeURIComponent(clientId)}` +
            `&client_secret=${encodeURIComponent(clientSecret)}` +
            `&code=${encodeURIComponent(code)}` +
            `&grant_type=authorization_code` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&code_verifier=${encodeURIComponent(codeVerifier)}`;

        const message = Soup.Message.new('POST', ConfigSyncPreferences.GDRIVE_TOKEN_URL);
        message.set_request_body_from_bytes(
            'application/x-www-form-urlencoded',
            GLib.Bytes.new(new TextEncoder().encode(body))
        );

        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (sess, result) => {
            try {
                const bytes = sess.send_and_read_finish(result);
                const data = JSON.parse(new TextDecoder().decode(bytes.get_data()));

                if (data.refresh_token) {
                    settings.set_string('gdrive-refresh-token', data.refresh_token);
                    statusRow.subtitle = _('Authorized successfully!');
                    authButton.label = _('Re-authorize');
                    console.log('ConfigSyncPreferences: Google Drive OAuth2 authorization successful');
                } else {
                    statusRow.subtitle = _('Error: No refresh token received. Try revoking app access at myaccount.google.com and re-authorizing.');
                    authButton.label = _('Authorize');
                    console.error('ConfigSyncPreferences: No refresh token in response');
                }
            } catch (e) {
                statusRow.subtitle = _(`Token exchange failed: ${e.message}`);
                authButton.label = _('Authorize');
                console.error(`ConfigSyncPreferences: Token exchange error: ${e.message}`);
            }
            authButton.sensitive = true;
        });
    }
}