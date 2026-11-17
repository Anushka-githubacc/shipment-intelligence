# Shipment Intelligence

**Monitor. Predict. Investigate. Resolve.**

An enterprise-grade shipment tracking, delay risk assessment, and resolution management platform built natively on the Salesforce Platform using Apex (API Version 68.0) and Lightning Web Components (LWC). Shipment Intelligence integrates with the Shippo Multi-Carrier Tracking REST API via modern Salesforce External Credentials and Named Credentials to synchronize carrier milestones, evaluate rule-based delivery risks, and empower customer support teams with end-to-end operational visibility.

Developed for the **Wipro Phase II Project Submission**.

---

## Table of Contents

1. [Project Overview & Problem Statement](#project-overview--problem-statement)
2. [Objectives & Key Features](#objectives--key-features)
3. [Architecture & Workflow](#architecture--workflow)
4. [Technology Stack](#technology-stack)
5. [Project Directory Structure](#project-directory-structure)
6. [Salesforce Data Model](#salesforce-data-model)
7. [Apex & LWC Implementation](#apex--lwc-implementation)
8. [Shippo REST API Integration](#shippo-rest-api-integration)
9. [Prerequisites](#prerequisites)
10. [Setup & Installation Guide](#setup--installation-guide)
    - [Step A: Node.js Dependency Installation](#step-a-nodejs-dependency-installation)
    - [Step B: Salesforce CLI Installation](#step-b-salesforce-cli-installation)
    - [Step C: Salesforce Org Authentication](#step-c-salesforce-org-authentication)
    - [Step D: Named Credential & External Credential Configuration](#step-d-named-credential--external-credential-configuration)
    - [Step E: Salesforce Metadata Deployment](#step-e-salesforce-metadata-deployment)
    - [Step F: Synthetic Demo Data Seeding](#step-f-synthetic-demo-data-seeding)
11. [Testing Instructions](#testing-instructions)
    - [LWC Unit Tests (Jest)](#lwc-unit-tests-jest)
    - [Apex Regression Tests](#apex-regression-tests)
    - [Code Quality & Linting](#code-quality--linting)
12. [Synthetic & Demo Data Disclaimer](#synthetic--demo-data-disclaimer)
13. [Security Considerations](#security-considerations)
14. [Known Limitations & Future Scope](#known-limitations--future-scope)
15. [Team & Project Metadata](#team--project-metadata)
16. [Repository Information](#repository-information)

---

## Project Overview & Problem Statement

### The Problem

Modern e-commerce and enterprise supply chains rely on third-party logistics (3PL) carriers to transport goods across regional and global networks. Customer service representatives (CSRs) and logistics controllers face several critical challenges:

- **Fragmented Visibility**: Tracking codes must be manually queried across individual carrier portals, causing context switching and customer response delays.
- **Reactive Exception Handling**: CSRs only learn of transit failures or delivery stalls after angry customers file complaints or call support lines.
- **Disjointed CRM Data**: Carrier status updates are disconnected from Salesforce `Case` records, leading to duplicate investigations and inconsistent communications.
- **Risk Invisibility**: Standard tracking feeds indicate _what happened_ in the past, but fail to flag shipments that are statistically likely to miss their promised delivery date (ETA).

### The Solution

Shipment Intelligence resolves these operational bottlenecks by providing a single-pane-of-glass command center within Salesforce:

- Unifies multi-carrier tracking feeds into a canonical Salesforce data model via a resilient Shippo provider adapter.
- Computes real-time, deterministic, rule-based delivery risk tiers (`On Track`, `At Risk`, `Delayed`) against estimated delivery dates and milestone timestamps.
- Integrates directly with Salesforce Cases, allowing support agents to review tracking histories and draft customer updates with mandatory human oversight before dispatch.
- Organizes logistics operations across six purpose-built workspaces with a responsive, high-contrast, hybrid Bento Grid and Spatial UI design.

---

## Objectives & Key Features

- **Centralized Operational Control**: Monitor overall logistics health across all active consignments from a single dashboard.
- **Rule-Based Delay Risk Assessment**: Automatically classify shipments into `On Track`, `At Risk`, or `Delayed` using transparent, deterministic business rules (no unverified AI/ML models).
- **Interactive Shipment Journey Stepper**: Visualize consignment progress across 4 standardized stages: _Booked / Pre-transit_, _In Transit_, _Out for Delivery_, and _Delivered_, with explicit exception states for _Returned_, _Failure_, and _Unknown_.
- **Milestone Audit Trail**: Store historical carrier tracking events (`Shipment_Event__c`) with external ID deduplication linked to the master shipment.
- **Proactive Exception Management**: Triage delivery failures, customs holds, and return-to-sender events with prescriptive operational recommendations.
- **Human-in-the-Loop Case Management**: Assist service agents by drafting contextual customer status updates directly from linked Case records, requiring mandatory human review before sending.
- **Responsive Command Centre**: Fully responsive desktop, tablet, and mobile layouts with a sticky navigation sidebar, compact rail mode (72px) at narrow viewports, and mobile drawer support.

---

## Architecture & Workflow

Shipment Intelligence uses a decoupled, three-tier architecture adhering to enterprise Salesforce design patterns:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER (Lightning Web Components)         │
│  logisticsAppShell (Command Centre Shell, Sticky Nav, Global Search)    │
│  ├── Control Tower (shipmentDashboard)                                  │
│  ├── Shipment Intelligence (shipmentIntelligence)                       │
│  ├── Risk Intelligence (riskIntelligence)                               │
│  ├── Exception Centre (exceptionCentre)                                 │
│  ├── Analytics & Reports (analyticsReports)                             │
│  └── Case Management (caseManagement)                                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ @AuraEnabled (Imperative & Wire)
┌───────────────────────────────────▼────────────────────────────────────┐
│                   BUSINESS LOGIC & CONTROLLER LAYER (Apex API 68.0)    │
│  ShipmentController (AuraEnabled API gateway & cache orchestration)    │
│  ShipmentService (Domain service: persistence, DTO mapping, dedupe)   │
│  ShipmentRiskCalculator (Deterministic rule-based risk evaluation)     │
│  TrackingProviderFactory (Factory pattern for provider resolution)    │
│  ShippoTrackingAdapter (Adapter connecting provider to domain)        │
│  ShippoService (HTTP client consuming Shippo REST API)                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Callout via Named Credential
┌───────────────────────────────────▼────────────────────────────────────┐
│                   INTEGRATION & DATA PERSISTENCE LAYER                 │
│  Named Credential: callout:Shippo_Named_Credential/tracks/{c}/{t}      │
│  External Credential: Shippo_External_Credential (Custom Auth)         │
│  Salesforce Objects: Shipment__c (Master) & Shipment_Event__c (Detail) │
│  External API: Shippo Multi-Carrier Tracking REST API                  │
└────────────────────────────────────────────────────────────────────────┘
```

### End-to-End Tracking Synchronization Workflow

1. **User Action / Refresh**: A logistics controller clicks _Sync_ or _Refresh_ in `shipmentDashboard`, `shipmentIntelligence`, or `caseManagement`.
2. **Controller Dispatch**: `ShipmentController.syncOne` or `syncMultiple` receives the carrier code and tracking number.
3. **Provider Factory Resolution**: `TrackingProviderFactory.getProvider('Shippo')` returns the registered `ShippoTrackingAdapter`.
4. **REST Callout via Named Credential**: `ShippoService` issues an HTTP GET callout to `callout:Shippo_Named_Credential/tracks/{carrier}/{tracking_number}`.
5. **Payload Normalization**: The raw JSON payload is parsed into a strongly-typed `ShipmentInfo` DTO, normalizing carrier-specific statuses into canonical Salesforce status values.
6. **Milestone Deduplication**: `ShipmentService` upserts incoming events against existing `Shipment_Event__c` records using the unique `Event_ID__c` external identifier.
7. **Risk Assessment**: `ShipmentRiskCalculator` evaluates the updated status against current time and `Estimated_Delivery_Date__c` (respecting `Keep_Seeded_Date__c` for demo records).
8. **DML Persistence with USER_MODE**: Updated shipment and newly discovered tracking events are persisted enforcing `AccessLevel.USER_MODE`.
9. **UI Refresh**: LWC components reactively refresh data via standard Lightning wire adapters (`refreshApex`).

---

## Technology Stack

| Layer                     | Technology / Tool                                      | Version / Spec                                          | Description                                           |
| :------------------------ | :----------------------------------------------------- | :------------------------------------------------------ | :---------------------------------------------------- |
| **Platform**              | Salesforce Platform                                    | API Version 68.0                                        | Native cloud CRM runtime environment                  |
| **Backend**               | Salesforce Apex                                        | v68.0                                                   | Object-oriented business logic, triggers, controllers |
| **Frontend**              | Lightning Web Components (LWC)                         | ECMAScript 2022                                         | Modular custom elements built on web standards        |
| **Styling**               | Salesforce Lightning Design System (SLDS) + Custom CSS | CSS3 Variables / Flexbox / Grid                         | Bento Grid + Spatial UI design system                 |
| **Integration**           | Salesforce Named & External Credentials                | Custom Auth / Header                                    | Secure, credential-isolated HTTP callouts             |
| **External API**          | Shippo Tracking REST API                               | REST / JSON                                             | Live multi-carrier tracking aggregator feed           |
| **Package Management**    | Node.js / npm                                          | Node v18+ / v20+, npm v10+                              | Local development, tooling, and test runners          |
| **Unit Testing (Client)** | `@salesforce/sfdx-lwc-jest`                            | Jest v28 / v29                                          | Component DOM unit tests with wire mocks              |
| **Unit Testing (Server)** | Apex Test Framework                                    | API 68.0                                                | Regression test suite with mock callout adapters      |
| **Linting & Formatting**  | ESLint & Prettier                                      | `@salesforce/eslint-config-lwc`, `prettier-plugin-apex` | Code style enforcement and pre-commit hooks           |
| **CLI Tools**             | Salesforce CLI (`sf`)                                  | v2.x+                                                   | Metadata deployment, org auth, and scripting          |
| **Version Control**       | Git & GitHub                                           | Git 2.40+                                               | Source control management and release history         |

---

## Project Directory Structure

```text
shipment-intelligence/
├── .github/                           # GitHub repository configuration
├── .husky/                            # Git pre-commit hook triggers
├── force-app/main/default/            # Salesforce DX source directory
│   ├── classes/                       # Apex classes and test suites
│   │   ├── ITrackingProvider.cls      # Interface for tracking providers
│   │   ├── TrackingProviderFactory.cls# Factory resolving provider adapters
│   │   ├── ShippoTrackingAdapter.cls  # Shippo adapter implementation
│   │   ├── ShippoService.cls          # Shippo REST API client & callouts
│   │   ├── ShipmentService.cls        # Domain logic, persistence, DTO mapping
│   │   ├── ShipmentRiskCalculator.cls # Deterministic rule-based risk engine
│   │   ├── ShipmentController.cls     # AuraEnabled LWC controller
│   │   ├── ShipmentInfo.cls           # Strongly-typed tracking DTO
│   │   ├── ShipmentControllerTest.cls # Controller test suite (38 test methods)
│   │   ├── ShipmentServiceTest.cls    # Domain service test suite (13 test methods)
│   │   ├── ShipmentRiskCalculatorTest.cls # Risk calculation test suite (18 test methods)
│   │   ├── ShippoServiceTest.cls      # Callout mock test suite (23 test methods)
│   │   ├── TrackingProviderFactoryTest.cls # Factory resolution test suite (4 test methods)
│   │   └── ShipmentDemoDataTest.cls   # Synthetic dataset verification suite (2 test methods)
│   ├── lwc/                           # Lightning Web Components
│   │   ├── logisticsAppShell/         # Master command centre shell & navigation
│   │   ├── shipmentDashboard/         # Control Tower workspace (KPIs, stepper, table)
│   │   ├── shipmentIntelligence/      # Consignment investigation & timeline
│   │   ├── riskIntelligence/          # Risk distribution & driver inspection
│   │   ├── exceptionCentre/           # Exception triage & resolution workflow
│   │   ├── analyticsReports/          # Carrier SLA & performance metrics
│   │   └── caseManagement/            # Linked Cases & reviewed customer drafts
│   ├── objects/                       # Custom Salesforce Object schemas
│   │   ├── Shipment__c/               # Consignment master object
│   │   │   └── fields/                # Tracking code, carrier, status, risk, Case lookup
│   │   └── Shipment_Event__c/         # Milestone child tracking events
│   │       └── fields/                # Event ID, status, date, location, raw payload
│   └── permissionsets/                # Security permission sets
│       ├── Logistics_Operations_Access.permissionset-meta.xml # Operational FLS
│       └── Shippo_API_Access.permissionset-meta.xml           # External Credential access
├── scripts/
│   ├── apex/
│   │   └── seedShipmentDemoData.apex  # Idempotent synthetic data seeding script
│   └── soql/                          # Utility SOQL queries
├── .gitignore                         # Ignores node_modules, credentials, .sf cache
├── .prettierrc                        # Prettier code formatting rules
├── package.json                       # Node dependencies and project scripts
├── package-lock.json                  # Deterministic dependency lockfile
├── sfdx-project.json                  # Salesforce DX project definition (v68.0)
└── README.md                          # Comprehensive project documentation
```

---

## Salesforce Data Model

The application introduces two custom objects linked to standard Salesforce `Case`:

### 1. `Shipment__c` (Custom Object)

The primary consignment entity representing an individual package in transit.

| Field API Name               | Data Type           | Properties                    | Description                                                                                                               |
| :--------------------------- | :------------------ | :---------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `Tracking_Code__c`           | Text(50)            | Required, Unique, External ID | Carrier tracking number (case-sensitive)                                                                                  |
| `Carrier__c`                 | Picklist            | Restricted                    | Supported carrier designation (`FedEx`, `UPS`, `DHL Express`, `Delhivery`, `Blue Dart`)                                   |
| `Provider__c`                | Picklist            | Restricted                    | Tracking data provider (defaults to `Shippo`)                                                                             |
| `Status__c`                  | Picklist            | Restricted                    | Canonical status (`pre_transit`, `in_transit`, `out_for_delivery`, `delivered`, `return_to_sender`, `failure`, `unknown`) |
| `Estimated_Delivery_Date__c` | DateTime            | Optional                      | Carrier-estimated delivery date (ETA)                                                                                     |
| `Actual_Delivery_Date__c`    | DateTime            | Optional                      | Timestamp when delivered status was confirmed                                                                             |
| `Last_Synced__c`             | DateTime            | Optional                      | Timestamp of last successful API synchronization                                                                          |
| `Risk_Level__c`              | Picklist            | Restricted                    | Computed delay risk (`On Track`, `At Risk`, `Delayed`)                                                                    |
| `Risk_Reason__c`             | Text(255)           | Optional                      | Human-readable explanation of the computed risk tier                                                                      |
| `Keep_Seeded_Date__c`        | Checkbox            | Default: False                | Protects synthetic demo ETAs from being overwritten during live sync                                                      |
| `Case__c`                    | Lookup(Case)        | Optional                      | Links shipment to a standard customer support Case                                                                        |
| `Resolution_Status__c`       | Picklist            | Restricted                    | Triage status (`New`, `In Review`, `Escalated`, `Resolved`, `Closed`)                                                     |
| `Resolution_Notes__c`        | LongTextArea(32768) | Optional                      | Operational investigation and resolution log                                                                              |

### 2. `Shipment_Event__c` (Custom Object)

A child record representing a single historical milestone event reported by the carrier. New events are deduplicated upon synchronization using `Event_ID__c` as the upsert key.

| Field API Name         | Data Type                    | Properties          | Description                                                  |
| :--------------------- | :--------------------------- | :------------------ | :----------------------------------------------------------- |
| `Shipment__c`          | Master-Detail(`Shipment__c`) | Required            | Parent shipment record                                       |
| `Event_ID__c`          | Text(255)                    | Unique, External ID | Unique milestone hash or external event ID for deduplication |
| `Event_Date__c`        | DateTime                     | Optional            | Timestamp when the tracking event occurred                   |
| `Event_Status__c`      | Text(100)                    | Optional            | Raw status string returned by carrier                        |
| `Event_Description__c` | Text(255)                    | Optional            | Milestone narrative (e.g. _Departed sorting facility_)       |
| `Event_Location__c`    | Text(255)                    | Optional            | Geographic location of the scan (e.g. _Memphis, TN_)         |
| `Provider__c`          | Text(50)                     | Optional            | Data provider that recorded the event (`Shippo`)             |
| `Raw_Event_Data__c`    | LongTextArea(32768)          | Optional            | Unparsed JSON string for audit and debugging                 |

---

## Apex & LWC Implementation

### Apex Service & Controller Architecture

1. **`ITrackingProvider.cls`**: Standardized interface enforcing `ShipmentInfo track(String carrier, String trackingNumber)`. Decouples business logic from external API contracts.
2. **`TrackingProviderFactory.cls`**: Implements the Factory pattern. Dynamically returns the appropriate provider implementation (currently `ShippoTrackingAdapter`).
3. **`ShippoTrackingAdapter.cls`**: Implements `ITrackingProvider`, acting as a bridge between the generic domain layer and `ShippoService`.
4. **`ShippoService.cls`**: Handles HTTP callout creation, URL encoding, HTTP status validation, JSON parsing, and mapping Shippo response structures into `ShipmentInfo`.
5. **`ShipmentRiskCalculator.cls`**: Evaluates delivery risk deterministically:
   - **`Delayed`**: Any shipment where status is not `delivered` and `Estimated_Delivery_Date__c < Datetime.now()`, or where status is `failure` or `return_to_sender`.
   - **`At Risk`**: Consignments within 24 hours of ETA without an `out_for_delivery` scan, or consignments stalled in `pre_transit` past the expected dispatch window.
   - **`On Track`**: Consignments progressing through transit checkpoints within the expected delivery window.
6. **`ShipmentService.cls`**: Orchestrates database operations, field-level security checks, status transitions, event deduplication via `Event_ID__c`, and risk recalculation.
7. **`ShipmentController.cls`**: Exposes `@AuraEnabled` methods for LWC consumption:
   - `getShipments()`: Retrieves filtered shipment lists for the Control Tower.
   - `getShipmentDetail(shipmentId)`: Retrieves a specific shipment with linked Case context.
   - `getShipmentEvents(shipmentId)`: Retrieves chronological tracking milestones.
   - `syncOne(shipmentId)`: Triggers immediate live API sync for a single shipment.
   - `syncMultiple(shipmentIds)`: Synchronizes multiple consignments sequentially.
   - `saveResolution(shipmentId, status, notes)`: Updates triage resolution states.

### Six Purpose-Built LWC Workspaces

1. **Control Tower (`shipmentDashboard`)**:
   - Executive telemetry summary cards: Total Tracked, On Track, At Risk, Delayed.
   - Dynamic search by carrier or tracking code, status dropdown, risk dropdown, and _Needs Attention_ quick toggle.
   - Signature 4-stage shipment journey stepper reflecting live status.
   - Single-click row sync and bulk synchronization.
2. **Shipment Intelligence (`shipmentIntelligence`)**:
   - Deep-dive technical consignment explorer with a sticky left-hand selector.
   - Detailed milestone timeline with status badges, timestamps, locations, and descriptions.
   - Carrier metadata overview and quick refresh.
3. **Risk Intelligence (`riskIntelligence`)**:
   - Delay risk distribution visualizer categorizing consignments by urgency.
   - Technical investigation drawer displaying computed risk drivers and historical transit delay patterns.
4. **Exception Centre (`exceptionCentre`)**:
   - Dedicated triage queue for critical delivery exceptions (`failure`, `return_to_sender`, `unknown`).
   - Prescriptive action matrix recommending specific operational interventions.
   - Human-in-the-loop resolution workflow allowing operators to log resolution notes and update status (`New`, `In Review`, `Escalated`, `Resolved`).
5. **Analytics & Reports (`analyticsReports`)**:
   - Aggregated operational analytics: on-time delivery percentages, average transit times, carrier volume distribution.
   - Multi-carrier comparative performance metrics.
6. **Case Management (`caseManagement`)**:
   - Case Explorer linking Salesforce Cases directly to their associated shipments.
   - Split-view layout displaying customer case history alongside live shipment tracking.
   - Contextual customer update draft generator (rule-based templates populated with carrier ETA and status) requiring **mandatory human review** before sending.

---

## Shippo REST API Integration

Shipment Intelligence integrates directly with the [Shippo Tracking REST API](https://goshippo.com/docs/tracking/).

### Single Provider Architecture vs. Carrier Designations

- **Single External Provider**: Shippo is the **only** implemented external tracking provider. All live tracking requests are routed through `ShippoService` and the `Shippo_Named_Credential`.
- **Supported Carrier Designations**: The `Carrier__c` picklist supports designations for `FedEx`, `UPS`, `DHL Express`, `Delhivery`, and `Blue Dart`. These represent business categorization values and supported carrier identifiers passed to Shippo.
- **Aggregated Integration**: The platform does **not** maintain direct, independent API connections to individual carrier portals (e.g. direct FedEx Web Services or direct UPS API). Live tracking synchronization relies on Shippo's multi-carrier tracking aggregator endpoint.

### API Endpoint & Method

- **Method**: `GET`
- **Endpoint**: `https://api.goshippo.com/tracks/{carrier}/{tracking_number}`
- **Salesforce Apex Callout**:
  ```apex
  HttpRequest req = new HttpRequest();
  req.setEndpoint('callout:Shippo_Named_Credential/tracks/' +
      EncodingUtil.urlEncode(carrier.trim(), 'UTF-8') + '/' +
      EncodingUtil.urlEncode(trackingNumber.trim(), 'UTF-8'));
  req.setMethod('GET');
  req.setHeader('Accept', 'application/json');
  ```

### Authentication Architecture

- Built using **Salesforce External Credentials** and **Named Credentials** (replacing legacy Named Credentials).
- **External Credential**: `Shippo_External_Credential`
  - Authentication Protocol: `Custom`
  - Principal: `Shippo_Named_Principal`
  - Authentication Parameter: Custom Header `Authorization: ShippoToken <SHIPPO_API_TOKEN>`
- **Named Credential**: `Shippo_Named_Credential`
  - Callout URL: `https://api.goshippo.com`
  - External Credential: `Shippo_External_Credential`
  - Generate Authorization Header: `Enabled`
- **Security Isolation**: API tokens are never exposed in Apex code, custom settings, or repository commits.

---

## Prerequisites

Before setting up the project, ensure your workstation has the following tools installed:

1. **Git**: v2.40 or later ([Download Git](https://git-scm.com/))
2. **Node.js**: v18.x or v20.x LTS ([Download Node.js](https://nodejs.org/))
3. **Salesforce CLI (`sf`)**: v2.x or later ([Install Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli))
4. **Salesforce Org**: A Developer Edition org, Trailhead Playground, or Scratch Org with API Version 68.0 enabled.
5. **Shippo Account**: A free Shippo account to obtain a live or test tracking API token ([Sign Up at GoShippo](https://goshippo.com/)).

---

## Setup & Installation Guide

> [!IMPORTANT]
> **Separation of Concerns**: Running `npm ci` installs local JavaScript development and testing dependencies only. It does **not** automatically configure Salesforce authentication, create Named Credentials, or deploy metadata to your Salesforce org. Follow each step below in sequence.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        SETUP EXECUTION SEQUENCE                        │
│                                                                        │
│   Step A: npm ci (Install Node dev dependencies)                       │
│     │                                                                  │
│   Step B: Install Salesforce CLI (sf)                                  │
│     │                                                                  │
│   Step C: sf org login web (Authenticate target org)                   │
│     │                                                                  │
│   Step D: Configure Named Credential & Permission Set in Org           │
│     │                                                                  │
│   Step E: sf project deploy start (Deploy Apex & LWC metadata)         │
│     │                                                                  │
│   Step F: sf apex run (Seed synthetic demo shipments & Cases)          │
└────────────────────────────────────────────────────────────────────────┘
```

### Step A: Node.js Dependency Installation

Clone the repository and install dependencies using the committed `package-lock.json`:

```bash
# Clone the repository
git clone https://github.com/Anushka-githubacc/shipment-intelligence.git
cd shipment-intelligence

# Install exact locked dependencies
npm ci
```

### Step B: Salesforce CLI Installation

Verify that Salesforce CLI is installed and updated:

```bash
sf version
# Expected: @salesforce/cli/2.x.x or higher
```

### Step C: Salesforce Org Authentication

Authenticate your target Salesforce Developer Edition or Scratch Org:

```bash
# Authenticate via browser web flow
sf org login web --set-default --alias ShipmentOrg

# Verify authentication state
sf org display --target-org ShipmentOrg
```

### Step D: Named Credential & External Credential Configuration

Because external API secrets must never be committed to source control, configure the Shippo External Credential directly in your target Salesforce org:

1. Log into your Salesforce org as an Administrator.
2. Navigate to **Setup &rarr; Security &rarr; Named Credentials**.
3. Select the **External Credentials** tab and click **New**:
   - **Label**: `Shippo External Credential`
   - **Name**: `Shippo_External_Credential`
   - **Authentication Protocol**: `Custom`
   - Click **Save**.
4. In the **Principals** section of `Shippo_External_Credential`, click **New**:
   - **Parameter Name**: `Shippo_Named_Principal`
   - **Sequence**: `1`
   - Click **Save**.
5. In the **Custom Headers** section of `Shippo_External_Credential`, click **New**:
   - **Name**: `Authorization`
   - **Value**: `ShippoToken <YOUR_SHIPPO_API_TOKEN>` _(Replace with your actual Shippo API token)_
   - Click **Save**.
6. Switch to the **Named Credentials** tab and click **New**:
   - **Label**: `Shippo Named Credential`
   - **Name**: `Shippo_Named_Credential`
   - **URL**: `https://api.goshippo.com`
   - **External Credential**: Select `Shippo_External_Credential`
   - **Generate Authorization Header**: Checked
   - **Allow Callouts to Subdomains**: Checked
   - Click **Save**.
7. Assign the **`Shippo API Access`** Permission Set to your user:
   - Navigate to **Setup &rarr; Users &rarr; Permission Sets &rarr; Shippo API Access &rarr; Manage Assignments**.
   - Assign to your active administrative user.

### Step E: Salesforce Metadata Deployment

Deploy all Apex classes, Custom Objects, Permission Sets, and Lightning Web Components to your target org:

```bash
# Deploy all project metadata to the default target org
sf project deploy start --target-org ShipmentOrg --source-dir force-app

# Assign the operational permission sets
sf org assign permset --name Logistics_Operations_Access --target-org ShipmentOrg
sf org assign permset --name Shippo_API_Access --target-org ShipmentOrg
```

### Step F: Synthetic Demo Data Seeding

Populate your org with 36 realistic synthetic shipment records across all 7 statuses, 3 risk tiers, and 12 linked Salesforce Cases:

```bash
# Execute the idempotent seeding script
sf apex run --file scripts/apex/seedShipmentDemoData.apex --target-org ShipmentOrg
```

---

## Testing Instructions

### LWC Unit Tests (Jest)

The project includes a comprehensive LWC Jest suite testing all six workspaces and the application shell:

```bash
# Run all LWC unit tests
npm test

# Run tests in watch mode during development
npm run test:unit:watch

# Generate code coverage report
npm run test:unit:coverage
```

**Expected Result**:

```text
PASS force-app/main/default/lwc/riskIntelligence/__tests__/riskIntelligence.test.js
PASS force-app/main/default/lwc/shipmentIntelligence/__tests__/shipmentIntelligence.test.js
PASS force-app/main/default/lwc/exceptionCentre/__tests__/exceptionCentre.test.js
PASS force-app/main/default/lwc/logisticsAppShell/__tests__/logisticsAppShell.test.js
PASS force-app/main/default/lwc/shipmentDashboard/__tests__/shipmentDashboard.test.js
PASS force-app/main/default/lwc/analyticsReports/__tests__/analyticsReports.test.js
PASS force-app/main/default/lwc/caseManagement/__tests__/caseManagement.test.js

Test Suites: 7 passed, 7 total
Tests:       126 passed, 126 total
Snapshots:   0 total
Time:        ~8-12s
```

### Apex Regression Tests

Execute server-side Apex unit tests against your target org:

```bash
sf apex run test --test-level RunSpecifiedTests \
  --tests ShipmentControllerTest,ShipmentServiceTest,ShipmentRiskCalculatorTest,ShippoServiceTest,TrackingProviderFactoryTest,ShipmentDemoDataTest \
  --target-org ShipmentOrg \
  --result-format human \
  --code-coverage
```

**Expected Result**:

- Tests: **98/98 test methods passed (100%)**
  - `ShipmentControllerTest`: 38 passed
  - `ShipmentServiceTest`: 13 passed
  - `ShippoServiceTest`: 23 passed
  - `TrackingProviderFactoryTest`: 4 passed
  - `ShipmentRiskCalculatorTest`: 18 passed
  - `ShipmentDemoDataTest`: 2 passed
- **Project Test Run Coverage**: **82%** (873 / 1,065 lines covered across all project classes)
  - `ShipmentRiskCalculator`: 100% (46 / 46 lines)
  - `TrackingProviderFactory`: 100% (10 / 10 lines)
  - `ShippoTrackingAdapter`: 100% (6 / 6 lines)
  - `ShipmentInfo`: 100% (20 / 20 lines)
  - `ShippoService`: 92% (201 / 218 lines)
  - `ShipmentController`: 78% (393 / 505 lines)
  - `ShipmentService`: 76% (197 / 260 lines)
- **Org-Wide Apex Coverage**: **79%**

### Code Quality & Linting

The project enforces strict code quality and formatting standards, with clear separation between verified automated checks and environment-restricted tooling:

#### 1. Verified Passing Automated Checks

- **JavaScript & LWC Linting (`npm run lint`)**:
  Enforces Salesforce LWC rules, accessibility standards, and ECMAScript best practices across all component bundles:

  ```bash
  npm run lint
  ```

  **Result**: `0 errors, 0 warnings` (Exit code: 0).

- **LWC Frontend & Configuration Prettier Check**:
  Validates that all LWC component templates (`.html`), styles (`.css`), component controllers (`.js`), and configuration files (`.json`) strictly conform to Prettier formatting:

  ```bash
  npx prettier --check "force-app/main/default/lwc/**/*.{html,css,js}" "*.json"
  ```

  **Result**: `All matched files use Prettier code style!` (Exit code: 0).

- **LWC Component Unit Tests (`npm test`)**:
  Executes the full Jest test suite across all 6 workspaces and the application shell:

  ```bash
  npm test
  ```

  **Result**: `7/7 suites passed, 126/126 tests passed` (Exit code: 0).

- **Apex Regression Test Suite (`sf apex run test`)**:
  Executes server-side regression tests against the target org:
  ```bash
  sf apex run test --test-level RunSpecifiedTests \
    --tests ShipmentControllerTest,ShipmentServiceTest,ShipmentRiskCalculatorTest,ShippoServiceTest,TrackingProviderFactoryTest,ShipmentDemoDataTest \
    --target-org ShipmentOrg --result-format human --code-coverage
  ```
  **Result**: `98/98 test methods passed (100%)`, **82% project test-run coverage** (Exit code: 0).

#### 2. Environment-Restricted Checks (Windows Security Policy)

- **Apex Prettier Parsing (`.cls`, `.trigger`, `.apex`)**:
  The default `npm run prettier:verify` command targets all project files including Apex (`**/*.cls`). It invokes `prettier-plugin-apex`, which relies on an embedded native binary (`apex-ast-serializer-win32-x64.exe`).

  > [!WARNING]
  > On enterprise Windows workstations enforcing **Windows Defender Application Control (WDAC)** or **Device Guard** policies, this executable is blocked by operating system security policies, causing any command targeting `.cls`, `.trigger`, or `.apex` to exit with an error. It cannot run in WDAC-enforced environments.

- **Salesforce Metadata XML Formatting**:
  Running Prettier across Salesforce metadata XML files (`*.xml`) reports formatting warnings because Salesforce DX exports XML using 4-space indentation, whereas `@prettier/plugin-xml` defaults to 2 spaces. The existing Salesforce DX formatting is retained to avoid unnecessary formatting changes and noisy Git diffs.

---

## Synthetic & Demo Data Disclaimer

- **Seeded Shipment Records**: To facilitate testing and academic evaluation, the project includes synthetic demo shipments linked to sample Salesforce Cases.
- **`Keep_Seeded_Date__c` Protection**: Seeded demo shipments have `Keep_Seeded_Date__c = true`. When synchronization is triggered on these records, the system preserves their seeded estimated delivery dates so that deterministic risk evaluation scenarios (`At Risk`, `Delayed`) remain testable.
- **Zero Fabricated Milestone Events**: The project **never** fabricates fake carrier event scans (`Shipment_Event__c`). Child tracking events are created strictly when genuine milestone payloads are returned from the external Shippo API.
- **Rule-Based Risk Assessment**: Delivery risk is assessed strictly through transparent, deterministic mathematical and timestamp comparisons (`ShipmentRiskCalculator`). The project makes no claim of using trained deep learning or artificial intelligence models.

---

## Security Considerations

1. **Named Credential Isolation**: External API tokens are never hardcoded in source code or committed to Git. Callouts reference secure Salesforce Named Credentials with Custom Header authentication.
2. **Access Control & USER_MODE Enforcement**:
   - All Apex classes (`ShipmentController`, `ShipmentService`, `ShipmentRiskCalculator`, `ShippoService`, `ShippoTrackingAdapter`, `TrackingProviderFactory`) are explicitly declared `with sharing` to enforce organization-wide defaults and sharing rules.
   - Database operations throughout the application enforce modern Salesforce **`WITH USER_MODE`** on SOQL queries (including dynamic binds via `Database.queryWithBinds(query, bindValues, AccessLevel.USER_MODE)`) and **`AccessLevel.USER_MODE`** on DML statements (`Database.insert`, `Database.update`, `Database.upsert`). This ensures that Field-Level Security (FLS) and Object-Level Security (CRUD) permissions are strictly validated at runtime.
3. **Strict Human-in-the-Loop Communication**: The platform **never sends automated emails or external messages**. The Case Management workspace generates editable draft responses that require explicit human review and approval by an authenticated CSR before dispatch.
4. **XSS & Injection Protection**: Lightning Web Components enforce strict DOM encapsulation via Shadow DOM and automatic output encoding, preventing cross-site scripting (XSS).
5. **Input Validation**: All tracking numbers and carrier inputs are validated and sanitized (`EncodingUtil.urlEncode`) prior to callout dispatch.

---

## Known Limitations & Future Scope

### Known Limitations

- **Single Active Carrier Gateway**: While the backend architecture uses a provider-agnostic factory (`ITrackingProvider`), Shippo is currently the only implemented external tracking provider.
- **Synchronous Callouts**: Tracking synchronization is currently invoked synchronously via AuraEnabled methods, subject to Salesforce synchronous callout limits (100 callouts per transaction).

### Future Scope

- **Additional Provider Adapters**: Implement native provider adapters for direct carrier APIs (e.g. FedEx Web Services, UPS Developer API, EasyPost).
- **Asynchronous Queueable Sync**: Transition bulk shipment synchronization to Salesforce `Queueable` or `Batchable` Apex to support enterprise-scale tracking updates.
- **Change Data Capture (CDC)**: Implement Salesforce Platform Events to reactively push milestone updates to the frontend without requiring manual refresh.

---

## Team & Project Metadata

- **Project Title**: Shipment Intelligence — Real-Time Consignment Tracking & Risk Resolution
- **Submission Track**: Wipro Phase II Project Evaluation
- **Lead Developer**: Anushka Darunkar
- **Target Org Alias**: `ShipmentOrg`
- **Salesforce Platform API Version**: 68.0

---

## Repository Information

- **GitHub Repository**: [https://github.com/Anushka-githubacc/shipment-intelligence.git](https://github.com/Anushka-githubacc/shipment-intelligence.git)
- **Primary Branch**: `main`
- **License**: Private / Proprietary (Wipro Phase II Submission)
