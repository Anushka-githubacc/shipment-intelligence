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
  public Datetime actualDeliveryDate { get; set; }
  @AuraEnabled
  public Datetime lastEventDate { get; set; }
  @AuraEnabled
  public String lastEventDetails { get; set; }
  @AuraEnabled
  public Boolean isTest { get; set; }
  @AuraEnabled
  public List<TrackingEvent> events { get; set; }

  public ShipmentInfo() {
    this.events = new List<TrackingEvent>();
  }

  public class TrackingEvent {
    @AuraEnabled
    public String eventId { get; set; }
    @AuraEnabled
    public Datetime eventDate { get; set; }
    @AuraEnabled
    public String status { get; set; }
    @AuraEnabled
    public String rawStatus { get; set; }
    @AuraEnabled
    public String description { get; set; }
    @AuraEnabled
    public String location { get; set; }
    @AuraEnabled
    public String rawData { get; set; }
  }
}
