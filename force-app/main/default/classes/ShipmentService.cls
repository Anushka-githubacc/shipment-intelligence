public with sharing class ShipmentService {

    // Builds a Shipment__c from the API. Callout only, NO database save here.
    public static Shipment__c buildFromApi(String carrier, String trackingNumber, Id caseId) {
        // A query before a callout is fine
        List<Shipment__c> existing = [
    SELECT Id, Estimated_Delivery_Date__c, Keep_Seeded_Date__c
    FROM Shipment__c
    WHERE Tracking_Code__c = :trackingNumber
    WITH USER_MODE
    LIMIT 1
];
        ShippoService.ShipmentInfo info = ShippoService.track(carrier, trackingNumber);

        // Keep your hand-set demo date if the record says so
        Datetime est = info.estDeliveryDate;
        if (!existing.isEmpty() && existing[0].Keep_Seeded_Date__c == true) {
            est = existing[0].Estimated_Delivery_Date__c;
        }

        ShipmentRiskCalculator.Risk risk =
            ShipmentRiskCalculator.assess(info.status, est, Datetime.now());

        Shipment__c s = new Shipment__c(
            Tracking_Code__c = info.trackingCode,
            Carrier__c = info.carrier,
            Status__c = info.status,
            Estimated_Delivery_Date__c = est,
            Last_Synced__c = Datetime.now(),
            Risk_Level__c = risk.level,
            Risk_Reason__c = risk.reason
        );
        if (caseId != null) {
            s.Case__c = caseId;
        }
        return s;
    }

    // Saves records. Always runs AFTER all callouts are finished.
    public static void saveAll(List<Shipment__c> shipments) {
        Database.upsert(shipments, Shipment__c.Tracking_Code__c, true);
    }

    public static Shipment__c syncAndSave(String carrier, String trackingNumber, Id caseId) {
        Shipment__c s = buildFromApi(carrier, trackingNumber, caseId);
        saveAll(new List<Shipment__c>{ s });
        return s;
    }

    // Many shipments: do every callout first, then save once
    public static void syncCodes(String carrier, List<String> trackingNumbers) {
        List<Shipment__c> toSave = new List<Shipment__c>();
        for (String code : trackingNumbers) {
            toSave.add(buildFromApi(carrier, code, null));
        }
        saveAll(toSave);
    }
}