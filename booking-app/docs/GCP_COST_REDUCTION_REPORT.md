# GCP Cost Reduction Report

**Date**: 2026-03-10
**Project**: flowing-mantis-389917
**Billing Account**: 010C45-1E6DA4-045B07

---

## Current Architecture

Running 3 services on App Engine Standard (Node.js 20):

| Service | Instance | Scaling | min/max |
|---------|----------|---------|---------|
| default (production) | F1 | automatic_scaling | 1 / 10 |
| development | F1 | automatic_scaling | 1 / 10 |
| staging | B1 | basic_scaling | - / 10 (idle: 5m) |

---

## 1. App Engine Instance Hours (Largest Cost Driver)

Actual data from Cloud Monitoring (last 30 days):

| Service | Avg Instances | Max Instances | Est. Monthly Instance-Hours | Requests/Day |
|---------|--------------|---------------|----------------------------|-------------|
| **default (prod)** | 3.13 | 6.65 | ~2,255h | 5,866 |
| **development** | 2.52 | 8.29 | ~1,811h | 305 |
| **staging** | 1.25 | 3.44 | ~901h | 109 |
| **Total** | **6.90** | - | **~4,967h/mo** | - |

F1 instance: $0.05/h → **Estimated ~$248/mo (instance hours only)**

### Key Issues

- **Development environment**: Only 305 requests/day yet running 2.52 instances on average — nearly the same resource consumption as production (5,866 requests/day). `min_instances: 1` + `automatic_scaling` keeps at least 1 instance running 24/7, even with near-zero traffic.
- **Staging environment**: 109 requests/day with 1.25 average instances. The basic_scaling `idle_timeout` of 5m is too long.
- **Production**: `max_instances: 10` but actual peak is only 6.65. No need to allow up to 10.

## 2. Response Latency

| Service | P50 Latency |
|---------|------------|
| default (prod) | **4,183ms** |
| development | 3,536ms |
| staging | 1,335ms |

Production P50 exceeding **4 seconds** is very slow. Long request processing times keep instances occupied, causing the Auto Scaler to spin up additional instances — a direct driver of increased costs.

## 3. Cloud Storage

| Bucket | Size | Notes |
|--------|------|-------|
| staging.flowing-mantis-389917.appspot.com | **26.6 GB** (4,390 files) | Accumulated deploy artifacts |
| booking-app-prod-backup-20251122 | 8.5 MB | Firestore backup |
| booking-prod-backup20250903 | 5.7 MB | Old backup |
| booking-app-dev-backup-20251122 | 4.5 MB | Dev backup |
| booking-app-prod_firestore_backup | 1.5 MB | Another backup |
| booking-backup20250903 | 0 B | Empty bucket |
| flowing-mantis-389917.appspot.com | 573 B | - |

The **26.6 GB staging bucket** stands out. Deploy artifacts accumulate with each deployment.

## 4. Firestore

### Database Inventory

| Database | Free Tier | Location | Notes |
|----------|-----------|----------|-------|
| (default) | **Yes** | us-east4 | Main DB |
| booking-app-prod | No | us-east4 | Production data |
| booking-app-staging | No | us-east4 | Staging data |
| booking-app-prod-backup | No | us-east4 | Backup |
| booking-app-prod-backup-20251122 | No | nam5 | Dated backup |
| media-commons1 | No | nam5 | Legacy DB? |

**5 non-free-tier databases** exist. Unused backup DBs still incur storage charges.

### Operations (Last 30 Days)

| Type | Monthly Total | Daily Average |
|------|--------------|---------------|
| Reads | **86,645,573** | 2,795,018 |
| Writes | 8,238 | 275 |

Read volume is extremely high (~86.6M/mo). The read-to-write ratio is approximately 10,000:1, suggesting significant room for caching optimization.

## 5. Cloud Logging

- Last 30 days ingestion: **2.76 GB** (daily avg: 94 MB)
- Free tier: 50 GB/mo → **Within free tier, no action needed**

---

## Recommendations

### Phase 1: Quick Wins — Config Changes Only (Low Risk)

| # | Action | Est. Monthly Savings | Risk |
|---|--------|---------------------|------|
| 1 | **development: set `min_instances: 0`** | ~$90 | Cold starts will occur (acceptable for dev) |
| 2 | **development: set `max_instances: 3`** | Caps spike costs | 305 req/day easily handled by 3 instances |
| 3 | **staging: reduce `idle_timeout` to `2m`** | ~$20 | Slightly increased response latency |
| 4 | **staging: set `max_instances: 3`** | Caps spike costs | 109 req/day easily handled by 3 instances |
| 5 | **production: set `max_instances: 5`** | Caps spike costs | Peak was 6.65 — needs monitoring |

**Phase 1 estimated savings: ~$110/mo (~44% reduction)**

### Phase 2: Medium-Term Cleanup

| # | Action | Savings | Effort |
|---|--------|---------|--------|
| 6 | **Delete unused Firestore backup DBs** (`booking-app-prod-backup-20251122`, `media-commons1`, etc.) | DB storage cost reduction | Low (verify they're truly unused first) |
| 7 | **Clean up staging bucket** (26.6 GB of deploy artifacts) | Storage cost reduction | Low |
| 8 | **Delete empty bucket `booking-backup20250903`** | Minimal | Low |

### Phase 3: Fundamental Improvements (Medium–Large Effort)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 9 | **Improve production latency** (P50: 4,183ms → target < 1,000ms) | Better instance efficiency → fewer instances needed | Large |
| 10 | **Optimize Firestore read caching** (86.6M reads/mo) | Reduce Firestore read costs | Medium |
| 11 | **Evaluate migration to Cloud Run** | Per-request billing model is more cost-efficient | Large |

---

## Proposed Config Changes (Phase 1)

### app.development.yaml

```yaml
# Before
instance_class: F1
automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.65

# After
instance_class: F1
automatic_scaling:
  min_instances: 0          # Changed: stop always-on instance
  max_instances: 3           # Changed: 10 → 3
  target_cpu_utilization: 0.65
```

### app.staging.yaml

```yaml
# Before
instance_class: B1
basic_scaling:
  max_instances: 10
  idle_timeout: 5m

# After
instance_class: B1
basic_scaling:
  max_instances: 3           # Changed: 10 → 3
  idle_timeout: 2m           # Changed: 5m → 2m
```

### app.production.yaml

```yaml
# Before
instance_class: F1
automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.65

# After
instance_class: F1
automatic_scaling:
  min_instances: 1
  max_instances: 5           # Changed: 10 → 5
  target_cpu_utilization: 0.65
```

---

## Reference: App Engine Pricing

- **F1 instance**: 600MHz CPU, 256MB RAM — $0.05/hour
- **B1 instance**: 600MHz CPU, 256MB RAM — $0.05/hour
- Free tier: 28 instance-hours/day (F1)
- Current usage (~4,967h/mo = ~166h/day) far exceeds the free tier (28h/day)
