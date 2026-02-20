<img src="https://raw.githubusercontent.com/gavindi/gnoming-profiles/74a7d98e2579992c504ff01f0b5f13b2aac2ea50/icons/system-switch-user-symbolic.svg" alt="title" width="25%">


# Gnoming Profiles Extension
![screenshot](https://github.com/gavindi/gnoming-profiles/blob/master/media/GnomingProfilesScreenshot.png?raw=true)

A GNOME Shell extension that automatically syncs your gsettings and configuration files to GitHub, Nextcloud, or Google Drive with real-time change monitoring, high-performance batch uploading, intelligent polling, binary-safe wallpaper syncing, and a modular architecture with pluggable storage backends.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/P5P21M7MBS)

## Features

- **Multiple Storage Backends**: Sync to GitHub, Nextcloud/WebDAV, or Google Drive (v3.3+)
- **Live Provider Switching**: Change storage backend without restarting the extension
- **Google Drive with GNOME Online Accounts**: Seamless authentication via GOA with multi-account support (v3.3.4+)
- **Automatic Sync**: Backup on logout, restore on login
- **Real-time Change Monitoring**: Automatically sync when files or settings change
- **Remote Polling**: Efficient change detection with ETag or modifiedTime-based polling
- **Binary-Safe Wallpaper Syncing**: Corruption-free wallpaper sync with header validation
- **High-Performance Batching**: Upload multiple files atomically (GitHub Tree API, Nextcloud WebDAV, Google Drive multipart)
- **Request Queue Management**: Intelligent concurrency limits and queue management
- **Smart Caching**: SHA-based caching to avoid unnecessary uploads
- **Modular Architecture**: Clean separation of concerns with pluggable StorageProvider backends
- **GSettings Support**: Monitor and sync any GSettings schema in real-time
- **Multitasking & Workspaces**: Full sync of GNOME workspace and window management settings
- **Ubuntu Desktop Support**: Automatic sync of Ubuntu-specific desktop extensions and settings
- **Wallpaper Sync**: Optionally sync desktop and lock screen wallpapers with binary integrity
- **File Monitoring**: Watch configuration files for changes and sync automatically
- **Smart Debouncing**: Configurable delay to prevent excessive syncing
- **Manual Sync**: Trigger sync manually from the panel indicator
- **Visual Feedback**: Panel indicator shows sync status and monitoring state
- **Organized Menu**: Clean, intuitive panel menu with logical sections

