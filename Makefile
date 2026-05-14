.PHONY: install build serve clean test deploy

PYTHON ?= python3
DUMP   ?= ../legislink-2026.db
OUT    ?= dist

install:
	$(PYTHON) -m pip install -r requirements.txt

test:
	$(PYTHON) -m pytest tests/ -v

build:
	$(PYTHON) -m build.build --dump $(DUMP) --out $(OUT)

serve: build
	$(PYTHON) -m http.server -d $(OUT) 8080

clean:
	rm -rf $(OUT) build/__pycache__ tests/__pycache__ .pytest_cache

deploy: build
	./scripts/deploy.sh
