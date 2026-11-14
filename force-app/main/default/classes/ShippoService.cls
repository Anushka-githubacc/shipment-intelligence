public with sharing class ShippoService {
    private static final String PROVIDER_NAME = 'Shippo';

    // Shippo's statuses mapped to Salesforce picklist values
    private static final Map<String, String> STATUS_MAP = new Map<String, String>{
        'PRE_TRANSIT' => 'pre_transit',
        'TRANSIT' => 'in_transit',
        'OUT_FOR_DELIVERY' => 'out_for_delivery',
        'DELIVERED' => 'delivered',
        'RETURNED' => 'return_to_sender',
        'FAILURE' => 'failure',
        'UNKNOWN' => 'unknown'
    };

    public static ShipmentInfo track(String carrier, String trackingNumber) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(
            'callout:Shippo_Named_Credential/tracks/' +
                EncodingUtil.urlEncode(carrier, 'UTF-8') +
                '/' +
                EncodingUtil.urlEncode(trackingNumber, 'UTF-8')
        );
        req.setMethod('GET');

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() < 200 || res.getStatusCode() > 299) {
            throw new CalloutException('Shippo returned HTTP ' + res.getStatusCode());
        }

        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        Map<String, Object> ts = (Map<String, Object>) body.get('tracking_status');

        ShipmentInfo info = new ShipmentInfo();
        info.trackingCode = (String) body.get('tracking_number');
        info.carrier = (String) body.get('carrier');
        info.provider = PROVIDER_NAME;
        info.estDeliveryDate = parseDate((String) body.get('eta'));
        info.isTest = (Boolean) body.get('test');

        String rawStatus = (ts == null) ? null : (String) ts.get('status');
        info.rawStatus = rawStatus;
        info.status = (rawStatus != null && STATUS_MAP.containsKey(rawStatus))
            ? STATUS_MAP.get(rawStatus)
            : 'unknown';

        if (ts != null) {
            info.lastEventDate = parseDate((String) ts.get('status_date'));
            info.lastEventDetails = (String) ts.get('status_details');
        }
        return info;
    }

    private static Datetime parseDate(String iso) {
        if (String.isBlank(iso)) {
            return null;
        }
        return (Datetime) JSON.deserialize('"' + iso + '"', Datetime.class);
    }
}
