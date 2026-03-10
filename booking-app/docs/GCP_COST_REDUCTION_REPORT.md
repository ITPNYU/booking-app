# GCP Cost Reduction Report

**Date**: 2026-03-10
**Project**: flowing-mantis-389917
**Billing Account**: [REDACTED — see GCP console]

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

Actual data from Cloud Monitoring — per-version, per-zone idle instance counts (last 30 days):

| Service | Avg Instances | Max Instances | Requests/Day |
|---------|--------------|---------------|-------------|
| **default (prod)** | 3.0 | 6.3 | 5,866 |
| **development** | 2.6 | 8.4 | 305 |
| **staging** | 1.2 | 2.5 | 109 |

### Daily Cost Breakdown (All Services Combined)

```
Date        Prod  Zn   Dev  Zn   Stg  Zn   Total    Cost
2026-02-10   3.2   2   2.0   2   1.0   1     6.2  $ 7.46
2026-02-11   5.7   2   5.4   2   1.0   1    12.2  $14.60
2026-02-12   1.9   1   2.0   1   1.0   1     4.9  $ 5.87
2026-02-13   1.8   1   1.0   1   1.0   1     3.8  $ 4.59
2026-02-14   1.9   1   1.0   1   1.0   1     3.9  $ 4.69
2026-02-15   1.2   1   1.0   1   1.0   1     3.2  $ 3.89
2026-02-16   1.4   1   1.0   1   1.0   1     3.4  $ 4.11
2026-02-17   1.4   1   3.0   2   1.0   1     5.4  $ 6.50
2026-02-18   6.2   2   6.4   2   2.0   1    14.7  $17.60
2026-02-19   1.9   1   1.1   1   1.0   1     4.0  $ 4.78
2026-02-20   2.7   2   1.0   1   1.0   1     4.7  $ 5.67
2026-02-21   3.8   1   7.0   2   2.5   1    13.2  $15.87
2026-02-22   3.5   2   1.2   1   1.9   2     6.5  $ 7.79
2026-02-23   1.6   1   1.0   1   2.0   2     4.6  $ 5.52
2026-02-24   3.3   2   4.4   2   1.0   1     8.7  $10.44
2026-02-25   3.3   2   1.0   1   1.0   1     5.3  $ 6.36
2026-02-26   3.9   2   2.0   2   1.0   1     6.8  $ 8.22
2026-02-27   6.3   2   1.0   1   2.0   2     9.4  $11.27
2026-02-28   3.7   2   1.0   1   2.0   2     6.8  $ 8.14
2026-03-01   2.5   2   3.3   2   1.0   1     6.7  $ 8.09
2026-03-02   2.0   2   2.0   2   1.0   1     5.0  $ 6.00
2026-03-03   3.7   2   2.0   2   1.0   1     6.7  $ 8.08
2026-03-04   3.7   2   7.9   2   1.1   1    12.6  $15.16
2026-03-05   3.5   2   1.0   1   1.0   1     5.6  $ 6.74
2026-03-06   2.9   2   2.0   2   2.0   2     6.9  $ 8.26
2026-03-07   2.4   2   2.0   2   1.0   1     5.4  $ 6.50
2026-03-08   2.8   2   1.1   1   0.8   1     4.7  $ 5.65
2026-03-09   1.2   1   1.0   1   0.8   1     3.0  $ 3.60
2026-03-10   2.9   2   8.4   2   1.3   1    12.6  $15.17
2026-03-11   2.0   2   1.0   1   0.0   0     3.0  $ 3.61
```

"Zn" = number of GCP zones the service was running in on that day.

### Cost Summary

- **Avg daily: $7.97**
- **Min daily: $3.60** (03-09) — all services in 1 zone, ~1 instance each
- **Max daily: $17.60** (02-18) — multiple services in 2 zones with spikes
- **Est. monthly: ~$240**

### Cost by Service (29-day period)

| Service | Cost | Share |
|---------|------|-------|
| Production | $105 | 45% |
| Development | $83 | 36% |
| Staging | $43 | 19% |
| **Total** | **$231** | |

---

## 2. Root Cause: Why Daily Costs Vary by $3–$18

We tested correlations between daily cost and several potential drivers:

| Factor Pair | Correlation (r) | Interpretation |
|-------------|----------------|----------------|
| **Total cost vs Zone count** | **0.593** | Strongest — multi-zone deployment is the primary driver |
| Instances vs HTTP Requests | 0.153 | Very weak — request volume does NOT drive cost |
| Instances vs Firestore Reads | 0.074 | No correlation |

### The real driver: Automatic multi-zone deployment

App Engine automatically distributes instances across GCP zones for reliability. When a service runs in **2 zones instead of 1**, `min_instances: 1` applies **per zone**, effectively doubling the minimum instance count.

