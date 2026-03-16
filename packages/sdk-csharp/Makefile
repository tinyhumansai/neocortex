.PHONY: build test integration-test clean

build:
	dotnet build

test:
	dotnet test --filter "Category!=Integration"

integration-test:
	dotnet test --filter "Category=Integration"

clean:
	dotnet clean
	rm -rf src/Alphahuman.Sdk/bin src/Alphahuman.Sdk/obj
	rm -rf test/Alphahuman.Sdk.Tests/bin test/Alphahuman.Sdk.Tests/obj
	rm -rf example/Alphahuman.Sdk.Example/bin example/Alphahuman.Sdk.Example/obj
