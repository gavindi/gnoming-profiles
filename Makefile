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

.PHONY: install uninstall dist clean