.PHONY: install test build publish version-patch version-minor version-major

install:
	uv sync

test:
	uv run pytest

build:
	uv build

publish: build
	uv publish

# Bump version in pyproject.toml, commit, and tag (e.g. make version-minor)
version-patch version-minor version-major:
	@PART=$$(echo $@ | sed 's/^version-//') && \
	VERSION=$$(uv run python scripts/bump_version.py $$PART) && \
	uv lock && \
	git add pyproject.toml uv.lock && \
	git commit -m "Bump version to $$VERSION" && \
	git tag -a "v$$VERSION" -m "Release v$$VERSION" && \
	echo "Bumped to $$VERSION, committed, and tagged v$$VERSION"
