
@IsTest
private class ShippoServiceTest {

    // Mock response for the Shippo tracking API.
    private class ShippoMock implements HttpCalloutMock {
        private String rawStatus;
        private Integer responseCode;
        private Boolean omitTrackingStatus;

        ShippoMock(String rawStatus, Integer responseCode) {
            this.rawStatus = rawStatus;
            this.responseCode = responseCode;
            this.omitTrackingStatus = false;
        }

        ShippoMock(Boolean omitTrackingStatus) {
            this.rawStatus = null;
            this.responseCode = 200;
            this.omitTrackingStatus = omitTrackingStatus;
        }

        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(responseCode);
            res.setHeader('Content-Type', 'application/json');

            if (responseCode != 200) {
                res.setBody('{"detail":"Simulated API error"}');
                return res;
            }

            String body =
                '{"tracking_number":"TEST_TRACK_001",' +
                '"carrier":"shippo",' +
                '"eta":"2026-11-15T12:30:00Z",' +
                '"test":true';

            if (!omitTrackingStatus) {
                body +=
                    ',"tracking_status":{' +
                    '"status":"' + rawStatus + '",' +
                    '"status_date":"2026-11-14T10:30:00Z",' +
                    '"status_details":"Test tracking event"' +
                    '}';
            }

            body += '}';

            res.setBody(body);
            return res;
        }
    }

    private static ShipmentInfo trackWithStatus(String rawStatus) {
        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(rawStatus, 200)
        );

        Test.startTest();
        ShipmentInfo info = ShippoService.track(
            'shippo',
            'TEST_TRACK_001'
        );
        Test.stopTest();

        return info;
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
    static void handlesMissingTrackingStatus() {
        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock(true)
        );

        Test.startTest();
        ShipmentInfo info = ShippoService.track(
            'shippo',
            'TEST_TRACK_001'
        );
        Test.stopTest();

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
    static void handlesHttpErrorResponse() {
        Test.setMock(
            HttpCalloutMock.class,
            new ShippoMock('TRANSIT', 500)
        );

        Boolean exceptionThrown = false;

        Test.startTest();
        try {
            ShippoService.track('shippo', 'TEST_TRACK_001');
        } catch (CalloutException e) {
            exceptionThrown = true;
            System.assert(
                e.getMessage().contains('500')
            );
        }
        Test.stopTest();

        System.assert(
            exceptionThrown,
            'Expected an exception for an unsuccessful HTTP response.'
        );
    }
}
