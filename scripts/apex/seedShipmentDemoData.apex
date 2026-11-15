
List<String> trackingCodes = new List<String>{
    'SHIPPO_PRE_TRANSIT',
    'SHIPPO_TRANSIT',
    'SHIPPO_DELIVERED',
    'SHIPPO_RETURNED',
    'SHIPPO_FAILURE',
    'SHIPPO_UNKNOWN'
};

Map<String, String> caseSubjects = new Map<String, String>{
    'SHIPPO_PRE_TRANSIT' => 'Shipment not yet dispatched - Demo',
    'SHIPPO_TRANSIT' => 'Shipment delayed in transit - Demo',
    'SHIPPO_DELIVERED' => 'Delivery confirmation - Demo',
    'SHIPPO_RETURNED' => 'Shipment returned to sender - Demo',
    'SHIPPO_FAILURE' => 'Delivery attempt failed - Demo',
    'SHIPPO_UNKNOWN' => 'Tracking information unavailable - Demo'
};

// Reuse existing demo Cases to avoid duplicates.
Map<String, Case> casesBySubject = new Map<String, Case>();

for (Case c : [
    SELECT Id, Subject
    FROM Case
    WHERE Subject IN :caseSubjects.values()
]) {
    casesBySubject.put(c.Subject, c);
}

List<Case> casesToInsert = new List<Case>();

for (String code : trackingCodes) {
    String subject = caseSubjects.get(code);

    if (!casesBySubject.containsKey(subject)) {
        casesToInsert.add(new Case(
            Subject = subject,
            Status = 'New',
            Origin = 'Phone'
        ));
    }
}

if (!casesToInsert.isEmpty()) {
    insert casesToInsert;

    for (Case c : casesToInsert) {
        casesBySubject.put(c.Subject, c);
    }
}

Map<String, Case> caseByTrackingCode = new Map<String, Case>();

for (String code : trackingCodes) {
    caseByTrackingCode.put(
        code,
        casesBySubject.get(caseSubjects.get(code))
    );
}

// Retrieve all six existing shipments.
Map<String, Shipment__c> shipmentsByCode =
    new Map<String, Shipment__c>();

for (Shipment__c s : [
    SELECT Id, Tracking_Code__c, Status__c,
           Estimated_Delivery_Date__c,
           Keep_Seeded_Date__c
    FROM Shipment__c
    WHERE Tracking_Code__c IN :trackingCodes
]) {
    shipmentsByCode.put(s.Tracking_Code__c, s);
}

if (shipmentsByCode.size() != 6) {
    throw new IllegalArgumentException(
        'Expected six demo shipments, but found ' +
        shipmentsByCode.size() + '. No shipment updates were performed.'
    );
}

Datetime nowTime = Datetime.now();

Map<String, Datetime> demoEtas = new Map<String, Datetime>{
    'SHIPPO_PRE_TRANSIT' => nowTime.addDays(3),
    'SHIPPO_TRANSIT' => nowTime.addHours(12),
    'SHIPPO_DELIVERED' => nowTime.addDays(1),
    'SHIPPO_RETURNED' => nowTime.addDays(2),
    'SHIPPO_FAILURE' => nowTime.addDays(2),
    'SHIPPO_UNKNOWN' => nowTime.addDays(3)
};

List<Shipment__c> shipmentsToUpdate = new List<Shipment__c>();

for (String code : trackingCodes) {
    Shipment__c shipment = shipmentsByCode.get(code);

    shipment.Case__c = caseByTrackingCode.get(code).Id;
    shipment.Estimated_Delivery_Date__c = demoEtas.get(code);
    shipment.Keep_Seeded_Date__c = true;

    ShipmentRiskCalculator.Risk risk =
        ShipmentRiskCalculator.assess(
            shipment.Status__c,
            shipment.Estimated_Delivery_Date__c,
            nowTime
        );

    shipment.Risk_Level__c = risk.level;
    shipment.Risk_Reason__c = risk.reason;

    shipmentsToUpdate.add(shipment);
}

update shipmentsToUpdate;

System.debug(
    LoggingLevel.INFO,
    'Successfully linked and updated ' +
    shipmentsToUpdate.size() + ' demo shipments.'
);
