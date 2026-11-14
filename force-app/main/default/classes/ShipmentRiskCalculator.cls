public with sharing class ShipmentRiskCalculator {

    public class Risk {
        public String level;
        public String reason;
    }

    public static Risk assess(String status, Datetime est, Datetime now) {
        Risk r = new Risk();

        if (status == 'delivered') {
            r.level = 'On Track';
            r.reason = 'Delivered';
        } else if (status == 'failure' || status == 'return_to_sender') {
            r.level = 'Delayed';
            r.reason = 'Delivery failed or was returned';
        } else if (status == 'unknown') {
            r.level = 'At Risk';
            r.reason = 'Carrier status unknown, check manually';
        } else if (est != null && est < now) {
            Integer days = est.date().daysBetween(now.date());
            if (days >= 1) {
                r.level = 'Delayed';
                r.reason = days + ' day(s) past estimated delivery';
            } else {
                r.level = 'At Risk';
                r.reason = 'Estimated delivery time has just passed';
            }
        } else if (est != null && est < now.addDays(1)) {
            r.level = 'At Risk';
            r.reason = 'Estimated delivery is within 1 day and it is not delivered yet';
        } else {
            r.level = 'On Track';
            r.reason = 'Within the estimated delivery time';
        }

        return r;
    }
}