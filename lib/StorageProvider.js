/*
 * StorageProvider.js - Abstract base class for storage backends
 * Part of Gnoming Profiles extension
 */

/**
 * Abstract storage provider interface.
 * All storage backends (GitHub, Nextcloud, etc.) must implement these methods.
 */
export class StorageProvider {
    /**
     * @param {import('./RequestQueue.js').RequestQueue} requestQueue
     * @param {import('./ETagManager.js').ETagManager} etagManager
     */
    constructor(requestQueue, etagManager) {
        this.requestQueue = requestQueue;
        this.etagManager = etagManager;
    }

    /**
     * Get the display name of this provider (e.g. "GitHub", "Nextcloud")
     * @returns {string}
     */
    get name() {
        throw new Error('StorageProvider.name must be implemented');
    }

    /**
     * Upload a batch of file changes atomically (or as close to atomic as the backend supports).
     * @param {Array<{path: string, content: string, encoding?: string, mode?: string}>} changes
     *   Each entry has a remote path, content string, and optional encoding ('utf-8' or 'base64').
     * @param {Object} credentials - Provider-specific credentials object
     * @returns {Promise<void>}
     */
    async uploadBatch(changes, credentials) {
        throw new Error('StorageProvider.uploadBatch must be implemented');
    }

    /**
     * Download a text file from the remote storage.
     * @param {string} path - Remote file path
     * @param {Object} credentials - Provider-specific credentials object
     * @returns {Promise<{ok: boolean, status: number, content: string|null}>}
     */
    async downloadFile(path, credentials) {
        throw new Error('StorageProvider.downloadFile must be implemented');
    }

    /**
     * Download a binary file from the remote storage.
     * @param {string} path - Remote file path
     * @param {Object} credentials - Provider-specific credentials object
     * @returns {Promise<Uint8Array>}
     */
    async downloadBinaryFile(path, credentials) {
        throw new Error('StorageProvider.downloadBinaryFile must be implemented');
    }

    /**
     * List files in a remote directory.
     * @param {string} path - Remote directory path
     * @param {Object} credentials - Provider-specific credentials object
     * @returns {Promise<{ok: boolean, status: number, files: Array<{name: string, type: string, download_url: string|null, url: string}>}>}
     */
    async listDirectory(path, credentials) {
        throw new Error('StorageProvider.listDirectory must be implemented');
    }

    /**
     * Poll for remote changes using efficient conditional requests (ETags, etc.).
     * @param {Object} credentials - Provider-specific credentials object
     * @returns {Promise<{hasChanges: boolean}>}
     */
    async pollForChanges(credentials) {
        throw new Error('StorageProvider.pollForChanges must be implemented');
    }

    /**
     * Clear any cached change-detection state (ETags, tokens, etc.).
     */
    clearChangeCache() {
        throw new Error('StorageProvider.clearChangeCache must be implemented');
    }

    /**
     * Build a credentials object from GSettings.
     * Each provider reads the keys it needs.
     * @param {Gio.Settings} settings
     * @returns {Object} Provider-specific credentials, or null if incomplete
     */
    getCredentials(settings) {
        throw new Error('StorageProvider.getCredentials must be implemented');
    }

    /**
     * Validate that credentials are configured.
     * @param {Object} credentials
     * @returns {boolean}
     */
    hasValidCredentials(credentials) {
        throw new Error('StorageProvider.hasValidCredentials must be implemented');
    }

    /**
     * Cleanup resources (HTTP sessions, caches, etc.)
     */
    cleanup() {
        if (this.etagManager) {
            this.etagManager.clearAll();
        }
    }
}
