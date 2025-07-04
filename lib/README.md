# Gnoming Profiles - Modular Architecture

This directory contains the modular components of the Gnoming Profiles extension, providing a clean separation of concerns and improved maintainability.

## Module Overview

### Core Infrastructure

#### `RequestQueue.js`
- **Purpose**: Manages GitHub API request concurrency
- **Features**: 
  - Configurable maximum concurrent requests (default: 3)
  - Queue management with automatic processing
  - Error isolation and cleanup
- **Usage**: Prevents API rate limiting and manages network resources

#### `ETagManager.js`
- **Purpose**: Handles ETag caching for efficient GitHub polling
- **Features**:
  - ETag storage and retrieval
  - Poll result tracking (304/changes/errors)
  - Cache management and cleanup
- **Usage**: Enables bandwidth-efficient conditional HTTP requests

#### `GitHubAPI.js`
- **Purpose**: GitHub API integration with ETag support
- **Features**:
  - ETag-based conditional requests
  - Tree API operations for batching
  - HTTP session reuse
  - Binary file download support (for wallpapers)
  - Comprehensive API coverage
- **Dependencies**: RequestQueue, ETagManager

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
  - Dual download method support (API vs direct download)
  - Comprehensive file validation (size, type, existence)
  - Graceful handling of missing or invalid files
- **Dependencies**: GitHubAPI, Utils
- **Usage**: Handles wallpaper image syncing

#### `SyncManager.js`
- **Purpose**: Coordinates all sync operations
- **Features**:
  - Backup creation and restoration
  - GitHub Tree API batching
  - Content hash caching
  - Sync operation locking
- **Dependencies**: GitHubAPI, WallpaperManager, Settings
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
  - GitHub-specific validation helpers
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
├── GitHubAPI.js (depends on RequestQueue, ETagManager)
├── FileMonitor.js (uses Utils)
├── SettingsMonitor.js (uses Utils)
├── WallpaperManager.js (depends on GitHubAPI, uses Utils)
├── SyncManager.js (depends on GitHubAPI, WallpaperManager, Settings, uses Utils)
├── PanelIndicator.js
└── Utils.js (shared utilities)
```

## Key Design Patterns

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
- Limits concurrent GitHub API requests
- Prevents rate limiting
- Manages network resources efficiently

### ETag Manager
- Reduces bandwidth usage by up to 95%
- Enables frequent polling without performance impact
- Smart cache invalidation

### Content Caching
- SHA-256 based change detection
- Avoids unnecessary uploads
- Session-persistent caching

### On-Demand Loading
- Wallpapers loaded only when needed
- Reduces memory usage
- Improves startup performance

## Testing Strategy

The modular architecture enables several testing approaches:

### Unit Testing
Each module can be tested independently with mocked dependencies.

### Integration Testing
Module interactions can be tested with real or mock components.

### End-to-End Testing
Full extension functionality can be tested through the main extension class.

## Future Enhancements

The modular architecture makes it easy to add new features:

### New Sync Targets
- Additional cloud storage providers
- Different backup formats
- Multiple repository support

### Enhanced Monitoring
- Additional file types
- Network-based configuration sources
- Cloud settings synchronization

### Improved UI
- Multiple panel indicators
- Desktop notifications
- Progress indicators

## Best Practices

### Adding New Modules
1. Define clear responsibilities and interfaces
2. Minimize dependencies on other modules
3. Implement comprehensive error handling
4. Add detailed logging for debugging
5. Update this documentation

### Modifying Existing Modules
1. Maintain backward compatibility where possible
2. Update dependent modules if interfaces change
3. Test thoroughly with integration tests
4. Update documentation to reflect changes

### Performance Guidelines
1. Use async/await for all I/O operations
2. Implement proper resource cleanup
3. Cache expensive computations
4. Minimize memory usage through on-demand loading

## Debugging

Each module includes extensive logging:
- Use `journalctl -f -o cat /usr/bin/gnome-shell | grep "Gnoming Profiles"` to view logs
- Module names are included in log messages
- Error conditions are logged with full stack traces
- Status changes are logged for debugging