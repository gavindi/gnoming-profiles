# Gnoming Profiles - Modular Architecture

This directory contains the modular components of the Gnoming Profiles extension, providing a clean separation of concerns and improved maintainability.

## Module Overview

### Storage Providers

#### `StorageProvider.js`
- **Purpose**: Abstract base class defining the storage backend interface
- **Features**:
  - Defines the contract for all storage providers (`uploadBatch`, `downloadFile`, `downloadBinaryFile`, `listDirectory`, `pollForChanges`)
  - Credential management (`getCredentials`, `hasValidCredentials`)
  - Change cache management (`clearChangeCache`)
- **Usage**: Extended by concrete providers (GitHubProvider, NextcloudProvider)

#### `GitHubProvider.js`
- **Purpose**: GitHub storage backend implementing StorageProvider
- **Features**:
  - Atomic batch uploads via GitHub Tree API (blobs → tree → commit → ref)
  - GitHub Content API downloads with base64 decoding
  - Binary file support via download URLs or base64 fallback
  - ETag-based polling via commits endpoint
  - Auto-detection of repository default branch
- **Dependencies**: GitHubAPI, StorageProvider

#### `NextcloudProvider.js`
- **Purpose**: Nextcloud/WebDAV storage backend implementing StorageProvider
- **Features**:
  - WebDAV file operations (PUT, GET, PROPFIND, MKCOL)
  - Basic auth with username and app password
  - Automatic directory creation via incremental MKCOL
  - PROPFIND XML parsing for directory listings
  - ETag-based change detection on config files
- **Dependencies**: StorageProvider
- **Usage**: Self-hosted alternative to GitHub using any WebDAV-compatible server

### Core Infrastructure

#### `RequestQueue.js`
- **Purpose**: Manages API request concurrency
- **Features**:
  - Configurable maximum concurrent requests (default: 3)
  - Queue management with automatic processing
  - Error isolation and cleanup
- **Usage**: Prevents API rate limiting and manages network resources

#### `ETagManager.js`
- **Purpose**: Handles ETag caching for efficient remote polling
- **Features**:
  - ETag storage and retrieval
  - Poll result tracking (304/changes/errors)
  - Cache management and cleanup
- **Usage**: Enables bandwidth-efficient conditional HTTP requests for all providers

#### `GitHubAPI.js`
- **Purpose**: Low-level GitHub REST API client
- **Features**:
  - ETag-based conditional requests
  - Tree API operations for batching
  - HTTP session reuse
  - Binary file download support (for wallpapers)
  - Comprehensive API coverage
- **Dependencies**: RequestQueue, ETagManager
- **Usage**: Used internally by GitHubProvider

### Monitoring Components

#### `FileMonitor.js`
- **Purpose**: File system monitoring for configuration files
- **Features**:
  - Real-time file change detection
  - Parent directory monitoring
  - Automatic monitor management
- **Usage**: Detects changes to user configuration files

#### `SettingsMonitor.js`
- **Purpose**: GSettings schema monitoring
- **Features**:
  - Schema availability checking
  - Change event handling
  - Temporary disable during restore operations
- **Usage**: Monitors GNOME settings for changes

### Management Components

#### `WallpaperManager.js`
- **Purpose**: Wallpaper syncing and management
- **Features**:
  - On-demand wallpaper loading
  - URI path updating and validation
  - Download and restoration with binary integrity
  - Comprehensive file validation (size, type, existence)
  - Graceful handling of missing or invalid files
- **Dependencies**: StorageProvider, Utils
- **Usage**: Handles wallpaper image syncing via the active storage provider

#### `SyncManager.js`
- **Purpose**: Coordinates all sync operations
- **Features**:
  - Provider-agnostic backup and restoration (`syncToRemote` / `syncFromRemote`)
  - Content hash caching
  - Sync operation locking
  - Backward-compatible shims for legacy method names
- **Dependencies**: StorageProvider, WallpaperManager, Settings, Utils
- **Usage**: Main sync logic coordinator

### User Interface

#### `PanelIndicator.js`
- **Purpose**: GNOME Shell panel indicator and menu
- **Features**:
  - Status display and animations
  - Menu organization and callbacks
  - Visual state management
- **Usage**: User interface for the extension

### Utilities

