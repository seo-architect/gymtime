PORT ?= 8000

.PHONY: dev

dev:
	python3 -m http.server $(PORT)
