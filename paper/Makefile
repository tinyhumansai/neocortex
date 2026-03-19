.PHONY: all setup build clean arxiv markdown figures-png

all: build markdown

setup:
	./scripts/setup.sh

figures-png:
	./scripts/export-svgs-to-png.sh

# PDF build (export-svgs-to-png runs inside scripts/build.sh).
build:
	./scripts/build.sh
	echo "Build complete: $$ROOT_DIR/out/main.pdf"

markdown:
	./scripts/render_markdown.sh
	echo "README updated: ./README.md"

clean:
	./scripts/clean.sh

arxiv:
	./scripts/package_arxiv.sh
