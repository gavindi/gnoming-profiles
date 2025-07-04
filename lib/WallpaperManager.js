/*
 * WallpaperManager.js - Wallpaper syncing and management
 * Part of Gnoming Profiles extension
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Utils } from './Utils.js';

/**
 * Manages wallpaper syncing and restoration
 */
export class WallpaperManager {
    constructor(githubAPI) {
        this.githubAPI = githubAPI;
        this._wallpaperData = new Map();
        this._wallpaperDir = GLib.build_filenamev([
            GLib.get_home_dir(), 
            '.local', 
            'share', 
            'gnoming-profiles', 
            'wallpapers'
        ]);
    }
    
    /**
     * Clear stored wallpaper data
     */
    clear() {
        this._wallpaperData.clear();
    }
    
    /**
     * Check if a GSettings key is wallpaper-related
     * @param {string} schema - GSettings schema
     * @param {string} key - GSettings key
     * @returns {boolean} True if key is wallpaper-related
     */
    isWallpaperKey(schema, key) {
        return (schema === 'org.gnome.desktop.background' && 
                (key === 'picture-uri' || key === 'picture-uri-dark')) ||
               (schema === 'org.gnome.desktop.screensaver' && key === 'picture-uri');
    }
    
    /**
     * Track a wallpaper for uploading
     * @param {string} schema - GSettings schema
     * @param {string} key - GSettings key
     * @param {Gio.Settings} settings - GSettings object
     */
    async trackWallpaperForUpload(schema, key, settings) {
        try {
            const uri = settings.get_string(key);
            if (!uri) {
                return; // Empty URI
            }
            
            if (!Utils.isWallpaperFileUri(uri)) {
                // Not a file URI, could be a color, gradient, etc.
                log(`Wallpaper Manager: Skipping non-file URI for ${schema}.${key}: ${uri.substring(0, 50)}...`);
                return;
            }
            
            const filePath = uri.replace('file://', '');
            const file = Gio.File.new_for_path(filePath);
            
            if (!file.query_exists(null)) {
                log(`Wallpaper Manager: Wallpaper file no longer exists, skipping: ${filePath}`);
                log(`Wallpaper Manager: This is normal if wallpapers were deleted or moved`);
                return;
            }
            
            // Check if it's a reasonable image file
            const fileInfo = file.query_info('standard::size,standard::content-type', Gio.FileQueryInfoFlags.NONE, null);
            const contentType = fileInfo.get_content_type();
            const fileSize = fileInfo.get_size();
            const fileName = file.get_basename();
            
            // Validate file size
            const sizeValidation = Utils.validateWallpaperSize(fileSize);
            if (!sizeValidation.isReasonable) {
                log(`Wallpaper Manager: Skipping wallpaper - ${sizeValidation.reason}: ${fileName} (${sizeValidation.formattedSize})`);
                return;
            }
            
            if (sizeValidation.warning) {
                log(`Wallpaper Manager: Warning - ${sizeValidation.reason}: ${fileName} (${sizeValidation.formattedSize})`);
            }
            
            // Check content type if available
            if (contentType && !Utils.isImageContentType(contentType)) {
                log(`Wallpaper Manager: Skipping non-image file (${contentType}): ${fileName}`);
                return;
            }
            
            // Check filename extension as backup
            if (!Utils.isImageFile(fileName)) {
                log(`Wallpaper Manager: Warning - File extension doesn't look like an image: ${fileName}`);
            }
            
            // Store file info instead of content (load on-demand)
            const wallpaperKey = `${schema}-${key}`;
            
            this._wallpaperData.set(wallpaperKey, {
                filePath: filePath,
                fileName: fileName,
                schema: schema,
                key: key,
                fileSize: fileSize,
                contentType: contentType || 'image/unknown'
                // Don't store content here - load when needed
            });
            
            log(`Wallpaper Manager: Tracked wallpaper for upload: ${fileName} (${sizeValidation.formattedSize}) for ${wallpaperKey}`);
            
        } catch (e) {
            log(`Wallpaper Manager: Failed to track wallpaper ${schema}.${key}: ${e.message}`);
        }
    }
    
