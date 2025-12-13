/**
 * PermissionManagerService - Manages file system access permissions
 * Handles persistent storage of directory handles and permission lifecycle
 */
import EventBus from '../utils/EventBus.js';

class PermissionManagerService {
    constructor(databaseService) {
        this.db = databaseService;

        // Constants
        this.IDB_NAME = 'MusicPlayerHandles';
        this.IDB_VERSION = 1;
        this.HANDLE_STORE = 'handles';

        // State
        this.dirHandle = null;
        this.idb = null;
    }

    /**
     * Initialize permission manager and restore handle
     */
    async init() {
        try {
            // Open native IndexedDB connection
            this.idb = await this.openIDB();
            console.log('[PermissionManager] IndexedDB opened');

            // Restore handle from IndexedDB
            const handle = await this.restoreHandleFromIDB();
            if (handle) {
                this.dirHandle = handle;
                console.log('[PermissionManager] Handle restored from IndexedDB');

                // Check permission status
                const status = await this.checkPermission();
                console.log(`[PermissionManager] Permission status: ${status}`);

                // Show banner immediately if permission not granted
                // (auto-request removed - requires user gesture to work)
                if (status !== 'granted') {
                    console.log('[PermissionManager] Permission not granted, showing banner');
                    EventBus.emit('permission:needed');
                }
            } else {
                console.log('[PermissionManager] No handle found in storage');
            }
        } catch (error) {
            console.error('[PermissionManager] Init error:', error);
        }
    }

    /**
     * Open native IndexedDB connection
     */
    async openIDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.IDB_NAME, this.IDB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.HANDLE_STORE)) {
                    db.createObjectStore(this.HANDLE_STORE);
                    console.log('[PermissionManager] Created handles object store');
                }
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Restore handle from IndexedDB
     */
    async restoreHandleFromIDB() {
        if (!this.idb) return null;

        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction([this.HANDLE_STORE], 'readonly');
            const store = tx.objectStore(this.HANDLE_STORE);
            const request = store.get('root');

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                console.error('[PermissionManager] Error restoring handle:', request.error);
                resolve(null);
            };
        });
    }

    /**
     * Save directory handle to IndexedDB
     */
    async saveHandle(handle) {
        if (!this.idb) {
            console.error('[PermissionManager] IndexedDB not initialized');
            return;
        }

        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction([this.HANDLE_STORE], 'readwrite');
            const store = tx.objectStore(this.HANDLE_STORE);
            const request = store.put(handle, 'root');

            request.onsuccess = () => {
                this.dirHandle = handle;
                console.log('[PermissionManager] Handle saved to IndexedDB');
                resolve();
            };

            request.onerror = () => {
                console.error('[PermissionManager] Error saving handle:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get stored directory handle
     */
    async getHandle() {
        // Return cached handle if available
        if (this.dirHandle) {
            return this.dirHandle;
        }

        // Try to restore from IndexedDB
        if (this.idb) {
            this.dirHandle = await this.restoreHandleFromIDB();
        }

        return this.dirHandle;
    }

    /**
     * Check current permission status
     */
    async checkPermission() {
        if (!this.dirHandle) return null;

        try {
            const status = await this.dirHandle.queryPermission({ mode: 'read' });
            return status;
        } catch (error) {
            console.error('[PermissionManager] Error checking permission:', error);
            return null;
        }
    }

    /**
     * Request permission manually (user-initiated)
     */
    async requestPermissionManual() {
        if (!this.dirHandle) return false;

        try {
            const status = await this.dirHandle.requestPermission({ mode: 'read' });
            return status === 'granted';
        } catch (error) {
            console.error('[PermissionManager] Manual request failed:', error);
            return false;
        }
    }

    /**
     * Clear stored handle (for rescan)
     */
    async clearHandle() {
        if (!this.idb) return;

        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction([this.HANDLE_STORE], 'readwrite');
            const store = tx.objectStore(this.HANDLE_STORE);
            const request = store.delete('root');

            request.onsuccess = () => {
                this.dirHandle = null;
                console.log('[PermissionManager] Handle cleared');
                resolve();
            };

            request.onerror = () => {
                console.error('[PermissionManager] Error clearing handle:', request.error);
                reject(request.error);
            };
        });
    }

}

export default PermissionManagerService;
