
public with sharing class ShipmentService {
    private static final String DEFAULT_PROVIDER = 'Shippo';
    private static final Integer MAX_CALLOUTS_PER_BATCH = 100;

    // Backward-compatible method using the default provider.
    public static Shipment__c buildFromApi(
        String carrier,
        String trackingNumber,
        Id caseId
    ) {
        return buildFromApi(
            DEFAULT_PROVIDER,
            carrier,
            trackingNumber,
            caseId
        );
    }

    // Builds a shipment using the selected tracking provider.
    public static Shipment__c buildFromApi(
        String providerName,
        String carrier,
        String trackingNumber,
        Id caseId
    ) {
        if (String.isBlank(providerName)) {
            throw new IllegalArgumentException(
                'Integration provider name is required.'
            );
        }

        if (String.isBlank(carrier)) {
            throw new IllegalArgumentException(
                'Carrier is required.'
            );
        }

        if (String.isBlank(trackingNumber)) {
            throw new IllegalArgumentException(
                'Tracking number is required.'
            );
        }

        String normalizedCode = trackingNumber.trim();

        ITrackingProvider provider =
            TrackingProviderFactory.resolve(providerName);

        Map<String, Shipment__c> existingByCode =
            queryExisting(new Set<String>{ normalizedCode });

        ShipmentInfo info = provider.track(
            carrier.trim(),
            normalizedCode
        );

        if (info == null) {
            throw new CalloutException(
                'Tracking provider returned an empty shipment response.'
            );
        }

        return toShipment(
            provider,
            info,
            normalizedCode,
            caseId,
            findExisting(existingByCode, normalizedCode)
        );
    }

    // Saves records after all callouts have finished.
    public static void saveAll(List<Shipment__c> shipments) {
        if (shipments == null || shipments.isEmpty()) {
            return;
        }

        Database.upsert(
            shipments,
            Shipment__c.Tracking_Code__c,
            true
        );
    }

    // Backward-compatible method using the default provider.
    public static Shipment__c syncAndSave(
        String carrier,
        String trackingNumber,
        Id caseId
    ) {
        return syncAndSave(
            DEFAULT_PROVIDER,
            carrier,
            trackingNumber,
            caseId
        );
    }

    // Synchronizes and saves one shipment.
    public static Shipment__c syncAndSave(
        String providerName,
        String carrier,
        String trackingNumber,
        Id caseId
    ) {
        Shipment__c shipment = buildFromApi(
            providerName,
            carrier,
            trackingNumber,
            caseId
        );

        saveAll(new List<Shipment__c>{ shipment });

        return shipment;
    }

    // Backward-compatible bulk synchronization using the default provider.
    public static void syncCodes(
        String carrier,
        List<String> trackingNumbers
    ) {
        syncCodes(
            DEFAULT_PROVIDER,
            carrier,
            trackingNumbers
        );
    }

    // Synchronizes multiple shipments using the selected provider.
    // All callouts are completed before records are saved.
    public static void syncCodes(
        String providerName,
        String carrier,
        List<String> trackingNumbers
    ) {
        List<String> codes = normalizeTrackingNumbers(
            providerName,
            carrier,
            trackingNumbers
        );

        Map<String, Shipment__c> existingByCode =
            queryExisting(new Set<String>(codes));

        ITrackingProvider provider =
            TrackingProviderFactory.resolve(providerName);

        List<Shipment__c> toSave = new List<Shipment__c>();

        for (String code : codes) {
            ShipmentInfo info = provider.track(
                carrier.trim(),
                code
            );

            if (info == null) {
                throw new CalloutException(
                    'Tracking provider returned an empty shipment response ' +
                    'for tracking number: ' + code
                );
            }

            toSave.add(
                toShipment(
                    provider,
                    info,
                    code,
                    null,
                    findExisting(existingByCode, code)
                )
            );
        }

        saveAll(toSave);
    }

    // Validates and normalizes bulk synchronization input.
    private static List<String> normalizeTrackingNumbers(
        String providerName,
        String carrier,
        List<String> trackingNumbers
    ) {
        if (String.isBlank(providerName)) {
            throw new IllegalArgumentException(
                'Integration provider name is required.'
            );
        }

        if (String.isBlank(carrier)) {
            throw new IllegalArgumentException(
                'Carrier is required.'
            );
        }

        if (trackingNumbers == null || trackingNumbers.isEmpty()) {
            throw new IllegalArgumentException(
                'At least one tracking number is required.'
            );
        }

        if (trackingNumbers.size() > MAX_CALLOUTS_PER_BATCH) {
            throw new IllegalArgumentException(
                'A synchronous batch supports at most 100 tracking numbers. ' +
                'Each number requires one callout, and a transaction allows 100 callouts.'
            );
        }

        List<String> codes = new List<String>();
        Set<String> seen = new Set<String>();

        for (String trackingNumber : trackingNumbers) {
            if (String.isBlank(trackingNumber)) {
                throw new IllegalArgumentException(
                    'Tracking number is required.'
                );
            }

            String code = trackingNumber.trim();

            if (!seen.add(code.toLowerCase())) {
                throw new IllegalArgumentException(
                    'Duplicate tracking number in request: ' + code
                );
            }

            codes.add(code);
        }

        return codes;
    }

    // Retrieves existing shipment records in one SOQL query.
    private static Map<String, Shipment__c> queryExisting(
        Set<String> trackingNumbers
    ) {
        Map<String, Shipment__c> existingByCode =
            new Map<String, Shipment__c>();

        Set<String> codes = new Set<String>();

        if (trackingNumbers != null) {
            for (String trackingNumber : trackingNumbers) {
                if (!String.isBlank(trackingNumber)) {
                    codes.add(trackingNumber.trim());
                }
            }
        }

        if (codes.isEmpty()) {
            return existingByCode;
        }

        for (Shipment__c existing : [
            SELECT
                Id,
                Tracking_Code__c,
                Estimated_Delivery_Date__c,
                Keep_Seeded_Date__c,
                Case__c
            FROM Shipment__c
            WHERE Tracking_Code__c IN :codes
            WITH USER_MODE
        ]) {
            if (existing.Tracking_Code__c != null) {
                existingByCode.put(
                    existing.Tracking_Code__c.toLowerCase(),
                    existing
                );
            }
        }

        return existingByCode;
    }

    // Finds an existing shipment using a case-insensitive tracking code.
    private static Shipment__c findExisting(
        Map<String, Shipment__c> existingByCode,
        String trackingNumber
    ) {
        if (
            existingByCode == null ||
            String.isBlank(trackingNumber)
        ) {
            return null;
        }

        return existingByCode.get(
            trackingNumber.trim().toLowerCase()
        );
    }

    // Converts the provider response into a Salesforce Shipment record.
    private static Shipment__c toShipment(
        ITrackingProvider provider,
        ShipmentInfo info,
        String requestedTrackingNumber,
        Id caseId,
        Shipment__c existing
    ) {
        if (info == null) {
            throw new CalloutException(
                'Cannot create shipment because the tracking response is empty.'
            );
        }

        if (provider == null) {
            throw new IllegalArgumentException(
                'Tracking provider is required.'
            );
        }

        Datetime est = info.estDeliveryDate;

        // Preserve manually seeded ETAs when requested.
        if (
            existing != null &&
            existing.Keep_Seeded_Date__c == true
        ) {
            est = existing.Estimated_Delivery_Date__c;
        }

        ShipmentRiskCalculator.Risk risk =
            ShipmentRiskCalculator.assess(
                info.status,
                est,
                Datetime.now()
            );

        Shipment__c shipment = new Shipment__c(
            Tracking_Code__c = trackingCodeFor(
                info,
                requestedTrackingNumber,
                existing
            ),
            Carrier__c = info.carrier,
            Status__c = info.status,
            Estimated_Delivery_Date__c = est,
            Last_Synced__c = Datetime.now(),
            Risk_Level__c = risk.level,
            Risk_Reason__c = risk.reason,
            Provider__c = provider.getProviderName()
        );

        if (existing != null) {
            shipment.Id = existing.Id;
            shipment.Keep_Seeded_Date__c =
                existing.Keep_Seeded_Date__c;
        }

        // Preserve the existing Case relationship unless a new Case is supplied.
        if (caseId != null) {
            shipment.Case__c = caseId;
        } else if (existing != null) {
            shipment.Case__c = existing.Case__c;
        }

        return shipment;
    }

    // Determines which tracking code should be stored.
    private static String trackingCodeFor(
        ShipmentInfo info,
        String requestedTrackingNumber,
        Shipment__c existing
    ) {
        if (
            existing != null &&
            !String.isBlank(existing.Tracking_Code__c)
        ) {
            return existing.Tracking_Code__c;
        }

        if (!String.isBlank(info.trackingCode)) {
            return info.trackingCode;
        }

        return String.isBlank(requestedTrackingNumber)
            ? null
            : requestedTrackingNumber.trim();
    }
}
