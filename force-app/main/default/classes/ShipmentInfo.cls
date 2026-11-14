public class ShipmentInfo {
    @AuraEnabled
    public String trackingCode { get; set; }
    @AuraEnabled
    public String carrier { get; set; }
    @AuraEnabled
    public String provider { get; set; }
    @AuraEnabled
    public String status { get; set; }
    @AuraEnabled
    public String rawStatus { get; set; }
    @AuraEnabled
    public Datetime estDeliveryDate { get; set; }
    @AuraEnabled
    public Datetime lastEventDate { get; set; }
    @AuraEnabled
    public String lastEventDetails { get; set; }
    @AuraEnabled
    public Boolean isTest { get; set; }
}
