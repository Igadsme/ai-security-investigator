.PHONY: setup backend frontend docker test sample-video

setup: backend frontend

backend:
	cd backend && python3.11 -m venv venv && . venv/bin/activate && pip install -r requirements.txt
	cp -n backend/.env.example backend/.env || true

frontend:
	cd frontend && npm install
	cp -n frontend/.env.local.example frontend/.env.local || true

docker:
	docker compose up --build

test:
	cd backend && . venv/bin/activate && DATABASE_URL=sqlite:///./test.db pytest tests/ -v

sample-video:
	cd backend && . venv/bin/activate && python ../scripts/generate_sample_video.py
