# Shipment Intelligence — Agent Instructions

## Project Context

This is an existing Salesforce project built using Apex, Lightning Web Components and Salesforce CLI.

The project already has a functioning backend. Your responsibility is to build and refine the frontend without unnecessarily modifying the backend.

## Existing Backend

The following Apex classes already exist:

- ShipmentController
- ShipmentService
- ShipmentRiskCalculator
- ShipmentInfo
- ShippoService
- ITrackingProvider
- TrackingProviderFactory
- ShippoTrackingAdapter

The Shipment__c object stores tracking code, carrier, provider, status, estimated delivery, last synchronization, risk level, risk reason and Case relationship.

Six synthetic shipments are already seeded and linked to six Salesforce Cases.

The latest verified backend regression run passed 60/60 tests with 80% org-wide Apex coverage. These results predate any future modifications.

## Locked Design System

The dashboard design is fixed:

- Light theme.
- Hybrid Bento Grid + Spatial UI.
- Subtle 3D intensity.
- Soft off-white background.
- White cards with restrained shadows.
- Electric cyan primary accent.
- Violet secondary accent.
- Emerald for On Track.
- Amber for At Risk.
- Coral red for Delayed.
- Modern sans-serif typography.
- Responsive layout.

### Signature Feature

The shipment journey stepper is a mandatory signature feature.

Stages:

1. Booked / Pre-transit.
2. In Transit.
3. Out for Delivery.
4. Delivered.

It must respond to the actual shipment status.

Returned, failure and unknown statuses must have appropriate exception states. Never display them as successful delivery progress.

Selecting a shipment must update the journey stepper.

## Technical Requirements

- Use Salesforce Lightning Web Components.
- Use the existing Apex methods and inspect their actual signatures before calling them.
- Preserve API version 68.0.
- Use existing Salesforce security and access patterns.
- Do not hardcode demo shipment data.
- Do not create mock production data to simulate API results.
- Do not install unnecessary external UI libraries.
- Do not introduce React or a separate web application.
- Do not modify the existing BikeCard project.
- Preserve existing backend classes unless a specific defect requires a change.
- Use Salesforce-compatible components and styling.

## Development Workflow

1. Inspect the actual project before editing.
2. Produce a plan for every major multi-file implementation.
3. Edit only the files required for the approved batch.
4. Avoid overwriting existing components without inspecting them.
5. Run available validation and tests after changes.
6. Report every modified file.
7. Report deployment or test failures honestly.
8. Never claim successful Salesforce deployment without actual confirmation.
9. Do not commit or push without user approval.
10. Keep implementations consolidated rather than making repeated piecemeal changes.

## Expected Frontend

### Shipment Dashboard

- Summary KPI cards.
- Shipment datatable.
- Search by tracking code or carrier.
- Status filter.
- Risk filter.
- Needs Attention toggle.
- Sync and refresh.
- Loading, empty and error states.
- Risk indicators.
- TEST DATA indicator.
- Interactive shipment journey stepper.

### Case Shipment Panel

- Retrieve shipments linked to the current Case.
- Display status, ETA and risk.
- Refresh tracking.
- Generate customer update draft.
- Editable message area.
- Human review before communication.

## Critical Restrictions

- Never send emails or messages automatically.
- Do not claim that multiple courier providers are integrated. Shippo is the only implemented provider.
- Preserve seeded ETAs when Keep_Seeded_Date__c is true.
- Do not change existing Apex method signatures without approval.
- Do not change Named Credential or External Credential configuration without a demonstrated need.
