public interface ITrackingProvider {
    ShipmentInfo track(String carrier, String trackingNumber);
    String getProviderName();
}
