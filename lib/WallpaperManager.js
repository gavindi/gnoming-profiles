/*
 * WallpaperManager.js - Wallpaper syncing and management
 * Part of Gnoming Profiles extension
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

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
            if (uri && uri.startsWith('file://')) {
                const filePath = uri.replace('file://', '');
                const file = Gio.File.new_for_path(filePath);
                
                if (!file.query_exists(null)) {
                    log(`Wallpaper Manager: File not found: ${filePath}`);
                    return;
                }
                
                // Store file info instead of content (load on-demand)
                const fileName = file.get_basename();
                const wallpaperKey = `${schema}-${key}`;
                
                this._wallpaperData.set(wallpaperKey, {
                    filePath: filePath,
                    fileName: fileName,
                    schema: schema,
                    key: key
                    // Don't store content here - load when needed
                });
                
                log(`Wallpaper Manager: Tracked wallpaper for upload: ${fileName} for ${wallpaperKey}`);
            }
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
            const [success, contents] = file.load_contents(null);
            
            if (!success) {
                log(`Wallpaper Manager: Failed to read wallpaper: ${wallpaperData.filePath}`);
                return null;
            }
            
            return {
                content: GLib.base64_encode(contents),
                size: contents.length,
                ...wallpaperData
            };
        } catch (e) {
            log(`Wallpaper Manager: Error reading wallpaper ${wallpaperKey}: ${e.message}`);
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
        return {
            trackedWallpapers: this._wallpaperData.size,
            wallpaperDirectory: this._wallpaperDir,
            wallpaperKeys: Array.from(this._wallpaperData.keys())
        };
    }
}