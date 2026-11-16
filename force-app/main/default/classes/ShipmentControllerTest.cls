@IsTest
private class ShipmentControllerTest {
  // Mock response for Shippo API callouts
  private class ControllerShipmentMock implements HttpCalloutMock {
    public HttpResponse respond(HttpRequest req) {
      List<String> parts = req.getEndpoint().split('/');
      String trackingCode = parts[parts.size() - 1];

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

    List<Shipment__c> results = ShipmentController.getShipments(
      null,
      null,
      null
    );

    Test.stopTest();

    System.assertEquals(3, results.size());
  }

  // Test 2: Search by tracking code
  @IsTest
  static void searchesShipmentsByTrackingCode() {
    Test.startTest();

    List<Shipment__c> results = ShipmentController.getShipments(
      'SEARCH_TRANSIT_001',
      null,
      null
    );

    Test.stopTest();

    System.assertEquals(1, results.size());
    System.assertEquals('SEARCH_TRANSIT_001', results[0].Tracking_Code__c);
  }

  // Test 3: Search by carrier
  @IsTest
  static void searchesShipmentsByCarrier() {
    Test.startTest();

    List<Shipment__c> results = ShipmentController.getShipments(
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

    List<Shipment__c> results = ShipmentController.getShipments(
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

    List<Shipment__c> results = ShipmentController.getShipments(
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

    List<Shipment__c> results = ShipmentController.getShipments(
      'SEARCH_TRANSIT',
      'in_transit',
      'On Track'
    );

    Test.stopTest();

    System.assertEquals(1, results.size());
    System.assertEquals('SEARCH_TRANSIT_001', results[0].Tracking_Code__c);
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

    List<Shipment__c> results = ShipmentController.getShipmentsForCase(
      testCase.Id
    );

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
    Test.setMock(HttpCalloutMock.class, new ControllerShipmentMock());

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
    Test.setMock(HttpCalloutMock.class, new ControllerShipmentMock());

    Test.startTest();

    List<Shipment__c> results = ShipmentController.syncMultipleWithProvider(
      'Shippo',
      'shippo',
      new List<String>{ 'CTRL_BULK_001', 'CTRL_BULK_002', 'CTRL_BULK_003' }
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

  // Test 12: Retrieve complete shipment detail including Case fields
  @IsTest
  static void retrievesShipmentDetailWithCaseInfo() {
    Shipment__c shipment = [
      SELECT Id, Tracking_Code__c, Case__c
      FROM Shipment__c
      WHERE Tracking_Code__c = 'SEARCH_TRANSIT_001'
      LIMIT 1
    ];

    Test.startTest();
    Shipment__c detail = ShipmentController.getShipmentDetail(shipment.Id);
    Test.stopTest();

    System.assertNotEquals(null, detail);
    System.assertEquals('SEARCH_TRANSIT_001', detail.Tracking_Code__c);
    System.assertNotEquals(null, detail.Case__c);
    System.assertNotEquals(null, detail.Case__r.CaseNumber);
  }

  // Test 13: Reject missing ID for shipment detail
  @IsTest
  static void rejectsMissingShipmentDetailId() {
    Boolean exceptionThrown = false;
    try {
      ShipmentController.getShipmentDetail(null);
    } catch (AuraHandledException e) {
      exceptionThrown = true;
    }
    System.assertEquals(true, exceptionThrown);
  }

  // Test 14: Retrieve shipment events
  @IsTest
  static void retrievesShipmentEventsInOrder() {
    Shipment__c shipment = [
      SELECT Id
      FROM Shipment__c
      WHERE Tracking_Code__c = 'SEARCH_TRANSIT_001'
      LIMIT 1
    ];

    List<Shipment_Event__c> events = new List<Shipment_Event__c>{
      new Shipment_Event__c(
        Shipment__c = shipment.Id,
        Event_ID__c = 'TEST_EVT_001',
        Event_Date__c = Datetime.now().addDays(-1),
        Event_Status__c = 'pre_transit',
        Event_Description__c = 'Label created',
        Provider__c = 'Shippo'
      ),
      new Shipment_Event__c(
        Shipment__c = shipment.Id,
        Event_ID__c = 'TEST_EVT_002',
        Event_Date__c = Datetime.now(),
        Event_Status__c = 'in_transit',
        Event_Description__c = 'In transit',
        Provider__c = 'Shippo'
      )
    };
    insert events;

    Test.startTest();
    List<Shipment_Event__c> results = ShipmentController.getShipmentEvents(
      shipment.Id
    );
    Test.stopTest();

    System.assertEquals(2, results.size());
    System.assertEquals('TEST_EVT_002', results[0].Event_ID__c);
  }

  // Test 15: Reject missing ID for shipment events
  @IsTest
  static void rejectsMissingShipmentEventsId() {
    Boolean exceptionThrown = false;
    try {
      ShipmentController.getShipmentEvents(null);
    } catch (AuraHandledException e) {
      exceptionThrown = true;
    }
    System.assertEquals(true, exceptionThrown);
  }

  // Test 16: Refresh an individual shipment
  @IsTest
  static void refreshesShipmentRecord() {
    Shipment__c shipment = [
      SELECT Id, Tracking_Code__c
      FROM Shipment__c
      WHERE Tracking_Code__c = 'SEARCH_TRANSIT_001'
      LIMIT 1
    ];

    Test.setMock(HttpCalloutMock.class, new ControllerShipmentMock());

    Test.startTest();
    Shipment__c refreshed = ShipmentController.refreshShipment(shipment.Id);
    Test.stopTest();

    System.assertNotEquals(null, refreshed);
    System.assertEquals(shipment.Id, refreshed.Id);
    System.assertEquals('SEARCH_TRANSIT_001', refreshed.Tracking_Code__c);
  }

  // Test 17: Reject missing ID for refresh
  @IsTest
  static void rejectsMissingRefreshShipmentId() {
    Boolean exceptionThrown = false;
    try {
      ShipmentController.refreshShipment(null);
    } catch (AuraHandledException e) {
      exceptionThrown = true;
    }
    System.assertEquals(true, exceptionThrown);
  }

  // Test 18: Retrieve shipment-related cases
  @IsTest
  static void retrievesShipmentCases() {
    Test.startTest();
    List<Case> cases = ShipmentController.getShipmentCases();
    Test.stopTest();

    System.assertNotEquals(0, cases.size());
    System.assertEquals('Shipment Controller Test Case', cases[0].Subject);
    System.assertNotEquals(0, cases[0].Shipments__r.size());
  }

  // Test 19: Update case fields
  @IsTest
  static void updatesCaseSuccessfully() {
    Case targetCase = [
      SELECT Id, Status, Priority, Subject, Description
      FROM Case
      LIMIT 1
    ];

    Test.startTest();
    Case updated = ShipmentController.updateCase(
      targetCase.Id,
      'Working',
      'High',
      'Updated Case Subject',
      'Updated Case Description'
    );
    Test.stopTest();

    System.assertEquals('Working', updated.Status);
    System.assertEquals('High', updated.Priority);
    System.assertEquals('Updated Case Subject', updated.Subject);
    System.assertEquals('Updated Case Description', updated.Description);
  }

  // Test 20: Reject missing ID for updateCase
  @IsTest
  static void rejectsMissingCaseIdForUpdate() {
    Boolean exceptionThrown = false;
    try {
      ShipmentController.updateCase(null, 'Working', 'High', 'Sub', 'Desc');
    } catch (AuraHandledException e) {
      exceptionThrown = true;
    }
    System.assertEquals(true, exceptionThrown);
  }

  // Test 21: Update shipment resolution status and notes
  @IsTest
  static void updatesShipmentResolutionSuccessfully() {
    Shipment__c shipment = [
      SELECT Id, Resolution_Status__c, Resolution_Notes__c
      FROM Shipment__c
      WHERE Tracking_Code__c = 'SEARCH_TRANSIT_001'
      LIMIT 1
    ];

    Test.startTest();
    Shipment__c updated = ShipmentController.updateShipmentResolution(
      shipment.Id,
      'Investigating',
      'Investigating customs clearance delay.'
    );
    Test.stopTest();

    System.assertNotEquals(null, updated);
    System.assertEquals('Investigating', updated.Resolution_Status__c);
    System.assertEquals(
      'Investigating customs clearance delay.',
      updated.Resolution_Notes__c
    );
  }

  // Test 22: Reject missing ID for updateShipmentResolution
  @IsTest
  static void rejectsMissingShipmentIdForResolutionUpdate() {
    Boolean exceptionThrown = false;
    try {
      ShipmentController.updateShipmentResolution(
        null,
        'Investigating',
        'Notes'
      );
    } catch (AuraHandledException e) {
      exceptionThrown = true;
    }
    System.assertEquals(true, exceptionThrown);
  }

  // Test 23: Create Case for unlinked shipment
  @IsTest
  static void createsCaseForUnlinkedShipmentSuccessfully() {
    Shipment__c unlinkedShipment = [
      SELECT Id, Case__c
      FROM Shipment__c
      WHERE Tracking_Code__c = 'SEARCH_DELIVERED_002'
      LIMIT 1
    ];
    System.assertEquals(null, unlinkedShipment.Case__c);

    Test.startTest();
    Case createdCase = ShipmentController.createCaseForShipment(
      unlinkedShipment.Id,
      'Delivery Exception Escalation',
      'High',
      'Logistics Operations',
      'Investigating delayed delivery attempt.'
    );
    Test.stopTest();

    System.assertNotEquals(null, createdCase);
    System.assertEquals('Delivery Exception Escalation', createdCase.Subject);
    System.assertEquals('High', createdCase.Priority);
    System.assertEquals('Logistics Operations', createdCase.Origin);

    Shipment__c updatedShipment = [
      SELECT Id, Case__c
      FROM Shipment__c
      WHERE Id = :unlinkedShipment.Id
    ];
    System.assertEquals(createdCase.Id, updatedShipment.Case__c);
  }

  // Test 24: Prevent duplicate Case when shipment already linked
  @IsTest
  static void preventsDuplicateCaseForAlreadyLinkedShipment() {
    Shipment__c linkedShipment = [
      SELECT Id, Case__c
      FROM Shipment__c
      WHERE Tracking_Code__c = 'SEARCH_TRANSIT_001'
      LIMIT 1
    ];
    System.assertNotEquals(null, linkedShipment.Case__c);

    Boolean exceptionThrown = false;
    String errorMessage = '';
    Test.startTest();
    try {
      ShipmentController.createCaseForShipment(
        linkedShipment.Id,
        'Duplicate Case Attempt',
        'High',
        'Phone',
        'Should fail due to existing case'
      );
    } catch (AuraHandledException e) {
      exceptionThrown = true;
      errorMessage = e.getMessage();
    }
    Test.stopTest();

    System.assertEquals(true, exceptionThrown);
    System.assert(
      errorMessage.contains('already has an associated Case') ||
      errorMessage.contains('Script-thrown exception')
    );
  }

  // Test 25: Reject invalid parameters for createCaseForShipment
  @IsTest
  static void rejectsInvalidParamsForCreateCase() {
    Boolean nullShipmentThrown = false;
    try {
      ShipmentController.createCaseForShipment(
        null,
        'Subject',
        'High',
        'Phone',
        'Desc'
      );
    } catch (AuraHandledException e) {
      nullShipmentThrown = true;
    }
    System.assertEquals(true, nullShipmentThrown);

    Shipment__c shipment = [SELECT Id FROM Shipment__c LIMIT 1];
    Boolean blankSubjectThrown = false;
    try {
      ShipmentController.createCaseForShipment(
        shipment.Id,
        '  ',
        'High',
        'Phone',
        'Desc'
      );
    } catch (AuraHandledException e) {
      blankSubjectThrown = true;
    }
    System.assertEquals(true, blankSubjectThrown);
  }

  // Test 26: Link existing Case to shipment
  @IsTest
  static void linksExistingCaseToShipmentSuccessfully() {
    Shipment__c unlinkedShipment = [
      SELECT Id, Case__c
      FROM Shipment__c
      WHERE Tracking_Code__c = 'SEARCH_DELAYED_003'
      LIMIT 1
    ];
    Case existingCase = [SELECT Id FROM Case LIMIT 1];

    Test.startTest();
    Shipment__c updated = ShipmentController.linkCaseToShipment(
      unlinkedShipment.Id,
      existingCase.Id
    );
    Test.stopTest();

    System.assertNotEquals(null, updated);
    System.assertEquals(existingCase.Id, updated.Case__c);
  }

  // Test 27: Reject invalid parameters for linkCaseToShipment
  @IsTest
  static void rejectsInvalidParamsForLinkCase() {
    Case existingCase = [SELECT Id FROM Case LIMIT 1];
    Boolean nullShipmentThrown = false;
    try {
      ShipmentController.linkCaseToShipment(null, existingCase.Id);
    } catch (AuraHandledException e) {
      nullShipmentThrown = true;
    }
    System.assertEquals(true, nullShipmentThrown);

    Shipment__c shipment = [SELECT Id FROM Shipment__c LIMIT 1];
    Boolean nullCaseThrown = false;
    try {
      ShipmentController.linkCaseToShipment(shipment.Id, null);
    } catch (AuraHandledException e) {
      nullCaseThrown = true;
    }
    System.assertEquals(true, nullCaseThrown);
  }

  // Test 28: Assign Case owner
  @IsTest
  static void assignsCaseOwnerSuccessfully() {
    Case targetCase = [SELECT Id, OwnerId FROM Case LIMIT 1];
    Id currentUserId = UserInfo.getUserId();

    Test.startTest();
    Case updated = ShipmentController.assignCase(targetCase.Id, currentUserId);
    Test.stopTest();

    System.assertNotEquals(null, updated);
    System.assertEquals(currentUserId, updated.OwnerId);
  }

  // Test 29: Reject invalid parameters for assignCase
  @IsTest
  static void rejectsInvalidParamsForAssignCase() {
    Id currentUserId = UserInfo.getUserId();
    Boolean nullCaseThrown = false;
    try {
      ShipmentController.assignCase(null, currentUserId);
    } catch (AuraHandledException e) {
      nullCaseThrown = true;
    }
    System.assertEquals(true, nullCaseThrown);

    Case targetCase = [SELECT Id FROM Case LIMIT 1];
    Boolean nullOwnerThrown = false;
    try {
      ShipmentController.assignCase(targetCase.Id, null);
    } catch (AuraHandledException e) {
      nullOwnerThrown = true;
    }
    System.assertEquals(true, nullOwnerThrown);
  }

  // Test 30: Retrieve available cases list
  @IsTest
  static void retrievesAvailableCasesSuccessfully() {
    Test.startTest();
    List<Case> availableCases = ShipmentController.getAvailableCases();
    Test.stopTest();

    System.assertNotEquals(0, availableCases.size());
  }

  // Test 31: Generate customer update for delivered shipment with Contact details
  @IsTest
  static void generatesCustomerUpdateDeliveredWithContactEmail() {
    Contact testContact = new Contact(
      FirstName = 'Alice',
      LastName = 'Smith',
      Email = 'alice.smith@example.com'
    );
    insert testContact;

    Case c = new Case(
      Subject = 'Delivered Package Ingestion',
      Status = 'Closed',
      ContactId = testContact.Id
    );
    insert c;

    Shipment__c deliveredShipment = new Shipment__c(
      Tracking_Code__c = 'COMM_DELIV_001',
      Carrier__c = 'fedex',
      Provider__c = 'Shippo',
      Status__c = 'delivered',
      Risk_Level__c = 'On Track',
      Actual_Delivery_Date__c = Datetime.now(),
      Case__c = c.Id
    );
    insert deliveredShipment;

    Test.startTest();
    ShipmentController.CustomerUpdateDraft draft = ShipmentController.generateCustomerUpdate(
      c.Id
    );
    Test.stopTest();

    System.assertNotEquals(null, draft);
    System.assertEquals('alice.smith@example.com', draft.recipientEmail);
    System.assertEquals(true, draft.hasRecipientEmail);
    System.assert(draft.recipientName.contains('Alice'));
    System.assert(draft.subject.contains('COMM_DELIV_001'));
    System.assert(draft.body.contains('successfully delivered'));
    System.assert(draft.body.contains('FedEx'));
    System.assert(draft.body.contains('Customer Support Operations'));
  }

  // Test 32: Generate customer update for delayed shipment with risk reason
  @IsTest
  static void generatesCustomerUpdateDelayedWithRiskReason() {
    Case c = new Case(
      Subject = 'Severe Transit Delay Case',
      SuppliedEmail = 'ops.client@example.org',
      Status = 'Working'
    );
    insert c;

    Shipment__c delayedShipment = new Shipment__c(
      Tracking_Code__c = 'COMM_DELAY_002',
      Carrier__c = 'delhivery',
      Provider__c = 'Shippo',
      Status__c = 'in_transit',
      Risk_Level__c = 'Delayed',
      Risk_Reason__c = 'Severe weather near regional sorting hub',
      Estimated_Delivery_Date__c = Datetime.now().addDays(4),
      Case__c = c.Id
    );
    insert delayedShipment;

    Test.startTest();
    ShipmentController.CustomerUpdateDraft draft = ShipmentController.generateCustomerUpdate(
      c.Id
    );
    Test.stopTest();

    System.assertNotEquals(null, draft);
    System.assertEquals('ops.client@example.org', draft.recipientEmail);
    System.assertEquals(true, draft.hasRecipientEmail);
    System.assert(draft.body.contains('COMM_DELAY_002'));
    System.assert(draft.body.contains('transit delay'));
    System.assert(
      draft.body.contains('Severe weather near regional sorting hub')
    );
    System.assert(draft.body.contains('Delhivery'));
    // Verify no compensation promises made
    System.assert(!draft.body.toLowerCase().contains('refund'));
    System.assert(!draft.body.toLowerCase().contains('compensation'));
  }

  // Test 33: Generate customer update for in-transit shipment with missing ETA
  @IsTest
  static void generatesCustomerUpdateInTransitMissingEta() {
    Case c = new Case(Subject = 'In Transit ETA Verification', Status = 'New');
    insert c;

    Shipment__c inTransitShipment = new Shipment__c(
      Tracking_Code__c = 'COMM_TRANS_003',
      Carrier__c = 'bluedart',
      Provider__c = 'Shippo',
      Status__c = 'in_transit',
      Risk_Level__c = 'On Track',
      Estimated_Delivery_Date__c = null,
      Case__c = c.Id
    );
    insert inTransitShipment;

    Test.startTest();
    ShipmentController.CustomerUpdateDraft draft = ShipmentController.generateCustomerUpdate(
      c.Id
    );
    Test.stopTest();

    System.assertNotEquals(null, draft);
    System.assertEquals(false, draft.hasRecipientEmail);
    System.assertEquals(null, draft.recipientEmail);
    System.assertEquals('Valued Customer', draft.recipientName);
    System.assert(draft.body.contains('Blue Dart'));
    System.assert(
      draft.body.contains(
        'Carrier tracking does not currently list an estimated delivery date'
      )
    );
  }

  // Test 34: Generate customer update with missing risk reason and At Risk classification
  @IsTest
  static void generatesCustomerUpdateMissingRiskReason() {
    Case c = new Case(
      Subject = 'At Risk Consignment Check',
      Status = 'Working'
    );
    insert c;

    Shipment__c atRiskShipment = new Shipment__c(
      Tracking_Code__c = 'COMM_RISK_004',
      Carrier__c = 'usps',
      Provider__c = 'Shippo',
      Status__c = 'in_transit',
      Risk_Level__c = 'At Risk',
      Risk_Reason__c = null,
      Estimated_Delivery_Date__c = Datetime.now().addDays(1),
      Case__c = c.Id
    );
    insert atRiskShipment;

    Test.startTest();
    ShipmentController.CustomerUpdateDraft draft = ShipmentController.generateCustomerUpdate(
      c.Id
    );
    Test.stopTest();

    System.assertNotEquals(null, draft);
    System.assert(draft.body.contains('USPS'));
    System.assert(draft.body.contains('tracking your shipment'));
  }

  // Test 35: Generate customer update covering failure, return_to_sender, out_for_delivery, and pre_transit
  @IsTest
  static void generatesCustomerUpdateOtherStatuses() {
    Case cFailure = new Case(
      Subject = 'Failed Delivery Attempt',
      Status = 'New'
    );
    Case cReturn = new Case(Subject = 'RTS Case', Status = 'Working');
    Case cOut = new Case(Subject = 'Out for Delivery Case', Status = 'New');
    Case cPre = new Case(Subject = 'Pre-transit Booking', Status = 'New');
    insert new List<Case>{ cFailure, cReturn, cOut, cPre };

    List<Shipment__c> shipments = new List<Shipment__c>{
      new Shipment__c(
        Tracking_Code__c = 'COMM_FAIL_005',
        Carrier__c = 'dtdc',
        Status__c = 'failure',
        Risk_Level__c = 'Delayed',
        Risk_Reason__c = 'Customer door locked',
        Case__c = cFailure.Id
      ),
      new Shipment__c(
        Tracking_Code__c = 'COMM_RET_006',
        Carrier__c = 'ekart',
        Status__c = 'return_to_sender',
        Risk_Level__c = 'Delayed',
        Risk_Reason__c = 'Incorrect pin code',
        Case__c = cReturn.Id
      ),
      new Shipment__c(
        Tracking_Code__c = 'COMM_OUT_007',
        Carrier__c = 'ups',
        Status__c = 'out_for_delivery',
        Risk_Level__c = 'On Track',
        Case__c = cOut.Id
      ),
      new Shipment__c(
        Tracking_Code__c = 'COMM_PRE_008',
        Carrier__c = 'shadowfax',
        Status__c = 'pre_transit',
        Risk_Level__c = 'On Track',
        Case__c = cPre.Id
      )
    };
    insert shipments;

    Test.startTest();
    ShipmentController.CustomerUpdateDraft failDraft = ShipmentController.generateCustomerUpdate(
      cFailure.Id
    );
    ShipmentController.CustomerUpdateDraft retDraft = ShipmentController.generateCustomerUpdate(
      cReturn.Id
    );
    ShipmentController.CustomerUpdateDraft outDraft = ShipmentController.generateCustomerUpdate(
      cOut.Id
    );
    ShipmentController.CustomerUpdateDraft preDraft = ShipmentController.generateCustomerUpdate(
      cPre.Id
    );
    Test.stopTest();

    System.assert(failDraft.body.contains('delivery attempt exception'));
    System.assert(failDraft.body.contains('Customer door locked'));

    System.assert(retDraft.body.contains('returned to sender'));
    System.assert(retDraft.body.contains('Incorrect pin code'));

    System.assert(outDraft.body.contains('out for delivery today'));

    System.assert(preDraft.body.contains('has been booked with'));
  }

  // Test 36: Delivered shipment with null Actual Delivery Date omits date entirely
  @IsTest
  static void generatesCustomerUpdateDeliveredWithNullActualDeliveryDateOmitsDate() {
    Case c = new Case(Subject = 'Delivered No Date Test', Status = 'Closed');
    insert c;

    Shipment__c deliveredNoDate = new Shipment__c(
      Tracking_Code__c = 'COMM_DELIV_NODATE',
      Carrier__c = 'fedex',
      Status__c = 'delivered',
      Risk_Level__c = 'On Track',
      Actual_Delivery_Date__c = null,
      Estimated_Delivery_Date__c = Datetime.now().addDays(-2),
      Case__c = c.Id
    );
    insert deliveredNoDate;

    Test.startTest();
    ShipmentController.CustomerUpdateDraft draft = ShipmentController.generateCustomerUpdate(
      c.Id
    );
    Test.stopTest();

    System.assertNotEquals(null, draft);
    System.assert(draft.body.contains('successfully delivered.'));
    String estimatedDateFormatted = deliveredNoDate.Estimated_Delivery_Date__c.format(
      'MMMM d, yyyy'
    );
    System.assert(!draft.body.contains(estimatedDateFormatted));
  }

  // Test 37: Reject generating customer update for Case without linked shipment
  @IsTest
  static void rejectsGenerateCustomerUpdateForUnlinkedCase() {
    Case emptyCase = new Case(
      Subject = 'Unlinked Standalone Case',
      Status = 'New'
    );
    insert emptyCase;

    Boolean exceptionThrown = false;
    Test.startTest();
    try {
      ShipmentController.generateCustomerUpdate(emptyCase.Id);
    } catch (AuraHandledException e) {
      exceptionThrown = true;
    }
    Test.stopTest();

    System.assertEquals(true, exceptionThrown);
  }

  // Test 38: Reject invalid parameters (null or non-existent Case ID)
  @IsTest
  static void rejectsGenerateCustomerUpdateForInvalidCaseIds() {
    Boolean nullCaseThrown = false;
    try {
      ShipmentController.generateCustomerUpdate(null);
    } catch (AuraHandledException e) {
      nullCaseThrown = true;
    }
    System.assertEquals(true, nullCaseThrown);

    Boolean notFoundThrown = false;
    Id fakeCaseId = '500000000000001AAA';
    try {
      ShipmentController.generateCustomerUpdate(fakeCaseId);
    } catch (AuraHandledException e) {
      notFoundThrown = true;
    }
    System.assertEquals(true, notFoundThrown);
  }
}
