# Changelog

All notable changes to the Gnoming Profiles extension are documented in this file.

## [v3.4.1] - 2026-02-21

### Fixed
- **Nextcloud polling 412 Precondition Failed** — SabreDAV returns 412 instead of 304 for conditional HEAD requests with `If-None-Match`; now re-fetches the ETag without the conditional header and correctly reports changes
- **Nextcloud file download 404 noise** — `downloadFile()` no longer logs errors for 404 responses, which are expected when a file hasn't been uploaded yet and are handled gracefully by the caller

### Changed
- Preferences UI text made provider-agnostic — \"Force an initial backup to GitHub\" now says \"to your storage provider\"
- Simplified Sync tab — removed ETag Efficiency info, ETag Polling Tips, and Performance sections; added polling interval tip to Change Monitoring Tips
- Updated version to 3.4.1 with changelog showing last five releases

## [v3.4.0] - 2026-02-20

### Fixed
- **Schema filename mismatch** — renamed `org.gnome.shell.extensions.config-sync.gschema.xml` to `org.gnome.shell.extensions.gnoming-profiles.gschema.xml` to match the schema ID in metadata.json
- **`make install` copies unnecessary files** — now uses `$(DIST_FILES)` instead of `cp -r *`, so only runtime files are installed
- **Settings signal handlers not disconnected in `disable()`** — all 8 `changed::` signal connections on `Gio.Settings` are now tracked and properly disconnected during disable, preventing callbacks on orphaned objects
- **Excessive logging** — removed all `console.log` and `console.warn` calls (170 across 13 files); only `console.error` retained for actual error conditions, complying with GNOME extension review guidelines
- **Imaginary API usage in prefs** — removed `is_destroyed` property checks on GTK widgets and `Gio.Settings`, which is not a real GObject/GTK API

### Changed
- GOA dependency installation instructions moved to Installation section as a prerequisite in README
- Updated `lib/README.md` — added GoogleDriveProvider documentation, dependency tree, and changelog entries for v3.3.1–v3.3.5
- Updated `metadata.json` description to mention all three storage providers (GitHub, Nextcloud, Google Drive)
- Excluded `lib/README.md` from distribution ZIP — unnecessary documentation file should not be shipped

### Removed
- Deprecated `syncToGitHub()` and `syncFromGitHub()` shim methods from SyncManager — no callers exist; use `syncToRemote()` / `syncFromRemote()` instead

## [v3.3.5] - 2026-02-19

### Changed
- Removed redundant "Change Sync Direction" (bidirectional) option from Sync tab — remote restore is handled by the separate "Remote Change Detection" section
- Removed unused `change-sync-bidirectional` GSettings key

### Fixed
- `make dist` now compiles GSettings schemas before zipping, so installs from the zip don't fail with missing `gschemas.compiled`

## [v3.3.4] - 2026-02-20

### Changed
- **Google Drive authentication via GNOME Online Accounts (GOA)** — replaced manual OAuth2 flow (Client ID/Secret, PKCE loopback server) with system-managed GOA authentication
- **Multi-account support** — account selector dropdown in preferences allows choosing which Google account to use for Drive sync
- Removed `gdrive-client-id`, `gdrive-client-secret`, `gdrive-refresh-token` GSettings keys; added `gdrive-goa-account-id`
- Removed `Soup` dependency from preferences (no longer needed for token exchange)
- Google Drive preferences UI simplified: account dropdown, "Open Online Accounts" button, folder name
- Security info updated to reflect GOA-managed token storage

### Removed
- OAuth2 PKCE loopback server and all manual token management code
- Google Cloud Console credential setup requirement — users now just need a Google account in GNOME Settings with "Files" enabled

## [v3.3.3] - 2026-02-19

### Fixed
- **Google Drive polling not detecting remote changes on other devices** — first poll now signals `hasChanges: true` so new clients pull remote data instead of silently caching the modifiedTime
- **Stale file ID cache pointing to trashed files** — polling now requests the `trashed` field from Google Drive API; if the cached file ID resolves to a trashed file, all caches are cleared and a fresh resolve is triggered

