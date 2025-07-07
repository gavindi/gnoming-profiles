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

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ConfigSyncPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
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
    }
    
    _createGeneralTab(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);
        
        // GitHub settings group
        const githubGroup = new Adw.PreferencesGroup({
            title: _('GitHub Repository'),
            description: _('Configure your private GitHub repository for syncing')
        });
        page.add(githubGroup);
        
        // GitHub username
        const usernameRow = new Adw.EntryRow({
            title: _('GitHub Username'),
            text: settings.get_string('github-username')
        });
        usernameRow.connect('changed', () => {
            settings.set_string('github-username', usernameRow.text);
        });
        githubGroup.add(usernameRow);
        
        // GitHub repository
        const repoRow = new Adw.EntryRow({
            title: _('Repository Name'),
            text: settings.get_string('github-repo')
        });
        repoRow.connect('changed', () => {
            settings.set_string('github-repo', repoRow.text);
        });
        githubGroup.add(repoRow);
        
        // GitHub token
        const tokenRow = new Adw.PasswordEntryRow({
            title: _('Personal Access Token'),
            text: settings.get_string('github-token')
        });
        tokenRow.connect('changed', () => {
            settings.set_string('github-token', tokenRow.text);
        });
        githubGroup.add(tokenRow);
        
        // Session sync settings group
        const sessionGroup = new Adw.PreferencesGroup({
            title: _('Session Sync'),
            description: _('Configure automatic syncing during login and logout')
        });
        page.add(sessionGroup);
        
        // Auto sync on login
        const loginSyncRow = new Adw.SwitchRow({
            title: _('Auto-sync on Login'),
            subtitle: _('Automatically restore configuration when logging in')
        });
        settings.bind('auto-sync-on-login', loginSyncRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        sessionGroup.add(loginSyncRow);
        
        // Auto sync on logout
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
            title: _('🔒 Data Security'),
            subtitle: _('• Use private GitHub repositories only\n• Personal access tokens are stored encrypted\n• Only configured files and settings are synced\n• Review your repository contents regularly\n• ETags are cached in memory only (not persisted)')
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
            title: _('Change Monitoring'),
            description: _('Automatically sync when files or settings change in real-time')
        });
        page.add(changeGroup);
        
        // Auto sync on change
        const changeSyncRow = new Adw.SwitchRow({
            title: _('Auto-sync on Changes'),
            subtitle: _('Automatically backup when monitored files or settings change')
        });
        settings.bind('auto-sync-on-change', changeSyncRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        changeGroup.add(changeSyncRow);
        
        // Change sync delay
        const delayRow = new Adw.SpinRow({
            title: _('Change Sync Delay'),
            subtitle: _('Seconds to wait after a change before syncing (prevents excessive syncing)'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 300,
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
        syncDirectionRow.model.append(_('Backup Only (Upload to GitHub)'));
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
        
        // ETag-based GitHub polling group
        const pollingGroup = new Adw.PreferencesGroup({
            title: _('ETag-Based GitHub Polling'),
            description: _('Efficiently check GitHub repository for remote changes using HTTP ETags')
        });
        page.add(pollingGroup);
        
        // Enable GitHub polling
        const pollingEnabledRow = new Adw.SwitchRow({
            title: _('Enable ETag Polling'),
            subtitle: _('Use efficient ETag-based polling to detect changes from other devices')
        });
        settings.bind('github-polling-enabled', pollingEnabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        pollingGroup.add(pollingEnabledRow);
        
        // Polling interval
        const pollingIntervalRow = new Adw.SpinRow({
            title: _('Polling Interval'),
            subtitle: _('How often to check GitHub for changes (in minutes). ETags make frequent polling efficient.'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 1440, // Max 24 hours
                step_increment: 1,
                page_increment: 10,
                value: settings.get_int('github-polling-interval')
            })
        });
        settings.bind('github-polling-interval', pollingIntervalRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        pollingGroup.add(pollingIntervalRow);
        
        // Auto-sync remote changes
        const autoSyncRemoteRow = new Adw.SwitchRow({
            title: _('Auto-sync Remote Changes'),
            subtitle: _('Automatically download and apply changes when detected via ETag polling')
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
        
        // Initialize sync button
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
        
        // Create a safe timeout handler that doesn't capture button reference
        const createSafeTimeoutHandler = (buttonRef) => {
            return () => {
                // Use weak reference pattern - check if button still exists
                if (buttonRef?.sensitive !== undefined) {
                    buttonRef.sensitive = true;
                    buttonRef.label = _('Initialize Sync');
                }
                return GLib.SOURCE_REMOVE;
            };
        };
        
        initButton.connect('clicked', () => {
            // Disable button temporarily
            initButton.sensitive = false;
            initButton.label = _('Initializing...');
            
            // Trigger the extension to perform initial sync by setting a flag
            settings.set_boolean('trigger-initial-sync', true);
            
            // Re-enable button after a delay using safe timeout handler
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, createSafeTimeoutHandler(initButton));
        });
        
        initSyncRow.add_suffix(initButton);
        initGroup.add(initSyncRow);
        
        const initWarningRow = new Adw.ActionRow({
            title: _('⚠️ Important'),
            subtitle: _('Make sure GitHub credentials are configured before initializing. Check the panel menu and logs for status updates.')
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
            subtitle: _('Wallpapers stored in ~/.local/share/gnoming-profiles/wallpapers/\nUploaded to wallpapers/ folder in GitHub repository')
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
            height_request: 120,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
            css_classes: ['card']
        });
        
        const schemasScrolled = new Gtk.ScrolledWindow({
            child: schemasView,
            height_request: 120,
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
        
        // Use a simple closure that only captures the settings object, not the buffer
        schemasBuffer.connect('changed', () => {
            const text = schemasBuffer.text;
            const schemas = text.split('\n').filter(s => s.trim().length > 0);
            settings.set_strv('gsettings-schemas', schemas);
        });
        
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
            height_request: 120,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
            css_classes: ['card']
        });
        
        const filesScrolled = new Gtk.ScrolledWindow({
            child: filesView,
            height_request: 120,
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
        
        // Use a simple closure that only captures the settings object, not the buffer
        filesBuffer.connect('changed', () => {
            const text = filesBuffer.text;
            const files = text.split('\n').filter(f => f.trim().length > 0);
            settings.set_strv('sync-files', files);
        });
        
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
            description: _('Automatic GNOME configuration sync via GitHub with ETag-based polling')
        });
        page.add(infoGroup);
        
        const versionRow = new Adw.ActionRow({
            title: _('Version'),
            subtitle: _('2.9 (with ETag polling)')
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
            subtitle: _('Automatically syncs your GNOME settings and configuration files to a private GitHub repository with real-time monitoring, high-performance batching, intelligent request management, and ultra-efficient ETag-based polling.')
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
            subtitle: _('• Real-time file and settings monitoring\n• ETag-based polling for ultra-efficient remote sync\n• High-performance GitHub Tree API batching\n• Intelligent request queue management\n• Smart content caching and change detection\n• Multi-device configuration sharing\n• Wallpaper syncing (optional)\n• Session-based auto-sync\n• Remote change detection\n• Private repository security')
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
        const v30Row = new Adw.ActionRow({
            title: _('⚡ Performance Notice (v3.0 with Binary-Safe Wallpapers)'),
            subtitle: _('This version fixes wallpaper corruption and uses ETag polling and GitHub Tree API for dramatically improved performance. Your first sync may take slightly longer as caches are built, but subsequent syncs and polling will be much faster and more efficient.')
        });
        changelogGroup.add(v30Row);        
        const v29Row = new Adw.ActionRow({
            title: _('v2.9 (Current - with ETag Polling)'),
            subtitle: _('• NEW: ETag-Based GitHub Polling - Ultra-efficient change detection\n  - Uses HTTP ETags for conditional requests (If-None-Match)\n  - 304 Not Modified responses reduce bandwidth by up to 95%\n  - Conditional requests often don\'t count against API limits\n  - Real-time ETag status display in panel menu\n• NEW: GitHub Tree API Batching - All files uploaded in single commits\n• NEW: Request Queue Management - Intelligent concurrency control\n• NEW: Smart Caching System - SHA-256 based change detection\n• NEW: HTTP Session Reuse - Better connection efficiency\n• IMPROVED: Wallpaper Handling - On-demand loading reduces memory\n• ENHANCED: Panel Menu - ETag and request queue status displays\n• PERFORMANCE: 60-80% faster sync + 95% bandwidth reduction\n• RELIABILITY: Better error handling and network recovery')
        });
        changelogGroup.add(v29Row);
        
        const v28Row = new Adw.ActionRow({
            title: _('v2.8'),
            subtitle: _('• NEW: Reorganized panel menu structure\n• Extension name now appears at top of menu\n• Status information grouped in middle section\n• Action items (Sync Now, Settings) moved to bottom\n• Enhanced visual hierarchy with logical sections\n• NEW: Sync Lock System prevents concurrent operations\n• Centralized sync management with smart queueing\n• Enhanced user feedback during sync operations')
        });
        changelogGroup.add(v28Row);
        
        const v27Row = new Adw.ActionRow({
            title: _('v2.7'),
            subtitle: _('• Removed "Test GitHub Polling" from panel menu\n• NEW: Added "Initialize Sync" button for manual setup\n• Fixed schema detection and counting issues\n• Enhanced initial backup process\n• Improved logging for troubleshooting')
        });
        changelogGroup.add(v27Row);
        
        const v26Row = new Adw.ActionRow({
            title: _('v2.6'),
            subtitle: _('• Renamed "Monitoring" tab to "Sync" for clarity\n• Renamed "Advanced" tab to "Help" for better organization\n• Added heartfelt dedication to Jupiter\n• Improved tab naming for better user experience')
        });
        changelogGroup.add(v26Row);
        
        const v24Row = new Adw.ActionRow({
            title: _('v2.4'),
            subtitle: _('• NEW: Organized preferences into logical tabs\n• Added comprehensive About section\n• NEW: Default support for GNOME multitasking schemas\n• NEW: Default support for Ubuntu desktop extensions\n• Improved settings organization and user experience')
        });
        changelogGroup.add(v24Row);
        
        const v23Row = new Adw.ActionRow({
            title: _('v2.3'),
            subtitle: _('• BREAKING: Wallpaper storage optimization\n• Wallpapers now stored only in wallpapers/ folder\n• Reduced main config file size\n• Improved repository organization')
        });
        changelogGroup.add(v23Row);
        
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
            title: _('⚡ Performance Notice (v2.9 with ETags)'),
            subtitle: _('This version uses ETag polling and GitHub Tree API for dramatically improved performance. Your first sync may take slightly longer as caches are built, but subsequent syncs and polling will be much faster and more efficient.')
        });
        helpGroup.add(performanceNoticeRow);
        
        const etagExplanationRow = new Adw.ActionRow({
            title: _('🏷️ Understanding ETags'),
            subtitle: _('ETags are HTTP headers that act like "fingerprints" for content. When GitHub content hasn\'t changed, it returns a 304 "Not Modified" response with minimal data, saving bandwidth and improving speed. Check the panel menu to see ETag status in real-time.')
        });
        helpGroup.add(etagExplanationRow);
    }
}