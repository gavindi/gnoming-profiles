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
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ConfigSyncPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        // Create General tab
        this._createGeneralTab(window, settings);
        
        // Create Monitoring tab
        this._createMonitoringTab(window, settings);
        
        // Create Content tab
        this._createContentTab(window, settings);
        
        // Create Advanced tab
        this._createAdvancedTab(window, settings);
        
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
            subtitle: _('• Use private GitHub repositories only\n• Personal access tokens are stored encrypted\n• Only configured files and settings are synced\n• Review your repository contents regularly')
        });
        securityGroup.add(securityRow);
    }
    
    _createMonitoringTab(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('Monitoring'),
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
        
        // GitHub polling group
        const pollingGroup = new Adw.PreferencesGroup({
            title: _('GitHub Polling'),
            description: _('Check GitHub repository for remote changes made by other devices')
        });
        page.add(pollingGroup);
        
        // Enable GitHub polling
        const pollingEnabledRow = new Adw.SwitchRow({
            title: _('Enable GitHub Polling'),
            subtitle: _('Periodically check for changes made by other devices or manual edits')
        });
        settings.bind('github-polling-enabled', pollingEnabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        pollingGroup.add(pollingEnabledRow);
        
        // Polling interval
        const pollingIntervalRow = new Adw.SpinRow({
            title: _('Polling Interval'),
            subtitle: _('How often to check GitHub for changes (in minutes). Use 1-2 min for testing.'),
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
            subtitle: _('Automatically download and apply changes when detected')
        });
        settings.bind('auto-sync-remote-changes', autoSyncRemoteRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        pollingGroup.add(autoSyncRemoteRow);
        
        // Enable/disable polling rows based on main setting
        const updatePollingRowSensitivity = () => {
            pollingIntervalRow.sensitive = pollingEnabledRow.active;
            autoSyncRemoteRow.sensitive = pollingEnabledRow.active;
        };
        pollingEnabledRow.connect('notify::active', updatePollingRowSensitivity);
        updatePollingRowSensitivity();
        
        // Monitoring tips
        const tipsGroup = new Adw.PreferencesGroup({
            title: _('Tips & Troubleshooting'),
        });
        page.add(tipsGroup);
        
        const changeMonitoringTipsRow = new Adw.ActionRow({
            title: _('💡 Change Monitoring Tips'),
            subtitle: _('• Files are monitored in real-time for changes\n• GSettings changes trigger immediate sync\n• Use sync delay to prevent excessive syncing\n• Binary files are automatically skipped')
        });
        tipsGroup.add(changeMonitoringTipsRow);
        
        const pollingTipsRow = new Adw.ActionRow({
            title: _('💡 GitHub Polling Tips'),
            subtitle: _('• Polls GitHub API for new commits\n• Only syncs if config files changed\n• Use "Test GitHub Polling" in panel menu\n• Set 1-2 minutes for testing, 15+ for production')
        });
        tipsGroup.add(pollingTipsRow);
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
            subtitle: _('Include wallpaper image files in sync (may increase sync time and storage use)')
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
        
        schemasBuffer.connect('changed', () => {
            const text = schemasBuffer.text;
            const schemas = text.split('\n').filter(s => s.trim().length > 0);
            settings.set_strv('gsettings-schemas', schemas);
        });
        
        // Example schemas
        const exampleSchemasRow = new Adw.ActionRow({
            title: _('📋 Example Schemas'),
            subtitle: _('org.gnome.desktop.interface\norg.gnome.desktop.wm.preferences\norg.gnome.shell\norg.gnome.mutter')
        });
        schemasGroup.add(exampleSchemasRow);
        
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
    
    _createAdvancedTab(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('Advanced'),
            icon_name: 'preferences-other-symbolic',
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
            subtitle: _('1. Check GitHub credentials in General tab\n2. Verify repository exists and is private\n3. Test with "Test GitHub Polling" in panel menu\n4. Check logs for error messages\n5. Try disabling/re-enabling extension')
        });
        debugGroup.add(troubleshootingRow);
        
        // Performance group
        const performanceGroup = new Adw.PreferencesGroup({
            title: _('Performance'),
            description: _('Settings that affect extension performance')
        });
        page.add(performanceGroup);
        
        const performanceRow = new Adw.ActionRow({
            title: _('⚡ Performance Tips'),
            subtitle: _('• Increase Change Sync Delay for rapidly-changing files\n• Use "Backup Only" sync direction for better performance\n• Disable wallpaper syncing if not needed\n• Use longer polling intervals in production\n• Review monitored files list regularly')
        });
        performanceGroup.add(performanceRow);
        
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
        
        // Reset and maintenance group
        const maintenanceGroup = new Adw.PreferencesGroup({
            title: _('Maintenance'),
            description: _('Extension maintenance and reset options')
        });
        page.add(maintenanceGroup);
        
        const maintenanceRow = new Adw.ActionRow({
            title: _('🧹 Maintenance Tips'),
            subtitle: _('• Regularly review your repository contents\n• Clean up old wallpapers if not needed\n• Monitor repository size (GitHub has limits)\n• Keep your access token secure and rotate periodically')
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
            description: _('Automatic GNOME configuration sync via GitHub')
        });
        page.add(infoGroup);
        
        const versionRow = new Adw.ActionRow({
            title: _('Version'),
            subtitle: _('2.4')
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
            subtitle: _('Automatically syncs your GNOME settings and configuration files to a private GitHub repository with real-time monitoring and multi-device support.')
        });
        infoGroup.add(descriptionRow);
        
        // Features group
        const featuresGroup = new Adw.PreferencesGroup({
            title: _('Key Features'),
        });
        page.add(featuresGroup);
        
        const featuresRow = new Adw.ActionRow({
            title: _('✨ What This Extension Does'),
            subtitle: _('• Real-time file and settings monitoring\n• Automatic GitHub repository sync\n• Multi-device configuration sharing\n• Wallpaper syncing (optional)\n• Session-based auto-sync\n• Remote change detection\n• Private repository security')
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
        
        const v24Row = new Adw.ActionRow({
            title: _('v2.4 (Current)'),
            subtitle: _('• NEW: Organized preferences into logical tabs\n• Added comprehensive About section\n• Improved settings organization\n• Better user experience with categorized options')
        });
        changelogGroup.add(v24Row);
        
        const v23Row = new Adw.ActionRow({
            title: _('v2.3'),
            subtitle: _('• BREAKING: Wallpaper storage optimization\n• Wallpapers now stored only in wallpapers/ folder\n• Reduced main config file size\n• Improved repository organization')
        });
        changelogGroup.add(v23Row);
        
        const v22Row = new Adw.ActionRow({
            title: _('v2.2'),
            subtitle: _('• NEW: Optional wallpaper syncing support\n• Wallpaper syncing disabled by default\n• Automatic wallpaper detection and sync\n• Smart wallpaper restoration')
        });
        changelogGroup.add(v22Row);
        
        // Help group
        const helpGroup = new Adw.PreferencesGroup({
            title: _('Getting Started'),
        });
        page.add(helpGroup);
        
        const setupRow = new Adw.ActionRow({
            title: _('🚀 Quick Setup'),
            subtitle: _('1. Create a private GitHub repository\n2. Generate a Personal Access Token (repo permissions)\n3. Configure credentials in General tab\n4. Add schemas and files in Content tab\n5. Enable monitoring in Monitoring tab')
        });
        helpGroup.add(setupRow);
        
        const firstSyncRow = new Adw.ActionRow({
            title: _('💾 First Sync'),
            subtitle: _('After setup, click the user icon in your top panel and select "Sync Now" to perform your first backup and test the connection.')
        });
        helpGroup.add(firstSyncRow);
    }
}