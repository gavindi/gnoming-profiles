# Gnoming Profiles Extension

A GNOME Shell extension that automatically syncs your gsettings and configuration files to a private GitHub repository with real-time change monitoring.

## Features

- **Automatic Sync**: Backup on logout, restore on login
- **Real-time Change Monitoring**: Automatically sync when files or settings change
- **GitHub Polling**: Check GitHub repository for remote changes from other devices
- **GSettings Support**: Monitor and sync any GSettings schema in real-time
- **Multitasking & Workspaces**: Full sync of GNOME workspace and window management settings
- **Ubuntu Desktop Support**: Automatic sync of Ubuntu-specific desktop extensions and settings
- **Wallpaper Sync**: Optionally sync desktop and lock screen wallpapers
- **File Monitoring**: Watch configuration files for changes and sync automatically
- **Smart Debouncing**: Configurable delay to prevent excessive syncing
- **Private Repository**: Uses GitHub private repositories for security
- **Manual Sync**: Trigger sync manually from the panel indicator
- **Visual Feedback**: Panel indicator shows sync status and monitoring state

## Installation

1. Clone or download this extension
2. Run `make install` to install to your local extensions directory
3. Enable the extension using GNOME Extensions app or:
   ```bash
   gnome-extensions enable gnoming-profiles@gavindi.github.com
   ```

## Setup

1. Create a private GitHub repository for your configs
2. Generate a Personal Access Token with `repo` permissions
3. Open extension preferences and configure:
   - GitHub username
   - Repository name
   - Personal access token
   - Which GSettings schemas to monitor and sync
   - Which files to monitor and sync
   - Change monitoring settings

## Sync Modes

### Session-based Sync
- **Login Sync**: Automatically restore configuration when logging in
- **Logout Sync**: Automatically backup configuration when logging out

### Change-based Sync
- **File Monitoring**: Watches configured files for changes in real-time
- **GSettings Monitoring**: Monitors GSettings schemas for any changes
- **Smart Debouncing**: Configurable delay (1-300 seconds) to prevent excessive syncing
- **Sync Direction**: Choose between backup-only or bidirectional sync for changes

### GitHub Polling (NEW!)
- **Remote Change Detection**: Periodically checks GitHub for commits from other devices
- **Smart Filtering**: Only syncs when configuration files are actually changed
- **Configurable Interval**: Poll every 1-1440 minutes (default: 15 minutes)
- **Auto-sync Remote**: Automatically download and apply remote changes
- **Manual Pull**: Option to manually pull remote changes from the panel menu

### Manual Sync
- Click the panel indicator and select "Sync Now"
- Performs both backup and restore operations

## Default Monitored Items

- **Core Desktop GSettings**: 
  - `org.gnome.desktop.interface` (theme, fonts, accessibility)
  - `org.gnome.desktop.wm.preferences` (window manager settings)
  - `org.gnome.shell` (shell preferences and extensions)

- **Multitasking & Workspaces**:
  - `org.gnome.mutter` (workspace behavior, animations, window management)
  - `org.gnome.desktop.wm.keybindings` (workspace switching shortcuts)
  - `org.gnome.shell.window-switcher` (Alt+Tab behavior and appearance)
  - `org.gnome.shell.app-switcher` (Super+Tab application switching)

