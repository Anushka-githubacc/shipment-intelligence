/**
 * Shipment Intelligence - Synthetic Demo Dataset Seeding Script
 *
 * Expands the demo dataset from 6 to 36 realistic synthetic shipment records
 * distributed across all 7 supported statuses and 3 risk classifications, with
 * 12 appropriately linked Salesforce Cases.
 *
 * Idempotent: Uses Tracking_Code__c as External ID for upsert and checks existing
 * Case subjects to prevent duplicate record creation upon repeated execution.
 */

Datetime nowTime = Datetime.now();

// ============================================================================
// 1. DEFINE & SEED 12 SYNTHETIC SALESFORCE CASES
// ============================================================================
Map<String, Map<String, String>> demoCaseDefinitions = new Map<String, Map<String, String>>{
    'Shipment not yet dispatched - Demo' => new Map<String, String>{
        'Status' => 'New', 'Priority' => 'Medium', 'Origin' => 'Phone',
        'Description' => 'Customer inquiring why shipment has not been dispatched past expected dispatch date.'
    },
    'Shipment delayed in transit - Demo' => new Map<String, String>{
        'Status' => 'Working', 'Priority' => 'High', 'Origin' => 'Phone',
        'Description' => 'Consignment delayed between sorting hubs. Expedited investigation requested.'
    },
    'Delivery confirmation - Demo' => new Map<String, String>{
        'Status' => 'Closed', 'Priority' => 'Low', 'Origin' => 'Phone',
        'Description' => 'Delivery confirmed and receipt signed by customer.'
    },
    'Shipment returned to sender - Demo' => new Map<String, String>{
        'Status' => 'Working', 'Priority' => 'High', 'Origin' => 'Phone',
        'Description' => 'Delivery refused by consignee; parcel currently in transit back to origin.'
    },
    'Delivery attempt failed - Demo' => new Map<String, String>{
        'Status' => 'New', 'Priority' => 'Medium', 'Origin' => 'Phone',
        'Description' => 'Courier attempted delivery but consignee was unavailable. Reattempt scheduled.'
    },
    'Tracking information unavailable - Demo' => new Map<String, String>{
        'Status' => 'New', 'Priority' => 'Medium', 'Origin' => 'Phone',
        'Description' => 'No status updates received from carrier tracking service for over 48 hours.'
    },
    'Critical delay in transit - Medical supplies to Pune - Demo' => new Map<String, String>{
        'Status' => 'Working', 'Priority' => 'High', 'Origin' => 'Phone',
        'Description' => 'Time-sensitive healthcare consignment delayed at Chakan Pune sorting center. Escalated to regional logistics lead.'
    },
    'Customer unreachable - Multiple delivery attempts in Okhla Delhi - Demo' => new Map<String, String>{
        'Status' => 'New', 'Priority' => 'Medium', 'Origin' => 'Web',
        'Description' => 'Second delivery attempt failed in Okhla Phase III; consignee phone unreachable.'
    },
    'Return to sender: Incomplete address in T. Nagar Chennai - Demo' => new Map<String, String>{
        'Status' => 'Working', 'Priority' => 'High', 'Origin' => 'Email',
        'Description' => 'Door number missing from shipping label in T. Nagar Chennai. Customer contacted for address verification.'
    },
    'Urgent: Commercial consignment status unknown past delivery window - Demo' => new Map<String, String>{
        'Status' => 'Working', 'Priority' => 'High', 'Origin' => 'Phone',
        'Description' => 'Enterprise shipment status unknown past delivery SLA. Carrier escalation ticket opened with Peenya hub.'
    },
    'Delivery enquiry: High-value electronic server hardware to Hyderabad - Demo' => new Map<String, String>{
        'Status' => 'New', 'Priority' => 'Medium', 'Origin' => 'Web',
        'Description' => 'Customer requesting live tracking verification for data center equipment delivery in Hitec City.'
    },
    'Resolved: Damaged outer packaging re-verified and delivered to Mumbai - Demo' => new Map<String, String>{
        'Status' => 'Closed', 'Priority' => 'Medium', 'Origin' => 'Phone',
        'Description' => 'Outer carton inspected in presence of recipient at Bandra Kurla Complex; contents verified undamaged and accepted.'
    }
};