    /**
     * Load wallpaper content on-demand
     * @param {string} wallpaperKey - Wallpaper identifier
     * @returns {Object|null} Wallpaper content object
     */
    async getWallpaperContent(wallpaperKey) {
        const wallpaperData = this._wallpaperData.get(wallpaperKey);
        if (!wallpaperData || !wallpaperData.filePath) {
            return null;
        }
        
        try {
            const file = Gio.File.new_for_path(wallpaperData.filePath);
            
            // Check if file still exists (it might have been deleted since tracking)
            if (!file.query_exists(null)) {
                log(`Wallpaper Manager: Wallpaper file was deleted since tracking: ${wallpaperData.filePath}`);
                log(`Wallpaper Manager: Removing from upload queue: ${wallpaperKey}`);
                this._wallpaperData.delete(wallpaperKey);
                return null;
            }
            
            const [success, contents] = file.load_contents(null);
            
            if (!success) {
                log(`Wallpaper Manager: Failed to read wallpaper content: ${wallpaperData.filePath}`);
                return null;
            }
            
            // Verify content isn't empty
            if (contents.length === 0) {
                log(`Wallpaper Manager: Wallpaper file is empty: ${wallpaperData.filePath}`);
                return null;
            }
            
            const base64Content = GLib.base64_encode(contents);
            
            log(`Wallpaper Manager: Loaded wallpaper content: ${wallpaperData.fileName} (${contents.length} bytes → ${base64Content.length} base64 chars)`);
            
            return {
                content: base64Content,
                size: contents.length,
                ...wallpaperData
            };
        } catch (e) {
            log(`Wallpaper Manager: Error reading wallpaper ${wallpaperKey}: ${e.message}`);
            // Remove from tracking since it's problematic
            this._wallpaperData.delete(wallpaperKey);
            return null;
        }
    }
    
    /**
     * Get all wallpaper data for uploading
     * @returns {Map} Map of wallpaper data
     */
    getWallpaperData() {
        return this._wallpaperData;
    }
    
    /**
     * Download and restore wallpapers from GitHub
     * @param {string} token - GitHub token
     * @param {string} username - GitHub username  
     * @param {string} repo - Repository name
     */
    async downloadAndRestoreWallpapers(token, username, repo) {
        try {
            // Get list of wallpapers from GitHub
            const response = await this.githubAPI.getContents(username, repo, 'wallpapers', token);
            
            if (!response.ok) {
                if (response.status === 404) {
                    log('Wallpaper Manager: No wallpapers folder found in repository');
                    return;
                }
                throw new Error(`Failed to list wallpapers: ${response.status}`);
            }
            
            const wallpaperFiles = JSON.parse(response.data);
            if (!Array.isArray(wallpaperFiles) || wallpaperFiles.length === 0) {
                log('Wallpaper Manager: No wallpapers found in repository');
                return;
            }
            
            log(`Wallpaper Manager: Found ${wallpaperFiles.length} wallpapers in repository`);
            
            // Create wallpaper directory if it doesn't exist
            await this._ensureWallpaperDirectory();
            
            // Download each wallpaper file
            for (const fileInfo of wallpaperFiles) {
                if (fileInfo.type !== 'file') continue;
                
                try {
                    await this._downloadWallpaperFile(fileInfo, token);
                } catch (e) {
                    log(`Wallpaper Manager: Failed to download wallpaper ${fileInfo.name}: ${e.message}`);
                }
            }
            
        } catch (error) {
            log(`Wallpaper Manager: Failed to download wallpapers: ${error.message}`);
        }
    }
    
    /**
     * Ensure wallpaper directory exists
     */
    async _ensureWallpaperDirectory() {
        const wallpaperDirFile = Gio.File.new_for_path(this._wallpaperDir);
        if (!wallpaperDirFile.query_exists(null)) {
            try {
                wallpaperDirFile.make_directory_with_parents(null);
                log(`Wallpaper Manager: Created wallpaper directory: ${this._wallpaperDir}`);
            } catch (e) {
                throw new Error(`Failed to create wallpaper directory: ${e.message}`);
            }
        }
    }
    
