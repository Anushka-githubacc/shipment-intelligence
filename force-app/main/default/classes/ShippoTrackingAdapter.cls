public with sharing class ShippoTrackingAdapter implements ITrackingProvider {
    public ShipmentInfo track(String carrier, String trackingNumber) {
        ShippoService.ShipmentInfo source = ShippoService.track(carrier, trackingNumber);

        ShipmentInfo info = new ShipmentInfo();
        info.trackingCode = source.trackingCode;
        info.carrier = source.carrier;
        info.provider = getProviderName();
        info.status = source.status;
        // ShippoService.ShipmentInfo does not include the carrier raw status.
        info.rawStatus = null;
        info.estDeliveryDate = source.estDeliveryDate;
        info.lastEventDate = source.lastEventDate;
        info.lastEventDetails = source.lastEventDetails;
        info.isTest = source.isTest;
        return info;
    }

    public String getProviderName() {
        return 'Shippo';
    }
}
