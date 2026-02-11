<img src="https://github.com/gavindi/gnoming-profiles/blob/dev/icons/system-switch-user-symbolic.svg" alt="logo" width="64" />

# Gnoming Profiles Extension
![screenshot](https://github.com/gavindi/gnoming-profiles/blob/master/media/GnomingProfilesScreenshot.png)

A GNOME Shell extension that automatically syncs your gsettings and configuration files to a private GitHub repository with real-time change monitoring, high-performance batch uploading, intelligent ETag-based polling, binary-safe wallpaper syncing, enhanced timer and memory management, and a modular architecture for enhanced maintainability.

## Features

- **Automatic Sync**: Backup on logout, restore on login
- **Real-time Change Monitoring**: Automatically sync when files or settings change
- **ETag-Based GitHub Polling**: Efficient change detection with minimal bandwidth usage (v2.9+)
- **Binary-Safe Wallpaper Syncing**: Corruption-free wallpaper sync with header validation (v3.0+)
- **Enhanced Memory Management**: Proper timer and resource cleanup (v3.0+)
- **Improved Logging**: Semantic console logging with console.log/warn/error for better debugging (v3.0.1+)
- **High-Performance Batching**: Upload multiple files in single commits using GitHub Tree API (v2.9+)
- **Request Queue Management**: Intelligent concurrency limits and queue management (v2.9+)
- **Smart Caching**: SHA-based caching to avoid unnecessary uploads (v2.9+)
- **Modular Architecture**: Clean separation of concerns for better maintainability (v2.9+)
- **GSettings Support**: Monitor and sync any GSettings schema in real-time
- **Multitasking & Workspaces**: Full sync of GNOME workspace and window management settings
- **Ubuntu Desktop Support**: Automatic sync of Ubuntu-specific desktop extensions and settings
- **Wallpaper Sync**: Optionally sync desktop and lock screen wallpapers with binary integrity
- **File Monitoring**: Watch configuration files for changes and sync automatically
- **Smart Debouncing**: Configurable delay to prevent excessive syncing
- **Private Repository**: Uses GitHub private repositories for security
- **Manual Sync**: Trigger sync manually from the panel indicator
- **Visual Feedback**: Panel indicator shows sync status and monitoring state
- **Organized Menu**: Clean, intuitive panel menu with logical sections

## Demo
[![Demo](https://i9.ytimg.com/vi_webp/6QftnXT5tCo/mq2.webp?sqp=CKT5u8MG&rs=AOn4CLApGxIz13UaU9JNbf4Heg9dnjK0VQ)](https://youtu.be/6QftnXT5tCo)

## Installation

1. Clone or download this extension
2. Run `make install` to install to your local extensions directory
3. Enable the extension using GNOME Extensions app or:
   ```bash
   gnome-extensions enable gnoming-profiles@gavindi.github.com
   ```

## Modular Architecture (v2.9+)

The extension features a completely modular architecture with clean separation of concerns:

### Core Modules
- **RequestQueue**: Manages GitHub API concurrency and rate limiting
- **ETagManager**: Handles ETag caching for bandwidth-efficient polling  
- **GitHubAPI**: GitHub integration with ETag support, Tree API batching, and binary-safe downloads (v3.0+)
- **SyncManager**: Coordinates all backup/restore operations

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
journalctl -f -o cat /usr/bin/gnome-shell | grep "GitHub API"
journalctl -f -o cat /usr/bin/gnome-shell | grep "Wallpaper Manager"
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

### ETag-Based GitHub Polling (v2.9+)
- **Efficient Remote Change Detection**: Uses HTTP ETags for bandwidth-efficient polling
- **304 Not Modified Support**: Only processes data when changes actually exist
- **Reduced API Usage**: Dramatically reduces GitHub API rate limit consumption
- **Smart Caching**: ETags cached in memory for the extension session
- **Configurable Interval**: Poll every 1-1440 minutes (default: 15 minutes)
- **Auto-sync Remote**: Automatically download and apply remote changes
- **Manual Pull**: Option to manually pull remote changes from the panel menu

### Manual Sync
- Click the panel indicator and select "Sync Now"
- Performs both backup and restore operations

## Performance Features (v2.9+)

### **ETag-Based Polling**
- **Conditional HTTP Requests**: Uses If-None-Match headers for efficient polling
- **304 Not Modified Responses**: GitHub returns minimal data when no changes exist
- **Bandwidth Savings**: Up to 95% reduction in data transfer during polling
- **Rate Limit Efficiency**: Conditional requests often don't count against API limits
- **Real-time Status**: Panel menu shows ETag polling status and cache state

### **GitHub Tree API Batching**
- **Single Commit Uploads**: All file changes are batched into a single commit
- **Reduced API Calls**: Up to 90% fewer GitHub API requests
- **Atomic Operations**: All changes succeed or fail together
- **Better Git History**: Clean commit history with meaningful batch messages

### **Request Queue Management**
- **Concurrency Control**: Maximum 3 simultaneous GitHub API requests
- **Queue Status**: Real-time display of pending and active requests in panel menu
- **Error Isolation**: Failed requests don't block the entire queue
- **Resource Management**: Prevents API rate limiting and connection exhaustion

### **Smart Caching System**
- **Content Hash Caching**: SHA-256 hashing to detect actual content changes
- **Skip Unchanged Files**: Only upload files that have actually changed
- **Session Persistence**: Cache persists during extension lifetime
- **Memory Efficiency**: Reduced memory usage for large configuration sets

### **HTTP Session Reuse**
- **Connection Pooling**: Reuses HTTP connections for better performance
- **Reduced Latency**: Faster subsequent requests to GitHub API
- **Resource Efficiency**: Lower network overhead and connection setup time

### **Binary-Safe Downloads (v3.0+)**
- **Proper Binary Handling**: Wallpapers downloaded without corruption
- **Header Validation**: JPEG/PNG header verification to detect corruption
- **File Integrity**: Binary data preserved throughout download process
- **Error Detection**: Early detection of corrupted downloads

### **Enhanced Resource Management (v3.0+)**
- **Timer Cleanup**: All timeouts properly tracked and removed
- **Memory Management**: Comprehensive reference nullification
- **Component Lifecycle**: Proper initialization and destruction
- **Error Recovery**: Better cleanup during error conditions

### **Improved Logging (v3.0.1+)**
- **Semantic Logging**: Clear distinction between info, warnings, and errors
- **Better Debugging**: Enhanced filtering and monitoring capabilities
- **Standard API**: Uses JavaScript console methods for better tool integration

## Panel Menu Interface

The extension features a clean, organized panel menu with logical sections:

1. **Extension Header**: "Gnoming Profiles" title for clear identification
2. **Status Section**: 
   - Last sync timestamp
   - Change monitoring status (files/schemas count)
   - GitHub polling status (interval) with ETag indicator
   - Request queue status (pending/active requests)
   - ETag polling status (cached/changes detected/304 responses)
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
- **Wallpaper files**: The actual image files are uploaded to GitHub
- **Dark mode wallpapers**: Separate wallpapers for light/dark themes

### **How It Works**
1. **Detection**: Extension reads wallpaper paths from GSettings
2. **Backup**: Wallpaper image files are encoded and uploaded to GitHub (batched in v2.9+)
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
- **Sync Time**: Large wallpapers may increase sync duration (mitigated by batching in v2.9+)
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
- **Binary Integrity**: Automatic corruption detection and validation (v3.0+)
- **Automatic Schema Addition**: Wallpaper schemas added automatically when enabled
- **Storage Location**: Wallpapers restored to `~/.local/share/gnoming-profiles/wallpapers/`
- **Repository Storage**: Wallpapers uploaded to `wallpapers/` folder in GitHub repo

### ETag-Based GitHub Polling Settings (v2.9+)
- **Enable GitHub Polling**: Turn on/off ETag-based remote change detection
- **Polling Interval**: How often to check GitHub (1-1440 minutes, default: 15)
- **Auto-sync Remote Changes**: Automatically apply remote changes when detected
- **Manual Pull Option**: Always available in panel menu when remote changes detected
- **ETag Caching**: Automatic caching of ETags for efficient conditional requests
- **304 Handling**: Intelligent handling of "Not Modified" responses

### Advanced Features
- **File Type Detection**: Automatically skips binary files
- **Directory Creation**: Creates parent directories as needed when restoring
- **Error Recovery**: Robust error handling with detailed logging
- **Visual Indicators**: Panel icon changes to show sync and monitoring status
- **Request Queue Monitoring**: Real-time visibility into GitHub API request status (v2.9+)
- **ETag Status Display**: Shows current ETag cache state and polling efficiency (v2.9+)
- **Binary Validation**: Header validation and corruption detection for image files (v3.0+)
- **Memory Management**: Comprehensive timer and resource cleanup (v3.0+)
- **Semantic Logging**: Clear logging with console.log/warn/error methods (v3.0.1+)

## Panel Indicator States

- **Default**: Static user icon (monitoring/polling disabled or no activity)
- **Monitoring Active**: Subtle green glow (change monitoring or GitHub polling enabled)
- **Syncing**: Animated blue pulsing with rotating icons
- **Change Detected**: Brief orange flash when local changes are detected
- **Remote Changes**: Purple pulsing when remote changes are available (shows "Pull Changes" menu item)
- **ETag Cached**: Indicates efficient polling with cached ETags

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
  my-wallpaper.jpg          # Desktop wallpaper files (binary-safe v3.0+)
  lock-screen.png           # Lock screen wallpaper files
```

## Security Features

- **Private Repositories**: Only works with private GitHub repositories
- **Encrypted Storage**: Personal access tokens stored encrypted by GNOME
- **Selective Sync**: Only configured schemas and files are monitored and synced
- **Text-only**: Binary files are automatically detected and skipped (except wallpapers)
- **Permission Control**: Uses minimal GitHub API permissions (repo scope only)
- **ETag Security**: ETags stored in memory only (not persisted to disk)
- **Binary Integrity**: Wallpaper files validated for corruption (v3.0+)
- **Resource Security**: Proper cleanup prevents information leakage (v3.0+)

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

## ETag Polling Details (v2.9+)

### How ETag Polling Works
- **Initial Request**: Extension makes normal GitHub API request, stores returned ETag
- **Subsequent Requests**: Include `If-None-Match: <etag>` header
- **304 Response**: GitHub returns "Not Modified" when content unchanged (minimal data transfer)
- **Change Detection**: Only when ETag differs does GitHub return full data
- **Cache Management**: ETags stored in memory during extension session

### Benefits of ETag Polling
- **Bandwidth Efficiency**: Up to 95% reduction in data transfer during polling
- **Rate Limit Savings**: Conditional requests often don't count against API limits
- **Faster Responses**: 304 responses are much quicker than full data transfers
- **Resource Conservation**: Reduces server load and network traffic
- **Battery Life**: Lower network activity improves battery life on laptops

### ETag Status Indicators
- **Not Cached**: First poll or no ETag available
- **Cached**: ETag stored, ready for efficient polling
- **No Changes (304)**: Last poll returned "Not Modified"
- **Changes Detected**: Content changed, new ETag cached

## Performance Considerations

- **Minimal Resource Usage**: Uses efficient GNOME APIs for monitoring
- **Debounced Syncing**: Prevents excessive network requests
- **Selective Monitoring**: Only watches explicitly configured items
- **Automatic Cleanup**: All monitors properly cleaned up when extension disabled (v3.0+)
- **Batched Operations**: Multiple file changes uploaded in single commits (v2.9+)
- **Request Queuing**: Intelligent concurrency control prevents API overload (v2.9+)
- **Smart Caching**: Content-based change detection avoids unnecessary uploads (v2.9+)
- **ETag Efficiency**: Conditional requests minimize unnecessary data transfer (v2.9+)
- **Binary-Safe Processing**: Wallpapers handled without corruption (v3.0+)
- **Memory Management**: Comprehensive timer and resource cleanup (v3.0+)
- **Semantic Logging**: Better debugging with console.log/warn/error (v3.0.1+)

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
journalctl -f -o cat /usr/bin/gnome-shell | grep "GitHub API"
journalctl -f -o cat /usr/bin/gnome-shell | grep "Sync Manager"
journalctl -f -o cat /usr/bin/gnome-shell | grep "ETag Manager"
journalctl -f -o cat /usr/bin/gnome-shell | grep "Wallpaper Manager"
```

### Change Monitoring Not Working
1. Check that "Auto-sync on Changes" is enabled in preferences
2. Verify that your files and schemas are properly configured
3. Check the GNOME Shell logs: `journalctl -f -o cat /usr/bin/gnome-shell`
4. Try toggling change monitoring off and on in preferences

### ETag Polling Issues (v2.9+)
1. Check the "ETag polling" status in the panel menu
2. "Not cached" indicates first poll or ETag unavailable
3. "No changes (304)" shows efficient polling is working
4. High polling frequency may still hit rate limits despite ETags
5. Check network connectivity if ETag status shows errors

### GitHub Polling Issues
1. Check that GitHub credentials are properly configured
2. Ensure repository exists and is accessible with your token
3. Verify polling is enabled in preferences
4. Check network connectivity to GitHub
5. Review polling interval (too frequent may hit rate limits)
6. Look for "GitHub polling" status in panel menu

### Request Queue Issues (v2.9+)
1. Check the "Request queue" status in the panel menu
2. High pending counts may indicate network issues
3. Multiple active requests show the queue is working properly
4. If queue appears stuck, try disabling/re-enabling the extension

### Empty config-backup.json or 0 Schemas Detected
1. Use the **"Initialize Sync"** button in Preferences → Sync tab
2. This will force creation of an initial backup with all available schemas
3. Check the logs to see which schemas are being detected
4. Verify GitHub credentials are configured before initializing
5. Check panel menu to see schema count after initialization

### Remote Changes Not Detected
1. Verify changes were actually committed to the repository
2. Check that config files (config-backup.json or files/*) were modified
3. Ensure polling interval has elapsed since the change
4. Try manual "Sync Now" to test connectivity
5. Check ETag status - "Not cached" may indicate polling issues

### Wallpaper Corruption Issues (v3.0+ FIXED)
1. **Corrupted wallpapers**: Fixed in v3.0 with proper binary handling
2. **"Not a JPEG file" errors**: Fixed - wallpapers now download without corruption
3. **Invalid headers**: v3.0 validates JPEG/PNG headers and reports corruption
4. **File integrity**: Downloaded files are now verified for correctness
5. **Empty files**: Zero-byte wallpaper files are automatically skipped and reported
6. **Large files**: Files over 50MB are automatically skipped; over 10MB show warnings

### Memory and Performance Issues (v3.0+ IMPROVED)
1. **Memory leaks**: Fixed - all timers and references are properly cleaned up
2. **High memory usage**: Improved - better resource management and cleanup
3. **Extension won't disable**: Fixed - proper lifecycle management
4. **Timeouts not clearing**: Fixed - comprehensive timeout tracking and cleanup
5. **Resource exhaustion**: Improved - better component isolation and cleanup

### Logging and Debugging Issues (v3.0.1+ IMPROVED)
1. **Better log filtering**: Use console methods for clearer debugging
2. **Semantic clarity**: Distinguish between info, warnings, and errors
3. **Standard tools**: Works better with browser developer tools
4. **Enhanced monitoring**: Better integration with system logging tools

### Excessive GitHub API Usage
1. Enable ETag polling for dramatically reduced API usage (v2.9+)
2. Increase the "Change Sync Delay" in preferences
3. Review your monitored files list for rapidly-changing files
4. Consider using "Backup Only" sync direction for change monitoring
5. v2.9+ automatically reduces API usage through batching, caching, and ETags

### Files Not Syncing
1. Ensure files exist and are readable
2. Check file paths use correct syntax (~ for home directory)
3. Binary files are automatically skipped (except wallpapers)
4. Parent directories must be accessible
5. Check request queue status for upload issues (v2.9+)

## Requirements

- GNOME Shell 45+
- GitHub account with private repository
- Personal access token with repo permissions
- Write access to monitored configuration files

**Note**: Ubuntu-specific schemas (ubuntu-dock, ubuntu-appindicators, etc.) are only synced when the corresponding extensions are installed and active. The extension gracefully handles missing schemas without errors.

## Bug Reporting

Bugs should be reported to the Github bug tracker [https://github.com/gavindi/gnoming-profiles/issues](https://github.com/gavindi/gnoming-profiles/issues).

When reporting issues with change monitoring, ETag polling, or wallpaper syncing, please include:
- GNOME Shell version
- Extension version
- Monitored files and schemas list
- ETag polling status from panel menu
- GNOME Shell logs showing the issue (filtered by console level if possible - v3.0.1+)
- For wallpaper issues: output of wallpaper validation diagnostic

## License

Gnoming Profiles GNOME Shell extension is distributed under the terms of the GNU General Public License, version 2. See the LICENSE file for details.

## Changelog

### v3.0.4 (Current)
- **FIXED: Default Branch Detection**: Auto-detect repository default branch instead of hardcoding "main"
  - Repos using "master" or any other default branch name now work correctly
  - Added `getDefaultBranch()` method to GitHubAPI with per-session caching
  - No extra API overhead — branch name is fetched once and cached for the session

### v3.0.3
- **ADDED: GNOME Shell 49 support**

### v3.0.2
- **REFACTOR: Code Cleanup**: Removed 27 unused functions and methods for improved maintainability
  - **Utils Class**: Removed 15 unused utility functions including validation, formatting, and helper methods
    - Removed: `expandPath()`, `generateContentHash()`, `isBinaryFile()`, `safeJsonParse()`, `safeJsonStringify()`
    - Removed: `debounce()`, `throttle()`, `formatDuration()`, validation functions, and retry logic
  - **Diagnostic Methods**: Removed 11 unused diagnostic and debug methods across modules
    - **ETagManager**: Removed `getStats()` diagnostic method
    - **FileMonitor**: Removed `isMonitoring()`, `getStatus()` diagnostic methods
    - **SettingsMonitor**: Removed `getMonitoredSchemas()`, `getMonitorCount()`, `isMonitoring()`, `getStatus()`
    - **WallpaperManager**: Removed `validateDownloadedWallpapers()`, `validateWallpapers()`, `debugWallpaperState()`, `getStatus()`
  - **Status/Accessor Methods**: Removed 3 unused getter and utility methods
    - **SyncManager**: Removed `isSyncing` getter, `queuedCount` getter
    - **PanelIndicator**: Removed `getMenuItems()`, `addIconClass()`, `removeIconClass()`
- **FIXED: Sync Timeout Management**: Enhanced timeout handling in SyncManager restore operations
  - **SyncManager**: Fixed potential timeout accumulation in `restoreBackup()` method
  - Ensures existing monitoring restore timeout is cleared before creating new one
  - Prevents multiple overlapping timeouts when restore operations are called repeatedly
  - Improved resource cleanup and prevents potential memory leaks from timeout accumulation
- **IMPROVED: Magic Numbers Elimination**: Replaced hardcoded values with named constants
  - **Extension**: Added timing constants for status updates, debouncing, and HTTP status codes
  - **SyncManager**: Added constants for queue processing delays and HTTP status codes
  - **PanelIndicator**: Added constants for animation intervals and display timeouts
  - **Preferences**: Added constants for UI dimensions, delays, and configuration limits
  - Enhanced code readability and maintainability with self-documenting constant names
- **IMPROVED: Codebase Size**: Reduced overall codebase size by removing dead code
  - All core functionality preserved - only unused diagnostic and utility code removed
  - No files became empty - all modules retain their essential functionality
  - Improved code maintainability with cleaner, more focused modules
- **ENHANCED: Code Quality**: Better focus on production functionality
  - Eliminated unused validation functions that weren't being called
  - Removed debug methods that cluttered the public API
  - Streamlined module interfaces to essential functionality only

### v3.0.1
- **IMPROVED: Semantic Console Logging**: Replaced all `log()` calls with appropriate `console.*` methods
  - **`console.log()`**: General information, status updates, and normal operations
  - **`console.warn()`**: Warnings, non-critical issues, and situations needing attention
  - **`console.error()`**: Errors, failures, and critical problems
- **ENHANCED: Debugging Experience**: Better log filtering and semantic clarity
  - Enhanced filtering capabilities in debugging tools and system journals
  - Clear distinction between information, warnings, and errors
  - Better integration with browser developer tools
  - Improved monitoring with standard JavaScript console API
- **IMPROVED: Development Experience**: Better debugging capabilities for developers and users
  - Easier troubleshooting with semantic log levels
  - Enhanced compatibility with debugging tools
  - Clearer error reporting and issue diagnosis
- **FIXED: HTTP Session Cleanup**: Added proper `abort()` call in GitHubAPI cleanup
  - HTTP sessions now properly terminated during extension disable/cleanup
  - Prevents potential resource leaks from unclosed network connections
  - Improved extension lifecycle management with proper resource cleanup
- **FIXED: Timeout Management**: Enhanced timeout cleanup across all modules
  - **SyncManager**: Added proper cleanup for monitoring restore timeout
  - **Utils**: Enhanced debounce/throttle functions with `.cancel()` methods for cleanup
  - Prevents timeout-related memory leaks during extension disable/cleanup
  - Improved resource management and component lifecycle reliability

### v3.0 (Enhanced Memory Management)
- **CRITICAL FIX: Wallpaper Corruption Bug**: Complete rewrite of binary file handling
  - Fixed "Not a JPEG file: starts with 0xfd 0xfd" and similar corruption errors
  - Proper binary data handling throughout download process
  - Binary files no longer corrupted during GitHub download
  - Added comprehensive header validation for JPEG (0xFF 0xD8 0xFF) and PNG files
  - Wallpapers now download and display correctly without corruption
- **NEW: Binary-Safe Download System**: Enhanced GitHubAPI with proper binary support
  - New `downloadBinaryFile()` method for corruption-free binary downloads
  - Separate binary vs text handling in HTTP requests
  - Proper Uint8Array handling without string conversion
- **NEW: Wallpaper Validation System**: Comprehensive file integrity checking
  - JPEG and PNG header validation to detect corruption early
  - File size verification and integrity checks
  - Diagnostic tools to validate downloaded wallpapers
  - Clear error messages for corrupted or invalid files
- **ENHANCED: Error Detection**: Better reporting of wallpaper issues
  - Early detection of corrupt downloads with detailed error messages
  - File verification after download to ensure integrity
  - Comprehensive logging for troubleshooting wallpaper problems
- **IMPROVED: Wallpaper URI Management**: Fixed URI mapping bugs
  - Corrected wallpaper data lookup by filename instead of schema-key
  - Better fallback handling for missing wallpaper mappings
  - Improved GSettings URI updates to point to correct local files
- **ENHANCED: Timer and Memory Management**: Comprehensive resource cleanup
  - All GLib timeouts are properly tracked and removed
  - Active timeout tracking using Sets for reliable cleanup
  - Timeout IDs nullified after removal to prevent double cleanup
  - Proper reference nullification for all objects and data structures
  - Component-level destroy methods with proper cleanup phases
  - Session handler and monitor cleanup with error handling
  - Memory leak prevention and graceful shutdown capabilities
  - Better error recovery during cleanup operations
- **IMPROVED: Component Lifecycle Management**: Better initialization and destruction
  - Each module now has proper destroy() methods
  - Resources are cleaned up in the correct order
  - Error isolation prevents cleanup failures from affecting other components
  - Improved extension enable/disable reliability
- **ENHANCED: Preferences Timeout Management**: Safer timeout handling in UI
  - Active timeout tracking in preferences window
  - Proper cleanup when preferences window is destroyed
  - Safer button interaction patterns to prevent memory leaks
  - Better error handling in UI timeout operations
- **RELIABILITY**: Extension can now be safely disabled and re-enabled
  - Proper cleanup prevents resource leaks
  - Better memory management reduces footprint
  - Improved stability during GNOME Shell operations

### v2.9
- **NEW: Modular Architecture**: Complete code restructuring for better maintainability
  - 9 specialized modules with clear separation of concerns
  - Enhanced testability and debugging capabilities  
  - Improved performance through module specialization
  - Better error isolation and resource management
  - See `lib/README.md` for detailed module documentation
- **NEW: ETag-Based GitHub Polling**: Dramatically improved polling efficiency
  - Uses HTTP ETags for conditional requests (If-None-Match headers)
  - 304 Not Modified responses reduce bandwidth by up to 95%
  - Conditional requests often don't count against API rate limits
  - Real-time ETag status display in panel menu
- **NEW: GitHub Tree API Batching**: All file changes now uploaded in single commits
  - Dramatically reduced GitHub API calls (up to 90% fewer requests)
  - Atomic operations ensure all changes succeed or fail together
  - Cleaner Git history with meaningful batch commit messages
  - Better performance for large configuration sets
- **NEW: Request Queue Management**: Intelligent concurrency control for GitHub API
  - Maximum 3 simultaneous requests to prevent rate limiting
  - Real-time queue status display in panel menu
  - Smart error isolation prevents queue blocking
  - Better resource management and connection efficiency
- **NEW: Smart Caching System**: SHA-256 based content change detection
  - Skip uploads for files that haven't actually changed
  - Persistent cache during extension session
  - Significant reduction in unnecessary network traffic
  - Better performance for frequent change monitoring
- **NEW: HTTP Session Reuse**: Connection pooling for GitHub API requests
  - Reduced latency for subsequent API calls
  - Lower network overhead and connection setup time
  - More efficient resource usage
- **IMPROVED: Wallpaper Handling**: On-demand loading reduces memory usage
  - Wallpaper content loaded only when needed for upload
  - Better memory efficiency for large wallpaper files
  - Wallpapers included in batch commits for better organization
- **ENHANCED: Panel Menu**: Added ETag and request queue status displays
  - Real-time visibility into ETag polling efficiency
  - Real-time visibility into pending and active GitHub requests
  - Better user feedback during sync operations
  - ETag status helps diagnose polling performance
- **ARCHITECTURE**: Clean modular design improves maintainability
  - 9 specialized modules with single responsibilities
  - Clear dependency injection and interfaces
  - Comprehensive error handling and logging
  - Better separation of UI, business logic, and infrastructure
- **PERFORMANCE**: Overall sync speed improvements of 60-80% for typical use cases
- **EFFICIENCY**: Up to 95% reduction in bandwidth usage during polling
- **RELIABILITY**: Better error handling and recovery for network issues

### v2.8
- **NEW: Reorganized Panel Menu**: Improved app indicator menu structure
- Extension name now appears at the top of the menu for better branding
- Status information (sync status, monitoring, polling) grouped together in middle section
- Action items (Sync Now, Settings) moved to bottom for better organization
- Enhanced visual hierarchy with logical sections separated by dividers
- Improved user experience with cleaner, more intuitive menu layout
- **NEW: Sync Lock System**: Prevents concurrent sync operations and race conditions
- Centralized sync operation management with smart queueing for different operation types
- Enhanced user feedback with sync status indicators and disabled menu items during operations
- Robust error handling ensures sync lock is always properly released
- Eliminates GitHub API conflicts when multiple sync triggers occur simultaneously
- **FIXED: Session Handler Memory Leaks**: Proper cleanup of DBusProxy connections
- Session manager signals now properly disconnected when extension is disabled
- Improved extension lifecycle management prevents memory leaks during enable/disable cycles
- Enhanced error handling during session handler cleanup with detailed logging

### v2.7
- **UI Cleanup**: Removed "Test GitHub Polling" from panel menu
- **NEW: Initialize Sync Button**: Added "Initialize Sync" button in Preferences → Sync tab
- **Fixed Schema Detection**: Improved schema counting and availability detection
- **Enhanced Initial Sync**: Better handling of first-time setup and backup creation
- **Improved Logging**: More detailed logging for troubleshooting schema and sync issues
- Simplified menu interface for better user experience
- Cleaned up debugging options to focus on production features
- GitHub polling functionality remains available through automatic polling

### v2.6
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