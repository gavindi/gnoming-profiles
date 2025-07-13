/*
 * WallpaperManager.js - Wallpaper syncing and management (BINARY CORRUPTION FIXED)
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
                console.warn(`Wallpaper Manager: Skipping non-file URI for ${schema}.${key}: ${uri.substring(0, 50)}...`);
                return;
            }
            
            const filePath = uri.replace('file://', '');
            const file = Gio.File.new_for_path(filePath);
            
            if (!file.query_exists(null)) {
                console.warn(`Wallpaper Manager: Wallpaper file no longer exists, skipping: ${filePath}`);
                console.log(`Wallpaper Manager: This is normal if wallpapers were deleted or moved`);
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
                console.warn(`Wallpaper Manager: Skipping wallpaper - ${sizeValidation.reason}: ${fileName} (${sizeValidation.formattedSize})`);
                return;
            }
            
            if (sizeValidation.warning) {
                console.warn(`Wallpaper Manager: Warning - ${sizeValidation.reason}: ${fileName} (${sizeValidation.formattedSize})`);
            }
            
            // Check content type if available
            if (contentType && !Utils.isImageContentType(contentType)) {
                console.warn(`Wallpaper Manager: Skipping non-image file (${contentType}): ${fileName}`);
                return;
            }
            
            // Check filename extension as backup
            if (!Utils.isImageFile(fileName)) {
                console.warn(`Wallpaper Manager: Warning - File extension doesn't look like an image: ${fileName}`);
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
            
            console.log(`Wallpaper Manager: Tracked wallpaper for upload: ${fileName} (${sizeValidation.formattedSize}) for ${wallpaperKey}`);
            
        } catch (e) {
            console.error(`Wallpaper Manager: Failed to track wallpaper ${schema}.${key}: ${e.message}`);
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
                console.warn(`Wallpaper Manager: Wallpaper file was deleted since tracking: ${wallpaperData.filePath}`);
                console.log(`Wallpaper Manager: Removing from upload queue: ${wallpaperKey}`);
                this._wallpaperData.delete(wallpaperKey);
                return null;
            }
            
            const [success, contents] = file.load_contents(null);
            
            if (!success) {
                console.error(`Wallpaper Manager: Failed to read wallpaper content: ${wallpaperData.filePath}`);
                return null;
            }
            
            // Verify content isn't empty
            if (contents.length === 0) {
                console.error(`Wallpaper Manager: Wallpaper file is empty: ${wallpaperData.filePath}`);
                return null;
            }
            
            const base64Content = GLib.base64_encode(contents);
            
            console.log(`Wallpaper Manager: Loaded wallpaper content: ${wallpaperData.fileName} (${contents.length} bytes → ${base64Content.length} base64 chars)`);
            
            return {
                content: base64Content,
                size: contents.length,
                ...wallpaperData
            };
        } catch (e) {
            console.error(`Wallpaper Manager: Error reading wallpaper ${wallpaperKey}: ${e.message}`);
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
                    console.warn('Wallpaper Manager: No wallpapers folder found in repository');
                    return;
                }
                throw new Error(`Failed to list wallpapers: ${response.status}`);
            }
            
            const wallpaperFiles = JSON.parse(response.data);
            if (!Array.isArray(wallpaperFiles) || wallpaperFiles.length === 0) {
                console.warn('Wallpaper Manager: No wallpapers found in repository');
                return;
            }
            
            console.log(`Wallpaper Manager: Found ${wallpaperFiles.length} wallpapers in repository`);
            
            // Create wallpaper directory if it doesn't exist
            await this._ensureWallpaperDirectory();
            
            // Download each wallpaper file
            for (const fileInfo of wallpaperFiles) {
                if (fileInfo.type !== 'file') continue;
                
                try {
                    await this._downloadWallpaperFile(fileInfo, token);
                } catch (e) {
                    console.error(`Wallpaper Manager: Failed to download wallpaper ${fileInfo.name}: ${e.message}`);
                }
            }
            
        } catch (error) {
            console.error(`Wallpaper Manager: Failed to download wallpapers: ${error.message}`);
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
                console.log(`Wallpaper Manager: Created wallpaper directory: ${this._wallpaperDir}`);
            } catch (e) {
                throw new Error(`Failed to create wallpaper directory: ${e.message}`);
            }
        }
    }
    
    /**
     * Download a single wallpaper file (BINARY-FIXED VERSION)
     * @param {Object} fileInfo - File information from GitHub
     * @param {string} token - GitHub token
     */
    async _downloadWallpaperFile(fileInfo, token) {
        console.log(`Wallpaper Manager: Downloading wallpaper: ${fileInfo.name}`);
        
        let content;
        
        // Try download_url first (direct file content) - USE BINARY DOWNLOAD
        if (fileInfo.download_url) {
            try {
                console.log(`Wallpaper Manager: Using binary download for ${fileInfo.name}`);
                content = await this.githubAPI.downloadBinaryFile(fileInfo.download_url, token);
                console.log(`Wallpaper Manager: Binary download successful: ${content.length} bytes`);
            } catch (e) {
                console.warn(`Wallpaper Manager: Binary download failed for ${fileInfo.name}: ${e.message}, trying API URL`);
                // Fall back to API URL
                content = await this._downloadViaApiUrl(fileInfo, token);
            }
        } else {
            // Use API URL (returns JSON with base64 content)
            content = await this._downloadViaApiUrl(fileInfo, token);
        }
        
        // Validate the content before saving
        if (!content || content.length === 0) {
            throw new Error(`Downloaded content is empty for ${fileInfo.name}`);
        }
        
        // Check if this looks like a valid image file (basic validation)
        if (content.length < 50) {
            throw new Error(`Downloaded content too small for ${fileInfo.name}: ${content.length} bytes`);
        }
        
        // For JPEG files, verify the header
        if (fileInfo.name.toLowerCase().match(/\.(jpg|jpeg)$/)) {
            // JPEG files should start with FF D8 FF
            if (content[0] !== 0xFF || content[1] !== 0xD8 || content[2] !== 0xFF) {
                console.warn(`Wallpaper Manager: WARNING - JPEG header validation failed for ${fileInfo.name}`);
                console.warn(`Wallpaper Manager: File starts with: 0x${content[0].toString(16)} 0x${content[1].toString(16)} 0x${content[2].toString(16)}`);
                console.warn(`Wallpaper Manager: Expected JPEG header: 0xFF 0xD8 0xFF`);
                throw new Error(`Invalid JPEG header for ${fileInfo.name} - file may be corrupted`);
            } else {
                console.log(`Wallpaper Manager: ✓ JPEG header validation passed for ${fileInfo.name}`);
            }
        }
        
        // For PNG files, verify the header
        if (fileInfo.name.toLowerCase().match(/\.png$/)) {
            // PNG files should start with 89 50 4E 47 0D 0A 1A 0A
            const pngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            let validPNG = true;
            for (let i = 0; i < pngHeader.length && i < content.length; i++) {
                if (content[i] !== pngHeader[i]) {
                    validPNG = false;
                    break;
                }
            }
            if (!validPNG) {
                console.warn(`Wallpaper Manager: WARNING - PNG header validation failed for ${fileInfo.name}`);
                throw new Error(`Invalid PNG header for ${fileInfo.name} - file may be corrupted`);
            } else {
                console.log(`Wallpaper Manager: ✓ PNG header validation passed for ${fileInfo.name}`);
            }
        }
        
        // Save wallpaper file
        const newPath = GLib.build_filenamev([this._wallpaperDir, fileInfo.name]);
        const file = Gio.File.new_for_path(newPath);
        
        try {
            file.replace_contents(
                content,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
            
            console.log(`Wallpaper Manager: Saved wallpaper: ${fileInfo.name} to ${newPath} (${content.length} bytes)`);
        } catch (e) {
            throw new Error(`Failed to save wallpaper file ${newPath}: ${e.message}`);
        }
        
        // Verify the file was actually written and has correct size
        if (!file.query_exists(null)) {
            throw new Error(`Failed to write wallpaper file: ${newPath}`);
        }
        
        const fileSize = file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size();
        if (fileSize !== content.length) {
            throw new Error(`File size mismatch for ${newPath}: expected ${content.length}, got ${fileSize}`);
        }
        
        console.log(`Wallpaper Manager: ✓ Verified wallpaper file: ${newPath} (${fileSize} bytes)`);
        
        // Store the mapping with FILENAME as key (this is what updateWallpaperUri expects)
        this._wallpaperData.set(fileInfo.name, {
            newPath: newPath,
            fileName: fileInfo.name
        });
        
        // Test that the file can be read back correctly
        try {
            const [success, testContents] = file.load_contents(null);
            if (!success || testContents.length !== content.length) {
                throw new Error(`Verification read failed for ${newPath}`);
            }
            console.log(`Wallpaper Manager: ✓ File verification read successful for ${fileInfo.name}`);
        } catch (e) {
            console.warn(`Wallpaper Manager: WARNING - Could not verify file readback for ${fileInfo.name}: ${e.message}`);
        }
    }
    
    /**
     * Download wallpaper via GitHub API URL (returns JSON with base64 content)
     * @param {Object} fileInfo - File information from GitHub
     * @param {string} token - GitHub token
     * @returns {Uint8Array} File content
     */
    async _downloadViaApiUrl(fileInfo, token) {
        console.log(`Wallpaper Manager: Using API URL for ${fileInfo.name}`);
        
        const fileResponse = await this.githubAPI.makeRequest(
            fileInfo.url,
            'GET',
            token
        );
        
        if (fileResponse.ok) {
            try {
                const fileData = JSON.parse(fileResponse.data);
                if (fileData.content) {
                    const decodedContent = GLib.base64_decode(fileData.content);
                    console.log(`Wallpaper Manager: API download successful: ${decodedContent.length} bytes`);
                    return decodedContent;
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
     * Update wallpaper URI in a GSettings value (FIXED VERSION)
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
        
        // Skip non-file URIs (colors, gradients, etc.)
        if (!originalUri.startsWith('file://')) {
            console.log(`Wallpaper Manager: Skipping non-file URI for ${schema}.${key}: ${originalUri}`);
            return originalValue;
        }
        
        // Extract filename from the original URI
        const originalPath = originalUri.replace('file://', '');
        const filename = originalPath.split('/').pop();
        
        if (!filename) {
            console.warn(`Wallpaper Manager: Could not extract filename from URI: ${originalUri}`);
            return originalValue;
        }
        
        // Look up wallpaper data by filename (not schema-key combination)
        const wallpaperData = this._wallpaperData.get(filename);
        
        if (wallpaperData && wallpaperData.newPath) {
            const newUri = `file://${wallpaperData.newPath}`;
            const updatedValue = originalValue.replace(originalUri, newUri);
            console.log(`Wallpaper Manager: Updated wallpaper URI for ${schema}.${key}: ${originalUri} -> ${newUri}`);
            return updatedValue;
        } else {
            console.warn(`Wallpaper Manager: No wallpaper data found for filename: ${filename}`);
            
            // Fallback: check if the file exists in our wallpaper directory
            const expectedPath = GLib.build_filenamev([this._wallpaperDir, filename]);
            const file = Gio.File.new_for_path(expectedPath);
            
            if (file.query_exists(null)) {
                const newUri = `file://${expectedPath}`;
                const updatedValue = originalValue.replace(originalUri, newUri);
                console.log(`Wallpaper Manager: Found wallpaper file, updating URI for ${schema}.${key}: ${originalUri} -> ${newUri}`);
                
                // Store in wallpaper data for future use
                this._wallpaperData.set(filename, {
                    newPath: expectedPath,
                    fileName: filename
                });
                
                return updatedValue;
            } else {
                console.warn(`Wallpaper Manager: Wallpaper file not found: ${expectedPath}`);
                console.warn(`Wallpaper Manager: Keeping original URI: ${originalUri}`);
                return originalValue;
            }
        }
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
     * Destroy and cleanup with proper memory management
     */
    destroy() {
        console.log('Wallpaper Manager: Starting cleanup');
        
        // Clear wallpaper data map
        this._wallpaperData.clear();
        this._wallpaperData = null;
        
        // Clear GitHub API reference
        this.githubAPI = null;
        
        // Clear directory path
        this._wallpaperDir = null;
        
        console.log('Wallpaper Manager: Cleanup complete');
    }
}