// Retrieve existing demo Cases to prevent duplicate creation
Map<String, Case> casesBySubject = new Map<String, Case>();
for (Case existingCase : [
    SELECT Id, Subject, Status, Priority, Origin, Description
    FROM Case
    WHERE Subject IN :demoCaseDefinitions.keySet()
]) {
    casesBySubject.put(existingCase.Subject, existingCase);
}

List<Case> casesToInsert = new List<Case>();
for (String subject : demoCaseDefinitions.keySet()) {
    if (!casesBySubject.containsKey(subject)) {
        Map<String, String> def = demoCaseDefinitions.get(subject);
        casesToInsert.add(new Case(
            Subject = subject,
            Status = def.get('Status'),
            Priority = def.get('Priority'),
            Origin = def.get('Origin'),
            Description = def.get('Description')
        ));
    }
}

if (!casesToInsert.isEmpty()) {
    insert casesToInsert;
    for (Case c : casesToInsert) {
        casesBySubject.put(c.Subject, c);
    }
}

// ============================================================================
// 2. DEFINE 36 REALISTIC SYNTHETIC SHIPMENTS
// ============================================================================
class ShipmentDemoSpec {
    String trackingCode;
    String carrier;
    String status;
    Datetime eta;
    Datetime actualDeliveryDate;
    String resolutionStatus;
    String resolutionNotes;
    String linkedCaseSubject;

    ShipmentDemoSpec(
        String code, String carrier, String status, Datetime eta,
        Datetime actualDeliveryDate, String resStatus, String notes, String caseSubject
    ) {
        this.trackingCode = code;
        this.carrier = carrier;
        this.status = status;
        this.eta = eta;
        this.actualDeliveryDate = actualDeliveryDate;
        this.resolutionStatus = resStatus;
        this.resolutionNotes = notes;
        this.linkedCaseSubject = caseSubject;
    }
}

