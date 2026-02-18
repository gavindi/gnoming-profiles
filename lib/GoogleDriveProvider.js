/*
 * GoogleDriveProvider.js - Google Drive storage backend implementing StorageProvider
 * Part of Gnoming Profiles extension
 */

import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import { StorageProvider } from './StorageProvider.js';

/**
 * Google Drive storage provider using the Drive API v3 with OAuth2 authentication.
 */
export class GoogleDriveProvider extends StorageProvider {
    static DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
    static DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
    static TOKEN_URL = 'https://oauth2.googleapis.com/token';
    static FOLDER_MIME = 'application/vnd.google-apps.folder';

    static HTTP_OK = 200;
    static HTTP_NOT_FOUND = 404;
    static HTTP_UNAUTHORIZED = 401;

    constructor(requestQueue, etagManager) {
        super(requestQueue, etagManager);
        this._httpSession = null;
        this._accessToken = null;
        this._accessTokenExpiry = 0;
        this._pathIdCache = new Map();
        this._rootFolderId = null;
        this._initializeSession();
    }

    get name() {
        return 'Google Drive';
    }

    _initializeSession() {
        this._httpSession = new Soup.Session();
        this._httpSession.timeout = 30;
        this._httpSession.max_conns = 10;
        this._httpSession.user_agent = 'GNOME-Config-Sync/3.1.0-GoogleDrive';
    }

    // ── Credentials ──────────────────────────────────────────────────

    getCredentials(settings) {
        const clientId = settings.get_string('gdrive-client-id');
        const clientSecret = settings.get_string('gdrive-client-secret');
        const refreshToken = settings.get_string('gdrive-refresh-token');
        const folderName = settings.get_string('gdrive-folder-name');

        if (!clientId || !clientSecret || !refreshToken) return null;

        return {
            clientId,
            clientSecret,
            refreshToken,
            folderName: folderName || '.gnoming-profiles',
        };
    }

    hasValidCredentials(credentials) {
        return !!(credentials && credentials.clientId && credentials.clientSecret && credentials.refreshToken);
    }

    // ── Token management ─────────────────────────────────────────────

    async _ensureAccessToken(credentials) {
        const now = GLib.get_monotonic_time();
        if (this._accessToken && now < this._accessTokenExpiry - 60_000_000) {
            return;
        }
        await this._refreshAccessToken(credentials);
    }

    async _refreshAccessToken(credentials) {
        const body = `client_id=${encodeURIComponent(credentials.clientId)}` +
            `&client_secret=${encodeURIComponent(credentials.clientSecret)}` +
            `&refresh_token=${encodeURIComponent(credentials.refreshToken)}` +
            `&grant_type=refresh_token`;

        const response = await this._performTokenRequest(body);

        if (!response.ok) {
            const errorData = response.data ? JSON.parse(response.data) : {};
            if (errorData.error === 'invalid_grant') {
                this._accessToken = null;
                this._accessTokenExpiry = 0;
                throw new Error('Google Drive refresh token is invalid or revoked. Please re-authorize in extension preferences.');
            }
            throw new Error(`Token refresh failed: ${response.status} - ${response.data}`);
        }

        const tokenData = JSON.parse(response.data);
        this._accessToken = tokenData.access_token;
        this._accessTokenExpiry = GLib.get_monotonic_time() + (tokenData.expires_in * 1_000_000);
        console.log('GoogleDriveProvider: Access token refreshed');
    }

