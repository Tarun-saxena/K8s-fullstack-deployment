# Kubernetes Full-Stack Deployment

A Kubernetes project demonstrating containerized application deployment, internal service discovery using ClusterIP, PostgreSQL database connectivity, pod replication, and NGINX reverse-proxy routing configured via ConfigMaps.

## Architecture

The deployment consists of an NGINX reverse proxy gateway that exposes the application externally and routes traffic internally to a frontend service and a replicated backend API connected to PostgreSQL.

```text
External Client
       │
       ▼ (Port 80)
[LoadBalancer Service: reverse-proxy]
       │
       ▼
[NGINX Gateway Pod] (Routing rules supplied via ConfigMap)
       │
       ├─── / ──────► [frontend:80 (ClusterIP)] ────► [Frontend NGINX Pod]
       │
       └─── /users ──► [backend:3000 (ClusterIP)] ───► [Backend Pods (2 Replicas)]
                                                            │
                                                            ▼ (db:5432)
                                                      [PostgreSQL Pod]
```

### Request Flow
1. Traffic reaches the `reverse-proxy` LoadBalancer service on port 80.
2. NGINX inspects the path and routes accordingly:
   - `/`: Proxied to the internal frontend service on port 80.
   - `/users`: Proxied to the internal backend service on port 3000.
3. The `backend` ClusterIP service load-balances traffic across two application pods.
4. The backend connects to the PostgreSQL database instance via internal Kubernetes DNS on port 5432.

## Project Structure

```text
.
├── backend/                  # TypeScript application source code
│   ├── src/
│   │   └── index.ts          # Express REST API with PostgreSQL integration
│   ├── Dockerfile            # Container build specification (oven/bun)
│   ├── package.json          # Node.js dependencies and scripts
│   ├── tsconfig.json         # TypeScript compiler configuration
│   └── bun.lock              # Dependency lockfile
├── ops/                      # Declarative Kubernetes manifests
│   ├── db/
│   │   └── manifest.yml      # PostgreSQL Deployment and ClusterIP Service
│   ├── backend/
│   │   └── manifest.yml      # Backend Deployment (2 replicas) and ClusterIP Service
│   ├── frontend/
│   │   └── manifest.yml      # Frontend ConfigMap, Deployment, and ClusterIP Service
│   └── reverse-proxy/
│       └── manifest.yml      # NGINX ConfigMap, Deployment, and LoadBalancer Service
├── .gitignore
└── README.md
```

## Deployment

Apply the manifests to deploy the services:

### 1. Database Tier
```bash
kubectl apply -f ops/db/manifest.yml
kubectl get pods,svc -l app=db
```

### 2. Backend Tier
Build and push the container image:
```bash
cd backend
docker build --platform=linux/amd64 -t <your-dockerhub-username>/backend-pg:latest .
docker push <your-dockerhub-username>/backend-pg:latest
cd ..
```
Deploy the backend:
```bash
kubectl apply -f ops/backend/manifest.yml
kubectl get pods,svc -n backend
```

### 3. Frontend Tier
```bash
kubectl apply -f ops/frontend/manifest.yml
kubectl get pods,svc -n frontend
```

### 4. Gateway Tier
```bash
kubectl apply -f ops/reverse-proxy/manifest.yml
kubectl get pods,svc -l app=reverse-proxy
```

## Verification and Testing

Forward local port 8080 to the `reverse-proxy` service:
```bash
kubectl port-forward svc/reverse-proxy 8080:80
```

### Frontend Check
Open `http://localhost:8080/` in a browser or fetch the HTML page:
```bash
curl http://localhost:8080/
```

### API and Database Connectivity
Insert a record via the reverse-proxy:
```bash
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Tarun"}'
```

Retrieve stored records:
```bash
curl http://localhost:8080/users
```

## Technical Highlights

- **Internal Service Discovery:** Uses Kubernetes ClusterIP services and internal DNS to enable communication between services without exposing databases or APIs to the public network.
- **ConfigMap Configuration Management:** Injects `nginx.conf` and static assets into standard container images at runtime, decoupling configuration from container images.
- **Reverse Proxy Gateway:** Uses NGINX to route external traffic to internal microservices based on URL paths.
- **Pod Replication & Load Balancing:** Runs multiple backend replicas behind a single ClusterIP service for automatic round-robin traffic distribution.
- **Declarative Manifests:** Organizes resources by service domain into self-contained multi-document YAML files (`---`).
