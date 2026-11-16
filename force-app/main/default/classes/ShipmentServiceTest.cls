@IsTest
private class ShipmentServiceTest {
  // Shared counter for tracking mock API callouts
  private static Integer calloutCount = 0;

  // Mock Shippo API responses
  private class ShipmentMock implements HttpCalloutMock {
    public HttpResponse respond(HttpRequest req) {
      ShipmentServiceTest.calloutCount++;

      List<String> parts = req.getEndpoint().split('/');
      String trackingCode = parts[parts.size() - 1];

      // Format dates as ISO-8601 strings expected by ShippoService
      String statusDate = Datetime.now()
        .formatGMT('yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'');

      String estimatedDate = Datetime.now()
        .addDays(3)
        .formatGMT('yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'');

      Map<String, Object> trackingStatus = new Map<String, Object>{
        'status' => 'TRANSIT',
        'status_date' => statusDate,
        'status_details' => 'Shipment is moving'
      };

      Map<String, Object> responseBody = new Map<String, Object>{
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

  // Helper method to create test Cases
  private static Case createTestCase(String subject) {
    Case testCase = new Case(
      Subject = subject,
      Status = 'New',
      Origin = 'Phone'
    );
    insert testCase;
    return testCase;
  }

  // Helper method to create existing Shipment records
  private static Shipment__c createExistingShipment(
    String trackingCode,
    Id caseId,
    Boolean keepSeededDate,
    Datetime seededDate
  ) {
    Shipment__c shipment = new Shipment__c(
      Tracking_Code__c = trackingCode,
      Carrier__c = 'shippo',
      Status__c = 'in_transit',
      Estimated_Delivery_Date__c = seededDate,
      Keep_Seeded_Date__c = keepSeededDate,
      Case__c = caseId,
      Provider__c = 'Shippo'
    );
    insert shipment;
    return shipment;
  }

  // Test 1: Create and save a new shipment
  @IsTest
  static void createsAndSavesNewShipment() {
    ShipmentServiceTest.calloutCount = 0;
    Test.setMock(HttpCalloutMock.class, new ShipmentMock());

    Test.startTest();
    Shipment__c result = ShipmentService.syncAndSave(
      'Shippo',
      'shippo',
      'NEW_TRACK_001',
      null
    );
    Test.stopTest();

    Shipment__c saved = [
      SELECT
        Tracking_Code__c,
        Provider__c,
        Carrier__c,
        Status__c,
        Estimated_Delivery_Date__c,
        Last_Synced__c
      FROM Shipment__c
      WHERE Tracking_Code__c = 'NEW_TRACK_001'
      LIMIT 1
    ];

    System.assertEquals('NEW_TRACK_001', saved.Tracking_Code__c);
    System.assertEquals('Shippo', saved.Provider__c);
    System.assertEquals('shippo', saved.Carrier__c);
    System.assertEquals('in_transit', saved.Status__c);
    System.assertNotEquals(null, saved.Estimated_Delivery_Date__c);
    System.assertNotEquals(null, saved.Last_Synced__c);
    System.assertEquals(1, ShipmentServiceTest.calloutCount);
    System.assertNotEquals(null, result.Id);
  }

  // Test 2: Preserve seeded ETA and existing Case relationship
  @IsTest
  static void preservesSeededEtaAndExistingCase() {
    Case originalCase = createTestCase('Original shipment case');

    Datetime seededEta = Datetime.now().addDays(10);

    createExistingShipment(
      'SEEDED_TRACK_001',
      originalCase.Id,
      true,
      seededEta
    );

    Test.setMock(HttpCalloutMock.class, new ShipmentMock());

    Test.startTest();
    ShipmentService.syncAndSave('Shippo', 'shippo', 'SEEDED_TRACK_001', null);
    Test.stopTest();

    Shipment__c updated = [
      SELECT
        Estimated_Delivery_Date__c,
        Keep_Seeded_Date__c,
        Case__c,
        Provider__c
      FROM Shipment__c
      WHERE Tracking_Code__c = 'SEEDED_TRACK_001'
      LIMIT 1
    ];

    System.assertEquals(seededEta, updated.Estimated_Delivery_Date__c);
    System.assertEquals(true, updated.Keep_Seeded_Date__c);
    System.assertEquals(originalCase.Id, updated.Case__c);
    System.assertEquals('Shippo', updated.Provider__c);
  }

  // Test 3: Replace existing Case when a new Case is supplied
  @IsTest
  static void replacesExistingCaseWhenNewCaseIsSupplied() {
    Case originalCase = createTestCase('Original case');
    Case replacementCase = createTestCase('Replacement case');

    createExistingShipment(
      'CASE_TRACK_001',
      originalCase.Id,
      false,
      Datetime.now().addDays(5)
    );

    Test.setMock(HttpCalloutMock.class, new ShipmentMock());

    Test.startTest();
    ShipmentService.syncAndSave(
      'Shippo',
      'shippo',
      'CASE_TRACK_001',
      replacementCase.Id
    );
    Test.stopTest();

    Shipment__c updated = [
      SELECT Case__c
      FROM Shipment__c
      WHERE Tracking_Code__c = 'CASE_TRACK_001'
      LIMIT 1
    ];

    System.assertEquals(replacementCase.Id, updated.Case__c);
  }

  // Test 4: Update existing record without creating a duplicate
  @IsTest
  static void updatesExistingRecordWithoutCreatingDuplicate() {
    createExistingShipment(
      'UPDATE_TRACK_001',
      null,
      false,
      Datetime.now().addDays(5)
    );

    Test.setMock(HttpCalloutMock.class, new ShipmentMock());

    Test.startTest();
    ShipmentService.syncAndSave('Shippo', 'shippo', 'UPDATE_TRACK_001', null);
    Test.stopTest();

    Integer recordCount = [
      SELECT COUNT()
      FROM Shipment__c
      WHERE Tracking_Code__c = 'UPDATE_TRACK_001'
    ];

    System.assertEquals(1, recordCount);
  }

  // Test 5: Synchronize multiple shipments in one batch
  @IsTest
  static void synchronizesMultipleShipmentsInOneBatch() {
    ShipmentServiceTest.calloutCount = 0;
    Test.setMock(HttpCalloutMock.class, new ShipmentMock());

    Test.startTest();
    ShipmentService.syncCodes(
      'Shippo',
      'shippo',
      new List<String>{ 'BULK_TRACK_001', 'BULK_TRACK_002', 'BULK_TRACK_003' }
    );
    Test.stopTest();

    List<Shipment__c> saved = [
      SELECT Tracking_Code__c, Provider__c, Status__c
      FROM Shipment__c
      WHERE
        Tracking_Code__c IN (
          'BULK_TRACK_001',
          'BULK_TRACK_002',
          'BULK_TRACK_003'
        )
    ];

    System.assertEquals(3, saved.size());
    System.assertEquals(3, ShipmentServiceTest.calloutCount);

    for (Shipment__c shipment : saved) {
      System.assertEquals('Shippo', shipment.Provider__c);
      System.assertEquals('in_transit', shipment.Status__c);
    }
  }

  // Test 6: Reject blank tracking number
  @IsTest
  static void rejectsBlankTrackingNumber() {
    Boolean exceptionThrown = false;

    try {
      ShipmentService.buildFromApi('Shippo', 'shippo', ' ', null);
    } catch (IllegalArgumentException e) {
      exceptionThrown = true;
      System.assert(e.getMessage().contains('Tracking number is required'));
    }

    System.assert(exceptionThrown);
  }

  // Test 7: Reject blank carrier
  @IsTest
  static void rejectsBlankCarrier() {
    Boolean exceptionThrown = false;

    try {
      ShipmentService.buildFromApi('Shippo', ' ', 'TRACK_001', null);
    } catch (IllegalArgumentException e) {
      exceptionThrown = true;
      System.assert(e.getMessage().contains('Carrier is required'));
    }

    System.assert(exceptionThrown);
  }

  // Test 8: Reject duplicate tracking numbers
  @IsTest
  static void rejectsDuplicateTrackingNumbers() {
    Boolean exceptionThrown = false;

    try {
      ShipmentService.syncCodes(
        'Shippo',
        'shippo',
        new List<String>{ 'DUPLICATE_001', 'DUPLICATE_001' }
      );
    } catch (IllegalArgumentException e) {
      exceptionThrown = true;
      System.assert(e.getMessage().contains('Duplicate tracking number'));
    }

    System.assert(exceptionThrown);
  }

  // Test 9: Reject more than 100 tracking numbers
  @IsTest
  static void rejectsMoreThanOneHundredTrackingNumbers() {
    List<String> codes = new List<String>();

    for (Integer i = 0; i < 101; i++) {
      codes.add('LIMIT_TRACK_' + i);
    }

    Boolean exceptionThrown = false;

    try {
      ShipmentService.syncCodes('Shippo', 'shippo', codes);
    } catch (IllegalArgumentException e) {
      exceptionThrown = true;
      System.assert(e.getMessage().contains('at most 100'));
    }

    System.assert(exceptionThrown);
  }

  // Test 10: Reject unsupported provider
  @IsTest
  static void rejectsUnsupportedProvider() {
    Boolean exceptionThrown = false;

    try {
      ShipmentService.buildFromApi('Delhivery', 'delhivery', 'TRACK_001', null);
    } catch (IllegalArgumentException e) {
      exceptionThrown = true;
      System.assert(e.getMessage().contains('Unsupported tracking provider'));
    }

    System.assert(exceptionThrown);
  }

  // Test 11: Persist tracking events with deduplication
  @IsTest
  static void savesTrackingEventsWithDeduplication() {
    Shipment__c shipment = new Shipment__c(
      Tracking_Code__c = 'EVT_TEST_SHIP_001',
      Carrier__c = 'shippo',
      Provider__c = 'Shippo',
      Status__c = 'in_transit'
    );
    insert shipment;

    ShipmentInfo.TrackingEvent evt1 = new ShipmentInfo.TrackingEvent();
    evt1.eventId = 'EVT_DEDUPE_01';
    evt1.eventDate = Datetime.now();
    evt1.status = 'pre_transit';
    evt1.description = 'Label generated';
    evt1.location = 'San Francisco, CA';

    ShipmentInfo.TrackingEvent evt2 = new ShipmentInfo.TrackingEvent();
    evt2.eventId = 'EVT_DEDUPE_01'; // duplicate ID in same batch
    evt2.eventDate = Datetime.now();
    evt2.status = 'pre_transit';
    evt2.description = 'Label generated duplicate';

    Test.startTest();
    ShipmentService.saveEvents(
      shipment.Id,
      new List<ShipmentInfo.TrackingEvent>{ evt1, evt2 },
      'Shippo'
    );

    // Run second sync with original event + new event to test upsert deduplication
    ShipmentInfo.TrackingEvent evt3 = new ShipmentInfo.TrackingEvent();
    evt3.eventId = 'EVT_DEDUPE_02';
    evt3.eventDate = Datetime.now();
    evt3.status = 'in_transit';
    evt3.description = 'In transit to facility';

    ShipmentService.saveEvents(
      shipment.Id,
      new List<ShipmentInfo.TrackingEvent>{ evt1, evt3 },
      'Shippo'
    );
    Test.stopTest();

    List<Shipment_Event__c> savedEvents = [
      SELECT Id, Event_ID__c, Event_Status__c, Shipment__c
      FROM Shipment_Event__c
      WHERE Shipment__c = :shipment.Id
      ORDER BY Event_ID__c ASC
    ];

    System.assertEquals(2, savedEvents.size());
    System.assertEquals('EVT_DEDUPE_01', savedEvents[0].Event_ID__c);
    System.assertEquals('EVT_DEDUPE_02', savedEvents[1].Event_ID__c);
  }

  // Mock for delivered shipments
  private class DeliveredShipmentMock implements HttpCalloutMock {
    public HttpResponse respond(HttpRequest req) {
      String statusDate = Datetime.now()
        .formatGMT('yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'');
      Map<String, Object> trackingStatus = new Map<String, Object>{
        'status' => 'DELIVERED',
        'status_date' => statusDate,
        'status_details' => 'Delivered to front porch'
      };
      Map<String, Object> responseBody = new Map<String, Object>{
        'tracking_number' => 'DELIV_TRACK_001',
        'carrier' => 'shippo',
        'eta' => statusDate,
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

  // Test 12: Populates actual delivery date when shipment is delivered
  @IsTest
  static void populatesActualDeliveryDateWhenDelivered() {
    Test.setMock(HttpCalloutMock.class, new DeliveredShipmentMock());

    Test.startTest();
    Shipment__c result = ShipmentService.syncAndSave(
      'Shippo',
      'shippo',
      'DELIV_TRACK_001',
      null
    );
    Test.stopTest();

    Shipment__c reloaded = [
      SELECT Id, Status__c, Actual_Delivery_Date__c
      FROM Shipment__c
      WHERE Tracking_Code__c = 'DELIV_TRACK_001'
    ];

    System.assertEquals('delivered', reloaded.Status__c);
    System.assertNotEquals(null, reloaded.Actual_Delivery_Date__c);
  }

  // Test 13: Preserves resolution details and actual delivery date across synchronization
  @IsTest
  static void preservesResolutionFieldsAcrossSync() {
    Datetime deliveredDate = Datetime.now().addDays(-1);
    Shipment__c shipment = new Shipment__c(
      Tracking_Code__c = 'SYNC_RES_001',
      Carrier__c = 'shippo',
      Provider__c = 'Shippo',
      Status__c = 'delivered',
      Actual_Delivery_Date__c = deliveredDate,
      Resolution_Status__c = 'Escalated',
      Resolution_Notes__c = 'Escalated to carrier logistics team.'
    );
    insert shipment;

    Test.setMock(HttpCalloutMock.class, new ShipmentMock());

    Test.startTest();
    Shipment__c result = ShipmentService.syncAndSave(
      'Shippo',
      'shippo',
      'SYNC_RES_001',
      null
    );
    Test.stopTest();

    Shipment__c reloaded = [
      SELECT
        Id,
        Tracking_Code__c,
        Resolution_Status__c,
        Resolution_Notes__c,
        Actual_Delivery_Date__c
      FROM Shipment__c
      WHERE Id = :shipment.Id
    ];

    System.assertEquals('Escalated', reloaded.Resolution_Status__c);
    System.assertEquals(
      'Escalated to carrier logistics team.',
      reloaded.Resolution_Notes__c
    );
    System.assertEquals(deliveredDate, reloaded.Actual_Delivery_Date__c);
  }
}
