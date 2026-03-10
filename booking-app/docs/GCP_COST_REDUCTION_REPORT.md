# GCP Cost Reduction Report

**Date**: 2026-03-10
**Project**: flowing-mantis-389917
**Billing Account**: [REDACTED — see GCP console]

---

## TL;DR

- We're spending **~$240/month** on App Engine server costs
- **36% of that ($83/mo) is the development server**, which handles almost no traffic
- Daily costs swing between **$3.60 and $17.60** — this is caused by Google automatically spreading our servers across multiple data centers
- **Shutting down staging (already done) saves ~$45/mo**
- **One config change on the dev server can save ~$80–90/mo more**
- Total potential savings: **~$130/mo (54% reduction)**

---

## Where Is the Money Going?

We run 3 separate servers (App Engine "services"):

| Server | What it's for | Monthly Cost | Traffic |
|--------|--------------|-------------|---------|
| **Production** | Live app for real users | **$105** (45%) | ~5,900 visits/day |
| **Development** | Testing new features | **$83** (36%) | ~300 visits/day |
| **Staging** | Pre-release testing | **$43** (19%) | ~100 visits/day |
| **Total** | | **~$240/mo** | |

### The Problem

**The development server costs almost as much as production, despite handling 20x less traffic.** It's like paying for a full restaurant kitchen to make 5 sandwiches a day.

---

## Why Do Daily Costs Vary So Much?

Looking at the billing chart, you'll see costs jump between ~$4 and ~$18 per day. We investigated several possible causes:

| Possible Cause | Does it affect cost? |
|---------------|---------------------|
| Number of user visits | **No** (very weak correlation) |
| Database reads | **No** (no correlation) |
| **Google spreading servers across data centers** | **Yes** (strongest correlation) |

### What's actually happening

Google App Engine automatically copies our servers to multiple data centers (called "zones") for reliability. When it does this, we pay for servers in **each** data center — effectively doubling or tripling the cost for that day.

**We can't directly control when Google does this**, but we can reduce the impact by changing how many servers are kept running at minimum.

#### Cheap day vs Expensive day

| | Cheap Day (03-09): $3.60 | Expensive Day (02-18): $17.60 |
|---|---|---|
| Production | 1 server, 1 data center | 6 servers, 2 data centers |
| Development | 1 server, 1 data center | 6 servers, 2 data centers |
| Staging | 1 server, 1 data center | 2 servers, 1 data center |

---

## Other Cost Factors

### Database (Firestore)

- We have **6 databases**, but only 3 are actively used (production, staging, development)
- The other 3 are old backups that still cost money just by existing
- Our app reads from the database **~87 million times/month** but only writes ~8,000 times — there may be room to reduce reads through caching

### File Storage (Cloud Storage)

- **26.6 GB** of old deployment files have piled up in the staging storage bucket
- Several old backup buckets exist (one is completely empty)

### Logging

- Within free tier — no cost concern

---

## Recommendations

### Do Now (Config changes only, no code needed)

| # | What | Savings | Risk |
|---|------|---------|------|
| 1 | **Turn off always-on for dev server** | **~$80–90/mo** | Dev server will take a few seconds to "wake up" on first visit — fine for a dev environment |
| 2 | **Limit dev server to max 3 copies** | Prevents cost spikes | Currently allows up to 10 — far too many for 300 visits/day |
| 3 | **Limit production server to max 7 copies** | Prevents cost spikes | Currently allows 10, but we've never needed more than 6.3 |

> Staging has already been shut down (~$45/mo saved).

**Estimated savings: ~$80–90/mo (on top of the ~$45 from staging)**

### Do Soon (Cleanup tasks)

| # | What | Savings |
|---|------|---------|
| 4 | Delete unused backup databases (3 of them) | Reduces storage costs |
| 5 | Clean up 26.6 GB of old deployment files | Reduces storage costs |
| 6 | Delete the empty backup storage bucket | Housekeeping |

### Do Later (Requires development work)

| # | What | Why it matters |
|---|------|---------------|
| 7 | **Speed up the production app** (currently takes 4+ seconds per page load on average) | Faster responses = fewer servers needed = lower cost |
| 8 | **Reduce unnecessary database reads** (87M reads/mo is very high) | Lowers database costs and speeds up the app |
| 9 | **Consider switching to Cloud Run** (different hosting model) | We'd only pay when someone actually uses the app, instead of paying for always-on servers |

---

## Proposed Changes (Detail)

### Development server config (`app.development.yaml`)

| Setting | Current | Proposed | Why |
|---------|---------|----------|-----|
| Minimum servers always running | **1** | **0** | No need to keep a server running 24/7 for a dev environment |
| Maximum servers allowed | **10** | **3** | 300 visits/day never needs more than 3 |

### Production server config (`app.production.yaml`)

| Setting | Current | Proposed | Why |
|---------|---------|----------|-----|
| Minimum servers always running | 1 | 1 (no change) | Production needs to be always available |
| Maximum servers allowed | **10** | **7** | We've never used more than 6.3; keeps headroom while capping cost |

---

## Appendix: How We Measured This

- All data comes from **Google Cloud Monitoring API** over a 30-day window (Feb 9 – Mar 11, 2026)
- Server counts are based on the "idle instance" metric, which represents actually running (and billed) servers
- We tracked instances per version, per zone to get accurate billing estimates
- Correlations are Pearson's r across daily values
- Cost estimates use the published App Engine F1 rate of **$0.05/hour per server**
- Source: [App Engine Pricing](https://cloud.google.com/appengine/pricing) (retrieved 2026-03-10). Prices may vary by region and change over time.
