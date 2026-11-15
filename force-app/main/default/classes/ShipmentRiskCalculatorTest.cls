
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

    @IsTest
    static void deliveredShipmentIsOnTrack() {
        Datetime now = getReferenceTime();
        assertRisk('delivered', now.addDays(-5), now, 'On Track');
    }

    @IsTest
    static void failedShipmentIsDelayed() {
        Datetime now = getReferenceTime();
        assertRisk('failure', now.addDays(3), now, 'Delayed');
    }

    @IsTest
    static void returnedShipmentIsDelayed() {
        Datetime now = getReferenceTime();
        assertRisk('return_to_sender', now.addDays(3), now, 'Delayed');
    }

    @IsTest
    static void unknownStatusIsAtRisk() {
        Datetime now = getReferenceTime();
        assertRisk('unknown', now.addDays(5), now, 'At Risk');
    }

    @IsTest
    static void missingStatusIsAtRisk() {
        Datetime now = getReferenceTime();
        assertRisk(null, now.addDays(5), now, 'At Risk');
    }

    @IsTest
    static void missingEtaIsAtRisk() {
        Datetime now = getReferenceTime();
        assertRisk('in_transit', null, now, 'At Risk');
    }

    // Any past ETA is Delayed, even by one second
    @IsTest
    static void etaPassedByOneSecondIsDelayed() {
        Datetime now = getReferenceTime();
        assertRisk('in_transit', now.addSeconds(-1), now, 'Delayed');
    }

    @IsTest
    static void etaPassedBy23HoursIsDelayed() {
        Datetime now = getReferenceTime();
        assertRisk('in_transit', now.addHours(-23), now, 'Delayed');
    }

    @IsTest
    static void etaPassedByExactly24HoursIsDelayed() {
        Datetime now = getReferenceTime();
        assertRisk('in_transit', now.addHours(-24), now, 'Delayed');
    }

    @IsTest
    static void etaExactlyNowIsDelayed() {
        Datetime now = getReferenceTime();
        assertRisk('in_transit', now, now, 'Delayed');
    }

    @IsTest
    static void etaExactly24HoursAwayIsAtRisk() {
        Datetime now = getReferenceTime();
        assertRisk('in_transit', now.addHours(24), now, 'At Risk');
    }

    @IsTest
    static void etaMoreThan24HoursAwayIsOnTrack() {
        Datetime now = getReferenceTime();
        assertRisk('in_transit', now.addHours(25), now, 'On Track');
    }

    @IsTest
    static void nullCurrentTimeIsHandled() {
        ShipmentRiskCalculator.Risk result =
            ShipmentRiskCalculator.assess('delivered', null, null);

        System.assertEquals('On Track', result.level);
        System.assertEquals('Delivered', result.reason);
    }

    @IsTest
    static void statusComparisonIgnoresCaseAndWhitespace() {
        Datetime now = getReferenceTime();
        assertRisk('  DELIVERED  ', now.addDays(-2), now, 'On Track');
    }

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

    @IsTest
    static void preTransitShipmentUsesEtaForRisk() {
        Datetime now = getReferenceTime();
        assertRisk('pre_transit', now.addDays(3), now, 'On Track');
    }

    // Out for Delivery with upcoming ETA within 24 hours is On Track
    @IsTest
    static void outForDeliveryWithin24HoursIsOnTrack() {
        Datetime now = getReferenceTime();
        assertRisk(
            'out_for_delivery',
            now.addHours(2),
            now,
            'On Track'
        );
    }

    // Out for Delivery does not override an overdue ETA
    @IsTest
    static void outForDeliveryWithPastEtaIsDelayed() {
        Datetime now = getReferenceTime();
        assertRisk(
            'out_for_delivery',
            now.addHours(-2),
            now,
            'Delayed'
        );
    }
}