    /**
     * Download a single wallpaper file
     * @param {Object} fileInfo - File information from GitHub
     * @param {string} token - GitHub token
     */
    async _downloadWallpaperFile(fileInfo, token) {
        log(`Wallpaper Manager: Downloading wallpaper: ${fileInfo.name}`);
        
        let content;
        
        // Try download_url first (direct file content)
        if (fileInfo.download_url) {
            try {
                log(`Wallpaper Manager: Using download_url for ${fileInfo.name}`);
                const fileResponse = await this.githubAPI.makeRequest(
                    fileInfo.download_url,
                    'GET',
                    token
                );
                
                if (fileResponse.ok) {
                    if (fileResponse.isRaw) {
                        // download_url returns raw binary data
                        content = fileResponse.data; // Already Uint8Array
                    } else {
                        // Fallback: if not detected as raw, handle as before
                        const rawString = fileResponse.data;
                        const bytes = new Uint8Array(rawString.length);
                        for (let i = 0; i < rawString.length; i++) {
                            bytes[i] = rawString.charCodeAt(i);
                        }
                        content = bytes;
                    }
                } else {
                    throw new Error(`Download URL failed: ${fileResponse.status}`);
                }
            } catch (e) {
                log(`Wallpaper Manager: Download URL failed for ${fileInfo.name}: ${e.message}, trying API URL`);
                // Fall back to API URL
                content = await this._downloadViaApiUrl(fileInfo, token);
            }
        } else {
            // Use API URL (returns JSON with base64 content)
            content = await this._downloadViaApiUrl(fileInfo, token);
        }
        
        // Save wallpaper file
        const newPath = GLib.build_filenamev([this._wallpaperDir, fileInfo.name]);
        const file = Gio.File.new_for_path(newPath);
        
        file.replace_contents(
            content,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null
        );
        
        log(`Wallpaper Manager: Restored wallpaper: ${fileInfo.name} to ${newPath} (${content.length} bytes)`);
        
        // Store the mapping for URI updates
        this._wallpaperData.set(fileInfo.name, {
            newPath: newPath,
            fileName: fileInfo.name
        });
    }
    
    /**
     * Download wallpaper via GitHub API URL (returns JSON with base64 content)
     * @param {Object} fileInfo - File information from GitHub
     * @param {string} token - GitHub token
     * @returns {Uint8Array} File content
     */
    async _downloadViaApiUrl(fileInfo, token) {
        log(`Wallpaper Manager: Using API URL for ${fileInfo.name}`);
        
        const fileResponse = await this.githubAPI.makeRequest(
            fileInfo.url,
            'GET',
            token
        );
        
        if (fileResponse.ok) {
            try {
                const fileData = JSON.parse(fileResponse.data);
                if (fileData.content) {
                    return GLib.base64_decode(fileData.content);
                } else {
                    throw new Error('No content field in API response');
                }
            } catch (e) {
                throw new Error(`Failed to parse API response: ${e.message}`);
            }
        } else {
            throw new Error(`API URL failed: ${fileResponse.status}`);
        }
    }
    
    /**
     * Update wallpaper URI in a GSettings value
     * @param {string} originalValue - Original GSettings value
     * @param {string} schema - GSettings schema
     * @param {string} key - GSettings key
     * @returns {string} Updated value with new URI
     */
    updateWallpaperUri(originalValue, schema, key) {
        // Parse the original value to extract the URI
        const match = originalValue.match(/'([^']*)'/);
        if (!match) {
            return originalValue;
        }
        
        const originalUri = match[1];
        const wallpaperKey = `${schema}-${key}`;
        const wallpaperData = this._wallpaperData.get(wallpaperKey);
        
        if (wallpaperData && wallpaperData.newPath) {
            const newUri = `file://${wallpaperData.newPath}`;
            const updatedValue = originalValue.replace(originalUri, newUri);
            log(`Wallpaper Manager: Updated wallpaper URI for ${wallpaperKey}: ${originalUri} -> ${newUri}`);
            return updatedValue;
        }
        
