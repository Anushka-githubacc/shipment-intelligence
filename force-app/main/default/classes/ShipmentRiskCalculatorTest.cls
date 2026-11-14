
@IsTest
private class ShipmentRiskCalculatorTest {

    // Fixed reference time makes boundary tests predictable
    private static Datetime getReferenceTime() {
        return Datetime.newInstanceGMT(2026, 11, 15, 12, 0, 0);
    }

    private static void assertRisk(
        String status,
        Datetime eta,
        Datetime currentTime,
        String expectedLevel
    ) {
        ShipmentRiskCalculator.Risk result =
            ShipmentRiskCalculator.assess(status, eta, currentTime);

        System.assertEquals(
            expectedLevel,
            result.level,
            'Incorrect risk level for status: ' + status
        );

        System.assertNotEquals(
            null,
            result.reason,
            'Risk reason should not be null'
        );
    }

    // Test 1: Delivered shipment is always On Track
    @IsTest
    static void deliveredShipmentIsOnTrack() {
        Datetime now = getReferenceTime();

        assertRisk(
            'delivered',
            now.addDays(-5),
            now,
            'On Track'
        );
    }

    // Test 2: Failed shipment is Delayed
    @IsTest
    static void failedShipmentIsDelayed() {
        Datetime now = getReferenceTime();

        assertRisk(
            'failure',
            now.addDays(3),
            now,
            'Delayed'
        );
    }

    // Test 3: Returned shipment is Delayed
    @IsTest
    static void returnedShipmentIsDelayed() {
        Datetime now = getReferenceTime();

        assertRisk(
            'return_to_sender',
            now.addDays(3),
            now,
            'Delayed'
        );
    }

    // Test 4: Unknown status is At Risk
    @IsTest
    static void unknownStatusIsAtRisk() {
        Datetime now = getReferenceTime();

        assertRisk(
            'unknown',
            now.addDays(5),
            now,
            'At Risk'
        );
    }

    // Test 5: Missing status is At Risk
    @IsTest
    static void missingStatusIsAtRisk() {
        Datetime now = getReferenceTime();

        assertRisk(
            null,
            now.addDays(5),
            now,
            'At Risk'
        );
    }

    // Test 6: Missing ETA is At Risk
    @IsTest
    static void missingEtaIsAtRisk() {
        Datetime now = getReferenceTime();

        assertRisk(
            'in_transit',
            null,
            now,
            'At Risk'
        );
    }

    // Test 7: ETA passed by 23 hours is At Risk
    @IsTest
    static void etaPassedBy23HoursIsAtRisk() {
        Datetime now = getReferenceTime();

        assertRisk(
            'in_transit',
            now.addHours(-23),
            now,
            'At Risk'
        );
    }

    // Test 8: ETA passed by exactly 24 hours is Delayed
    @IsTest
    static void etaPassedByExactly24HoursIsDelayed() {
        Datetime now = getReferenceTime();

        assertRisk(
            'in_transit',
            now.addHours(-24),
            now,
            'Delayed'
        );
    }

    // Test 9: ETA exactly 24 hours away is At Risk
    @IsTest
    static void etaExactly24HoursAwayIsAtRisk() {
        Datetime now = getReferenceTime();

        assertRisk(
            'in_transit',
            now.addHours(24),
            now,
            'At Risk'
        );
    }

    // Test 10: ETA more than 24 hours away is On Track
    @IsTest
    static void etaMoreThan24HoursAwayIsOnTrack() {
        Datetime now = getReferenceTime();

        assertRisk(
            'in_transit',
            now.addHours(25),
            now,
            'On Track'
        );
    }

    // Test 11: Null current time safely uses the system time
    @IsTest
    static void nullCurrentTimeIsHandled() {
        ShipmentRiskCalculator.Risk result =
            ShipmentRiskCalculator.assess(
                'delivered',
                null,
                null
            );

        System.assertEquals('On Track', result.level);
        System.assertEquals('Delivered', result.reason);
    }

    // Test 12: Status comparison is case-insensitive
    @IsTest
    static void statusComparisonIgnoresCaseAndWhitespace() {
        Datetime now = getReferenceTime();

        assertRisk(
            '  DELIVERED  ',
            now.addDays(-2),
            now,
            'On Track'
        );
    }

    // Test 13: Unrecognized status is At Risk
    @IsTest
    static void unrecognizedStatusIsAtRisk() {
        Datetime now = getReferenceTime();

        assertRisk(
            'shipment_processing_unknown',
            now.addDays(5),
            now,
            'At Risk'
        );
    }

    // Test 14: Pre-transit shipment follows ETA rules
    @IsTest
    static void preTransitShipmentUsesEtaForRisk() {
        Datetime now = getReferenceTime();

        assertRisk(
            'pre_transit',
            now.addDays(3),
            now,
            'On Track'
        );
    }

    // Test 15: Out-for-delivery shipment with passed ETA
    // is At Risk if less than 24 hours late
    @IsTest
    static void outForDeliveryShipmentRecentlyPastEtaIsAtRisk() {
        Datetime now = getReferenceTime();

        assertRisk(
            'out_for_delivery',
            now.addHours(-2),
            now,
            'At Risk'
        );
    }
}
