
@IsTest
private class ShipmentControllerTest {

    // Mock response for Shippo API callouts
    private class ControllerShipmentMock implements HttpCalloutMock {

        public HttpResponse respond(HttpRequest req) {

            List<String> parts = req.getEndpoint().split('/');
            String trackingCode = parts[parts.size() - 1];

            String statusDate = Datetime.now().formatGMT(
                'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\''
            );

            String estimatedDate = Datetime.now().addDays(3).formatGMT(
                'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\''
            );

            Map<String, Object> trackingStatus =
                new Map<String, Object>{
                    'status' => 'TRANSIT',
                    'status_date' => statusDate,
                    'status_details' => 'Shipment is moving'
                };

            Map<String, Object> responseBody =
                new Map<String, Object>{
                    'tracking_number' => trackingCode,
                    'carrier' => 'shippo',
                    'eta' => estimatedDate,
                    'test' => true,
                    'tracking_status' => trackingStatus
                };

            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            response.setHeader('Content-Type', 'application/json');
            response.setBody(JSON.serialize(responseBody));

            return response;
        }
    }

    // Create common test records
    @TestSetup
    static void createTestData() {

        Case testCase = new Case(
            Subject = 'Shipment Controller Test Case',
            Status = 'New',
            Origin = 'Phone'
        );
        insert testCase;

        List<Shipment__c> shipments = new List<Shipment__c>{

            new Shipment__c(
                Tracking_Code__c = 'SEARCH_TRANSIT_001',
                Carrier__c = 'shippo',
                Provider__c = 'Shippo',
                Status__c = 'in_transit',
                Risk_Level__c = 'On Track',
                Risk_Reason__c = 'Within estimated delivery time',
                Estimated_Delivery_Date__c = Datetime.now().addDays(3),
                Case__c = testCase.Id
            ),

            new Shipment__c(
                Tracking_Code__c = 'SEARCH_DELIVERED_002',
                Carrier__c = 'shippo',
                Provider__c = 'Shippo',
                Status__c = 'delivered',
                Risk_Level__c = 'On Track',
                Risk_Reason__c = 'Delivered'
            ),

            new Shipment__c(
                Tracking_Code__c = 'SEARCH_DELAYED_003',
                Carrier__c = 'delhivery',
                Provider__c = 'Shippo',
                Status__c = 'failure',
                Risk_Level__c = 'Delayed',
                Risk_Reason__c = 'Delivery failed'
            )
        };

        insert shipments;
    }

    // Test 1: Retrieve all dashboard shipments
    @IsTest
    static void retrievesAllShipments() {

        Test.startTest();

        List<Shipment__c> results =
            ShipmentController.getShipments(null, null, null);

        Test.stopTest();

        System.assertEquals(3, results.size());
    }

    // Test 2: Search by tracking code
    @IsTest
    static void searchesShipmentsByTrackingCode() {

        Test.startTest();

        List<Shipment__c> results =
            ShipmentController.getShipments(
                'SEARCH_TRANSIT_001',
                null,
                null
            );

        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals(
            'SEARCH_TRANSIT_001',
            results[0].Tracking_Code__c
        );
    }

    // Test 3: Search by carrier
    @IsTest
    static void searchesShipmentsByCarrier() {

        Test.startTest();

        List<Shipment__c> results =
            ShipmentController.getShipments(
                'delhivery',
                null,
                null
            );

        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals('delhivery', results[0].Carrier__c);
    }

    // Test 4: Filter shipments by status
    @IsTest
    static void filtersShipmentsByStatus() {

        Test.startTest();

        List<Shipment__c> results =
            ShipmentController.getShipments(
                null,
                'delivered',
                null
            );

        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals('delivered', results[0].Status__c);
    }

    // Test 5: Filter shipments by risk level
    @IsTest
    static void filtersShipmentsByRiskLevel() {

        Test.startTest();

        List<Shipment__c> results =
            ShipmentController.getShipments(
                null,
                null,
                'Delayed'
            );

        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals('Delayed', results[0].Risk_Level__c);
    }

    // Test 6: Apply search, status and risk filters together
    @IsTest
    static void appliesCombinedDashboardFilters() {

        Test.startTest();

        List<Shipment__c> results =
            ShipmentController.getShipments(
                'SEARCH_TRANSIT',
                'in_transit',
                'On Track'
            );

        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals(
            'SEARCH_TRANSIT_001',
            results[0].Tracking_Code__c
        );
        System.assertEquals('Shippo', results[0].Provider__c);
    }

    // Test 7: Retrieve shipments linked to a Case
    @IsTest
    static void retrievesShipmentsForCase() {

        Case testCase = [
            SELECT Id
            FROM Case
            WHERE Subject = 'Shipment Controller Test Case'
            LIMIT 1
        ];

        Test.startTest();

        List<Shipment__c> results =
            ShipmentController.getShipmentsForCase(testCase.Id);

        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals(testCase.Id, results[0].Case__c);
    }

    // Test 8: Reject a missing Case ID
    @IsTest
    static void rejectsMissingCaseId() {

        Boolean exceptionThrown = false;

        try {
            ShipmentController.getShipmentsForCase(null);
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }

        System.assertEquals(true, exceptionThrown);
    }

    // Test 9: Synchronize one shipment using default Shippo provider
    @IsTest
    static void synchronizesOneShipment() {

        Test.setMock(
            HttpCalloutMock.class,
            new ControllerShipmentMock()
        );

        Test.startTest();

        Shipment__c result = ShipmentController.syncOne(
            'shippo',
            'CTRL_SYNC_001',
            null
        );

        Test.stopTest();

        System.assertNotEquals(null, result.Id);
        System.assertEquals('CTRL_SYNC_001', result.Tracking_Code__c);
        System.assertEquals('Shippo', result.Provider__c);
        System.assertEquals('in_transit', result.Status__c);
    }

    // Test 10: Synchronize multiple shipments using provider-aware method
    @IsTest
    static void synchronizesMultipleShipments() {

        Test.setMock(
            HttpCalloutMock.class,
            new ControllerShipmentMock()
        );

        Test.startTest();

        List<Shipment__c> results =
            ShipmentController.syncMultipleWithProvider(
                'Shippo',
                'shippo',
                new List<String>{
                    'CTRL_BULK_001',
                    'CTRL_BULK_002',
                    'CTRL_BULK_003'
                }
            );

        Test.stopTest();

        System.assertEquals(3, results.size());

        for (Shipment__c shipment : results) {
            System.assertEquals('Shippo', shipment.Provider__c);
            System.assertEquals('in_transit', shipment.Status__c);
        }
    }

    // Test 11: Reject invalid bulk synchronization input
    @IsTest
    static void rejectsInvalidBulkSynchronizationInput() {

        Boolean exceptionThrown = false;

        try {
            ShipmentController.syncMultipleWithProvider(
                'Shippo',
                ' ',
                new List<String>{ 'CTRL_INVALID_001' }
            );
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }

        System.assertEquals(true, exceptionThrown);
    }
}
