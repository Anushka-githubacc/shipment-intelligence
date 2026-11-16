# Shipment Intelligence

**Monitor. Predict. Investigate. Resolve.**

Shipment Intelligence is an enterprise-grade shipment tracking, delay risk prediction, and resolution platform built natively on the Salesforce Platform using Apex (API 68.0) and Lightning Web Components (LWC). It integrates with external tracking providers via REST APIs to synchronize shipment milestones, calculate rule-based delay risks, and empower customer support teams with operational visibility and automated communications.

---

## Architecture Overview

Shipment Intelligence uses a decoupled, provider-adapter backend architecture paired with an application shell housing six purpose-built operational workspaces.

### 1. Backend Service Layer (Apex)

- **`ITrackingProvider`**: Common tracking provider interface defining standardized tracking retrieval.
- **`TrackingProviderFactory`**: Dynamic factory resolving the requested tracking provider implementation.
- **`ShippoTrackingAdapter`**: Concrete adapter connecting `ITrackingProvider` to `ShippoService`.
- **`ShippoService`**: HTTP client communicating with the Shippo Tracking REST API via Salesforce Named Credentials and External Credentials.
- **`ShipmentService`**: Core domain service managing shipment persistence, tracking code normalization, status progression, and event deduplication.
- **`ShipmentRiskCalculator`**: Rule-based risk evaluation engine scoring shipments into `On Track`, `At Risk`, or `Delayed` based on estimated delivery dates, tracking events, and carrier exceptions.
- **`ShipmentController`**: AuraEnabled controller exposing cacheable and imperative operations to Lightning Web Components.
- **`ShipmentInfo`**: Strongly-typed data transfer object (DTO) transferring normalized tracking payloads.

### 2. Data Model

- **`Shipment__c`**: Primary consignment record storing tracking codes, carrier information, status, risk tier, estimated vs. actual delivery timestamps, and relationship to Salesforce `Case`.
- **`Shipment_Event__c`**: Child milestone tracking event storing event timestamps, status progression, event descriptions, locations, and unique external event identifiers.

---

## Operational Workspaces

The platform UI is hosted within **`logisticsAppShell`**, featuring a command-centre sidebar, global search, and six workspaces:

1. **Control Tower (`shipmentDashboard`)**
   - High-level operational overview and KPI telemetry.
   - Status and risk filters, search by carrier or tracking code, and "Needs Attention" triage toggle.
   - Interactive shipment journey stepper (Booked &rarr; In Transit &rarr; Out for Delivery &rarr; Delivered) with exception handling.
   - Single-record and bulk Shippo tracking synchronization.

2. **Shipment Intelligence (`shipmentIntelligence`)**
   - Deep-dive technical consignment investigation in a responsive Bento Grid layout.
   - Chronological tracking milestone events with route and location markers.

3. **Risk Intelligence (`riskIntelligence`)**
   - Delay risk distribution visualizer across all active shipments.
   - Slide-in technical investigation drawer detailing root-cause delay drivers.

4. **Exception Centre (`exceptionCentre`)**
   - Urgency triage for critical delivery exceptions (Failed delivery attempts, Return to Sender, transit stalls).
   - Prescriptive recommendation matrix for operational intervention.
   - Human-in-the-loop resolution workflow capturing resolution notes and status.

5. **Analytics & Reports (`analyticsReports`)**
   - Multi-carrier performance benchmarking (FedEx, UPS, DHL Express, Delhivery, Blue Dart).
   - Transit duration analysis, on-time delivery percentages, and SLA compliance metrics.

6. **Case Management (`caseManagement`)**
   - Case Explorer displaying Salesforce Cases linked to shipments.
   - Dynamic layout switching between full-width table view and split-view detail panel.
   - AI-assisted customer communication draft generation with human review before dispatch.

---

## Prerequisites & Development

- **Salesforce CLI (`sf`)**: v2.x or later
- **Node.js**: v18.x or v20.x
- **Target Org**: Salesforce Developer Edition or Scratch Org (API Version 68.0)

### Running Tests Locally

```bash
# Run all LWC Jest unit tests
npm test

# Run JavaScript linter across LWC components
npm run lint

# Check Git diff for trailing whitespace or formatting defects
git diff --check
```

### Apex Tests

```bash
# Execute the full Apex regression test suite against target org
sf apex run test --test-level RunSpecifiedTests --tests ShipmentControllerTest,ShipmentServiceTest,ShipmentRiskCalculatorTest,ShippoServiceTest,TrackingProviderFactoryTest,ShipmentDemoDataTest -o <target-org-alias>
```
