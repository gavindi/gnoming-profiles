/*
 * Utils.js - Common utility functions for Gnoming Profiles
 * Part of Gnoming Profiles extension
 */

import GLib from 'gi://GLib';

/**
 * Common utility functions used across modules
 */
export class Utils {
    
    /**
     * Expand ~ to home directory in file paths
     * @param {string} path - Path that may contain ~
     * @returns {string} Expanded path
     */
    static expandPath(path) {
        if (path.startsWith('~')) {
            return path.replace('~', GLib.get_home_dir());
        }
        return path;
    }
    
    /**
     * Generate SHA-256 hash of content for caching
     * @param {string} content - Content to hash
     * @returns {string} SHA-256 hash
     */
    static generateContentHash(content) {
        return GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, content, -1);
    }
    
    /**
     * Check if a file appears to be binary
     * @param {Uint8Array} contents - File contents
     * @returns {boolean} True if file appears to be binary
     */
    static isBinaryFile(contents) {
        try {
            const content = new TextDecoder('utf-8', { fatal: true }).decode(contents);
            return false; // Successfully decoded as UTF-8
        } catch (e) {
            return true; // Failed to decode, likely binary
        }
    }
    
    /**
     * Safe JSON parsing with error handling
     * @param {string} jsonString - JSON string to parse
     * @param {any} defaultValue - Default value if parsing fails
     * @returns {any} Parsed JSON or default value
     */
    static safeJsonParse(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.error(`Utils: JSON parse error: ${e.message}`);
            return defaultValue;
        }
    }
    
    /**
     * Safe JSON stringification with error handling
     * @param {any} object - Object to stringify
     * @param {string} defaultValue - Default value if stringification fails
     * @returns {string} JSON string or default value
     */
    static safeJsonStringify(object, defaultValue = '{}') {
        try {
            return JSON.stringify(object, null, 2);
        } catch (e) {
            console.error(`Utils: JSON stringify error: ${e.message}`);
            return defaultValue;
        }
    }
    
    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, delay) {
        let timeoutId = null;
        
        return function(...args) {
            if (timeoutId) {
                GLib.source_remove(timeoutId);
            }
            
            timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                func.apply(this, args);
                timeoutId = null;
                return GLib.SOURCE_REMOVE;
            });
        };
    }
    
    /**
     * Throttle function calls
     * @param {Function} func - Function to throttle
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Throttled function
     */
    static throttle(func, delay) {
        let lastCall = 0;
        let timeoutId = null;
        
        return function(...args) {
            const now = Date.now();
            
            if (now - lastCall >= delay) {
                lastCall = now;
                func.apply(this, args);
            } else if (!timeoutId) {
                timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay - (now - lastCall), () => {
                    lastCall = Date.now();
                    func.apply(this, args);
                    timeoutId = null;
                    return GLib.SOURCE_REMOVE;
                });
            }
        };
    }
    
    /**
     * Format file size in human-readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size string
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Format duration in human-readable format
     * @param {number} milliseconds - Duration in milliseconds
     * @returns {string} Formatted duration string
     */
    static formatDuration(milliseconds) {
        if (milliseconds < 1000) {
            return `${milliseconds}ms`;
        }
        
        const seconds = Math.floor(milliseconds / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes < 60) {
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    
    /**
     * Validate GitHub repository name format
     * @param {string} repo - Repository name
     * @returns {boolean} True if valid
     */
    static isValidRepoName(repo) {
        if (!repo || typeof repo !== 'string') {
            return false;
        }
        
        // GitHub repo names: alphanumeric, hyphens, underscores, periods
        // Cannot start/end with special characters
        const repoPattern = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
        return repoPattern.test(repo) && repo.length <= 100;
    }
    
    /**
     * Validate GitHub username format
     * @param {string} username - Username
     * @returns {boolean} True if valid
     */
    static isValidUsername(username) {
        if (!username || typeof username !== 'string') {
            return false;
        }
        
        // GitHub usernames: alphanumeric and hyphens, cannot start/end with hyphen
        const usernamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
        return usernamePattern.test(username) && username.length <= 39;
    }
    
    /**
     * Validate GitHub personal access token format
     * @param {string} token - Access token
     * @returns {boolean} True if valid format
     */
    static isValidToken(token) {
        if (!token || typeof token !== 'string') {
            return false;
        }
        
        // Classic tokens start with ghp_, fine-grained with github_pat_
        // Length varies but typically 40+ characters
        return (token.startsWith('ghp_') || token.startsWith('github_pat_')) && token.length >= 40;
    }
    
    /**
     * Sanitize filename for GitHub repository
     * @param {string} filename - Original filename
     * @returns {string} Sanitized filename
     */
    static sanitizeFilename(filename) {
        if (!filename || typeof filename !== 'string') {
            return 'unnamed_file';
        }
        
        // Replace invalid characters with underscores
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '');
    }
    
    /**
     * Generate a short commit SHA for display
     * @param {string} sha - Full SHA
     * @returns {string} Short SHA (7 characters)
     */
    static shortSha(sha) {
        if (!sha || typeof sha !== 'string') {
            return 'unknown';
        }
        return sha.substring(0, 7);
    }
    
    /**
     * Check if a string is a valid ETag
     * @param {string} etag - ETag value
     * @returns {boolean} True if valid ETag format
     */
    static isValidETag(etag) {
        if (!etag || typeof etag !== 'string') {
            return false;
        }
        
        // ETags are typically quoted strings or W/ prefixed weak ETags
        return etag.startsWith('"') && etag.endsWith('"') || etag.startsWith('W/"');
    }
    
    /**
     * Create a retry wrapper for async functions
     * @param {Function} func - Async function to retry
     * @param {number} maxRetries - Maximum number of retries
     * @param {number} delay - Delay between retries in milliseconds
     * @returns {Function} Function with retry logic
     */
    static withRetry(func, maxRetries = 3, delay = 1000) {
        return async function(...args) {
            let lastError;
            
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    return await func.apply(this, args);
                } catch (error) {
                    lastError = error;
                    
                    if (attempt < maxRetries) {
                        console.warn(`Utils: Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay`);
                        await new Promise(resolve => {
                            GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                                resolve();
                                return GLib.SOURCE_REMOVE;
                            });
                        });
                    }
                }
            }
            
            throw lastError;
        };
    }
    
    /**
     * Check if a file appears to be an image based on extension
     * @param {string} filename - Filename to check
     * @returns {boolean} True if appears to be an image
     */
    static isImageFile(filename) {
        if (!filename || typeof filename !== 'string') {
            return false;
        }
        
        const imageExtensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', 
            '.tiff', '.tif', '.svg', '.ico', '.avif', '.heic'
        ];
        
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return imageExtensions.includes(ext);
    }
    
    /**
     * Check if a content type indicates an image
     * @param {string} contentType - MIME content type
     * @returns {boolean} True if content type is an image
     */
    static isImageContentType(contentType) {
        if (!contentType || typeof contentType !== 'string') {
            return false;
        }
        
        return contentType.toLowerCase().startsWith('image/');
    }
    
    /**
     * Check if a file size is reasonable for a wallpaper
     * @param {number} bytes - File size in bytes
     * @returns {Object} Object with isReasonable, reason, and formattedSize
     */
    static validateWallpaperSize(bytes) {
        const formatted = Utils.formatFileSize(bytes);
        
        if (bytes === 0) {
            return {
                isReasonable: false,
                reason: 'File is empty',
                formattedSize: formatted
            };
        }
        
        if (bytes > 50 * 1024 * 1024) { // 50MB
            return {
                isReasonable: false,
                reason: 'File is too large (over 50MB)',
                formattedSize: formatted
            };
        }
        
        if (bytes > 10 * 1024 * 1024) { // 10MB
            return {
                isReasonable: true,
                reason: 'File is large (over 10MB) - may slow sync',
                formattedSize: formatted,
                warning: true
            };
        }
        
        return {
            isReasonable: true,
            reason: 'File size is reasonable',
            formattedSize: formatted
        };
    }
    
    /**
     * Extract filename from a file URI
     * @param {string} uri - File URI (file://path/to/file)
     * @returns {string|null} Filename or null if invalid
     */
    static getFilenameFromUri(uri) {
        if (!uri || typeof uri !== 'string' || !uri.startsWith('file://')) {
            return null;
        }
        
        try {
            const path = uri.replace('file://', '');
            const parts = path.split('/');
            return parts[parts.length - 1] || null;
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Check if a URI looks like a wallpaper file URI
     * @param {string} uri - URI to check
     * @returns {boolean} True if appears to be a wallpaper file
     */
    static isWallpaperFileUri(uri) {
        if (!uri || typeof uri !== 'string') {
            return false;
        }
        
        if (!uri.startsWith('file://')) {
            return false; // Could be color, gradient, etc.
        }
        
        const filename = Utils.getFilenameFromUri(uri);
        return filename ? Utils.isImageFile(filename) : false;
    }
    
    /**
     * Deep clone an object (simple implementation)
     * @param {any} obj - Object to clone
     * @returns {any} Cloned object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (obj instanceof Array) {
            return obj.map(item => Utils.deepClone(item));
        }
        
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = Utils.deepClone(obj[key]);
                }
            }
            return cloned;
        }
        
        return obj;
    }
}