List<ShipmentDemoSpec> specs = new List<ShipmentDemoSpec>{
    // Existing 6 Shippo demo shipments (preserved & enriched)
    new ShipmentDemoSpec(
        'SHIPPO_PRE_TRANSIT', 'shippo', 'pre_transit', nowTime.addDays(3),
        null, 'New', 'Seeded pre-transit shipment awaiting scheduled carrier pickup.',
        'Shipment not yet dispatched - Demo'
    ),
    new ShipmentDemoSpec(
        'SHIPPO_TRANSIT', 'shippo', 'in_transit', nowTime.addHours(12),
        null, 'Investigating', 'Approaching 24-hour delivery window, investigating carrier transit status.',
        'Shipment delayed in transit - Demo'
    ),
    new ShipmentDemoSpec(
        'SHIPPO_DELIVERED', 'shippo', 'delivered', nowTime.addDays(-1),
        nowTime.addDays(-1), 'Resolved', 'Successfully delivered to recipient.',
        'Delivery confirmation - Demo'
    ),
    new ShipmentDemoSpec(
        'SHIPPO_RETURNED', 'shippo', 'return_to_sender', nowTime.addDays(2),
        null, 'Action Required', 'Consignee refused delivery; return in progress.',
        'Shipment returned to sender - Demo'
    ),
    new ShipmentDemoSpec(
        'SHIPPO_FAILURE', 'shippo', 'failure', nowTime.addDays(2),
        null, 'Action Required', 'Delivery attempt failed; customer not available.',
        'Delivery attempt failed - Demo'
    ),
    new ShipmentDemoSpec(
        'SHIPPO_UNKNOWN', 'shippo', 'unknown', nowTime.addDays(3),
        null, 'Investigating', 'Carrier tracking API returned unknown status.',
        'Tracking information unavailable - Demo'
    ),

    // Blue Dart Express (6 shipments - Pune / Mumbai corridor)
    new ShipmentDemoSpec(
        'DEMO_BLUEDART_001', 'Blue Dart', 'in_transit', nowTime.addDays(3),
        null, 'New', 'In transit via Blue Dart Express, Mumbai Air Hub to Pune Central Hub.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_BLUEDART_002', 'Blue Dart', 'out_for_delivery', nowTime.addHours(6),
        null, 'New', 'Out for delivery in Shivaji Nagar, Pune. Courier van BD-PN-14.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_BLUEDART_003', 'Blue Dart', 'in_transit', nowTime.addDays(-1),
        null, 'Escalated', 'Critical delay at Chakan Pune sorting center due to weather hold. Regional logistics lead notified.',
        'Critical delay in transit - Medical supplies to Pune - Demo'
    ),
    new ShipmentDemoSpec(
        'DEMO_BLUEDART_004', 'Blue Dart', 'delivered', nowTime.addDays(-2),
        nowTime.addDays(-2), 'Resolved', 'Delivered to reception at Hinjewadi Phase 1, Pune. Signed by security desk.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_BLUEDART_005', 'Blue Dart', 'pre_transit', nowTime.addDays(4),
        null, 'New', 'Shipment manifests generated at Mumbai fulfillment center. Awaiting linehaul dispatch.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_BLUEDART_006', 'Blue Dart', 'in_transit', nowTime.addHours(18),
        null, 'Investigating', 'Linehaul vehicle transit from Surat to Mumbai. Approaching 24-hour SLA window.',
        null
    ),

    // Delhivery (6 shipments - Delhi NCR hub network)
    new ShipmentDemoSpec(
        'DEMO_DELHIVERY_001', 'Delhivery', 'in_transit', nowTime.addDays(2),
        null, 'New', 'Processed at Delhivery Bilaspur Gateway, transiting to Delhi North Hub.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_DELHIVERY_002', 'Delhivery', 'out_for_delivery', nowTime.addHours(4),
        null, 'New', 'Out for delivery in Connaught Place, New Delhi. Courier rider on route.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_DELHIVERY_003', 'Delhivery', 'delivered', nowTime.addDays(-1),
        nowTime.addDays(-1), 'Resolved', 'Delivered to recipient in Saket, New Delhi. OTP verified upon handover.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_DELHIVERY_004', 'Delhivery', 'failure', nowTime.addDays(-1),
        null, 'Action Required', 'Second delivery attempt failed; premises closed and consignee unreachable in Okhla Phase III.',
        'Customer unreachable - Multiple delivery attempts in Okhla Delhi - Demo'
    ),
    new ShipmentDemoSpec(
        'DEMO_DELHIVERY_005', 'Delhivery', 'pre_transit', nowTime.addDays(-1),
        null, 'Investigating', 'Seller manifest created but parcel not handed over to Delhivery hub. Estimated pickup date elapsed.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_DELHIVERY_006', 'Delhivery', 'in_transit', nowTime.addHours(8),
        null, 'Investigating', 'Transiting on NH48 corridor towards Gurugram hub. Delivery due within 8 hours.',
        null
    ),

    // DTDC (5 shipments - Chennai / Tamil Nadu network)
    new ShipmentDemoSpec(
        'DEMO_DTDC_001', 'DTDC', 'in_transit', nowTime.addDays(3),
        null, 'New', 'Departed Chennai Central Transshipment Center, moving to Coimbatore distribution facility.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_DTDC_002', 'DTDC', 'out_for_delivery', nowTime.addHours(5),
        null, 'New', 'Dispatched with last-mile executive for delivery in Anna Nagar, Chennai.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_DTDC_003', 'DTDC', 'return_to_sender', nowTime.addDays(-2),
        null, 'Escalated', 'Street number missing in T. Nagar address; consignee phone switched off. RTO initiated.',
        'Return to sender: Incomplete address in T. Nagar Chennai - Demo'
    ),
    new ShipmentDemoSpec(
        'DEMO_DTDC_004', 'DTDC', 'delivered', nowTime.addDays(-3),
        nowTime.addDays(-3), 'Resolved', 'Delivered and signed by customer in Guindy, Chennai.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_DTDC_005', 'DTDC', 'unknown', nowTime.addDays(2),
        null, 'Investigating', 'Transshipment scan delayed at Chennai Meenambakkam air terminal. Status inquiry raised.',
        null
    ),

    // Ekart Logistics (5 shipments - Bengaluru / Karnataka tech corridor)
    new ShipmentDemoSpec(
        'DEMO_EKART_001', 'Ekart', 'in_transit', nowTime.addDays(2),
        null, 'New', 'Transiting from Hoskote Mother Hub to Whitefield Hub, Bengaluru.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_EKART_002', 'Ekart', 'out_for_delivery', nowTime.addHours(-3),
        null, 'Action Required', 'Delivery delayed due to heavy vehicular congestion on Outer Ring Road, Bengaluru.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_EKART_003', 'Ekart', 'delivered', nowTime.addDays(-1),
        nowTime.addDays(-1), 'Resolved', 'Delivered to mailroom at Manyata Tech Park, Bengaluru.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_EKART_004', 'Ekart', 'unknown', nowTime.addDays(-1),
        null, 'Escalated', 'No tracking ping received since departure from Bengaluru Peenya hub. High-priority ticket logged.',
        'Urgent: Commercial consignment status unknown past delivery window - Demo'
    ),
    new ShipmentDemoSpec(
        'DEMO_EKART_005', 'Ekart', 'failure', nowTime.addDays(1),
        null, 'Investigating', 'Customer requested reschedule; delivery rescheduled for tomorrow in Indiranagar, Bengaluru.',
        null
    ),

    // Shadowfax (4 shipments - Hyderabad / Telangana network)
    new ShipmentDemoSpec(
        'DEMO_SHADOWFAX_001', 'Shadowfax', 'out_for_delivery', nowTime.addHours(2),
        null, 'New', 'On-demand hyperlocal courier en route in Gachibowli, Hyderabad.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_SHADOWFAX_002', 'Shadowfax', 'in_transit', nowTime.addDays(2),
        null, 'Investigating', 'Moving through Shamshabad Air Logistics Center to Hitec City distribution point.',
        'Delivery enquiry: High-value electronic server hardware to Hyderabad - Demo'
    ),
    new ShipmentDemoSpec(
        'DEMO_SHADOWFAX_003', 'Shadowfax', 'return_to_sender', nowTime.addDays(-1),
        null, 'Action Required', 'Consignee refused Cash-on-Delivery payment in Banjara Hills, Hyderabad. Return in transit.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_SHADOWFAX_004', 'Shadowfax', 'delivered', nowTime.addDays(-2),
        nowTime.addDays(-2), 'Resolved', 'Handed over to recipient at DLF Cyber City, Hyderabad.',
        null
    ),

    // FedEx Express (4 shipments - International / Domestic premium freight)
    new ShipmentDemoSpec(
        'DEMO_FEDEX_001', 'FedEx', 'pre_transit', nowTime.addDays(5),
        null, 'New', 'International import customs cleared at Mumbai Sahar Cargo Complex. Domestic leg booked.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_FEDEX_002', 'FedEx', 'delivered', nowTime.addDays(-1),
        nowTime.addDays(-1), 'Resolved', 'Outer carton inspected and verified intact in presence of customer in Bandra Kurla Complex, Mumbai.',
        'Resolved: Damaged outer packaging re-verified and delivered to Mumbai - Demo'
    ),
    new ShipmentDemoSpec(
        'DEMO_FEDEX_003', 'FedEx', 'in_transit', nowTime.addDays(-2),
        null, 'Escalated', 'Commercial vehicle mechanical breakdown on Mumbai-Pune Expressway. Relief vehicle deployed.',
        null
    ),
    new ShipmentDemoSpec(
        'DEMO_FEDEX_004', 'FedEx', 'return_to_sender', nowTime.addDays(1),
        null, 'Dismissed', 'Shipper requested cancellation and recall prior to final delivery.',
        null
    )
};

