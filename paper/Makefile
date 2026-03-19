.PHONY: all setup build clean arxiv html markdown

all: build html markdown

setup:
	./scripts/setup.sh

build:
	./scripts/build.sh
	echo "Build complete: $$ROOT_DIR/out/main.pdf"

html:
	./scripts/render_html.sh
	echo "HTML render complete: $$ROOT_DIR/out/main.html"

markdown:
	./scripts/render_markdown.sh
	cp ./out/main.md ./README.md
	echo "Markdown render complete: $$ROOT_DIR/out/main.md"
	echo "README updated: ./README.md"

clean:
	./scripts/clean.sh

arxiv:
	./scripts/package_arxiv.sh