        return originalValue;
    }
    
    /**
     * Get wallpaper schemas to add when wallpaper syncing is enabled
     * @returns {string[]} Array of wallpaper schema IDs
     */
    getWallpaperSchemas() {
        return [
            'org.gnome.desktop.background',
            'org.gnome.desktop.screensaver'
        ];
    }
    
    /**
     * Get wallpaper directory path
     * @returns {string} Wallpaper directory path
     */
    getWallpaperDirectory() {
        return this._wallpaperDir;
    }
    
    /**
     * Get status information about wallpaper management
     * @returns {Object} Status object
     */
    getStatus() {
        const trackedWallpapers = [];
        const missingWallpapers = [];
        let totalSize = 0;
        
        for (const [key, data] of this._wallpaperData) {
            const file = Gio.File.new_for_path(data.filePath);
            if (file.query_exists(null)) {
                trackedWallpapers.push({
                    key,
                    fileName: data.fileName,
                    filePath: data.filePath,
                    size: data.fileSize || 0,
                    contentType: data.contentType || 'unknown'
                });
                totalSize += (data.fileSize || 0);
            } else {
                missingWallpapers.push({
                    key,
                    fileName: data.fileName,
                    filePath: data.filePath
                });
            }
        }
        
        return {
            trackedCount: trackedWallpapers.length,
            missingCount: missingWallpapers.length,
            totalSize: totalSize,
            wallpaperDirectory: this._wallpaperDir,
            trackedWallpapers,
            missingWallpapers
        };
    }
    
    /**
     * Validate current wallpaper settings and files
     * @returns {Object} Validation results
     */
    validateWallpapers() {
        const results = {
            valid: [],
            missing: [],
            invalid: [],
            warnings: []
        };
        
        // Check current wallpaper settings
        const wallpaperSchemas = this.getWallpaperSchemas();
        
        for (const schema of wallpaperSchemas) {
            try {
                const schemaSource = Gio.SettingsSchemaSource.get_default();
                const schemaObj = schemaSource.lookup(schema, true);
                
                if (!schemaObj) {
                    continue; // Schema not available
                }
                
                const settings = new Gio.Settings({schema: schema});
                const keys = ['picture-uri', 'picture-uri-dark'];
                
                for (const key of keys) {
                    if (!settings.list_keys().includes(key)) {
                        continue; // Key not available in this schema
                    }
                    
                    try {
                        const uri = settings.get_string(key);
                        
                        if (!uri) {
                            continue; // Empty URI
                        }
                        
                        if (!uri.startsWith('file://')) {
                            // Could be a color, gradient, or other URI type
                            results.warnings.push({
                                schema,
                                key,
                                uri,
                                reason: 'Not a file URI (possibly a color or gradient)'
                            });
                            continue;
                        }
                        
                        const filePath = uri.replace('file://', '');
                        const file = Gio.File.new_for_path(filePath);
                        
                        if (file.query_exists(null)) {
                            const fileInfo = file.query_info('standard::size,standard::content-type', Gio.FileQueryInfoFlags.NONE, null);
                            const size = fileInfo.get_size();
                            const contentType = fileInfo.get_content_type();
                            
                            results.valid.push({
                                schema,
                                key,
                                filePath,
                                fileName: file.get_basename(),
                                size,
                                contentType
                            });
                            
                            // Add warnings for large files
                            if (size > 10 * 1024 * 1024) { // 10MB
                                results.warnings.push({
                                    schema,
                                    key,
                                    filePath,
                                    reason: `Large file (${Math.round(size / 1024 / 1024)}MB) may slow sync`
                                });
                            }
                        } else {
                            results.missing.push({
                                schema,
                                key,
                                filePath,
                                fileName: Gio.File.new_for_path(filePath).get_basename()
                            });
                        }
                        
                    } catch (e) {
                        results.invalid.push({
                            schema,
                            key,
                            error: e.message
                        });
                    }
                }
                
            } catch (e) {
                log(`Wallpaper Manager: Error validating schema ${schema}: ${e.message}`);
            }
        }
        
        return results;
    }
}