UUID = gnoming-profiles@gavindi.github.com
DESTDIR = ~/.local/share/gnome-shell/extensions/$(UUID)
DISTDIR = dist
ZIPFILE = $(DISTDIR)/$(UUID).zip

# Files to include in distribution
DIST_FILES = extension.js \
             prefs.js \
             metadata.json \
             stylesheet.css \
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

# Performance test target for v2.9
test-performance:
	@echo "Testing v2.9 performance improvements..."
	@echo "1. Enable the extension and monitor sync times"
	@echo "2. Check panel menu for request queue status"
	@echo "3. Monitor GitHub repository for batch commits"
	@echo "4. Verify reduced API calls in GitHub rate limit usage"

.PHONY: install uninstall dist clean test-performance