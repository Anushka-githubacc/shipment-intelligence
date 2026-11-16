public with sharing class ShippoService {
  private static final String PROVIDER_NAME = 'Shippo';

  private static final Map<String, String> STATUS_MAP = new Map<String, String>{
    'PRE_TRANSIT' => 'pre_transit',
    'TRANSIT' => 'in_transit',
    'OUT_FOR_DELIVERY' => 'out_for_delivery',
    'DELIVERED' => 'delivered',
    'RETURNED' => 'return_to_sender',
    'FAILURE' => 'failure',
    'UNKNOWN' => 'unknown'
  };

  public static ShipmentInfo track(String carrier, String trackingNumber) {
    if (String.isBlank(carrier)) {
      throw new IllegalArgumentException('Carrier is required.');
    }

    if (String.isBlank(trackingNumber)) {
      throw new IllegalArgumentException('Tracking number is required.');
    }

    HttpRequest req = new HttpRequest();

    req.setEndpoint(
      'callout:Shippo_Named_Credential/tracks/' +
        EncodingUtil.urlEncode(carrier.trim(), 'UTF-8') +
        '/' +
        EncodingUtil.urlEncode(trackingNumber.trim(), 'UTF-8')
    );

    req.setMethod('GET');
    req.setHeader('Accept', 'application/json');

    HttpResponse res;

    try {
      res = new Http().send(req);
    } catch (CalloutException e) {
      throw new CalloutException(
        'Unable to connect to the Shippo tracking service.'
      );
    }

    if (res == null) {
      throw new CalloutException('Shippo returned an empty HTTP response.');
    }

    Integer statusCode = res.getStatusCode();

    if (statusCode < 200 || statusCode > 299) {
      throw new CalloutException(
        'Shippo tracking request failed with HTTP status ' + statusCode + '.'
      );
    }

    if (String.isBlank(res.getBody())) {
      throw new CalloutException('Shippo returned an empty response body.');
    }

    Map<String, Object> body;

    try {
      Object decoded = JSON.deserializeUntyped(res.getBody());

      if (!(decoded instanceof Map<String, Object>)) {
        throw new CalloutException(
          'Shippo returned an invalid response structure.'
        );
      }

      body = (Map<String, Object>) decoded;
    } catch (CalloutException e) {
      throw e;
    } catch (Exception e) {
      throw new CalloutException('Shippo returned invalid JSON data.');
    }

    Map<String, Object> trackingStatus = getObject(body, 'tracking_status');

    ShipmentInfo info = new ShipmentInfo();

    String responseTrackingCode = getString(body, 'tracking_number');

    String responseCarrier = getString(body, 'carrier');

    info.trackingCode = String.isBlank(responseTrackingCode)
      ? trackingNumber.trim()
      : responseTrackingCode;

    info.carrier = String.isBlank(responseCarrier)
      ? carrier.trim()
      : responseCarrier;

    info.provider = PROVIDER_NAME;

    info.estDeliveryDate = parseDate(getString(body, 'eta'), 'eta');

    info.isTest = getBoolean(body, 'test');

    String rawStatus = trackingStatus == null
      ? null
      : getString(trackingStatus, 'status');

    info.rawStatus = rawStatus;

    String normalizedStatus = String.isBlank(rawStatus)
      ? null
      : rawStatus.trim().toUpperCase();

    info.status = normalizedStatus != null &&
      STATUS_MAP.containsKey(normalizedStatus)
      ? STATUS_MAP.get(normalizedStatus)
      : 'unknown';

    if (trackingStatus != null) {
      info.lastEventDate = parseDate(
        getString(trackingStatus, 'status_date'),
        'status_date'
      );

      info.lastEventDetails = getString(trackingStatus, 'status_details');
    }

    List<Object> rawHistory = null;
    Object historyObj = body.get('tracking_history');
    if (historyObj instanceof List<Object>) {
      rawHistory = (List<Object>) historyObj;
    }

    List<ShipmentInfo.TrackingEvent> events = new List<ShipmentInfo.TrackingEvent>();
    Set<String> seenEventIds = new Set<String>();

    if (rawHistory != null) {
      for (Object item : rawHistory) {
        if (item instanceof Map<String, Object>) {
          ShipmentInfo.TrackingEvent evt = parseTrackingEvent(
            (Map<String, Object>) item,
            info.trackingCode
          );
          if (
            evt != null &&
            !String.isBlank(evt.eventId) &&
            !seenEventIds.contains(evt.eventId)
          ) {
            seenEventIds.add(evt.eventId);
            events.add(evt);
          }
        }
      }
    }

    if (trackingStatus != null) {
      ShipmentInfo.TrackingEvent currentEvt = parseTrackingEvent(
        trackingStatus,
        info.trackingCode
      );
      if (
        currentEvt != null &&
        !String.isBlank(currentEvt.eventId) &&
        !seenEventIds.contains(currentEvt.eventId)
      ) {
        seenEventIds.add(currentEvt.eventId);
        events.add(currentEvt);
      }
    }

    info.events = events;

    if (info.status == 'delivered' && info.lastEventDate != null) {
      info.actualDeliveryDate = info.lastEventDate;
    } else {
      for (ShipmentInfo.TrackingEvent evt : events) {
        if (evt.status == 'delivered' && evt.eventDate != null) {
          info.actualDeliveryDate = evt.eventDate;
          break;
        }
      }
    }

    return info;
  }

  // Parses a single tracking event into a TrackingEvent DTO.
  private static ShipmentInfo.TrackingEvent parseTrackingEvent(
    Map<String, Object> eventMap,
    String trackingCode
  ) {
    if (eventMap == null) {
      return null;
    }

    ShipmentInfo.TrackingEvent evt = new ShipmentInfo.TrackingEvent();

    Object objIdVal = eventMap.get('object_id');
    String objId = objIdVal != null ? String.valueOf(objIdVal).trim() : null;

    Object rawStVal = eventMap.get('status');
    String rawSt = rawStVal != null ? String.valueOf(rawStVal).trim() : null;

    Object dtVal = eventMap.get('status_date');
    Datetime dt = dtVal != null
      ? parseDate(String.valueOf(dtVal), 'status_date')
      : null;

    Object detailsVal = eventMap.get('status_details');
    String details = detailsVal != null ? String.valueOf(detailsVal) : null;

    String locStr = formatLocation(eventMap.get('location'));

    evt.rawStatus = rawSt;
    String normalized = String.isBlank(rawSt)
      ? null
      : rawSt.trim().toUpperCase();
    evt.status = normalized != null && STATUS_MAP.containsKey(normalized)
      ? STATUS_MAP.get(normalized)
      : 'unknown';
    evt.eventDate = dt;
    evt.description = details;
    evt.location = locStr;

    try {
      evt.rawData = JSON.serialize(eventMap);
    } catch (Exception e) {
      evt.rawData = null;
    }

    if (!String.isBlank(objId)) {
      evt.eventId = objId.trim();
    } else {
      String timePart = dt != null ? String.valueOf(dt.getTime()) : '0';
      String codePart = !String.isBlank(trackingCode)
        ? trackingCode.trim()
        : 'UNKNOWN';
      String codePrefix = codePart.length() > 40
        ? codePart.substring(0, 40)
        : codePart;
      String statusPart = evt.status != null ? evt.status.trim() : 'unknown';
      String detailsPart = !String.isBlank(details) ? details.trim() : '';
      String locPart = !String.isBlank(locStr) ? locStr.trim() : '';

      String rawKey =
        codePart +
        '|' +
        timePart +
        '|' +
        statusPart +
        '|' +
        detailsPart +
        '|' +
        locPart;
      String hash = EncodingUtil.convertToHex(
          Crypto.generateDigest('SHA-256', Blob.valueOf(rawKey))
        )
        .substring(0, 16);

      evt.eventId = codePrefix + '_' + timePart + '_' + hash;
    }

    return evt;
  }

  // Formats a location object or string into a readable location string.
  private static String formatLocation(Object locObj) {
    if (locObj == null) {
      return null;
    }
    if (locObj instanceof String) {
      return (String) locObj;
    }
    if (locObj instanceof Map<String, Object>) {
      Map<String, Object> loc = (Map<String, Object>) locObj;
      List<String> parts = new List<String>();
      String city = loc.get('city') instanceof String
        ? (String) loc.get('city')
        : null;
      String state = loc.get('state') instanceof String
        ? (String) loc.get('state')
        : null;
      String zip = loc.get('zip') instanceof String
        ? (String) loc.get('zip')
        : null;
      String country = loc.get('country') instanceof String
        ? (String) loc.get('country')
        : null;

      if (!String.isBlank(city)) {
        parts.add(city.trim());
      }
      if (!String.isBlank(state)) {
        if (!String.isBlank(zip)) {
          parts.add(state.trim() + ' ' + zip.trim());
        } else {
          parts.add(state.trim());
        }
      } else if (!String.isBlank(zip)) {
        parts.add(zip.trim());
      }
      if (!String.isBlank(country)) {
        parts.add(country.trim());
      }

      return parts.isEmpty() ? null : String.join(parts, ', ');
    }
    return null;
  }

  // Safely retrieves an optional nested JSON object.
  private static Map<String, Object> getObject(
    Map<String, Object> source,
    String fieldName
  ) {
    Object value = source.get(fieldName);

    if (value == null) {
      return null;
    }

    if (!(value instanceof Map<String, Object>)) {
      throw new CalloutException(
        'Shippo returned an invalid ' + fieldName + ' structure.'
      );
    }

    return (Map<String, Object>) value;
  }

  // Safely retrieves an optional string field.
  private static String getString(
    Map<String, Object> source,
    String fieldName
  ) {
    Object value = source.get(fieldName);

    if (value == null) {
      return null;
    }

    if (!(value instanceof String)) {
      throw new CalloutException(
        'Shippo returned an invalid ' + fieldName + ' value.'
      );
    }

    return (String) value;
  }

  // Safely retrieves an optional Boolean field.
  private static Boolean getBoolean(
    Map<String, Object> source,
    String fieldName
  ) {
    Object value = source.get(fieldName);

    if (value == null) {
      return null;
    }

    if (!(value instanceof Boolean)) {
      throw new CalloutException(
        'Shippo returned an invalid ' + fieldName + ' value.'
      );
    }

    return (Boolean) value;
  }

  // Parses ISO-8601 dates returned by Shippo.
  private static Datetime parseDate(String iso, String fieldName) {
    if (String.isBlank(iso)) {
      return null;
    }

    try {
      return (Datetime) JSON.deserialize(JSON.serialize(iso), Datetime.class);
    } catch (Exception e) {
      throw new CalloutException(
        'Shippo returned an invalid date in ' + fieldName + '.'
      );
    }
  }
}