## [v3.3.2] - 2026-02-19

### Added
- **Google Drive storage backend** — sync profiles to Google Drive as a third storage option alongside GitHub and Nextcloud
- OAuth2 loopback authorization flow with PKCE — opens browser for Google login, catches redirect on localhost to obtain refresh token
- Google Drive preferences UI — Client ID/Secret fields, folder name, Authorize button with status indicator
- New GSettings keys: `gdrive-client-id`, `gdrive-client-secret`, `gdrive-refresh-token`, `gdrive-folder-name`

### Architecture
- `GoogleDriveProvider` implements StorageProvider with path-to-ID resolution cache for Google Drive's ID-based file system
- Multipart upload helper for Google Drive API v3 (`multipart/related` with JSON metadata + binary content)
- Token management with automatic refresh and `invalid_grant` recovery
- `modifiedTime`-based polling for remote change detection
- OAuth2 loopback server uses `Gio.SocketService` for libsoup3 compatibility

### Changed
- Provider selection dropdown updated to three options: GitHub, Nextcloud WebDAV, Google Drive
- Security info and About tab updated to mention Google Drive

## [v3.3.1] - 2026-02-19

### Fixed
- **Nextcloud periodic polling not detecting changes** — `_performRequest` used `send_and_read_async` for HEAD requests which can fail on empty bodies in GJS/libsoup3; now uses `send_async` for HEAD
- **Polling falsely detecting own uploads as remote changes** — after uploading `config-backup.json`, the new ETag is now cached via a HEAD request so the next poll sees a matching ETag instead of a stale one
- **Remote sync triggering infinite upload loop** — file monitor was not disabled during remote restore, causing downloaded files to trigger an upload which changed the ETag, which triggered the next poll to sync again
- **Panel indicator crash on Nextcloud remote changes** — `showRemoteChanges()` assumed a GitHub commit object with `.sha`; now handles null commit for Nextcloud
- Added null/empty-bytes guard in `_performRequest` for bodyless responses (e.g. 204)
- Added GET fallback in `pollForChanges` when HEAD does not return an ETag header
- Renamed GSettings keys to provider-agnostic names: `polling-enabled`, `polling-interval`
- Renamed internal polling methods (`_setupGitHubPolling` → `_setupRemotePolling`, etc.) to reflect multi-backend support

### Added
- `FileMonitor.setEnabled()` — allows temporarily suppressing file change events during restore operations

### Changed
- Sync tab UI labels clarified: "Local Change Monitoring" (upload) vs "Remote Change Detection" (download) to make the distinction between local and remote sync obvious

## [v3.3.0] - 2026-02-18

### Added
- **Nextcloud/WebDAV storage backend** — sync profiles to a self-hosted Nextcloud server as an alternative to GitHub
- **StorageProvider abstraction layer** — pluggable backend architecture (`StorageProvider`, `GitHubProvider`, `NextcloudProvider`)
- Provider selection dropdown in preferences (GitHub / Nextcloud WebDAV)
- Nextcloud settings UI — server URL, username, app password, sync folder
- Live provider switching without requiring extension restart
- New GSettings keys: `storage-provider`, `nextcloud-url`, `nextcloud-username`, `nextcloud-password`, `nextcloud-folder`

### Changed
- `SyncManager` now uses provider-agnostic `syncToRemote()` / `syncFromRemote()` methods
- `WallpaperManager` refactored to use StorageProvider interface instead of direct GitHub API calls
- Polling and change detection work across both providers via ETag comparison
- Preferences UI labels updated to say "Remote" instead of "GitHub" where appropriate

### Architecture
- Extracted GitHub-specific upload logic (Tree API batching) into `GitHubProvider`
- `NextcloudProvider` implements WebDAV operations: `PUT`, `GET`, `PROPFIND`, `MKCOL`
- Backward-compatible shims (`syncToGitHub`/`syncFromGitHub`) retained as deprecated wrappers

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