// ============================================================================
// 3. BUILD & UPSERT SHIPMENT RECORDS WITH OVERWRITE PROTECTION
// ============================================================================
Set<String> allCodes = new Set<String>();
for (ShipmentDemoSpec spec : specs) {
    allCodes.add(spec.trackingCode);
}

Map<String, Shipment__c> existingByCode = new Map<String, Shipment__c>();
for (Shipment__c existing : [
    SELECT Id, Tracking_Code__c, Resolution_Status__c, Resolution_Notes__c, Case__c, Actual_Delivery_Date__c
    FROM Shipment__c
    WHERE Tracking_Code__c IN :allCodes
]) {
    existingByCode.put(existing.Tracking_Code__c, existing);
}

List<Shipment__c> shipmentsToUpsert = new List<Shipment__c>();

for (ShipmentDemoSpec spec : specs) {
    ShipmentRiskCalculator.Risk risk =
        ShipmentRiskCalculator.assess(spec.status, spec.eta, nowTime);

    Id linkedCaseId = null;
    if (!String.isBlank(spec.linkedCaseSubject) && casesBySubject.containsKey(spec.linkedCaseSubject)) {
        linkedCaseId = casesBySubject.get(spec.linkedCaseSubject).Id;
    }

    String resStatus = spec.resolutionStatus;
    String resNotes = spec.resolutionNotes;
    Datetime actualDel = spec.actualDeliveryDate;

    // Preserve existing operational resolution notes, statuses, and custom linked Cases
    Shipment__c existing = existingByCode.get(spec.trackingCode);
    if (existing != null) {
        if (!String.isBlank(existing.Resolution_Status__c)) {
            resStatus = existing.Resolution_Status__c;
        }
        if (!String.isBlank(existing.Resolution_Notes__c)) {
            resNotes = existing.Resolution_Notes__c;
        }
        if (existing.Actual_Delivery_Date__c != null) {
            actualDel = existing.Actual_Delivery_Date__c;
        }
        if (linkedCaseId == null && existing.Case__c != null) {
            linkedCaseId = existing.Case__c;
        }
    }

    Shipment__c shipment = new Shipment__c(
        Tracking_Code__c = spec.trackingCode,
        Carrier__c = spec.carrier,
        Provider__c = 'Shippo',
        Status__c = spec.status,
        Estimated_Delivery_Date__c = spec.eta,
        Actual_Delivery_Date__c = actualDel,
        Last_Synced__c = nowTime,
        Risk_Level__c = risk.level,
        Risk_Reason__c = risk.reason,
        Resolution_Status__c = resStatus,
        Resolution_Notes__c = resNotes,
        Keep_Seeded_Date__c = true,
        Case__c = linkedCaseId
    );

    shipmentsToUpsert.add(shipment);
}

