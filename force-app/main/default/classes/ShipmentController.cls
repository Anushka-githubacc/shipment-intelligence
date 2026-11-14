
public with sharing class ShipmentController {

    // Retrieve shipments using database-level dashboard filters.
    @AuraEnabled(cacheable=true)
    public static List<Shipment__c> getShipments(
        String searchTerm,
        String statusFilter,
        String riskFilter
    ) {
        try {
            String searchPattern = null;

            if (!String.isBlank(searchTerm)) {
                String escapedSearch = searchTerm.trim()
                    .replace('\\', '\\\\')
                    .replace('%', '\\%')
                    .replace('_', '\\_');

                searchPattern = '%' + escapedSearch + '%';
            }

            String normalizedStatus =
                String.isBlank(statusFilter) ||
                statusFilter.trim().equalsIgnoreCase('All')
                    ? null
                    : statusFilter.trim();

            String normalizedRisk =
                String.isBlank(riskFilter) ||
                riskFilter.trim().equalsIgnoreCase('All')
                    ? null
                    : riskFilter.trim();

            List<String> conditions = new List<String>();
            Map<String, Object> bindValues = new Map<String, Object>();

            if (searchPattern != null) {
                conditions.add(
                    '(Tracking_Code__c LIKE :searchPattern ' +
                    'OR Carrier__c LIKE :searchPattern ' +
                    'OR Name LIKE :searchPattern)'
                );
                bindValues.put('searchPattern', searchPattern);
            }

            if (normalizedStatus != null) {
                conditions.add('Status__c = :normalizedStatus');
                bindValues.put('normalizedStatus', normalizedStatus);
            }

            if (normalizedRisk != null) {
                conditions.add('Risk_Level__c = :normalizedRisk');
                bindValues.put('normalizedRisk', normalizedRisk);
            }

            String query =
                'SELECT Id, Name, Tracking_Code__c, Carrier__c, ' +
                'Provider__c, Status__c, Estimated_Delivery_Date__c, ' +
                'Last_Synced__c, Risk_Level__c, Risk_Reason__c, Case__c ' +
                'FROM Shipment__c';

            if (!conditions.isEmpty()) {
                query += ' WHERE ' + String.join(conditions, ' AND ');
            }

            query += ' ORDER BY LastModifiedDate DESC LIMIT 500';

            return Database.queryWithBinds(
                query,
                bindValues,
                AccessLevel.USER_MODE
            );

        } catch (Exception e) {
            throw new AuraHandledException(
                'Unable to retrieve shipments: ' + e.getMessage()
            );
        }
    }

    // Retrieve shipments linked to a particular Salesforce Case.
    @AuraEnabled(cacheable=true)
    public static List<Shipment__c> getShipmentsForCase(Id caseId) {
        if (caseId == null) {
            throw new AuraHandledException(
                'A valid Case ID is required.'
            );
        }

        try {
            return [
                SELECT Id, Name, Tracking_Code__c, Carrier__c,
                       Provider__c, Status__c,
                       Estimated_Delivery_Date__c,
                       Last_Synced__c, Risk_Level__c,
                       Risk_Reason__c, Case__c
                FROM Shipment__c
                WHERE Case__c = :caseId
                WITH USER_MODE
                ORDER BY LastModifiedDate DESC
                LIMIT 500
            ];

        } catch (Exception e) {
            throw new AuraHandledException(
                'Unable to retrieve Case shipments: ' + e.getMessage()
            );
        }
    }

    // Backward-compatible single shipment synchronization.
    @AuraEnabled
    public static Shipment__c syncOne(
        String carrier,
        String trackingNumber,
        Id caseId
    ) {
        return syncOneWithProvider(
            'Shippo',
            carrier,
            trackingNumber,
            caseId
        );
    }

    // Provider-aware single shipment synchronization.
    @AuraEnabled
    public static Shipment__c syncOneWithProvider(
        String providerName,
        String carrier,
        String trackingNumber,
        Id caseId
    ) {
        try {
            return ShipmentService.syncAndSave(
                providerName,
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

    // Backward-compatible bulk synchronization.
    @AuraEnabled
    public static List<Shipment__c> syncMultiple(
        String carrier,
        List<String> trackingNumbers
    ) {
        return syncMultipleWithProvider(
            'Shippo',
            carrier,
            trackingNumbers
        );
    }

    // Provider-aware bulk synchronization.
    @AuraEnabled
    public static List<Shipment__c> syncMultipleWithProvider(
        String providerName,
        String carrier,
        List<String> trackingNumbers
    ) {
        try {
            if (trackingNumbers == null || trackingNumbers.isEmpty()) {
                throw new IllegalArgumentException(
                    'At least one tracking number is required.'
                );
            }

            ShipmentService.syncCodes(
                providerName,
                carrier,
                trackingNumbers
            );

            Set<String> normalizedCodes = new Set<String>();

            for (String code : trackingNumbers) {
                normalizedCodes.add(code.trim());
            }

            return [
                SELECT Id, Name, Tracking_Code__c, Carrier__c,
                       Provider__c, Status__c,
                       Estimated_Delivery_Date__c,
                       Last_Synced__c, Risk_Level__c,
                       Risk_Reason__c, Case__c
                FROM Shipment__c
                WHERE Tracking_Code__c IN :normalizedCodes
                WITH USER_MODE
                ORDER BY LastModifiedDate DESC
            ];

        } catch (Exception e) {
            throw new AuraHandledException(
                'Unable to synchronize shipments: ' + e.getMessage()
            );
        }
    }
}
