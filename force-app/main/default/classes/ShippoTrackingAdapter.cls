public with sharing class ShippoTrackingAdapter implements ITrackingProvider {
    public ShipmentInfo track(String carrier, String trackingNumber) {
        ShipmentInfo info = ShippoService.track(carrier, trackingNumber);
        info.provider = getProviderName();
        return info;
    }

    public String getProviderName() {
        return 'Shippo';
    }
}