| Pattern | Prod | Dev | Stg | Example | Daily Cost |
|---------|------|-----|-----|---------|-----------|
| All services in 1 zone | ~1 | ~1 | ~1 | 03-09 | **~$3.60** |
| Prod in 2 zones | ~2+ | ~1 | ~1 | 02-25 | **~$6** |
| Prod + Dev in 2 zones | ~3+ | ~2+ | ~1 | 02-24, 03-03 | **~$8–10** |
| All spiking + multi-zone | ~6+ | ~7+ | ~2+ | 02-18, 02-21 | **~$15–18** |

**Development is the worst offender.** On 03-04 it ran 7.9 instances ($9.48 in one day) serving only ~305 requests. On 03-10, it hit 8.4 instances. This is a dev environment with nearly zero traffic — the cost is pure waste from multi-zone scaling.

### Why request count and Firestore reads don't correlate

| Date | HTTP Req | Firestore Reads | Instances | Cost |
|------|----------|----------------|-----------|------|
| 03-03 | **14,201** | **4,575,558** | 6.7 | $8.08 |
| 02-18 | 4,831 | 1,731,189 | **14.7** | **$17.60** |

Days with 3x the traffic can cost **less** than low-traffic days. The instance count is driven by zone distribution and auto-scaler behavior, not by aggregate request or read volume.

---

## 3. Response Latency

| Service | P50 Latency |
|---------|------------|
| default (prod) | **4,183ms** |
| development | 3,536ms |
| staging | 1,335ms |

Production P50 exceeding 4 seconds is very slow. When instances are occupied processing slow requests, the auto-scaler adds more instances to handle incoming traffic — contributing to cost spikes.

---

## 4. Cloud Storage

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

---

## 5. Firestore

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

Read-to-write ratio is approximately 10,000:1. While read volume does not directly correlate with instance costs, high read volume means Firestore read charges themselves may be significant. Caching could reduce both Firestore costs and response latency.

---

## 6. Cloud Logging

- Last 30 days ingestion: **2.76 GB** (daily avg: 94 MB)
- Free tier: 50 GB/mo → **Within free tier, no action needed**

---

## Recommendations

### Phase 1: Quick Wins — Config Changes Only (Low Risk)

| # | Action | Est. Monthly Savings | Risk |
|---|--------|---------------------|------|
| 1 | **development: set `min_instances: 0`** | **~$80–90** | Cold starts will occur (acceptable for dev) |
| 2 | **development: set `max_instances: 3`** | Caps spike costs | 305 req/day easily handled by 3 instances |
| 3 | **production: set `max_instances: 7`** | Caps spike costs | Above observed peak of 6.3; safe headroom |

> Note: Staging has already been shut down (~$45/mo saved).

`min_instances: 0` on development is the single highest-impact change. It prevents idle instances from being maintained in each zone, eliminating the multi-zone cost multiplication that causes $10–15 spike days on a dev environment.

**Phase 1 estimated savings: ~$80–90/mo (~35% reduction from current $240/mo)**

### Phase 2: Medium-Term Cleanup

| # | Action | Savings | Effort |
|---|--------|---------|--------|
| 4 | **Delete unused Firestore backup DBs** (`booking-app-prod-backup-20251122`, `media-commons1`, etc.) | DB storage cost reduction | Low (verify they're truly unused first) |
| 5 | **Clean up staging deploy bucket** (26.6 GB) | Storage cost reduction | Low |
| 6 | **Delete empty bucket `booking-backup20250903`** | Minimal | Low |

### Phase 3: Fundamental Improvements (Medium–Large Effort)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 7 | **Improve production latency** (P50: 4,183ms → target < 1,000ms) | Fewer instances needed to handle same traffic | Large |
| 8 | **Optimize Firestore read caching** (86.6M reads/mo, 10,000:1 read/write ratio) | Reduce Firestore read costs + improve latency | Medium |
| 9 | **Evaluate migration to Cloud Run** | Per-request billing instead of per-instance | Large |

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
  min_instances: 0          # Changed: no always-on instances — prevents multi-zone idle cost
  max_instances: 3           # Changed: 10 → 3
  target_cpu_utilization: 0.65
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
  max_instances: 7           # Changed: 10 → 7 (observed peak is 6.3; keeps safe headroom)
  target_cpu_utilization: 0.65
```

---

## Reference: App Engine Pricing

- **F1 instance**: 600MHz CPU, 256MB RAM — $0.05/hour
- **B1 instance**: 600MHz CPU, 256MB RAM — $0.05/hour
- Free tier: 28 instance-hours/day (F1)
- Current usage far exceeds the free tier
- Source: [App Engine Pricing](https://cloud.google.com/appengine/pricing) (retrieved 2026-03-10). Prices may vary by region and change over time.

## Methodology

All data was collected from Cloud Monitoring API (`appengine.googleapis.com/system/instance_count`) with per-version, per-zone granularity over a 30-day window (2026-02-09 to 2026-03-11). Instance counts reflect the `idle` state metric, which represents actual running (billable) instances. Correlations computed as Pearson's r across daily aggregated values.
