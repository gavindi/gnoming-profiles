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
        
        // Create main page
        const page = new Adw.PreferencesPage({
            title: _('Gnoming Profiles'),
            icon_name: 'folder-download-symbolic',
        });
        window.add(page);
        
        // GitHub settings group
        const githubGroup = new Adw.PreferencesGroup({
            title: _('GitHub Settings'),
            description: _('Configure your GitHub repository for syncing')
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
        
        // Sync settings group
        const syncGroup = new Adw.PreferencesGroup({
            title: _('Sync Settings'),
            description: _('Configure when to sync your configuration')
        });
        page.add(syncGroup);
        
        // Auto sync on login
        const loginSyncRow = new Adw.SwitchRow({
            title: _('Auto-sync on Login'),
            subtitle: _('Automatically restore configuration when logging in')
        });
        settings.bind('auto-sync-on-login', loginSyncRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        syncGroup.add(loginSyncRow);
        
        // Auto sync on logout
        const logoutSyncRow = new Adw.SwitchRow({
            title: _('Auto-sync on Logout'),
            subtitle: _('Automatically backup configuration when logging out')
        });
        settings.bind('auto-sync-on-logout', logoutSyncRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        syncGroup.add(logoutSyncRow);
        
        // Change monitoring group
        const changeGroup = new Adw.PreferencesGroup({
            title: _('Change Monitoring'),
            description: _('Automatically sync when files or settings change')
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
        
        // Enable/disable delay row based on change sync setting
        const updateDelayRowSensitivity = () => {
            delayRow.sensitive = changeSyncRow.active;
        };
        changeSyncRow.connect('notify::active', updateDelayRowSensitivity);
        updateDelayRowSensitivity();
        
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
            height_request: 150,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
            css_classes: ['card']
        });
        
        const schemasScrolled = new Gtk.ScrolledWindow({
            child: schemasView,
            height_request: 150,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12
        });
        
        // Create a simple row with the text area
        const schemasRow = new Adw.PreferencesRow({
            child: schemasScrolled
        });
        schemasGroup.add(schemasRow);
        
        schemasBuffer.connect('changed', () => {
            const text = schemasBuffer.text;
            const schemas = text.split('\n').filter(s => s.trim().length > 0);
            settings.set_strv('gsettings-schemas', schemas);
        });
        
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
            height_request: 150,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
            css_classes: ['card']
        });
        
        const filesScrolled = new Gtk.ScrolledWindow({
            child: filesView,
            height_request: 150,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12
        });
        
        // Create a simple row with the text area
        const filesRow = new Adw.PreferencesRow({
            child: filesScrolled
        });
        filesGroup.add(filesRow);
        
        filesBuffer.connect('changed', () => {
            const text = filesBuffer.text;
            const files = text.split('\n').filter(f => f.trim().length > 0);
            settings.set_strv('sync-files', files);
        });
        
        // Advanced settings group
        const advancedGroup = new Adw.PreferencesGroup({
            title: _('Advanced Settings'),
            description: _('Additional configuration options')
        });
        page.add(advancedGroup);
        
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
        
        advancedGroup.add(syncDirectionRow);
        
        // Add some helpful information
        const helpGroup = new Adw.PreferencesGroup({
            title: _('Help'),
            description: _('Usage information and examples')
        });
        page.add(helpGroup);
        
        const helpRow = new Adw.ActionRow({
            title: _('Example Schemas'),
            subtitle: _('org.gnome.desktop.interface\norg.gnome.desktop.wm.preferences\norg.gnome.shell\norg.gnome.mutter')
        });
        helpGroup.add(helpRow);
        
        const helpWallpaperRow = new Adw.ActionRow({
            title: _('Wallpaper Schemas (Auto-added)'),
            subtitle: _('org.gnome.desktop.background (desktop wallpaper)\norg.gnome.desktop.screensaver (lock screen)\nNote: Added automatically when wallpaper syncing is enabled')
        });
        helpGroup.add(helpWallpaperRow);
        
        const helpFilesRow = new Adw.ActionRow({
            title: _('Example Files'),
            subtitle: _('~/.bashrc\n~/.gitconfig\n~/.config/gtk-3.0/settings.ini\n~/.config/Code/User/settings.json')
        });
        helpGroup.add(helpFilesRow);
        
        const helpMonitoringRow = new Adw.ActionRow({
            title: _('Change Monitoring Tips'),
            subtitle: _('• Files are monitored in real-time for changes\n• GSettings changes trigger immediate sync\n• Use sync delay to prevent excessive syncing\n• Binary files are automatically skipped')
        });
        helpGroup.add(helpMonitoringRow);
        
        const helpPollingRow = new Adw.ActionRow({
            title: _('GitHub Polling Tips'),
            subtitle: _('• Polls GitHub API for new commits\n• Only syncs if config files changed\n• Use "Test GitHub Polling" in panel menu\n• Set 1-2 minutes for testing, 15+ for production\n• Check GNOME logs if issues: journalctl -f')
        });
        helpGroup.add(helpPollingRow);
        
        // Warning about token security
        const securityGroup = new Adw.PreferencesGroup({
            title: _('Security Notes'),
            description: _('Important information about your data security')
        });
        page.add(securityGroup);
        
        const securityRow = new Adw.ActionRow({
            title: _('🔒 Data Security'),
            subtitle: _('• Use private GitHub repositories only\n• Personal access tokens are stored encrypted\n• Only configured files and settings are synced\n• Review your repository contents regularly')
        });
        securityGroup.add(securityRow);
    }
}