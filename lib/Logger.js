/*
 * Logger.js - Gated logging utilities for Gnoming Profiles
 * Part of Gnoming Profiles extension
 *
 * Copyright 2025 Gavin Graham (gavindi)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPLv2)
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import GLib from 'gi://GLib';

/**
 * Informational logging is gated behind the GNOMING_PROFILES_DEBUG
 * environment variable so the extension does not write excessively to the
 * journal. Errors are always logged since the log should only be used for
 * important messages and errors (GNOME review guideline EGO-A-004).
 */
const DEBUG = GLib.getenv('GNOMING_PROFILES_DEBUG') === '1';

export const Logger = {
    /**
     * Log an informational message (only when debugging is enabled)
     * @param {string} message - Message to log
     */
    log(message) {
        if (DEBUG)
            console.log(message);
    },

    /**
     * Log a warning (only when debugging is enabled)
     * @param {string} message - Message to log
     */
    warn(message) {
        if (DEBUG)
            console.warn(message);
    },

    /**
     * Log an error (always)
     * @param {string} message - Message to log
     */
    error(message) {
        console.error(message);
    },
};