// Perform idempotent upsert on Tracking_Code__c external ID
Database.UpsertResult[] results = Database.upsert(
    shipmentsToUpsert,
    Shipment__c.Tracking_Code__c,
    true
);

// ============================================================================
// 4. VERIFICATION METRICS SUMMARY
// ============================================================================
Integer totalShipments = [SELECT count() FROM Shipment__c];
Integer totalCases = [SELECT count() FROM Case WHERE Subject IN :demoCaseDefinitions.keySet()];
Integer linkedShipments = [SELECT count() FROM Shipment__c WHERE Case__c != null];
Integer eventCount = [SELECT count() FROM Shipment_Event__c];

Map<String, Integer> statusCounts = new Map<String, Integer>();
for (AggregateResult ar : [
    SELECT Status__c st, count(Id) cnt
    FROM Shipment__c
    GROUP BY Status__c
]) {
    statusCounts.put((String) ar.get('st'), (Integer) ar.get('cnt'));
}

Map<String, Integer> riskCounts = new Map<String, Integer>();
for (AggregateResult ar : [
    SELECT Risk_Level__c rk, count(Id) cnt
    FROM Shipment__c
    GROUP BY Risk_Level__c
]) {
    riskCounts.put((String) ar.get('rk'), (Integer) ar.get('cnt'));
}

System.debug(LoggingLevel.INFO, '================================================');
System.debug(LoggingLevel.INFO, 'SHIPMENT INTELLIGENCE - SEEDING COMPLETE');
System.debug(LoggingLevel.INFO, 'Total Shipments: ' + totalShipments);
System.debug(LoggingLevel.INFO, 'Total Linked Cases: ' + totalCases + ' (' + linkedShipments + ' shipments linked)');
System.debug(LoggingLevel.INFO, 'Shipment Events Fabricated: ' + eventCount + ' (Must be 0)');
System.debug(LoggingLevel.INFO, 'Status Breakdown: ' + JSON.serialize(statusCounts));
System.debug(LoggingLevel.INFO, 'Risk Breakdown: ' + JSON.serialize(riskCounts));
System.debug(LoggingLevel.INFO, '================================================');
