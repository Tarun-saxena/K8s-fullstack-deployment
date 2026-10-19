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
│   ├── reverse-proxy/        # [Approach 1] Custom NGINX Reverse Proxy (First Principles)
│   │   └── manifest.yml      # NGINX ConfigMap, Deployment, and LoadBalancer Service
│   └── native-ingress/       # [Approach 2] Native Kubernetes Ingress
│       └── ingress.yml       # Standard Ingress resources (managed by Ingress-NGINX)
├── .gitignore
└── README.md
```

## Routing Strategies Comparison

This repository demonstrates two distinct approaches to routing external traffic into internal Kubernetes microservices:

| Feature | Approach 1: First Principles (`ops/reverse-proxy/`) | Approach 2: Native Ingress (`ops/native-ingress/`) |
| :--- | :--- | :--- |
| **How it works** | Dedicated NGINX Pod running custom `nginx.conf` via ConfigMap | Declarative Kubernetes `Ingress` resource managed by Ingress Controller |
| **Routing configuration** | Manually written `proxy_pass` rules in NGINX configuration | Native Kubernetes YAML rules (`path`, `service`, `port`) |
| **Scaling & Automation** | Requires manual ConfigMap updates & pod reloads for new routes | Fully automated; Ingress Controller detects changes dynamically |
| **Best suited for** | Learning reverse proxy fundamentals, custom upstream routing | Production Kubernetes clusters, standardized cloud deployments |

---

## Deployment

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

---

### Choose Your Gateway Approach

#### Option A: Deploy via Native Kubernetes Ingress (Recommended)
Make sure you have an Ingress Controller running (such as `ingress-nginx`).

1. Apply the Ingress resources:
   ```bash
   kubectl apply -f ops/native-ingress/ingress.yml
   ```
2. Verify Ingress rules:
   ```bash
   kubectl get ingress -A
   ```
3. **Configure Local DNS (`hosts` file)**:
   Because `k8s-ingress.com` is a custom local domain, map it to `127.0.0.1` in your system's `hosts` file:
   - **Windows**: `C:\Windows\System32\drivers\etc\hosts` (open Notepad as Administrator)
   - **Linux / macOS**: `/etc/hosts` (`sudo nano /etc/hosts`)

   Add the following line:
   ```text
   127.0.0.1  k8s-ingress.com
   ```

4. **Port-Forward the Ingress Controller** (for local clusters without a cloud load balancer):
   ```bash
   kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80
   ```

5. **Access the Application**:
   Open `http://k8s-ingress.com/` in your browser.

#### Option B: Deploy via First-Principles Reverse Proxy
1. Deploy the custom NGINX proxy:
   ```bash
   kubectl apply -f ops/reverse-proxy/manifest.yml
   ```
2. Forward local port 8080 to the `reverse-proxy` service:
   ```bash
   kubectl port-forward svc/reverse-proxy 8080:80
   ```
3. Access the application in your browser at `http://localhost:8080/`.

---

## Verification and Testing

### 1. Frontend Check
Open `http://k8s-ingress.com/` (or `http://localhost:8080/`) in your browser to view the minimal frontend.

### 2. API and Database Connectivity
Insert a record through the gateway:
```bash
curl -X POST http://k8s-ingress.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Tarun"}'
```

Retrieve stored records:
```bash
curl http://k8s-ingress.com/users
```

## Technical Highlights

- **Dual Routing Architecture:** Documents both manual reverse proxying from first principles and production-grade Kubernetes Ingress API routing.
- **Cross-Namespace Ingress Merging:** Leverages NGINX Ingress Controller to merge Ingress rules across different namespaces (`frontend` and `backend`) under a unified host.
- **Internal Service Discovery:** Uses Kubernetes ClusterIP services and internal DNS (`service.namespace.svc.cluster.local`) without exposing the database or backend pods directly.
- **ConfigMap Configuration Management:** Injects static assets into standard container images at runtime, decoupling code from configuration.
- **Pod Replication & Load Balancing:** Runs multiple backend replicas behind a single ClusterIP service for automatic round-robin traffic distribution.
