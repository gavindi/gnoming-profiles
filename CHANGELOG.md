# Changelog

All notable changes to the Gnoming Profiles extension are documented in this file.

## [v3.0.4] - 2026-02-11

### Fixed
- Auto-detect repository default branch instead of hardcoding "main" — repos using "master" or any other default branch now work correctly
- Added `getDefaultBranch()` to GitHubAPI with per-session caching to avoid extra API calls

## [v3.0.3] - 2025-12-04

### Changed
- Added GNOME Shell 49 support

## [v3.0.2] - 2025-07-14

### Improved
- Template literal standardization across codebase
- Magic numbers replaced with named constants
- Timeout management in SyncManager — `restoreBackup()` now handles multiple concurrent calls safely

### Removed
- 27 unused functions and methods for improved maintainability
- 15 unused utility functions from Utils class
- Unused diagnostic and debug methods from modules

## [v3.0.1] - 2025-07-11

### Changed
- Semantic console logging — replaced `log()` with `console.log/warn/error` methods
- Removed deprecated GNOME Shell version 45 from metadata.json

### Fixed
- HTTP session cleanup — proper `abort()` calls in GitHubAPI
- Enhanced timeout management across all modules

## [v3.0] - 2025-07-07

### Fixed
- Critical wallpaper corruption bug — complete rewrite of binary file handling
- Memory leaks — proper nullification of references and cleanup of event handlers

### Improved
- Timer and memory management — proper cleanup of all timeouts and references
- Resource management — better lifecycle management for all components
- Error handling — better error recovery and resource cleanup

### Added
- Binary-safe wallpaper syncing
- Destroy methods for all components with proper cleanup

## [v2.9] - 2025-07-04

### Added
- ETag-based GitHub polling for ultra-efficient change detection
- GitHub Tree API batching — all files uploaded in single commits
- Request queue management with intelligent concurrency control
- Smart caching system with SHA-256 based change detection
- Sync lock system to prevent concurrent operations
- Complete modular architecture with dependency injection

### Improved
- 60-80% faster sync operations
- 95% bandwidth reduction via ETag conditional requests
- Proper cleanup for session manager DBusProxy to prevent memory leaks

## [v2.8] - 2025-06-30

### Changed
- Reorganised panel menu layout
- `openPreferences()` now uses built-in Extension class method instead of spawning a subprocess

### Fixed
- Garbage collection improvements
- Schema recursion bug
- Incorrect schema count reported in panel menu

### Added
- Initial sync option in preferences Sync tab

## [v2.7] - 2025-06-27

### Added
- Modern tabbed preferences interface
- Ubuntu extension settings and workspaces settings support
- Wallpapers stored in dedicated "wallpapers" folder instead of main config-backup.json

### Changed
- Initial release on GitHub (catching up with local development)
