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
    constructor(storageProvider) {
        this.storageProvider = storageProvider;
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
                return;
            }
            
            const filePath = uri.replace('file://', '');
            const file = Gio.File.new_for_path(filePath);
            
            if (!file.query_exists(null)) {
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
                return;
            }
            
            if (sizeValidation.warning) {
            }
            
            // Check content type if available
            if (contentType && !Utils.isImageContentType(contentType)) {
                return;
            }
            
            // Check filename extension as backup
            if (!Utils.isImageFile(fileName)) {
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
     * Download and restore wallpapers from the storage provider
     * @param {Object} credentials - Provider-specific credentials object
     */
    async downloadAndRestoreWallpapers(credentials) {
        try {
            // Get list of wallpapers from storage provider
            const result = await this.storageProvider.listDirectory('wallpapers', credentials);

            if (!result.ok) {
                if (result.status === 404) {
                    return;
                }
                throw new Error(`Failed to list wallpapers: ${result.status}`);
            }

            const wallpaperFiles = result.files;
            if (!wallpaperFiles || wallpaperFiles.length === 0) {
                return;
            }

            // Create wallpaper directory if it doesn't exist
            await this._ensureWallpaperDirectory();

            // Download each wallpaper file
            for (const fileInfo of wallpaperFiles) {
                if (fileInfo.type !== 'file') continue;

                try {
                    await this._downloadWallpaperFile(fileInfo, credentials);
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
            } catch (e) {
                throw new Error(`Failed to create wallpaper directory: ${e.message}`);
            }
        }
    }
    
    /**
     * Download a single wallpaper file using the storage provider
     * @param {Object} fileInfo - File information from listDirectory
     * @param {Object} credentials - Provider-specific credentials
     */
    async _downloadWallpaperFile(fileInfo, credentials) {

        const content = await this.storageProvider.downloadBinaryFile(`wallpapers/${fileInfo.name}`, credentials);

        // Validate the content before saving
        if (!content || content.length === 0) {
            throw new Error(`Downloaded content is empty for ${fileInfo.name}`);
        }

        if (content.length < 50) {
            throw new Error(`Downloaded content too small for ${fileInfo.name}: ${content.length} bytes`);
        }

        // For JPEG files, verify the header
        if (fileInfo.name.toLowerCase().match(/\.(jpg|jpeg)$/)) {
            if (content[0] !== 0xFF || content[1] !== 0xD8 || content[2] !== 0xFF) {
                throw new Error(`Invalid JPEG header for ${fileInfo.name} - file may be corrupted`);
            }
        }

        // For PNG files, verify the header
        if (fileInfo.name.toLowerCase().match(/\.png$/)) {
            const pngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            let validPNG = true;
            for (let i = 0; i < pngHeader.length && i < content.length; i++) {
                if (content[i] !== pngHeader[i]) {
                    validPNG = false;
                    break;
                }
            }
            if (!validPNG) {
                throw new Error(`Invalid PNG header for ${fileInfo.name} - file may be corrupted`);
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
        } catch (e) {
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
            return originalValue;
        }
        
        // Extract filename from the original URI
        const originalPath = originalUri.replace('file://', '');
        const filename = originalPath.split('/').pop();
        
        if (!filename) {
            return originalValue;
        }
        
        // Look up wallpaper data by filename (not schema-key combination)
        const wallpaperData = this._wallpaperData.get(filename);
        
        if (wallpaperData && wallpaperData.newPath) {
            const newUri = `file://${wallpaperData.newPath}`;
            const updatedValue = originalValue.replace(originalUri, newUri);
            return updatedValue;
        } else {
            
            // Fallback: check if the file exists in our wallpaper directory
            const expectedPath = GLib.build_filenamev([this._wallpaperDir, filename]);
            const file = Gio.File.new_for_path(expectedPath);
            
            if (file.query_exists(null)) {
                const newUri = `file://${expectedPath}`;
                const updatedValue = originalValue.replace(originalUri, newUri);
                
                // Store in wallpaper data for future use
                this._wallpaperData.set(filename, {
                    newPath: expectedPath,
                    fileName: filename
                });
                
                return updatedValue;
            } else {
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
        
        // Clear wallpaper data map
        this._wallpaperData.clear();
        this._wallpaperData = null;
        
        // Clear storage provider reference
        this.storageProvider = null;
        
        // Clear directory path
        this._wallpaperDir = null;
        
    }
}