@IsTest
private class ShipmentDemoDataTest {
  @IsTest
  static void createsAndValidatesSyntheticDataset() {
    Test.startTest();
    // Create test cases
    Case c1 = new Case(
      Subject = 'Shipment delayed in transit - Demo',
      Status = 'Working',
      Priority = 'High',
      Origin = 'Phone'
    );
    Case c2 = new Case(
      Subject = 'Critical delay in transit - Medical supplies to Pune - Demo',
      Status = 'Working',
      Priority = 'High',
      Origin = 'Phone'
    );
    insert new List<Case>{ c1, c2 };

    // Create sample seeded shipments
    Shipment__c s1 = new Shipment__c(
      Tracking_Code__c = 'DEMO_BLUEDART_001',
      Carrier__c = 'Blue Dart',
      Provider__c = 'Shippo',
      Status__c = 'in_transit',
      Estimated_Delivery_Date__c = Datetime.now().addDays(3),
      Keep_Seeded_Date__c = true,
      Risk_Level__c = 'On Track',
      Resolution_Status__c = 'New'
    );
    Shipment__c s2 = new Shipment__c(
      Tracking_Code__c = 'DEMO_BLUEDART_003',
      Carrier__c = 'Blue Dart',
      Provider__c = 'Shippo',
      Status__c = 'in_transit',
      Estimated_Delivery_Date__c = Datetime.now().addDays(-1),
      Keep_Seeded_Date__c = true,
      Risk_Level__c = 'Delayed',
      Resolution_Status__c = 'Escalated',
      Resolution_Notes__c = 'Operator investigation note',
      Case__c = c2.Id
    );
    insert new List<Shipment__c>{ s1, s2 };
    Test.stopTest();

    // Verify no fabricated events exist
    Integer eventCount = [SELECT COUNT() FROM Shipment_Event__c];
    System.assertEquals(
      0,
      eventCount,
      'Zero Shipment_Event__c records must be fabricated'
    );

    // Verify shipment fields
    Shipment__c reloaded = [
      SELECT
        Id,
        Tracking_Code__c,
        Carrier__c,
        Keep_Seeded_Date__c,
        Case__c,
        Resolution_Status__c,
        Resolution_Notes__c
      FROM Shipment__c
      WHERE Tracking_Code__c = 'DEMO_BLUEDART_003'
    ];
    System.assertEquals(true, reloaded.Keep_Seeded_Date__c);
    System.assertEquals('Escalated', reloaded.Resolution_Status__c);
    System.assertEquals(
      'Operator investigation note',
      reloaded.Resolution_Notes__c
    );
    System.assertEquals(c2.Id, reloaded.Case__c);
  }

  @IsTest
  static void verifiesStatusAndRiskDistributions() {
    Datetime nowTime = Datetime.now();
    List<String> statuses = new List<String>{
      'pre_transit',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'return_to_sender',
      'failure',
      'unknown'
    };

    Set<String> assessedRisks = new Set<String>();
    for (String st : statuses) {
      ShipmentRiskCalculator.Risk r = ShipmentRiskCalculator.assess(
        st,
        nowTime.addDays(2),
        nowTime
      );
      assessedRisks.add(r.level);
    }

    // Test past ETA triggers Delayed
    ShipmentRiskCalculator.Risk delayedRisk = ShipmentRiskCalculator.assess(
      'in_transit',
      nowTime.addDays(-1),
      nowTime
    );
    assessedRisks.add(delayedRisk.level);

    System.assert(assessedRisks.contains('On Track'), 'Must assess On Track');
    System.assert(assessedRisks.contains('At Risk'), 'Must assess At Risk');
    System.assert(assessedRisks.contains('Delayed'), 'Must assess Delayed');
  }
}
