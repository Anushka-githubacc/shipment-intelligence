public with sharing class TrackingProviderFactory {
    public static ITrackingProvider resolve(String providerName) {
        if (String.isBlank(providerName)) {
            throw new IllegalArgumentException('Integration provider name is required.');
        }

        String normalizedName = providerName.trim();
        if (normalizedName.equalsIgnoreCase('Shippo')) {
            return new ShippoTrackingAdapter();
        }

        throw new IllegalArgumentException(
            'Unsupported tracking provider: ' +
                normalizedName +
                '. Supported provider: Shippo.'
        );
    }
}
