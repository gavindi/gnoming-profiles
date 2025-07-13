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