## Demo
[![Demo](https://i9.ytimg.com/vi_webp/6QftnXT5tCo/mq2.webp?sqp=CKT5u8MG&rs=AOn4CLApGxIz13UaU9JNbf4Heg9dnjK0VQ)](https://youtu.be/6QftnXT5tCo)

## Installation

### Prerequisites

The GNOME Online Accounts typelib is required for Google Drive support. It is pre-installed on most GNOME desktops, but if missing (e.g. on a minimal install), install it with:

```bash
# Debian / Ubuntu
sudo apt install gir1.2-goa-1.0

# Fedora
sudo dnf install gnome-online-accounts

# Arch Linux
sudo pacman -S gnome-online-accounts
```

### Steps

1. Clone or download this extension
2. Run `make install` to install to your local extensions directory
3. Enable the extension using GNOME Extensions app or:
   ```bash
   gnome-extensions enable gnoming-profiles@gavindi.github.com
   ```

## Modular Architecture (v2.9+)

The extension features a completely modular architecture with clean separation of concerns:

### Storage Providers
- **StorageProvider**: Abstract base class defining the storage backend contract
- **GitHubProvider**: GitHub backend — Tree API batching, Content API, ETag polling
- **NextcloudProvider**: Nextcloud/WebDAV backend — PUT/GET/PROPFIND/MKCOL, ETag polling
- **GoogleDriveProvider**: Google Drive backend — GOA authentication, path-to-ID resolution, multipart upload, modifiedTime polling

### Core Modules
- **RequestQueue**: Manages API concurrency and rate limiting
- **ETagManager**: Handles ETag/modifiedTime caching for bandwidth-efficient polling
- **GitHubAPI**: GitHub REST API client with ETag support, Tree API batching, and binary-safe downloads
- **SyncManager**: Coordinates all backup/restore operations across providers

### Monitoring Modules
- **FileMonitor**: Real-time file system change detection
- **SettingsMonitor**: GSettings schema change monitoring
- **WallpaperManager**: Binary-safe wallpaper syncing and URI management (v3.0+)

### UI Module
- **PanelIndicator**: GNOME Shell panel integration and user interface

### Benefits
- **Maintainability**: Each module has a single, well-defined responsibility
- **Testability**: Modules can be tested independently with clear interfaces
- **Performance**: Specialized modules optimize specific operations
- **Extensibility**: New features can be added without affecting existing code
- **Reliability**: Proper resource management and cleanup (v3.0+)
- **Better Debugging**: Semantic logging with console.log/warn/error methods (v3.0.1+)

See `lib/README.md` for detailed module documentation.

## Enhanced Memory Management (v3.0+)

Version 3.0 introduces comprehensive timer and memory management improvements:

### Timer Management
- **Proper Timeout Cleanup**: All GLib timeouts are tracked and properly removed
- **Timeout ID Tracking**: Active timeouts are tracked in Sets for reliable cleanup
- **Nullification**: Timeout IDs are set to null after removal to prevent double cleanup
- **Cascade Cleanup**: Nested timeouts are properly managed and cleaned up

### Memory Management
- **Reference Nullification**: All object references are properly nullified during cleanup
- **Map and Set Cleanup**: Data structures are cleared and nullified
- **Component Isolation**: Each module manages its own cleanup independently
- **Lifecycle Management**: Proper initialization and destruction phases

### Resource Management
- **Session Handler Cleanup**: DBus proxy connections are properly disconnected
- **File Monitor Cleanup**: All file system monitors are cancelled and cleared
- **Settings Monitor Cleanup**: GSettings signal handlers are disconnected
- **Network Resource Cleanup**: HTTP sessions and request queues are properly closed

### Reliability Improvements
- **Memory Leak Prevention**: Eliminates potential memory leaks from uncleaned timers
- **Graceful Shutdown**: Extension can be safely disabled and re-enabled
- **Error Recovery**: Better error handling during cleanup operations
- **Performance**: Reduced memory footprint and better resource utilization

## Improved Logging (v3.0.1+)

Version 3.0.1 introduces semantic console logging for better debugging and monitoring:

### Console Method Usage
- **`console.log()`**: General information, status updates, and normal operations
- **`console.warn()`**: Warnings, non-critical issues, and situations needing attention  
- **`console.error()`**: Errors, failures, and critical problems

### Benefits
- **Better Filtering**: Enhanced filtering capabilities in debugging tools
- **Semantic Clarity**: Clear distinction between information, warnings, and errors
- **Standard API**: Uses standard JavaScript console API instead of GNOME-specific `log()`
- **Improved Debugging**: Better integration with browser developer tools and system journals

### Viewing Logs
```bash
# View all extension logs
journalctl -f -o cat /usr/bin/gnome-shell | grep "Gnoming Profiles"

# Filter by log level (errors only)
journalctl -f -o cat /usr/bin/gnome-shell | grep -E "(ERROR|error)"

# Filter by component
journalctl -f -o cat /usr/bin/gnome-shell | grep "GitHubProvider"
journalctl -f -o cat /usr/bin/gnome-shell | grep "NextcloudProvider"
journalctl -f -o cat /usr/bin/gnome-shell | grep "GoogleDriveProvider"
journalctl -f -o cat /usr/bin/gnome-shell | grep "Wallpaper Manager"
```

## Setup

Open extension preferences, select your storage provider, and configure its credentials:

### GitHub
1. Create a private GitHub repository for your configs
2. Generate a Personal Access Token with `repo` permissions
3. Enter your GitHub username, repository name, and token

### Nextcloud / WebDAV
1. Generate an App Password in your Nextcloud security settings
2. Enter your Nextcloud server URL, username, and app password
3. Optionally change the sync folder name (default: `.gnoming-profiles`)

### Google Drive
1. Add your Google account in **GNOME Settings > Online Accounts**
2. Ensure **Files** is enabled for the account
3. Select the account in the extension preferences dropdown
4. Optionally change the Drive folder name (default: `.gnoming-profiles`)

### Common Settings
- Which GSettings schemas to monitor and sync
- Which files to monitor and sync
- Change monitoring and polling settings

## Sync Modes

### Session-based Sync
- **Login Sync**: Automatically restore configuration when logging in
- **Logout Sync**: Automatically backup configuration when logging out

### Change-based Sync
- **File Monitoring**: Watches configured files for changes in real-time
- **GSettings Monitoring**: Monitors GSettings schemas for any changes
- **Smart Debouncing**: Configurable delay (1-300 seconds) to prevent excessive syncing
- **Remote Change Detection**: Separate polling section to detect and apply changes from other devices

### Remote Polling
- **Efficient Remote Change Detection**: Uses ETags (GitHub/Nextcloud) or modifiedTime (Google Drive)
- **304 Not Modified Support**: Only processes data when changes actually exist
- **Reduced API Usage**: Conditional requests minimise bandwidth and rate limit consumption
- **Smart Caching**: ETags/timestamps cached in memory for the extension session
- **Configurable Interval**: Poll every 1-1440 minutes (default: 5 minutes)
- **Auto-sync Remote**: Automatically download and apply remote changes
- **Manual Pull**: Option to manually pull remote changes from the panel menu

### Manual Sync
- Click the panel indicator and select "Sync Now"
- Performs both backup and restore operations

## Performance Features

### **Conditional Polling**
- **ETag-Based**: GitHub and Nextcloud use If-None-Match headers for 304 responses
- **modifiedTime-Based**: Google Drive compares file timestamps for change detection
- **Bandwidth Savings**: Up to 95% reduction in data transfer during polling
- **Rate Limit Efficiency**: Conditional requests minimise API rate limit consumption
- **Real-time Status**: Panel menu shows polling status and cache state

### **Batch Uploading**
- **GitHub**: Tree API batches all file changes into a single atomic commit
- **Nextcloud**: Sequential WebDAV PUT with automatic directory creation
- **Google Drive**: Multipart upload with path-to-ID resolution and folder caching
- **Atomic Operations**: All changes succeed or fail together (GitHub)

### **Request Queue Management**
- **Concurrency Control**: Maximum 3 simultaneous API requests
- **Queue Status**: Real-time display of pending and active requests in panel menu
- **Error Isolation**: Failed requests don't block the entire queue
- **Resource Management**: Prevents API rate limiting and connection exhaustion

### **Smart Caching System**
- **Content Hash Caching**: SHA-256 hashing to detect actual content changes
- **Skip Unchanged Files**: Only upload files that have actually changed
- **Path-to-ID Cache**: Google Drive caches folder/file ID mappings to reduce API calls
- **Session Persistence**: All caches persist during extension lifetime

### **Binary-Safe Downloads**
- **Proper Binary Handling**: Wallpapers downloaded without corruption across all providers
- **Header Validation**: JPEG/PNG header verification to detect corruption
- **File Integrity**: Binary data preserved throughout download process
- **Error Detection**: Early detection of corrupted downloads

## Panel Menu Interface

The extension features a clean, organized panel menu with logical sections:

1. **Extension Header**: "Gnoming Profiles" title for clear identification
2. **Status Section**: 
   - Last sync timestamp
   - Change monitoring status (files/schemas count)
   - Remote polling status (interval) with ETag/modifiedTime indicator
   - Request queue status (pending/active requests)
   - Polling status (cached/changes detected/304 responses)
   - Pull Remote Changes (when available)
3. **Action Section**:
   - Sync Now
   - Settings

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

Wallpaper syncing is **disabled by default** but can be enabled in preferences. When enabled, the extension automatically detects and syncs your desktop and lock screen wallpapers with full binary integrity (v3.0+).

### **Enable Wallpaper Syncing**
1. Open extension preferences
2. Go to "Content" tab  
3. Enable "Sync Wallpapers" toggle
4. Wallpaper schemas are automatically added to monitoring

### **What Gets Synced**
- **Desktop wallpaper**: From `org.gnome.desktop.background` settings
- **Lock screen wallpaper**: From `org.gnome.desktop.screensaver` settings  
- **Wallpaper files**: The actual image files are uploaded to your storage provider
- **Dark mode wallpapers**: Separate wallpapers for light/dark themes

### **How It Works**
1. **Detection**: Extension reads wallpaper paths from GSettings
2. **Backup**: Wallpaper image files are encoded and uploaded to your storage provider
3. **Restore**: Files are downloaded to `~/.local/share/gnoming-profiles/wallpapers/`
4. **Update**: GSettings are updated to point to the restored wallpaper files

### **Binary-Safe Performance in v3.0**
- **Corruption-Free Downloads**: Proper binary handling prevents file corruption
- **Header Validation**: JPEG (0xFF 0xD8 0xFF) and PNG header verification
- **File Integrity Checks**: Downloaded files are validated for correctness
- **Error Detection**: Early detection of corrupt or incomplete downloads
- **Batched Upload**: Wallpapers are uploaded together with other files in single commits
- **On-Demand Loading**: Wallpaper content is loaded only when needed, reducing memory usage
- **Content Caching**: SHA-based detection prevents re-uploading unchanged wallpapers
- **Smart Validation**: Automatically skips missing, empty, or oversized files (50MB+ limit)
- **Content Type Checking**: Validates files are actually images before syncing
- **Graceful Error Handling**: Missing wallpapers don't break the sync process

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
- **Sync Time**: Large wallpapers may increase sync duration (mitigated by batching)
- **Storage**: Uses more remote storage space
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
- **Remote Change Detection**: Separate polling section handles downloading changes from other devices

### Wallpaper Syncing Settings
- **Sync Wallpapers**: Enable/disable wallpaper image syncing (default: disabled)
- **Binary Integrity**: Automatic corruption detection and validation
- **Automatic Schema Addition**: Wallpaper schemas added automatically when enabled
- **Storage Location**: Wallpapers restored to `~/.local/share/gnoming-profiles/wallpapers/`
- **Remote Storage**: Wallpapers uploaded to `wallpapers/` folder in remote storage

### Remote Polling Settings
- **Enable Remote Polling**: Turn on/off remote change detection
- **Polling Interval**: How often to check remote (1-1440 minutes, default: 5)
- **Auto-sync Remote Changes**: Automatically apply remote changes when detected
- **Manual Pull Option**: Always available in panel menu when remote changes detected
- **ETag/modifiedTime Caching**: Automatic caching for efficient conditional requests

### Advanced Features
- **File Type Detection**: Automatically skips binary files
- **Directory Creation**: Creates parent directories as needed when restoring
- **Error Recovery**: Robust error handling with detailed logging
- **Visual Indicators**: Panel icon changes to show sync and monitoring status
- **Request Queue Monitoring**: Real-time visibility into API request status
- **Polling Status Display**: Shows current cache state and polling efficiency
- **Binary Validation**: Header validation and corruption detection for image files
- **Memory Management**: Comprehensive timer and resource cleanup
- **Semantic Logging**: Clear logging with console.log/warn/error methods

## Panel Indicator States

- **Default**: Static user icon (monitoring/polling disabled or no activity)
- **Monitoring Active**: Subtle green glow (change monitoring or remote polling enabled)
- **Syncing**: Animated blue pulsing with rotating icons
- **Change Detected**: Brief orange flash when local changes are detected
- **Remote Changes**: Purple pulsing when remote changes are available (shows "Pull Changes" menu item)
- **ETag Cached**: Indicates efficient polling with cached ETags

## Remote Storage Structure

Regardless of provider (GitHub repo, Nextcloud folder, or Google Drive folder), your synced data is organised as:

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

- **Private Storage**: GitHub uses private repos; Nextcloud and Google Drive use your own account
- **Encrypted Credential Storage**: Tokens and passwords stored encrypted by GNOME GSettings
- **Minimal Permissions**: GitHub uses `repo` scope; Google Drive uses system-managed GOA tokens
- **GNOME Online Accounts**: Google Drive authentication managed securely by the system — no manual credentials required
- **Selective Sync**: Only configured schemas and files are monitored and synced
- **Text-only**: Binary files are automatically detected and skipped (except wallpapers)
- **Polling Cache Security**: ETags and timestamps stored in memory only (not persisted to disk)
- **Binary Integrity**: Wallpaper files validated for corruption
- **Resource Security**: Proper cleanup of tokens, sessions, and caches on extension disable

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

## Remote Polling Details

### How Polling Works
Each provider uses the most efficient change detection mechanism available:
- **GitHub / Nextcloud**: ETag-based conditional requests (`If-None-Match` header → 304 Not Modified)
- **Google Drive**: `modifiedTime` comparison on `config-backup.json`

### Benefits
- **Bandwidth Efficiency**: Up to 95% reduction in data transfer during polling
- **Rate Limit Savings**: Conditional requests minimise API rate limit consumption
- **Faster Responses**: 304 / "no change" responses are much quicker than full data transfers
- **Battery Life**: Lower network activity improves battery life on laptops

## Performance Considerations

- **Minimal Resource Usage**: Uses efficient GNOME APIs for monitoring
- **Debounced Syncing**: Prevents excessive network requests
- **Selective Monitoring**: Only watches explicitly configured items
- **Automatic Cleanup**: All monitors properly cleaned up when extension disabled
- **Batched Operations**: Multiple file changes uploaded atomically
- **Request Queuing**: Intelligent concurrency control prevents API overload
- **Smart Caching**: Content-based change detection avoids unnecessary uploads
- **Conditional Polling**: ETag / modifiedTime requests minimise unnecessary data transfer
- **Binary-Safe Processing**: Wallpapers handled without corruption across all providers
- **Path-to-ID Caching**: Google Drive file ID lookups are cached to reduce API calls

## Troubleshooting

### Debugging with Modular Logs
The modular architecture provides detailed logging from each component:
```bash
# View all extension logs
journalctl -f -o cat /usr/bin/gnome-shell | grep "Gnoming Profiles"

# Filter by log level (v3.0.1+)
journalctl -f -o cat /usr/bin/gnome-shell | grep -E "ERROR"  # Errors only
journalctl -f -o cat /usr/bin/gnome-shell | grep -E "WARN"   # Warnings only

# Filter by specific modules
journalctl -f -o cat /usr/bin/gnome-shell | grep "GitHubProvider"
journalctl -f -o cat /usr/bin/gnome-shell | grep "NextcloudProvider"
journalctl -f -o cat /usr/bin/gnome-shell | grep "GoogleDriveProvider"
journalctl -f -o cat /usr/bin/gnome-shell | grep "Sync Manager"
journalctl -f -o cat /usr/bin/gnome-shell | grep "Wallpaper Manager"
```

### Change Monitoring Not Working
1. Check that "Auto-sync on Changes" is enabled in preferences
2. Verify that your files and schemas are properly configured
3. Check the GNOME Shell logs: `journalctl -f -o cat /usr/bin/gnome-shell`
4. Try toggling change monitoring off and on in preferences

### Remote Polling Issues
1. Check the polling status in the panel menu
2. Verify credentials are properly configured for your chosen provider
3. Ensure polling is enabled in preferences
4. Check network connectivity to your storage provider
5. Review polling interval (too frequent may hit rate limits on GitHub)
6. For Google Drive: ensure your Google account is properly configured in GNOME Online Accounts with Files enabled

### Google Drive Authorization Issues
1. **No Google accounts found**: Add your Google account in GNOME Settings > Online Accounts
2. **"Files disabled" warning**: Enable the "Files" toggle for your Google account in GNOME Settings > Online Accounts
3. **Authentication errors**: Remove and re-add your Google account in GNOME Settings > Online Accounts
4. **Multiple accounts**: Select the correct account from the dropdown in extension preferences

### Empty config-backup.json or 0 Schemas Detected
1. Use the **"Initialize Sync"** button in Preferences → Sync tab
2. This will force creation of an initial backup with all available schemas
3. Check the logs to see which schemas are being detected
4. Verify provider credentials are configured before initializing
5. Check panel menu to see schema count after initialization

### Remote Changes Not Detected
1. Verify changes were actually made in remote storage
2. Check that config files (config-backup.json or files/*) were modified
3. Ensure polling interval has elapsed since the change
4. Try manual "Sync Now" to test connectivity
5. For GitHub/Nextcloud: check ETag status — "Not cached" may indicate polling issues
6. For Google Drive: check modifiedTime polling status

### Excessive API Usage
1. Enable polling for efficient conditional requests (ETags / modifiedTime)
2. Increase the "Change Sync Delay" in preferences
3. Review your monitored files list for rapidly-changing files
4. Review remote polling interval to reduce API calls

### Files Not Syncing
1. Ensure files exist and are readable
2. Check file paths use correct syntax (~ for home directory)
3. Binary files are automatically skipped (except wallpapers)
4. Parent directories must be accessible
5. Check request queue status for upload issues

## Requirements

- GNOME Shell 45+
- **GNOME Online Accounts GIR** (`gir1.2-goa-1.0`) — required for Google Drive support
- One of the following storage backends:
  - **GitHub**: Account with a private repository and Personal Access Token (`repo` scope)
  - **Nextcloud**: Server with WebDAV access and an App Password
  - **Google Drive**: Google account configured in GNOME Online Accounts with "Files" enabled
- Write access to monitored configuration files

**Note**: Ubuntu-specific schemas (ubuntu-dock, ubuntu-appindicators, etc.) are only synced when the corresponding extensions are installed and active. The extension gracefully handles missing schemas without errors.

## Bug Reporting

Bugs should be reported to the Github bug tracker [https://github.com/gavindi/gnoming-profiles/issues](https://github.com/gavindi/gnoming-profiles/issues).

When reporting issues, please include:
- GNOME Shell version
- Extension version
- Storage provider in use (GitHub, Nextcloud, or Google Drive)
- Monitored files and schemas list
- Polling status from panel menu
- GNOME Shell logs showing the issue (filtered by console level if possible)

## License

Gnoming Profiles GNOME Shell extension is distributed under the terms of the GNU General Public License, version 2. See the LICENSE file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.