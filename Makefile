.PHONY: run build test fmt vet tidy clean

BINARY := kintore-go

run:
	go run .

build:
	go build -o $(BINARY) .

test:
	go test ./...

fmt:
	go fmt ./...

vet:
	go vet ./...

tidy:
	go mod tidy

clean:
	rm -f $(BINARY)
