UUID = gnoming-profiles@gavindi.github.com
DESTDIR = ~/.local/share/gnome-shell/extensions/$(UUID)
DISTDIR = dist
ZIPFILE = $(DISTDIR)/$(UUID).zip

# Files to include in distribution
DIST_FILES = extension.js \
             prefs.js \
             metadata.json \
             stylesheet.css \
             lib/ \
             schemas/

install:
	mkdir -p $(DESTDIR)
	cp -r $(DIST_FILES) $(DESTDIR)/
	rm -f $(DESTDIR)/lib/README.md
	glib-compile-schemas $(DESTDIR)/schemas/

uninstall:
	rm -rf $(DESTDIR)

dist:
	glib-compile-schemas schemas/
	mkdir -p $(DISTDIR)
	rm -f $(ZIPFILE)
	zip -r $(ZIPFILE) $(DIST_FILES) -x "*.git*" "*~" "*.bak" "lib/README.md"
	@echo "Distribution package created: $(ZIPFILE)"

clean:
	rm -rf $(DISTDIR)

# Performance test target for v3.0 with binary-safe wallpaper syncing
test-performance:
	@echo "Testing v3.0 performance improvements with binary-safe wallpaper syncing..."
	@echo "1. Enable the extension and monitor sync times"
	@echo "2. Check panel menu for ETag polling status"
	@echo "3. Monitor request queue status for concurrency"
	@echo "4. Verify ETag caching (should show 'Cached' status)"
	@echo "5. Test 304 Not Modified responses (efficient polling)"
	@echo "6. Monitor GitHub repository for batch commits"
	@echo "7. Verify reduced API calls in GitHub rate limit usage"
	@echo "8. Check bandwidth usage reduction (up to 95% with ETags)"
	@echo "9. Test wallpaper sync without corruption (v3.0)"

# ETag efficiency testing
test-etag:
	@echo "Testing ETag-based polling efficiency..."
	@echo "1. Enable GitHub polling in extension preferences"
	@echo "2. Watch panel menu ETag status indicators:"
	@echo "   - 'Not cached' -> 'Cached' (initial ETag stored)"
	@echo "   - 'No changes (304)' indicates efficient polling"
	@echo "   - 'Changes detected' when content actually changes"
	@echo "3. Monitor network traffic to see bandwidth reduction"
	@echo "4. Check GitHub API rate limit usage (should be minimal)"
	@echo "5. Test with frequent polling intervals (1-2 minutes)"

# Binary-safe wallpaper testing (NEW in v3.0)
test-wallpapers:
	@echo "Testing binary-safe wallpaper syncing (v3.0)..."
	@echo "1. Enable wallpaper syncing in extension preferences"
	@echo "2. Set custom wallpapers in GNOME settings"
	@echo "3. Perform manual sync and check logs for corruption validation"
	@echo "4. Verify wallpapers download to ~/.local/share/gnoming-profiles/wallpapers/"
	@echo "5. Check that downloaded wallpapers open correctly in image viewer"
	@echo "6. Verify JPEG headers start with 0xFF 0xD8 0xFF"
	@echo "7. Verify PNG headers start with 0x89 0x50 0x4E 0x47"
	@echo "8. Test that GSettings point to correct local wallpaper files"

# Full feature testing
test-features:
	@echo "Testing all v3.0 features..."
	@echo "GitHub Tree API Batching:"
	@echo "  - Multiple file changes in single commits"
	@echo "  - Check repository for clean commit history"
	@echo "ETag Polling:"
	@echo "  - Conditional requests with If-None-Match headers"
	@echo "  - 304 responses for unchanged content"
	@echo "Request Queue:"
	@echo "  - Max 3 concurrent requests"
	@echo "  - Queue status in panel menu"
	@echo "Smart Caching:"
	@echo "  - SHA-256 based change detection"
	@echo "  - Skip uploads for unchanged files"
	@echo "HTTP Session Reuse:"
	@echo "  - Connection pooling for better performance"
	@echo "Binary-Safe Wallpapers (v3.0):"
	@echo "  - Corruption-free wallpaper downloads"
	@echo "  - Header validation for JPEG/PNG files"
	@echo "  - File integrity verification"

.PHONY: install uninstall dist clean test-performance test-etag test-wallpapers test-features