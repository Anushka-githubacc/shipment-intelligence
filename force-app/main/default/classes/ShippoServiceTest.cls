
@IsTest
private class ShippoServiceTest {

    private class ShippoMock implements HttpCalloutMock {
        private Integer responseCode;
        private String responseBody;

        ShippoMock(Integer responseCode, String responseBody) {
            this.responseCode = responseCode;
            this.responseBody = responseBody;
        }

        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();

            res.setStatusCode(responseCode);
            res.setHeader('Content-Type', 'application/json');
            res.setBody(responseBody);

            return res;
        }
    }

    private static String buildResponse(
        String rawStatus,
        Boolean includeTrackingStatus
    ) {
        Map<String, Object> body = new Map<String, Object>{
            'tracking_number' => 'TEST_TRACK_001',
            'carrier' => 'shippo',
            'eta' => '2026-11-15T12:30:00Z',
            'test' => true
        };

        if (includeTrackingStatus) {
            body.put(
                'tracking_status',
                new Map<String, Object>{
                    'status' => rawStatus,
                    'status_date' => '2026-11-14T10:30:00Z',
                    'status_details' => 'Test tracking event'
                }
            );
        }

        return JSON.serialize(body);
    }

    private static ShipmentInfo trackWithStatus(String rawStatus) {
        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(
                200,
                buildResponse(rawStatus, true)
            )
        );

        return ShippoService.track(
            'shippo',
            'TEST_TRACK_001'
        );
    }

    private static void assertHttpFailure(Integer statusCode) {
        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(
                statusCode,
                '{"detail":"Simulated API error"}'
            )
        );

        Boolean exceptionThrown = false;

        try {
            ShippoService.track('shippo', 'TEST_TRACK_001');
        } catch (CalloutException e) {
            exceptionThrown = true;

            System.assert(
                e.getMessage().contains(String.valueOf(statusCode)),
                'Expected the HTTP status code in the error message.'
            );

            System.assert(
                !e.getMessage().contains('Simulated API error'),
                'The external response body should not be exposed.'
            );
        }

        System.assert(
            exceptionThrown,
            'Expected failure for HTTP status ' + statusCode
        );
    }

    @IsTest
    static void mapsPreTransitStatus() {
        ShipmentInfo info = trackWithStatus('PRE_TRANSIT');

        System.assertEquals('pre_transit', info.status);
        System.assertEquals('PRE_TRANSIT', info.rawStatus);
    }

    @IsTest
    static void mapsTransitStatus() {
        ShipmentInfo info = trackWithStatus('TRANSIT');

        System.assertEquals('in_transit', info.status);
    }

    @IsTest
    static void mapsOutForDeliveryStatus() {
        ShipmentInfo info = trackWithStatus('OUT_FOR_DELIVERY');

        System.assertEquals('out_for_delivery', info.status);
    }

    @IsTest
    static void mapsDeliveredStatus() {
        ShipmentInfo info = trackWithStatus('DELIVERED');

        System.assertEquals('delivered', info.status);
    }

    @IsTest
    static void mapsReturnedStatus() {
        ShipmentInfo info = trackWithStatus('RETURNED');

        System.assertEquals('return_to_sender', info.status);
    }

    @IsTest
    static void mapsFailureStatus() {
        ShipmentInfo info = trackWithStatus('FAILURE');

        System.assertEquals('failure', info.status);
    }

    @IsTest
    static void mapsUnknownStatus() {
        ShipmentInfo info = trackWithStatus('SOME_NEW_STATUS');

        System.assertEquals('unknown', info.status);
    }

    @IsTest
    static void mapsStatusCaseInsensitively() {
        ShipmentInfo info = trackWithStatus('transit');

        System.assertEquals('in_transit', info.status);
        System.assertEquals('transit', info.rawStatus);
    }

    @IsTest
    static void handlesMissingTrackingStatus() {
        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(
                200,
                buildResponse(null, false)
            )
        );

        ShipmentInfo info = ShippoService.track(
            'shippo',
            'TEST_TRACK_001'
        );

        System.assertEquals('unknown', info.status);
        System.assertEquals(null, info.rawStatus);
    }

    @IsTest
    static void parsesShipmentResponseFields() {
        ShipmentInfo info = trackWithStatus('TRANSIT');

        System.assertEquals('TEST_TRACK_001', info.trackingCode);
        System.assertEquals('shippo', info.carrier);
        System.assertEquals('Shippo', info.provider);
        System.assertEquals(true, info.isTest);
        System.assertEquals('TRANSIT', info.rawStatus);

        System.assertEquals(
            'Test tracking event',
            info.lastEventDetails
        );

        System.assertEquals(
            Datetime.newInstanceGmt(2026, 11, 15, 12, 30, 0),
            info.estDeliveryDate
        );

        System.assertEquals(
            Datetime.newInstanceGmt(2026, 11, 14, 10, 30, 0),
            info.lastEventDate
        );
    }

    @IsTest
    static void usesRequestedValuesWhenResponseFieldsAreMissing() {
        Map<String, Object> body = new Map<String, Object>{
            'tracking_status' => new Map<String, Object>{
                'status' => 'TRANSIT'
            }
        };

        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(200, JSON.serialize(body))
        );

        ShipmentInfo info = ShippoService.track(
            'shippo',
            'REQUESTED_TRACK_001'
        );

        System.assertEquals(
            'REQUESTED_TRACK_001',
            info.trackingCode
        );

        System.assertEquals('shippo', info.carrier);
        System.assertEquals('in_transit', info.status);
    }

    @IsTest
    static void handlesMissingOptionalFields() {
        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(
                200,
                '{"tracking_number":"TEST_TRACK_001"}'
            )
        );

        ShipmentInfo info = ShippoService.track(
            'shippo',
            'TEST_TRACK_001'
        );

        System.assertEquals('unknown', info.status);
        System.assertEquals(null, info.estDeliveryDate);
        System.assertEquals(null, info.lastEventDate);
        System.assertEquals(null, info.lastEventDetails);
        System.assertEquals('Shippo', info.provider);
    }

    @IsTest
    static void handlesHttpErrorResponses() {
        Test.startTest();

        assertHttpFailure(400);
        assertHttpFailure(401);
        assertHttpFailure(403);
        assertHttpFailure(404);
        assertHttpFailure(429);
        assertHttpFailure(500);
        assertHttpFailure(503);

        Test.stopTest();
    }

    @IsTest
    static void rejectsEmptyResponseBody() {
        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(200, '')
        );

        Boolean exceptionThrown = false;

        try {
            ShippoService.track('shippo', 'TEST_TRACK_001');
        } catch (CalloutException e) {
            exceptionThrown = true;
            System.assert(
                e.getMessage().contains('empty response body')
            );
        }

        System.assert(exceptionThrown);
    }

    @IsTest
    static void rejectsMalformedJson() {
        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(200, '{"tracking_number":')
        );

        Boolean exceptionThrown = false;

        try {
            ShippoService.track('shippo', 'TEST_TRACK_001');
        } catch (CalloutException e) {
            exceptionThrown = true;
            System.assert(
                e.getMessage().contains('invalid JSON')
            );
        }

        System.assert(exceptionThrown);
    }

    @IsTest
    static void rejectsUnexpectedTopLevelJsonStructure() {
        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(200, '["unexpected"]')
        );

        Boolean exceptionThrown = false;

        try {
            ShippoService.track('shippo', 'TEST_TRACK_001');
        } catch (CalloutException e) {
            exceptionThrown = true;
            System.assert(
                e.getMessage().contains('invalid response structure')
            );
        }

        System.assert(exceptionThrown);
    }

    @IsTest
    static void rejectsInvalidTrackingStatusStructure() {
        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(
                200,
                '{"tracking_status":"invalid"}'
            )
        );

        Boolean exceptionThrown = false;

        try {
            ShippoService.track('shippo', 'TEST_TRACK_001');
        } catch (CalloutException e) {
            exceptionThrown = true;
            System.assert(
                e.getMessage().contains('tracking_status')
            );
        }

        System.assert(exceptionThrown);
    }

    @IsTest
    static void rejectsInvalidDate() {
        Map<String, Object> body = new Map<String, Object>{
            'tracking_number' => 'TEST_TRACK_001',
            'carrier' => 'shippo',
            'eta' => 'not-a-valid-date'
        };

        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(200, JSON.serialize(body))
        );

        Boolean exceptionThrown = false;

        try {
            ShippoService.track('shippo', 'TEST_TRACK_001');
        } catch (CalloutException e) {
            exceptionThrown = true;
            System.assert(
                e.getMessage().contains('invalid date')
            );
        }

        System.assert(exceptionThrown);
    }

    @IsTest
    static void rejectsBlankCarrier() {
        Boolean exceptionThrown = false;

        try {
            ShippoService.track('', 'TEST_TRACK_001');
        } catch (IllegalArgumentException e) {
            exceptionThrown = true;
        }

        System.assert(exceptionThrown);
    }

    @IsTest
    static void rejectsBlankTrackingNumber() {
        Boolean exceptionThrown = false;

        try {
            ShippoService.track('shippo', ' ');
        } catch (IllegalArgumentException e) {
            exceptionThrown = true;
        }

        System.assert(exceptionThrown);
    }
}
