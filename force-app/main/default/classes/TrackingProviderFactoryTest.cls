
@IsTest
private class TrackingProviderFactoryTest {

    @IsTest
    static void resolvesShippoProvider() {
        ITrackingProvider provider =
            TrackingProviderFactory.resolve('Shippo');

        System.assertNotEquals(null, provider);
        System.assertEquals('Shippo', provider.getProviderName());
    }

    @IsTest
    static void resolvesProviderCaseInsensitively() {
        ITrackingProvider provider =
            TrackingProviderFactory.resolve('sHiPpO');

        System.assertNotEquals(null, provider);
        System.assertEquals('Shippo', provider.getProviderName());
    }

    @IsTest
    static void rejectsBlankProvider() {
        Boolean exceptionThrown = false;

        try {
            TrackingProviderFactory.resolve(' ');
        } catch (IllegalArgumentException e) {
            exceptionThrown = true;
            System.assert(
                e.getMessage().contains('provider name is required')
            );
        }

        System.assert(
            exceptionThrown,
            'Expected blank provider to be rejected.'
        );
    }

    @IsTest
    static void rejectsUnsupportedProvider() {
        Boolean exceptionThrown = false;

        try {
            TrackingProviderFactory.resolve('Delhivery');
        } catch (IllegalArgumentException e) {
            exceptionThrown = true;
            System.assert(
                e.getMessage().contains('Unsupported tracking provider')
            );
        }

        System.assert(
            exceptionThrown,
            'Expected unsupported provider to be rejected.'
        );
    }
}
