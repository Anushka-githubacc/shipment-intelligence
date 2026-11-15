
public with sharing class ShippoService {
    private static final String PROVIDER_NAME = 'Shippo';

    private static final Map<String, String> STATUS_MAP =
        new Map<String, String>{
            'PRE_TRANSIT' => 'pre_transit',
            'TRANSIT' => 'in_transit',
            'OUT_FOR_DELIVERY' => 'out_for_delivery',
            'DELIVERED' => 'delivered',
            'RETURNED' => 'return_to_sender',
            'FAILURE' => 'failure',
            'UNKNOWN' => 'unknown'
        };

    public static ShipmentInfo track(
        String carrier,
        String trackingNumber
    ) {
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

        HttpRequest req = new HttpRequest();

        req.setEndpoint(
            'callout:Shippo_Named_Credential/tracks/' +
            EncodingUtil.urlEncode(carrier.trim(), 'UTF-8') +
            '/' +
            EncodingUtil.urlEncode(trackingNumber.trim(), 'UTF-8')
        );

        req.setMethod('GET');
        req.setHeader('Accept', 'application/json');

        HttpResponse res;

        try {
            res = new Http().send(req);
        } catch (CalloutException e) {
            throw new CalloutException(
                'Unable to connect to the Shippo tracking service.'
            );
        }

        if (res == null) {
            throw new CalloutException(
                'Shippo returned an empty HTTP response.'
            );
        }

        Integer statusCode = res.getStatusCode();

        if (statusCode < 200 || statusCode > 299) {
            throw new CalloutException(
                'Shippo tracking request failed with HTTP status ' +
                statusCode + '.'
            );
        }

        if (String.isBlank(res.getBody())) {
            throw new CalloutException(
                'Shippo returned an empty response body.'
            );
        }

        Map<String, Object> body;

        try {
            Object decoded = JSON.deserializeUntyped(res.getBody());

            if (!(decoded instanceof Map<String, Object>)) {
                throw new CalloutException(
                    'Shippo returned an invalid response structure.'
                );
            }

            body = (Map<String, Object>) decoded;

        } catch (CalloutException e) {
            throw e;
        } catch (Exception e) {
            throw new CalloutException(
                'Shippo returned invalid JSON data.'
            );
        }

        Map<String, Object> trackingStatus =
            getObject(body, 'tracking_status');

        ShipmentInfo info = new ShipmentInfo();

        String responseTrackingCode =
            getString(body, 'tracking_number');

        String responseCarrier =
            getString(body, 'carrier');

        info.trackingCode = String.isBlank(responseTrackingCode)
            ? trackingNumber.trim()
            : responseTrackingCode;

        info.carrier = String.isBlank(responseCarrier)
            ? carrier.trim()
            : responseCarrier;

        info.provider = PROVIDER_NAME;

        info.estDeliveryDate = parseDate(
            getString(body, 'eta'),
            'eta'
        );

        info.isTest = getBoolean(body, 'test');

        String rawStatus = trackingStatus == null
            ? null
            : getString(trackingStatus, 'status');

        info.rawStatus = rawStatus;

        String normalizedStatus = String.isBlank(rawStatus)
            ? null
            : rawStatus.trim().toUpperCase();

        info.status =
            normalizedStatus != null &&
            STATUS_MAP.containsKey(normalizedStatus)
                ? STATUS_MAP.get(normalizedStatus)
                : 'unknown';

        if (trackingStatus != null) {
            info.lastEventDate = parseDate(
                getString(trackingStatus, 'status_date'),
                'status_date'
            );

            info.lastEventDetails = getString(
                trackingStatus,
                'status_details'
            );
        }

        return info;
    }

    // Safely retrieves an optional nested JSON object.
    private static Map<String, Object> getObject(
        Map<String, Object> source,
        String fieldName
    ) {
        Object value = source.get(fieldName);

        if (value == null) {
            return null;
        }

        if (!(value instanceof Map<String, Object>)) {
            throw new CalloutException(
                'Shippo returned an invalid ' + fieldName + ' structure.'
            );
        }

        return (Map<String, Object>) value;
    }

    // Safely retrieves an optional string field.
    private static String getString(
        Map<String, Object> source,
        String fieldName
    ) {
        Object value = source.get(fieldName);

        if (value == null) {
            return null;
        }

        if (!(value instanceof String)) {
            throw new CalloutException(
                'Shippo returned an invalid ' + fieldName + ' value.'
            );
        }

        return (String) value;
    }

    // Safely retrieves an optional Boolean field.
    private static Boolean getBoolean(
        Map<String, Object> source,
        String fieldName
    ) {
        Object value = source.get(fieldName);

        if (value == null) {
            return null;
        }

        if (!(value instanceof Boolean)) {
            throw new CalloutException(
                'Shippo returned an invalid ' + fieldName + ' value.'
            );
        }

        return (Boolean) value;
    }

    // Parses ISO-8601 dates returned by Shippo.
    private static Datetime parseDate(
        String iso,
        String fieldName
    ) {
        if (String.isBlank(iso)) {
            return null;
        }

        try {
            return (Datetime) JSON.deserialize(
                JSON.serialize(iso),
                Datetime.class
            );
        } catch (Exception e) {
            throw new CalloutException(
                'Shippo returned an invalid date in ' +
                fieldName + '.'
            );
        }
    }
}
