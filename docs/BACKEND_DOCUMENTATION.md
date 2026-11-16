# Shipment Intelligence

## Backend Technical Documentation

### 1. Project Overview

Shipment Intelligence is a Salesforce-based shipment tracking and delay intelligence application. It integrates with an external shipment tracking provider, retrieves shipment information, stores shipment records in Salesforce and evaluates delivery risk.

The backend is designed around a provider-adapter architecture so that additional logistics providers can be incorporated in the future.

### 2. Backend Architecture

The backend consists of the following components:

| Component               | Responsibility                                             |
| ----------------------- | ---------------------------------------------------------- |
| ShippoService           | Communicates with the Shippo tracking REST API             |
| ShipmentInfo            | Transfers normalized shipment information                  |
| ITrackingProvider       | Defines the common tracking provider interface             |
| TrackingProviderFactory | Resolves the requested tracking provider                   |
| ShippoTrackingAdapter   | Connects the provider interface to ShippoService           |
| ShipmentService         | Handles shipment creation, synchronization and persistence |
| ShipmentController      | Exposes operations to Salesforce Lightning components      |
| ShipmentRiskCalculator  | Determines shipment delivery risk                          |

### 3. External API Integration

**Provider:** Shippo

**Endpoint:**
`GET https://api.goshippo.com/tracks/{carrier}/{tracking_number}`

**Authentication:** Shippo Token authentication through Salesforce Named Credentials and External Credentials.

The integration uses:

- Shippo Named Credential
- Shippo External Credential
- Shippo API Access Permission Set

Credentials are stored in Salesforce credential configuration rather than hardcoded in Apex source files.

### 4. Shipment Data Management

The custom Salesforce object `Shipment__c` stores shipment information.

Important fields include:

- Tracking_Code__c
- Carrier__c
- Provider__c
- Status__c
- Estimated_Delivery_Date__c
- Last_Synced__c
- Risk_Level__c
- Risk_Reason__c
- Case__c
- Keep_Seeded_Date__c

The tracking code is configured as a unique External ID to support shipment upsert operations without creating duplicate records.

### 5. Shipment Status Normalization

The external provider's shipment statuses are normalized into the application's internal status values:

| Provider status  | Internal status  |
| ---------------- | ---------------- |
| PRE_TRANSIT      | pre_transit      |
| TRANSIT          | in_transit       |
| OUT_FOR_DELIVERY | out_for_delivery |
| DELIVERED        | delivered        |
| RETURNED         | return_to_sender |
| FAILURE          | failure          |
| UNKNOWN          | unknown          |

### 6. Shipment Risk Calculation

The ShipmentRiskCalculator evaluates shipment status and estimated delivery time.

| Condition                                        | Risk level |
| ------------------------------------------------ | ---------- |
| Shipment delivered                               | On Track   |
| Shipment failed or returned                      | Delayed    |
| Estimated delivery time has passed               | Delayed    |
| Estimated delivery within 24 hours               | At Risk    |
| Out for delivery with future ETA within 24 hours | On Track   |
| Unknown status or missing ETA                    | At Risk    |
| Estimated delivery more than 24 hours away       | On Track   |

The calculator also generates a reason explaining the assigned risk level.

### 7. Security

The backend uses Salesforce security mechanisms:

- Apex classes use sharing enforcement where configured.
- Shipment queries use USER_MODE.
- Shipment persistence uses USER_MODE.
- External API authentication is managed through Named Credentials and External Credentials.
- API access is granted through the dedicated Shippo API Access Permission Set.
- Shipment deletion and unnecessary elevated permissions are restricted.

### 8. Bulk Processing and Limits

The ShipmentService supports bulk shipment synchronization.

The application enforces a maximum of 100 tracking requests per bulk operation to remain within Salesforce transaction callout limits.

The service validates blank tracking codes, blank carriers, duplicate tracking numbers and unsupported providers.

### 9. Error Handling

The integration handles:

- Invalid input values
- Unsupported tracking providers
- HTTP error responses
- Empty API responses
- Malformed JSON
- Unexpected response structures
- Invalid date values
- Missing optional tracking fields

Unexpected or invalid provider responses are handled through controlled exceptions rather than silently treated as successful tracking results.

### 10. Test Coverage and Validation

The backend regression test run completed with:

- 60 tests executed
- 60 tests passed
- 0 failures
- 80% org-wide Apex coverage

Individual class coverage:

| Class                   | Coverage |
| ----------------------- | -------: |
| ShippoService           |      93% |
| ShipmentRiskCalculator  |     100% |
| ShipmentService         |      78% |
| ShipmentController      |      82% |
| TrackingProviderFactory |      90% |
| ShippoTrackingAdapter   |     100% |
| ShipmentInfo            |     100% |

### 11. Demo Data and Limitations

Six synthetic shipment scenarios are maintained for demonstration:

1. Pre-transit
2. In transit
3. Delivered
4. Returned
5. Delivery failure
6. Unknown tracking status

Each shipment is associated with a dedicated Salesforce Case.

Shippo test-mode responses are synthetic and should not be represented as live carrier tracking. Seeded ETAs are used to demonstrate risk classification independently of the provider's test timestamps.

### 12. Future Enhancements

- Integration with additional logistics providers such as Shiprocket and Delhivery, subject to API access and credentials.
- Real-time shipment monitoring.
- Advanced delivery-delay analytics.
- Automated notification workflows with appropriate approval.
- AI-assisted customer communication, subject to feature availability and validation.
