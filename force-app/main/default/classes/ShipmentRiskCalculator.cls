
public with sharing class ShipmentRiskCalculator {

    // Risk information returned to the calling Apex or LWC component
    public class Risk {
        @AuraEnabled public String level { get; set; }
        @AuraEnabled public String reason { get; set; }
    }

    public static Risk assess(String status, Datetime est, Datetime now) {

        Risk r = new Risk();

        // Use the actual current time if no reference time is supplied
        if (now == null) {
            now = System.now();
        }

        // Normalize status to avoid case and whitespace issues
        String normalizedStatus = String.isBlank(status)
            ? null
            : status.trim().toLowerCase();

        // Rule 1: Shipment successfully delivered
        if (normalizedStatus == 'delivered') {
            r.level = 'On Track';
            r.reason = 'Delivered';
            return r;
        }

        // Rule 2: Shipment failed or returned
        if (normalizedStatus == 'failure' ||
            normalizedStatus == 'return_to_sender') {

            r.level = 'Delayed';
            r.reason = 'Delivery failed or was returned';
            return r;
        }

        // Rule 3: Missing or unknown shipment status
        if (String.isBlank(normalizedStatus) ||
            normalizedStatus == 'unknown') {

            r.level = 'At Risk';
            r.reason = 'Carrier status unknown, check manually';
            return r;
        }

        // Recognized active shipment statuses
        if (normalizedStatus != 'pre_transit' &&
            normalizedStatus != 'in_transit' &&
            normalizedStatus != 'out_for_delivery') {

            r.level = 'At Risk';
            r.reason = 'Unrecognized shipment status, check manually';
            return r;
        }

        // Rule 4: Missing estimated delivery date
        if (est == null) {
            r.level = 'At Risk';
            r.reason = 'Estimated delivery date is unavailable';
            return r;
        }

        // Calculate exact 24-hour boundaries
        Datetime twentyFourHoursAgo = now.addHours(-24);
        Datetime twentyFourHoursAhead = now.addHours(24);

        // Rule 5: ETA passed by 24 hours or more
        if (est <= twentyFourHoursAgo) {
            r.level = 'Delayed';

            Long elapsedHours = (now.getTime() - est.getTime())
                / (1000 * 60 * 60);

            r.reason = elapsedHours +
                ' hour(s) past estimated delivery';

        }
        // Rule 6: ETA passed, but less than 24 hours ago
        else if (est < now) {
            r.level = 'At Risk';
            r.reason = 'Estimated delivery time has recently passed';

        }
        // Rule 7: ETA is within the next 24 hours
        else if (est <= twentyFourHoursAhead) {
            r.level = 'At Risk';
            r.reason = 'Estimated delivery is within the next 24 hours';

        }
        // Rule 8: ETA is more than 24 hours away
        else {
            r.level = 'On Track';
            r.reason = 'Within the estimated delivery time';
        }

        return r;
    }
}
