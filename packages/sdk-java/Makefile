.PHONY: build test integration-test clean

build:
	./gradlew build

test:
	./gradlew test

integration-test:
	ALPHAHUMAN_TOKEN=$(ALPHAHUMAN_TOKEN) ./gradlew test

clean:
	./gradlew clean