    _performTokenRequest(body) {
        return new Promise((resolve, reject) => {
            try {
                const message = Soup.Message.new('POST', GoogleDriveProvider.TOKEN_URL);
                const bytes = GLib.Bytes.new(new TextEncoder().encode(body));
                message.set_request_body_from_bytes('application/x-www-form-urlencoded', bytes);

                this._httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                    try {
                        const responseBytes = session.send_and_read_finish(result);
                        const data = responseBytes ? new TextDecoder().decode(responseBytes.get_data()) : '';
                        resolve({
                            ok: message.status_code >= 200 && message.status_code < 300,
                            status: message.status_code,
                            data,
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

    // ── HTTP helpers ─────────────────────────────────────────────────

    async _request(url, method, credentials, body = null, extraHeaders = null, expectBinary = false) {
        await this._ensureAccessToken(credentials);
        return this.requestQueue.add(() => this._performRequest(url, method, body, extraHeaders, expectBinary));
    }

    async _requestWithRetry(url, method, credentials, body = null, extraHeaders = null, expectBinary = false) {
        const response = await this._request(url, method, credentials, body, extraHeaders, expectBinary);

        if (response.status === GoogleDriveProvider.HTTP_UNAUTHORIZED) {
            console.log('GoogleDriveProvider: Got 401, refreshing token and retrying');
            this._accessToken = null;
            this._accessTokenExpiry = 0;
            return this._request(url, method, credentials, body, extraHeaders, expectBinary);
        }

        return response;
    }

    _performRequest(url, method, body, extraHeaders, expectBinary) {
        return new Promise((resolve, reject) => {
            try {
                const message = Soup.Message.new(method, url);
                message.request_headers.append('Authorization', `Bearer ${this._accessToken}`);

                if (extraHeaders) {
                    for (const [key, value] of Object.entries(extraHeaders)) {
                        message.request_headers.append(key, value);
                    }
                }

                if (body !== null) {
                    const contentType = (extraHeaders && extraHeaders['Content-Type']) || 'application/json';
                    const bytes = (body instanceof Uint8Array)
                        ? GLib.Bytes.new(body)
                        : GLib.Bytes.new(new TextEncoder().encode(body));
                    message.set_request_body_from_bytes(contentType, bytes);
                }

                this._httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                    try {
                        const responseBytes = session.send_and_read_finish(result);
                        const rawData = responseBytes ? responseBytes.get_data() : null;
                        let data;
                        if (expectBinary) {
                            data = rawData;
                        } else {
                            data = rawData ? new TextDecoder().decode(rawData) : '';
                        }

                        resolve({
                            ok: message.status_code >= 200 && message.status_code < 300,
                            status: message.status_code,
                            data,
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

    // ── Folder & path resolution ─────────────────────────────────────

    async _ensureRootFolder(credentials) {
        if (this._rootFolderId) return this._rootFolderId;

        // Search for existing folder
        const q = `name='${credentials.folderName}' and mimeType='${GoogleDriveProvider.FOLDER_MIME}' and 'root' in parents and trashed=false`;
        const url = `${GoogleDriveProvider.DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
        const response = await this._requestWithRetry(url, 'GET', credentials);

        if (response.ok) {
            const data = JSON.parse(response.data);
            if (data.files && data.files.length > 0) {
                this._rootFolderId = data.files[0].id;
                console.log(`GoogleDriveProvider: Found root folder: ${this._rootFolderId}`);
                return this._rootFolderId;
            }
        }

        // Create folder
        const metadata = JSON.stringify({
            name: credentials.folderName,
            mimeType: GoogleDriveProvider.FOLDER_MIME,
        });
        const createUrl = `${GoogleDriveProvider.DRIVE_API_BASE}/files`;
        const createResponse = await this._requestWithRetry(createUrl, 'POST', credentials, metadata, {
            'Content-Type': 'application/json',
        });

        if (!createResponse.ok) {
            throw new Error(`Failed to create root folder: ${createResponse.status} - ${createResponse.data}`);
        }

        const folderData = JSON.parse(createResponse.data);
        this._rootFolderId = folderData.id;
        console.log(`GoogleDriveProvider: Created root folder: ${this._rootFolderId}`);
        return this._rootFolderId;
    }

    async _createFolder(name, parentId, credentials) {
        const metadata = JSON.stringify({
            name,
            mimeType: GoogleDriveProvider.FOLDER_MIME,
            parents: [parentId],
        });
        const url = `${GoogleDriveProvider.DRIVE_API_BASE}/files`;
        const response = await this._requestWithRetry(url, 'POST', credentials, metadata, {
            'Content-Type': 'application/json',
        });

        if (!response.ok) {
            throw new Error(`Failed to create folder '${name}': ${response.status}`);
        }

        return JSON.parse(response.data).id;
    }

    async _resolvePathToId(path, credentials, createMissing = false) {
        if (this._pathIdCache.has(path)) {
            return this._pathIdCache.get(path);
        }

        const rootId = await this._ensureRootFolder(credentials);
        const segments = path.split('/').filter(Boolean);

        let currentParentId = rootId;
        let currentPath = '';

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            currentPath = currentPath ? `${currentPath}/${segment}` : segment;
            const isLastSegment = i === segments.length - 1;

            // Check cache for intermediate paths
            if (this._pathIdCache.has(currentPath)) {
                currentParentId = this._pathIdCache.get(currentPath);
                continue;
            }

            // Query Drive for this segment
            const q = `name='${segment.replace(/'/g, "\\'")}' and '${currentParentId}' in parents and trashed=false`;
            const url = `${GoogleDriveProvider.DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)`;
            const response = await this._requestWithRetry(url, 'GET', credentials);

            if (response.ok) {
                const data = JSON.parse(response.data);
                if (data.files && data.files.length > 0) {
                    const fileId = data.files[0].id;
                    this._pathIdCache.set(currentPath, fileId);
                    currentParentId = fileId;
                    continue;
                }
            }

            // Not found
            if (!createMissing) return null;

            // Create missing directory (only for non-last segments, or last if it should be a folder)
            if (!isLastSegment) {
                const folderId = await this._createFolder(segment, currentParentId, credentials);
                this._pathIdCache.set(currentPath, folderId);
                currentParentId = folderId;
                console.log(`GoogleDriveProvider: Created folder '${currentPath}': ${folderId}`);
            } else {
                // Last segment not found and createMissing is true — caller will create the file
                return null;
            }
        }

        return currentParentId;
    }

    async _ensureParentFolders(path, credentials) {
        const parts = path.split('/');
        if (parts.length <= 1) {
            return this._ensureRootFolder(credentials);
        }

        const parentPath = parts.slice(0, -1).join('/');
        const parentId = await this._resolvePathToId(parentPath, credentials, true);
        return parentId || await this._ensureRootFolder(credentials);
    }

    // ── Multipart upload helper ──────────────────────────────────────

    _buildMultipartBody(metadata, contentBytes) {
        const boundary = `gnoming_profiles_${Date.now()}`;
        const metadataJson = JSON.stringify(metadata);

        const preamble = new TextEncoder().encode(
            `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${metadataJson}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: application/octet-stream\r\n\r\n`
        );
        const epilogue = new TextEncoder().encode(`\r\n--${boundary}--`);

        const combined = new Uint8Array(preamble.length + contentBytes.length + epilogue.length);
        combined.set(preamble, 0);
        combined.set(contentBytes, preamble.length);
        combined.set(epilogue, preamble.length + contentBytes.length);

        return { body: combined, contentType: `multipart/related; boundary=${boundary}` };
    }

    // ── StorageProvider implementation ────────────────────────────────

    async uploadBatch(changes, credentials) {
        await this._ensureRootFolder(credentials);

        let uploaded = 0;
        for (const change of changes) {
            try {
                const parentId = await this._ensureParentFolders(change.path, credentials);

                // Prepare content bytes
                let contentBytes;
                if (change.encoding === 'base64') {
                    contentBytes = GLib.base64_decode(change.content);
                } else {
                    contentBytes = new TextEncoder().encode(change.content);
                }

                // Check if file already exists
                const existingId = await this._resolvePathToId(change.path, credentials, false);

                if (existingId) {
                    // Update existing file
                    const { body, contentType } = this._buildMultipartBody({}, contentBytes);
                    const url = `${GoogleDriveProvider.DRIVE_UPLOAD_BASE}/files/${existingId}?uploadType=multipart`;
                    const response = await this._requestWithRetry(url, 'PATCH', credentials, body, {
                        'Content-Type': contentType,
                    });

                    if (response.ok) {
                        uploaded++;
                        console.log(`GoogleDriveProvider: Updated ${change.path}`);

                        // Cache modifiedTime for polling baseline
                        if (change.path === 'config-backup.json') {
                            const fileData = JSON.parse(response.data);
                            if (fileData.modifiedTime) {
                                this.etagManager.setETag('gdrive-config-modtime', fileData.modifiedTime);
                            }
                        }
                    } else {
                        console.error(`GoogleDriveProvider: Failed to update ${change.path}: HTTP ${response.status}`);
                    }
                } else {
                    // Create new file
                    const fileName = change.path.split('/').pop();
                    const metadata = {
                        name: fileName,
                        parents: [parentId],
                    };
                    const { body, contentType } = this._buildMultipartBody(metadata, contentBytes);
                    const url = `${GoogleDriveProvider.DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,modifiedTime`;
                    const response = await this._requestWithRetry(url, 'POST', credentials, body, {
                        'Content-Type': contentType,
                    });

                    if (response.ok) {
                        const fileData = JSON.parse(response.data);
                        this._pathIdCache.set(change.path, fileData.id);
                        uploaded++;
                        console.log(`GoogleDriveProvider: Created ${change.path}: ${fileData.id}`);

                        if (change.path === 'config-backup.json' && fileData.modifiedTime) {
                            this.etagManager.setETag('gdrive-config-modtime', fileData.modifiedTime);
                        }
                    } else {
                        console.error(`GoogleDriveProvider: Failed to create ${change.path}: HTTP ${response.status}`);
                    }
                }
            } catch (e) {
                console.error(`GoogleDriveProvider: Error uploading ${change.path}: ${e.message}`);
            }
        }

        console.log(`GoogleDriveProvider: Uploaded ${uploaded}/${changes.length} files`);
    }

    async downloadFile(path, credentials) {
        const fileId = await this._resolvePathToId(path, credentials, false);

        if (!fileId) {
            console.error(`GoogleDriveProvider: File not found: ${path}`);
            return { ok: false, status: GoogleDriveProvider.HTTP_NOT_FOUND, content: null };
        }

        const url = `${GoogleDriveProvider.DRIVE_API_BASE}/files/${fileId}?alt=media`;
        const response = await this._requestWithRetry(url, 'GET', credentials);

        if (!response.ok) {
            // Invalidate cache on 404 in case file was deleted
            if (response.status === GoogleDriveProvider.HTTP_NOT_FOUND) {
                this._pathIdCache.delete(path);
            }
            console.error(`GoogleDriveProvider: Download failed for ${path}: HTTP ${response.status}`);
            return { ok: false, status: response.status, content: null };
        }

        return { ok: true, status: response.status, content: response.data };
    }

    async downloadBinaryFile(path, credentials) {
        const fileId = await this._resolvePathToId(path, credentials, false);

        if (!fileId) {
            throw new Error(`File not found: ${path}`);
        }

        const url = `${GoogleDriveProvider.DRIVE_API_BASE}/files/${fileId}?alt=media`;
        const response = await this._requestWithRetry(url, 'GET', credentials, null, null, true);

        if (!response.ok) {
            if (response.status === GoogleDriveProvider.HTTP_NOT_FOUND) {
                this._pathIdCache.delete(path);
            }
            throw new Error(`Binary download failed for ${path}: ${response.status}`);
        }

        if (response.data instanceof Uint8Array) {
            return response.data;
        }
        throw new Error('Response was not binary data as expected');
    }

    async listDirectory(path, credentials) {
        let parentId;
        if (!path || path === '' || path === '/') {
            parentId = await this._ensureRootFolder(credentials);
        } else {
            parentId = await this._resolvePathToId(path, credentials, false);
            if (!parentId) {
                return { ok: false, status: GoogleDriveProvider.HTTP_NOT_FOUND, files: [] };
            }
        }

        const q = `'${parentId}' in parents and trashed=false`;
        const url = `${GoogleDriveProvider.DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)`;
        const response = await this._requestWithRetry(url, 'GET', credentials);

        if (!response.ok) {
            return { ok: false, status: response.status, files: [] };
        }

        const data = JSON.parse(response.data);
        const files = (data.files || []).map(file => ({
            name: file.name,
            type: file.mimeType === GoogleDriveProvider.FOLDER_MIME ? 'dir' : 'file',
            download_url: null,
            url: file.id,
        }));

        return { ok: true, status: response.status, files };
    }

    async pollForChanges(credentials) {
        // Resolve config-backup.json without creating if missing
        const fileId = await this._resolvePathToId('config-backup.json', credentials, false);

        if (!fileId) {
            console.log('GoogleDriveProvider: Config file not found on Drive');
            this.etagManager.setLastPollResult(false);
            return { hasChanges: false };
        }

        const url = `${GoogleDriveProvider.DRIVE_API_BASE}/files/${fileId}?fields=modifiedTime`;
        const response = await this._requestWithRetry(url, 'GET', credentials);

        if (!response.ok) {
            if (response.status === GoogleDriveProvider.HTTP_NOT_FOUND) {
                this._pathIdCache.delete('config-backup.json');
                this.etagManager.setLastPollResult(false);
                return { hasChanges: false };
            }
            throw new Error(`Poll failed: ${response.status}`);
        }

        const data = JSON.parse(response.data);
        const newModTime = data.modifiedTime;
        const cachedModTime = this.etagManager.getETag('gdrive-config-modtime');

        if (!cachedModTime) {
            // First poll — cache and return no changes
            this.etagManager.setETag('gdrive-config-modtime', newModTime);
            this.etagManager.setLastPollResult(false);
            console.log(`GoogleDriveProvider: First poll, cached modifiedTime: ${newModTime}`);
            return { hasChanges: false };
        }

        const hasChanges = cachedModTime !== newModTime;
        this.etagManager.setETag('gdrive-config-modtime', newModTime);
        this.etagManager.setLastPollResult(hasChanges);

        if (hasChanges) {
            console.log(`GoogleDriveProvider: modifiedTime changed from ${cachedModTime} to ${newModTime}`);
        }

        return { hasChanges };
    }

    clearChangeCache() {
        this.etagManager.clearETag('gdrive-config-modtime');
        this._pathIdCache.clear();
        this._rootFolderId = null;
        console.log('GoogleDriveProvider: Cleared change cache');
    }

    cleanup() {
        if (this._httpSession) {
            this._httpSession.abort();
            this._httpSession = null;
        }
        this._accessToken = null;
        this._accessTokenExpiry = 0;
        this._pathIdCache.clear();
        this._rootFolderId = null;
        super.cleanup();
    }
}
