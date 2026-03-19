DOCKER ?= docker

proxyalien_files:=icon-128.png icon-16.png icon-32.png icon-48.png manifest.json options.html options.js popup.html popup.js proxyalien.js screenshot-0.png screenshot-1.png screenshot-2.png style.css worker.js

all: proxyalien.zip

proxyalien.zip: $(proxyalien_files)
	zip $@ $^

clean:
	rm -f proxyalien.zip

test:
	$(DOCKER) build -t proxyalien-test . && $(DOCKER) run --init --cap-add=SYS_ADMIN --cap-add=NET_ADMIN --rm proxyalien-test

.PHONY: all clean test
