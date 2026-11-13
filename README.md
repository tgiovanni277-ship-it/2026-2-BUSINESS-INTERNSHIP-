# 2026-2-BUSINESS-INTERNSHIP-

# Candidate Intake and Pre-Screening Automation

An academic internship project proposing an automated candidate intake, pre-screening, and follow-up workflow for Rely Workforce Group.

## Overview

The project addresses the manual effort involved in reviewing and contacting candidates generated through digital campaigns. The proposed system would centralize candidate information, validate submissions, detect duplicates, apply job-specific eligibility criteria and scoring, and route follow-up based on each candidate’s results.

## Proposed Workflow

1. Candidates submit their information through a landing page or form linked to Meta Ads campaigns.
2. The workflow validates the submission and checks for duplicate records.
3. Job-specific eligibility rules and configurable scoring are applied.
4. Candidates are routed for initial contact or human review based on the pre-screening outcome.
5. Retell AI is proposed for initial voice contact.
6. Candidate status and follow-up are managed in GoHighLevel.

n8n is proposed to orchestrate the workflow and connect the different services.

## Proposed Technology Stack

| Tool or service | Proposed role |
|---|---|
| Meta Ads | Candidate acquisition channel |
| Landing page or form | Candidate data collection |
| n8n | Workflow orchestration |
| Retell AI | Initial voice contact |
| GoHighLevel | Candidate CRM and follow-up |

## Planned Deliverables

- Requirements and eligibility criteria matrix
- End-to-end workflow diagram
- Candidate status catalog
- Form data contract and payload
- Technical documentation
- Controlled testing plan
- Process metrics dashboard

## Repository Documentation

The implementation guide, architecture, run instructions, validation record,
and presentation materials are indexed in [docs/README.md](docs/README.md).
Most supporting documentation is in Spanish.

## Proposed Timeline

The activities are planned across 14 weeks, from August 1 to November 2, 2026.

| Phase | Schedule |
|---|---|
| Company familiarization | Weeks 1–2 · August 1–14 |
| Discovery | Weeks 3–4 · August 15–28 |
| Technical design | Weeks 5–6 · August 29–September 11 |
| Candidate intake and screening | Weeks 7–9 · September 12–October 2 |
| Voice and CRM integration | Weeks 10–11 · October 3–16 |
| Testing and deployment | Weeks 12–13 · October 17–30 |
| Optimization | Week 14 · October 31–November 2 |

## Project Status

This repository includes a local Docker Compose prototype for candidate intake
and pre-screening. Its development configuration simulates the CRM. It has not
been deployed to production; live company integrations, controlled testing with
company systems, production measurements, and voice automation remain pending.
Internship work was carried out locally because server access and credentials
were not provided.

This repository describes a proposed solution and a local prototype. It should
not be interpreted as evidence of a production system.