- **Ubuntu Desktop Extensions** (when available):
  - `org.gnome.shell.extensions.ubuntu-dock` (Ubuntu's dock configuration)
  - `org.gnome.shell.extensions.ubuntu-appindicators` (system tray indicators)
  - `org.gnome.shell.extensions.desktop-icons-ng` (desktop icons behavior)
  - `org.gnome.shell.extensions.ding` (desktop icons new generation)
  - `org.gnome.shell.extensions.dash-to-dock` (dash-to-dock extension)
  - `com.ubuntu.update-notifier` (Ubuntu update notification settings)

- **Wallpaper Settings** (when wallpaper sync enabled):
  - `org.gnome.desktop.background` (desktop wallpaper)
  - `org.gnome.desktop.screensaver` (lock screen wallpaper)

- **Configuration Files**: 
  - `~/.bashrc` (bash configuration)
  - `~/.gitconfig` (git configuration)
  - `~/.vimrc` (vim configuration)
  - `~/.config/gtk-3.0/settings.ini` (GTK3 settings)
  - Various other config files

## Wallpaper Syncing (Optional)

Wallpaper syncing is **disabled by default** but can be enabled in preferences. When enabled, the extension automatically detects and syncs your desktop and lock screen wallpapers.

### **Enable Wallpaper Syncing**
1. Open extension preferences
2. Go to "Wallpaper Syncing" section  
3. Enable "Sync Wallpapers" toggle
4. Wallpaper schemas are automatically added to monitoring

### **What Gets Synced**
- **Desktop wallpaper**: From `org.gnome.desktop.background` settings
- **Lock screen wallpaper**: From `org.gnome.desktop.screensaver` settings  
- **Wallpaper files**: The actual image files are uploaded to GitHub
- **Dark mode wallpapers**: Separate wallpapers for light/dark themes

### **How It Works**
1. **Detection**: Extension reads wallpaper paths from GSettings
2. **Backup**: Wallpaper image files are encoded and uploaded to GitHub
3. **Restore**: Files are downloaded to `~/.local/share/gnoming-profiles/wallpapers/`
4. **Update**: GSettings are updated to point to the restored wallpaper files

### **What Gets Synced with New Default Schemas**

**GNOME Multitasking & Workspaces:**
- **Workspace Behavior**: Number of workspaces, dynamic/static workspaces, workspace switching animations
- **Window Management**: Hot corner settings, window focus behavior, edge tiling
- **Keyboard Shortcuts**: All workspace switching shortcuts (Ctrl+Alt+Arrow, Super+Page Up/Down, etc.)
- **Window Switching**: Alt+Tab appearance, behavior, and application grouping
- **Application Switching**: Super+Tab behavior and visual settings

**Ubuntu Desktop Extensions:**
- **Ubuntu Dock**: Position, size, auto-hide behavior, icon click actions
- **System Tray**: Legacy application indicators, system indicator behavior
- **Desktop Icons**: Show/hide desktop icons, icon arrangement, trash/home icons
- **Update Notifications**: Ubuntu update notification preferences
- **Dash to Dock**: If installed, all dock customization settings

These settings ensure your complete desktop workflow is preserved across devices, including your workspace setup, window management preferences, and Ubuntu-specific customizations.

### **Considerations**
- **File Size**: Wallpaper files can be large (1-10MB+ each)
- **Sync Time**: Large wallpapers increase sync duration
- **Storage**: Uses more GitHub repository storage space
- **Bandwidth**: Higher data usage during sync

### **Supported Formats**
- All image formats supported by GNOME (JPG, PNG, WebP, etc.)
- Files of any size (though very large files may take longer to sync)
- Both local files and files from standard directories

### **Location After Restore**
Restored wallpapers are stored in: `~/.local/share/gnoming-profiles/wallpapers/`

## Configuration Options

### Change Monitoring Settings
- **Auto-sync on Changes**: Enable/disable real-time change monitoring
- **Change Sync Delay**: Debounce delay in seconds (default: 5 seconds)
- **Sync Direction**: 
  - Backup Only: Only upload changes to GitHub
  - Bidirectional: Upload changes and download any updates from GitHub

### Wallpaper Syncing Settings
- **Sync Wallpapers**: Enable/disable wallpaper image syncing (default: disabled)
- **Automatic Schema Addition**: Wallpaper schemas added automatically when enabled
- **Storage Location**: Wallpapers restored to `~/.local/share/gnoming-profiles/wallpapers/`
- **Repository Storage**: Wallpapers uploaded to `wallpapers/` folder in GitHub repo

### GitHub Polling Settings
- **Enable GitHub Polling**: Turn on/off remote change detection
- **Polling Interval**: How often to check GitHub (1-1440 minutes, default: 15)
- **Auto-sync Remote Changes**: Automatically apply remote changes when detected
- **Manual Pull Option**: Always available in panel menu when remote changes detected

### Advanced Features
- **File Type Detection**: Automatically skips binary files
- **Directory Creation**: Creates parent directories as needed when restoring
- **Error Recovery**: Robust error handling with detailed logging
- **Visual Indicators**: Panel icon changes to show sync and monitoring status

## Panel Indicator States

- **Default**: Static user icon (monitoring/polling disabled or no activity)
- **Monitoring Active**: Subtle green glow (change monitoring or GitHub polling enabled)
- **Syncing**: Animated blue pulsing with rotating icons
- **Change Detected**: Brief orange flash when local changes are detected
- **Remote Changes**: Purple pulsing when remote changes are available (shows "Pull Changes" menu item)

## Menu Options

- **Sync Now**: Full bidirectional sync (backup then restore)
- **Pull Remote Changes**: Appears when remote changes detected via polling
- **Status Lines**: 
  - Last sync timestamp
  - Change monitoring status (files/schemas count)
  - GitHub polling status (interval)
- **Settings**: Open extension preferences

## Repository Structure

In your GitHub repository, you'll find:

```
config-backup.json          # GSettings backup in JSON format (wallpapers excluded)
files/
  home/
    [username]/
      .bashrc               # Your actual config files
      .gitconfig           # Preserved in original structure
      .config/
        gtk-3.0/
          settings.ini
wallpapers/                 # Optional: Only if wallpaper sync enabled
  my-wallpaper.jpg          # Desktop wallpaper files
  lock-screen.png           # Lock screen wallpaper files
```

## Security Features

- **Private Repositories**: Only works with private GitHub repositories
- **Encrypted Storage**: Personal access tokens stored encrypted by GNOME
- **Selective Sync**: Only configured schemas and files are monitored and synced
- **Text-only**: Binary files are automatically detected and skipped
- **Permission Control**: Uses minimal GitHub API permissions (repo scope only)

## Change Monitoring Details

### File Monitoring
- Uses `Gio.FileMonitor` for efficient file system watching
- Monitors both files and parent directories (for files that don't exist yet)
- Detects create, modify, and delete events
- Filters out temporary files and irrelevant changes

### GSettings Monitoring
- Connects to the `changed` signal for each configured schema
- Monitors all keys within each schema automatically
- Captures changes from any source (GUI settings, command line, other applications)
- Temporarily disables monitoring during restore operations to prevent loops

### Smart Debouncing
- Configurable delay prevents rapid-fire syncing during bulk changes
- Timer resets with each new change detected
- Batch processing of multiple simultaneous changes
- Visual feedback when changes are detected and queued

## Performance Considerations

- **Minimal Resource Usage**: Uses efficient GNOME APIs for monitoring
- **Debounced Syncing**: Prevents excessive network requests
- **Selective Monitoring**: Only watches explicitly configured items
- **Automatic Cleanup**: All monitors properly cleaned up when extension disabled

## Troubleshooting

### Change Monitoring Not Working
1. Check that "Auto-sync on Changes" is enabled in preferences
2. Verify that your files and schemas are properly configured
3. Check the GNOME Shell logs: `journalctl -f -o cat /usr/bin/gnome-shell`
4. Try toggling change monitoring off and on in preferences

### GitHub Polling Issues
1. Check that GitHub credentials are properly configured
2. Ensure repository exists and is accessible with your token
3. Verify polling is enabled in preferences
4. Check network connectivity to GitHub
5. Review polling interval (too frequent may hit rate limits)
6. Look for "GitHub polling" status in panel menu

### Remote Changes Not Detected
1. Verify changes were actually committed to the repository
2. Check that config files (config-backup.json or files/*) were modified
3. Ensure polling interval has elapsed since the change
4. Try manual "Sync Now" to test connectivity

### Excessive GitHub API Usage
1. Increase the "Change Sync Delay" in preferences
2. Review your monitored files list for rapidly-changing files
3. Consider using "Backup Only" sync direction for change monitoring

### Files Not Syncing
1. Ensure files exist and are readable
2. Check file paths use correct syntax (~ for home directory)
3. Binary files are automatically skipped
4. Parent directories must be accessible

## Requirements

- GNOME Shell 45+
- GitHub account with private repository
- Personal access token with repo permissions
- Write access to monitored configuration files

**Note**: Ubuntu-specific schemas (ubuntu-dock, ubuntu-appindicators, etc.) are only synced when the corresponding extensions are installed and active. The extension gracefully handles missing schemas without errors.

## Bug Reporting

Bugs should be reported to the Github bug tracker [https://github.com/gavindi/gnoming-profiles/issues](https://github.com/gavindi/gnoming-profiles/issues).

When reporting issues with change monitoring, please include:
- GNOME Shell version
- Extension version
- Monitored files and schemas list
- GNOME Shell logs showing the issue

## License

Gnoming Profiles GNOME Shell extension is distributed under the terms of the GNU General Public License, version 2. See the LICENSE file for details.

## Changelog

### v2.6 (Current)
- **UI Improvements**: Renamed "Monitoring" tab to "Sync" for better clarity
- **Help Organization**: Renamed "Advanced" tab to "Help" for improved user experience
- **Personal Touch**: Added heartfelt dedication to Jupiter in About section
- **Better UX**: Improved tab naming and organization for easier navigation

### v2.4
- **NEW: Organized preferences interface with logical tabs**
- Added comprehensive About tab with extension information
- Reorganized settings into General, Monitoring, Content, Advanced, and About tabs
- **NEW: Default support for GNOME multitasking and workspace schemas**
- **NEW: Default support for Ubuntu desktop extension schemas**
- Enhanced default schema list includes:
  - Workspace management (`org.gnome.mutter`)
  - Window switching (`org.gnome.shell.window-switcher`, `org.gnome.shell.app-switcher`)
  - Workspace keybindings (`org.gnome.desktop.wm.keybindings`)
  - Ubuntu dock and indicators (`org.gnome.shell.extensions.ubuntu-*`)
  - Desktop icons extensions (`org.gnome.shell.extensions.desktop-icons-ng`)
- Improved user experience with better categorization and built-in help
- Added troubleshooting guides and performance tips within preferences

### v2.3
- **BREAKING CHANGE: Wallpaper storage optimization**
- Wallpapers are now stored ONLY in the `wallpapers/` folder in the repository
- Wallpaper data is no longer included in the main `config-backup.json` file
- This reduces the size of the main config file and improves sync performance
- Wallpaper syncing continues to work exactly the same for end users
- Improved separation of concerns between settings and binary data
- Better repository organization with cleaner main config file

### v2.2
- **NEW: Optional wallpaper syncing support**
- Wallpaper syncing disabled by default (enable in preferences)
- Automatically syncs desktop and lock screen wallpapers when enabled
- Wallpaper files uploaded to GitHub repository
- Smart wallpaper restoration with path updating
- Wallpaper schemas automatically added when syncing enabled
- Wallpaper files stored in dedicated repository folder
- Configurable to avoid large file transfers when not needed

### v2.1
- Added GitHub polling for remote change detection
- Multi-device sync support with conflict-free operation
- **FIXED: GitHub polling now works reliably**
- Manual "Test GitHub Polling" option in panel menu
- Comprehensive logging for debugging polling issues
- Reduced default polling interval to 5 minutes (was 15)
- Simplified commit detection (all commits trigger sync)
- Better error handling and recovery for network issues
- Enhanced panel indicator with remote change visualization
- Auto-sync remote changes with improved reliability

### v2.0
- Added real-time change monitoring for files and GSettings
- Configurable debouncing to prevent excessive syncing
- Visual status indicators in panel menu
- Smart sync direction control (backup-only vs bidirectional)
- Enhanced error handling and logging
- Improved UI with monitoring status display

### v1.0
- Initial release with session-based syncing
- Basic GSettings and file sync
- GitHub integration with private repositories