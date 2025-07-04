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
	cp -r * $(DESTDIR)/
	glib-compile-schemas $(DESTDIR)/schemas/

uninstall:
	rm -rf $(DESTDIR)

dist:
	mkdir -p $(DISTDIR)
	rm -f $(ZIPFILE)
	zip -r $(ZIPFILE) $(DIST_FILES) -x "*.git*" "*~" "*.bak"
	@echo "Distribution package created: $(ZIPFILE)"

clean:
	rm -rf $(DISTDIR)

# Performance test target for v2.9 with ETag polling
test-performance:
	@echo "Testing v2.9 performance improvements with ETag polling..."
	@echo "1. Enable the extension and monitor sync times"
	@echo "2. Check panel menu for ETag polling status"
	@echo "3. Monitor request queue status for concurrency"
	@echo "4. Verify ETag caching (should show 'Cached' status)"
	@echo "5. Test 304 Not Modified responses (efficient polling)"
	@echo "6. Monitor GitHub repository for batch commits"
	@echo "7. Verify reduced API calls in GitHub rate limit usage"
	@echo "8. Check bandwidth usage reduction (up to 95% with ETags)"

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

# Full feature testing
test-features:
	@echo "Testing all v2.9 features..."
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

.PHONY: install uninstall dist clean test-performance test-etag test-features