#### `Utils.js`
- **Purpose**: Common utility functions used across modules
- **Features**:
  - File path expansion and validation
  - Content hashing and binary detection
  - JSON parsing with error handling
  - Debouncing and throttling functions
  - Wallpaper file validation (size, type, URI parsing)
  - Retry logic and deep cloning
- **Usage**: Shared utilities to reduce code duplication

## Architecture Benefits

### Separation of Concerns
- Each module has a single, well-defined responsibility
- Clear interfaces between components
- Easier testing and debugging

### Maintainability
- Modular code is easier to understand and modify
- Changes to one component don't affect others
- Clear dependency relationships

### Reusability
- Modules can be reused or replaced independently
- Well-defined APIs enable component swapping
- Easier to add new features

### Performance
- Efficient resource management through specialized modules
- Request queuing prevents API overload
- ETag management reduces bandwidth usage

## Module Dependencies

```
extension.js (Main)
├── RequestQueue.js
├── ETagManager.js
├── StorageProvider.js (abstract base)
│   ├── GitHubProvider.js (depends on GitHubAPI)
│   │   └── GitHubAPI.js (depends on RequestQueue, ETagManager)
│   └── NextcloudProvider.js (standalone HTTP via Soup)
├── FileMonitor.js (uses Utils)
├── SettingsMonitor.js (uses Utils)
├── WallpaperManager.js (depends on StorageProvider, uses Utils)
├── SyncManager.js (depends on StorageProvider, WallpaperManager, Settings, uses Utils)
├── PanelIndicator.js
└── Utils.js (shared utilities)
```

## Key Design Patterns

### Strategy Pattern
StorageProvider defines a common interface; GitHubProvider and NextcloudProvider implement backend-specific logic. The active provider is selected at runtime and can be switched live.

### Dependency Injection
Components receive their dependencies through constructor parameters, making testing and mocking easier.

### Observer Pattern
File and settings monitors use callbacks to notify of changes, allowing loose coupling.

### Command Pattern
Sync operations are encapsulated as functions, enabling queuing and retry logic.

### Facade Pattern
GitHubAPI provides a simplified interface to complex GitHub operations.

## Error Handling

Each module implements comprehensive error handling:
- Graceful degradation when dependencies are unavailable
- Detailed logging for debugging
- Resource cleanup on errors
- Isolation of failures

## Performance Considerations

### Request Queue
- Limits concurrent API requests
- Prevents rate limiting
- Manages network resources efficiently

### ETag Manager
- Reduces bandwidth usage by up to 95%
- Enables frequent polling without performance impact
- Smart cache invalidation
- Works across all storage providers

### Content Caching
- SHA-256 based change detection
- Avoids unnecessary uploads
- Session-persistent caching

### On-Demand Loading
- Wallpapers loaded only when needed
- Reduces memory usage
- Improves startup performance

## Adding a New Storage Provider

1. Create a new class extending `StorageProvider`
2. Implement all required methods: `uploadBatch`, `downloadFile`, `downloadBinaryFile`, `listDirectory`, `pollForChanges`, `getCredentials`, `hasValidCredentials`, `clearChangeCache`
3. Add GSettings keys for provider-specific credentials
4. Register the provider in `extension.js` `_createStorageProvider()` factory
5. Add UI fields in `prefs.js` with show/hide logic based on provider selection
6. Update this documentation

## Debugging

Each module includes extensive logging:
- Use `journalctl -f -o cat /usr/bin/gnome-shell | grep "Gnoming Profiles"` to view logs
- Module names are included in log messages
- Error conditions are logged with full stack traces
- Status changes are logged for debugging

## Changelog

- **v3.3.0** — Nextcloud/WebDAV backend, StorageProvider abstraction, live provider switching
- **v3.0.4** — Auto-detect repository default branch instead of hardcoding "main"
- **v3.0.3** — Added GNOME Shell 49 support
- **v3.0.2** — Removed 42 unused functions/methods, template literal standardisation
- **v3.0.1** — Semantic console logging, HTTP session cleanup, timeout management
- **v3.0** — Critical wallpaper corruption fix, memory leak fixes, destroy methods
- **v2.9** — ETag-based polling, Tree API batching, request queue, smart caching
- **v2.8** — Panel menu reorganisation, schema recursion fix, initial sync option
- **v2.7** — Tabbed preferences, Ubuntu extension support, wallpaper folder separation