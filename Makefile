DOCKER ?= docker

proxyman_files:=$(shell find . -maxdepth 1 -type f | sort -V | grep -Fv -e proxyman.zip -e Makefile -e README -e screenshot -e gitignore)

all: proxyman.zip

proxyman.zip: $(proxyman_files)
	zip $@ $^

clean:
	rm -f proxyman.zip

test:
	$(DOCKER) build -t proxyman-test . && $(DOCKER) run --init --cap-add=SYS_ADMIN --cap-add=NET_ADMIN --rm proxyman-test

.PHONY: all clean test
