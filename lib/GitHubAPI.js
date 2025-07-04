/*
 * GitHubAPI.js - GitHub API integration with ETag support
 * Part of Gnoming Profiles extension
 */

import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

/**
 * GitHub API client with ETag support and request queuing
 */
export class GitHubAPI {
    constructor(requestQueue, etagManager) {
        this.requestQueue = requestQueue;
        this.etagManager = etagManager;
        this.httpSession = null;
        this._initializeSession();
    }
    
    /**
     * Initialize HTTP session for connection reuse
     */
    _initializeSession() {
        this.httpSession = new Soup.Session();
        this.httpSession.timeout = 30;
        this.httpSession.max_conns = 10;
        this.httpSession.user_agent = 'GNOME-Config-Sync/2.9.0-ETag';
    }
    
    /**
     * Make a GitHub API request with ETag support
     * @param {string} url - The API URL
     * @param {string} method - HTTP method
     * @param {string} token - GitHub token
     * @param {Object} data - Request data (for POST/PATCH)
     * @param {string} etag - ETag for conditional requests
     * @returns {Promise<Object>} Response object
     */
    async makeRequest(url, method, token, data = null, etag = null) {
        return this.requestQueue.add(() => this._performRequest(url, method, token, data, etag));
    }
    
    /**
     * Perform the actual HTTP request
     */
    _performRequest(url, method, token, data = null, etag = null) {
        return new Promise((resolve, reject) => {
            try {
                const message = Soup.Message.new(method, url);
                
                // Set headers
                message.request_headers.append('Authorization', `token ${token}`);
                message.request_headers.append('Accept', 'application/vnd.github.v3+json');
                
                // Add ETag for conditional requests
                if (etag && method === 'GET') {
                    message.request_headers.append('If-None-Match', etag);
                    log(`GitHub API: Adding If-None-Match header: ${etag}`);
                }
                
                if (data) {
                    const json = JSON.stringify(data);
                    message.set_request_body_from_bytes(
                        'application/json',
                        GLib.Bytes.new(new TextEncoder().encode(json))
                    );
                }
                
                // Make request using HTTP session
                this.httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);
                        const responseData = new TextDecoder().decode(bytes.get_data());
                        
                        // Extract ETag from response headers
                        let responseETag = null;
                        if (message.response_headers) {
                            responseETag = message.response_headers.get_one('ETag');
                        }
                        
                        resolve({
                            ok: message.status_code >= 200 && message.status_code < 300,
                            status: message.status_code,
                            data: responseData,
                            etag: responseETag
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * Poll for changes using ETag-based conditional requests
     * @param {string} username - GitHub username
     * @param {string} repo - Repository name
     * @param {string} token - GitHub token
     * @returns {Promise<Object>} Poll result
     */
    async pollForChanges(username, repo, token) {
        const commitsUrl = `https://api.github.com/repos/${username}/${repo}/commits?per_page=1`;
        const cachedETag = this.etagManager.getETag('commits');
        
        log(`GitHub API: Polling for changes ${cachedETag ? 'with ETag' : 'without ETag'}`);
        
        try {
            const response = await this.makeRequest(commitsUrl, 'GET', token, null, cachedETag);
            
            // Handle 304 Not Modified response
            if (response.status === 304) {
                log('GitHub API: No changes detected (304 Not Modified)');
                this.etagManager.setLastPollResult(false);
                return { hasChanges: false, commits: [], etag304: true };
            }
            
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} - ${response.data}`);
            }
            
            // Store new ETag
            if (response.etag) {
                this.etagManager.setETag('commits', response.etag);
            }
            
            const commits = JSON.parse(response.data);
            this.etagManager.setLastPollResult(true);
            
            return { hasChanges: true, commits, etag304: false };
            
        } catch (error) {
            this.etagManager.setLastPollResult(null);
            throw error;
        }
    }
    
    /**
     * Get repository contents
     * @param {string} username - GitHub username
     * @param {string} repo - Repository name
     * @param {string} path - File path
     * @param {string} token - GitHub token
     * @returns {Promise<Object>} File contents
     */
    async getContents(username, repo, path, token) {
        const url = `https://api.github.com/repos/${username}/${repo}/contents/${path}`;
        return this.makeRequest(url, 'GET', token);
    }
    
    /**
     * Create a blob
     * @param {string} username - GitHub username
     * @param {string} repo - Repository name
     * @param {string} token - GitHub token
     * @param {Object} blobData - Blob data
     * @returns {Promise<Object>} Blob response
     */
    async createBlob(username, repo, token, blobData) {
        const url = `https://api.github.com/repos/${username}/${repo}/git/blobs`;
        return this.makeRequest(url, 'POST', token, blobData);
    }
    
    /**
     * Create a tree
     * @param {string} username - GitHub username
     * @param {string} repo - Repository name
     * @param {string} token - GitHub token
     * @param {Object} treeData - Tree data
     * @returns {Promise<Object>} Tree response
     */
    async createTree(username, repo, token, treeData) {
        const url = `https://api.github.com/repos/${username}/${repo}/git/trees`;
        return this.makeRequest(url, 'POST', token, treeData);
    }
    
    /**
     * Create a commit
     * @param {string} username - GitHub username
     * @param {string} repo - Repository name
     * @param {string} token - GitHub token
     * @param {Object} commitData - Commit data
     * @returns {Promise<Object>} Commit response
     */
    async createCommit(username, repo, token, commitData) {
        const url = `https://api.github.com/repos/${username}/${repo}/git/commits`;
        return this.makeRequest(url, 'POST', token, commitData);
    }
    
    /**
     * Update branch reference
     * @param {string} username - GitHub username
     * @param {string} repo - Repository name
     * @param {string} token - GitHub token
     * @param {Object} refData - Reference data
     * @returns {Promise<Object>} Reference response
     */
    async updateRef(username, repo, token, refData) {
        const url = `https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`;
        return this.makeRequest(url, 'PATCH', token, refData);
    }
    
    /**
     * Get branch reference
     * @param {string} username - GitHub username
     * @param {string} repo - Repository name
     * @param {string} token - GitHub token
     * @returns {Promise<Object>} Branch response
     */
    async getBranch(username, repo, token) {
        const url = `https://api.github.com/repos/${username}/${repo}/git/refs/heads/main`;
        return this.makeRequest(url, 'GET', token);
    }
    
    /**
     * Get commit details
     * @param {string} username - GitHub username
     * @param {string} repo - Repository name
     * @param {string} sha - Commit SHA
     * @param {string} token - GitHub token
     * @returns {Promise<Object>} Commit response
     */
    async getCommit(username, repo, sha, token) {
        const url = `https://api.github.com/repos/${username}/${repo}/git/commits/${sha}`;
        return this.makeRequest(url, 'GET', token);
    }
    
    /**
     * Clear ETag cache (call after making changes to repository)
     */
    clearETagCache() {
        this.etagManager.clearETag('commits');
        log('GitHub API: Cleared ETag cache after repository changes');
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.httpSession) {
            this.httpSession = null;
        }
        this.etagManager.clearAll();
    }
}