.PHONY: all setup build clean arxiv markdown

all: build markdown

setup:
	./scripts/setup.sh

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
