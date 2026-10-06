.PHONY: install install-frontend install-backend install-hooks dev dev-frontend dev-backend dev-assessment dev-matching dev-registry dev-scheduling k8s-images k8s-secret k8s-forward

BACKEND_SERVICES := assessment matching registry scheduling

install: install-frontend install-backend

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && python3 -m pip install -e libs/kakimetch_common -r requirements-dev.txt -r scripts/requirements.txt $(foreach s,$(BACKEND_SERVICES),-r services/$(s)/requirements.txt)

install-hooks:
	git config core.hooksPath .githooks

dev-frontend:
	cd frontend && npm run dev

dev-assessment:
	cd backend/services/assessment && uvicorn app.main:app --reload --port 8001

dev-matching:
	cd backend/services/matching && uvicorn app.main:app --reload --port 8002

dev-registry:
	cd backend/services/registry && uvicorn app.main:app --reload --port 8003

dev-scheduling:
	cd backend/services/scheduling && uvicorn app.main:app --reload --port 8004

dev-backend:
	$(MAKE) -j 4 $(foreach s,$(BACKEND_SERVICES),dev-$(s))

dev:
	$(MAKE) -j 5 dev-frontend $(foreach s,$(BACKEND_SERVICES),dev-$(s))

k8s-images:
	eval $$(minikube docker-env --shell bash) && docker compose build

k8s-secret:
	kubectl create namespace kakimetch --dry-run=client -o yaml | kubectl apply -f -
	kubectl -n kakimetch create secret generic kakimetch-env --from-env-file=backend/.env --dry-run=client -o yaml | kubectl apply -f -

k8s-forward:
	kubectl -n kakimetch port-forward svc/assessment 8001:8000 & \
	kubectl -n kakimetch port-forward svc/matching 8002:8000 & \
	kubectl -n kakimetch port-forward svc/registry 8003:8000 & \
	kubectl -n kakimetch port-forward svc/scheduling 8004:8000 & \
	wait
