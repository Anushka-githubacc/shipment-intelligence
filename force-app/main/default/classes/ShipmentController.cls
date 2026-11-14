
public with sharing class ShipmentController {

    // Retrieve shipments and apply dashboard filters.
    @AuraEnabled(cacheable=true)
    public static List<Shipment__c> getShipments(
        String searchTerm,
        String statusFilter,
        String riskFilter
    ) {
        List<Shipment__c> shipments = [
            SELECT Id, Name, Tracking_Code__c, Carrier__c,
                   Status__c, Estimated_Delivery_Date__c,
                   Last_Synced__c, Risk_Level__c,
                   Risk_Reason__c, Case__c
            FROM Shipment__c
            WITH USER_MODE
            ORDER BY LastModifiedDate DESC
            LIMIT 500
        ];

        List<Shipment__c> results = new List<Shipment__c>();

        String search = String.isBlank(searchTerm)
            ? null : searchTerm.trim().toLowerCase();

        for (Shipment__c s : shipments) {

            Boolean matchesSearch = search == null ||
                (s.Tracking_Code__c != null &&
                 s.Tracking_Code__c.toLowerCase().contains(search)) ||
                (s.Carrier__c != null &&
                 s.Carrier__c.toLowerCase().contains(search)) ||
                (s.Name != null &&
                 s.Name.toLowerCase().contains(search));

            Boolean matchesStatus =
                String.isBlank(statusFilter) ||
                statusFilter == 'All' ||
                s.Status__c == statusFilter;

            Boolean matchesRisk =
                String.isBlank(riskFilter) ||
                riskFilter == 'All' ||
                s.Risk_Level__c == riskFilter;

            if (matchesSearch && matchesStatus && matchesRisk) {
                results.add(s);
            }
        }

        return results;
    }

    // Synchronize and save one shipment.
    @AuraEnabled
    public static Shipment__c syncOne(
        String carrier,
        String trackingNumber,
        Id caseId
    ) {
        try {
            return ShipmentService.syncAndSave(
                carrier,
                trackingNumber,
                caseId
            );
        } catch (Exception e) {
            throw new AuraHandledException(
                'Unable to synchronize shipment: ' + e.getMessage()
            );
        }
    }

    // Synchronize multiple shipments.
    @AuraEnabled
    public static List<Shipment__c> syncMultiple(
        String carrier,
        List<String> trackingNumbers
    ) {
        try {
            if (String.isBlank(carrier) ||
                trackingNumbers == null ||
                trackingNumbers.isEmpty()) {
                throw new AuraHandledException(
                    'Carrier and tracking numbers are required.'
                );
            }

            List<Shipment__c> shipments =
                new List<Shipment__c>();

            for (String code : trackingNumbers) {
                shipments.add(
                    ShipmentService.buildFromApi(carrier, code, null)
                );
            }

            ShipmentService.saveAll(shipments);

            return shipments;

        } catch (Exception e) {
            throw new AuraHandledException(
                'Unable to synchronize shipments: ' + e.getMessage()
            );
        }
    }
}
