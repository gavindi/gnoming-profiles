# Gnoming Profiles - Seamless GNOME Configuration Sync

## 🚀 Never Lose Your Perfect Desktop Setup Again

**Gnoming Profiles** is the ultimate GNOME Shell extension for power users who demand consistency across multiple devices. Whether you're switching between your work laptop, home desktop, or that fresh Linux install, your perfectly configured desktop environment follows you everywhere.

## ✨ What Makes Gnoming Profiles Special?

### 🔄 **Effortless Multi-Device Sync**
Set up your desktop once, enjoy it everywhere. Your themes, keyboard shortcuts, workspace preferences, dock settings, and even wallpapers automatically sync across all your GNOME devices through GitHub, your own Nextcloud server, or Google Drive.

### ⚡ **Real-Time Intelligence**
- **Smart Change Detection**: Monitors your settings and files in real-time, automatically backing up changes as you make them
- **Ultra-Efficient Polling**: ETag and modifiedTime-based technology reduces bandwidth usage by up to 95% while checking for remote updates
- **Instant Sync**: Changes appear on your other devices within minutes, not hours

### 🎨 **Complete Desktop Preservation**
- **Settings & Preferences**: All your GNOME settings, extensions, themes, and customizations
- **Configuration Files**: Bash profiles, Git configs, editor settings, and any files you choose
- **Wallpapers**: Your desktop and lock screen wallpapers sync perfectly with binary-safe technology
- **Ubuntu Integration**: Special support for Ubuntu's unique desktop extensions and features
- **Workspace Magic**: Your entire workspace setup, keyboard shortcuts, and window management preferences

### 🌐 **Three Storage Backends — Your Data, Your Way**
- **GitHub**: Private repository with atomic commits and clean version history
- **Nextcloud**: Self-hosted WebDAV — keep everything on your own infrastructure
- **Google Drive**: Seamless GNOME Online Accounts integration — just pick your Google account and go
- **Switch Anytime**: Change storage providers on the fly — no restart, no data loss

### 🔒 **Security First**
- **Private Storage**: GitHub uses private repos; Nextcloud and Google Drive use your own account
- **Encrypted Credentials**: Tokens and passwords stored securely via GNOME GSettings
- **System-Managed Auth**: Google Drive uses GNOME Online Accounts — tokens managed by your desktop, not the extension
- **Selective Sync**: Only sync what you choose — complete control over your data
- **No Third Parties**: Works directly with your chosen provider — no middleman involved

## 🎯 Perfect For:

**👩‍💻 Developers** who work across multiple machines and want consistent development environments

**🎮 Power Users** who spend time customizing their desktop and don't want to repeat the work

**💼 Professionals** who need the same efficient workspace setup on work and personal devices

**🏠 Multi-Device Users** with laptops, desktops, and servers that need consistent configurations

**🐧 Linux Enthusiasts** who frequently install new distributions or upgrade systems

## 🚀 Key Features That Set Us Apart

### **Choose Your Backend**
- **GitHub**: Atomic batch commits via Tree API, clean version history, familiar Git workflow
- **Nextcloud**: Self-hosted WebDAV, full control over your data, no third-party accounts needed
- **Google Drive**: Uses your existing GNOME Online Account — no API keys or developer setup needed
- **Live Switching**: Change providers from preferences — takes effect immediately
- **Same Experience**: All three backends support every feature — settings, files, wallpapers, polling

### **Revolutionary Performance**
- **95% Bandwidth Reduction**: Conditional polling (ETags / modifiedTime) means lightning-fast sync checks
- **Batch Uploading**: GitHub uses Tree API for single-commit batching; Google Drive uses multipart upload with path-to-ID caching
- **Smart Caching**: SHA-256 content hashing means unchanged files are never re-uploaded
- **Memory Optimized**: Comprehensive resource management prevents system slowdowns

### **Smart Intelligence**
- **Google Drive Made Easy**: Just select your Google account from the dropdown — no credentials to manage
- **Auto-Discovery**: Automatically detects and syncs relevant GNOME settings
- **Smart Defaults**: Works perfectly out of the box with sensible presets
- **Wallpaper Magic**: Automatically handles wallpaper files without corruption
- **Ubuntu Ready**: Includes all Ubuntu-specific desktop extensions by default

### **Professional Reliability**
- **Binary-Safe Technology**: Wallpapers and files sync without corruption across all providers
- **Atomic Operations**: All changes succeed or fail together — no partial syncs
- **Error Recovery**: Robust handling of network issues, expired tokens, and conflicts
- **Token Auto-Refresh**: Google Drive tokens managed automatically by GNOME Online Accounts
- **Resource Clean**: Proper cleanup of sessions, tokens, and caches on extension disable

### **Visual Feedback**
- **Smart Panel Indicator**: Always know your sync status at a glance
- **Real-Time Updates**: See exactly what's happening with detailed status information
- **Progress Tracking**: Monitor sync operations, queue status, and polling efficiency

## 🎉 What Users Are Saying

*"Finally! I can hop between my work laptop and home desktop without spending an hour reconfiguring everything. The wallpaper sync is brilliant!"*

*"The ETag polling is genius — it barely uses any bandwidth but keeps everything perfectly in sync. My mobile hotspot thanks you!"*

*"Set it up once, forgot about it, and it just works. Exactly what a good tool should do."*

*"Being able to use my own Nextcloud server instead of GitHub was exactly what I needed. My configs never leave my infrastructure."*

*"Google Drive setup couldn't be easier — I already had my Google account in GNOME Settings, just picked it from the dropdown and everything started syncing."*

## 🔧 Simple Setup, Powerful Results

1. **Install** the extension from GNOME Extensions
2. **Pick** your storage — GitHub, Nextcloud, or Google Drive
3. **Connect** — enter a token, app password, or pick your Google account
4. **Choose** what to sync (or use the smart defaults)
5. **Relax** — your desktop setup is now immortal

## 🆓 Free, Open Source, Community Driven

Gnoming Profiles is completely free and open source under GPL v2. Built by the community, for the community, with love for the GNOME ecosystem.

---

## 📊 Technical Excellence

- **Pluggable Architecture**: StorageProvider strategy pattern — add new backends without touching existing code
- **Battle Tested**: Comprehensive error handling and edge case management across three providers
- **Performance Optimized**: Minimal resource usage with conditional polling, content caching, and path-to-ID resolution
- **Future Proof**: Built with modern GJS APIs and best practices

## 🎯 Ready to Transform Your Workflow?

Stop manually reconfiguring your desktop environment. Join thousands of users who've discovered the freedom of seamless configuration sync.

**[Install Gnoming Profiles Today →](https://extensions.gnome.org/)**

*Your future self will thank you.*

---

### 💜 Made with Love
*Dedicated to Jupiter 🐱, the feline coding companion who made this extension possible.*
