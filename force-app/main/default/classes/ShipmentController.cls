public with sharing class ShipmentController {
  // Retrieve shipments using database-level dashboard filters.
  @AuraEnabled(cacheable=true)
  public static List<Shipment__c> getShipments(
    String searchTerm,
    String statusFilter,
    String riskFilter
  ) {
    try {
      String searchPattern = null;

      if (!String.isBlank(searchTerm)) {
        String escapedSearch = searchTerm.trim()
          .replace('\\', '\\\\')
          .replace('%', '\\%')
          .replace('_', '\\_');

        searchPattern = '%' + escapedSearch + '%';
      }

      String normalizedStatus = String.isBlank(statusFilter) ||
        statusFilter.trim().equalsIgnoreCase('All')
        ? null
        : statusFilter.trim();

      String normalizedRisk = String.isBlank(riskFilter) ||
        riskFilter.trim().equalsIgnoreCase('All')
        ? null
        : riskFilter.trim();

      List<String> conditions = new List<String>();
      Map<String, Object> bindValues = new Map<String, Object>();

      if (searchPattern != null) {
        conditions.add(
          '(Tracking_Code__c LIKE :searchPattern ' +
            'OR Carrier__c LIKE :searchPattern ' +
            'OR Name LIKE :searchPattern)'
        );
        bindValues.put('searchPattern', searchPattern);
      }

      if (normalizedStatus != null) {
        conditions.add('Status__c = :normalizedStatus');
        bindValues.put('normalizedStatus', normalizedStatus);
      }

      if (normalizedRisk != null) {
        conditions.add('Risk_Level__c = :normalizedRisk');
        bindValues.put('normalizedRisk', normalizedRisk);
      }

      String query =
        'SELECT Id, Name, Tracking_Code__c, Carrier__c, ' +
        'Provider__c, Status__c, Estimated_Delivery_Date__c, ' +
        'Actual_Delivery_Date__c, Resolution_Status__c, Resolution_Notes__c, ' +
        'Last_Synced__c, Risk_Level__c, Risk_Reason__c, Case__c, ' +
        'CreatedDate, LastModifiedDate, ' +
        'Case__r.CaseNumber, Case__r.Subject, Case__r.Status, Case__r.Priority, ' +
        'Case__r.OwnerId, Case__r.Owner.Name ' +
        'FROM Shipment__c';

      if (!conditions.isEmpty()) {
        query += ' WHERE ' + String.join(conditions, ' AND ');
      }

      query += ' ORDER BY LastModifiedDate DESC LIMIT 500';

      return Database.queryWithBinds(query, bindValues, AccessLevel.USER_MODE);
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to retrieve shipments: ' + e.getMessage()
      );
    }
  }

  // Retrieve shipments linked to a particular Salesforce Case.
  @AuraEnabled(cacheable=true)
  public static List<Shipment__c> getShipmentsForCase(Id caseId) {
    if (caseId == null) {
      throw new AuraHandledException('A valid Case ID is required.');
    }

    try {
      return [
        SELECT
          Id,
          Name,
          Tracking_Code__c,
          Carrier__c,
          Provider__c,
          Status__c,
          Estimated_Delivery_Date__c,
          Actual_Delivery_Date__c,
          Resolution_Status__c,
          Resolution_Notes__c,
          Last_Synced__c,
          Risk_Level__c,
          Risk_Reason__c,
          Case__c
        FROM Shipment__c
        WHERE Case__c = :caseId
        WITH USER_MODE
        ORDER BY LastModifiedDate DESC
        LIMIT 500
      ];
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to retrieve Case shipments: ' + e.getMessage()
      );
    }
  }

  // Backward-compatible single shipment synchronization.
  @AuraEnabled
  public static Shipment__c syncOne(
    String carrier,
    String trackingNumber,
    Id caseId
  ) {
    return syncOneWithProvider('Shippo', carrier, trackingNumber, caseId);
  }

  // Provider-aware single shipment synchronization.
  @AuraEnabled
  public static Shipment__c syncOneWithProvider(
    String providerName,
    String carrier,
    String trackingNumber,
    Id caseId
  ) {
    try {
      return ShipmentService.syncAndSave(
        providerName,
        carrier,
        trackingNumber,
        caseId
      );
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to synchronize shipment: ' + e.getMessage()
      );
    }
  }

  // Backward-compatible bulk synchronization.
  @AuraEnabled
  public static List<Shipment__c> syncMultiple(
    String carrier,
    List<String> trackingNumbers
  ) {
    return syncMultipleWithProvider('Shippo', carrier, trackingNumbers);
  }

  // Provider-aware bulk synchronization.
  @AuraEnabled
  public static List<Shipment__c> syncMultipleWithProvider(
    String providerName,
    String carrier,
    List<String> trackingNumbers
  ) {
    try {
      if (trackingNumbers == null || trackingNumbers.isEmpty()) {
        throw new IllegalArgumentException(
          'At least one tracking number is required.'
        );
      }

      ShipmentService.syncCodes(providerName, carrier, trackingNumbers);

      Set<String> normalizedCodes = new Set<String>();

      for (String code : trackingNumbers) {
        normalizedCodes.add(code.trim());
      }

      return [
        SELECT
          Id,
          Name,
          Tracking_Code__c,
          Carrier__c,
          Provider__c,
          Status__c,
          Estimated_Delivery_Date__c,
          Actual_Delivery_Date__c,
          Resolution_Status__c,
          Resolution_Notes__c,
          Last_Synced__c,
          Risk_Level__c,
          Risk_Reason__c,
          Case__c
        FROM Shipment__c
        WHERE Tracking_Code__c IN :normalizedCodes
        WITH USER_MODE
        ORDER BY LastModifiedDate DESC
      ];
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to synchronize shipments: ' + e.getMessage()
      );
    }
  }

  // Retrieve complete shipment details including linked Case information.
  @AuraEnabled(cacheable=true)
  public static Shipment__c getShipmentDetail(Id shipmentId) {
    if (shipmentId == null) {
      throw new AuraHandledException('A valid Shipment ID is required.');
    }

    try {
      List<Shipment__c> shipments = [
        SELECT
          Id,
          Name,
          Tracking_Code__c,
          Carrier__c,
          Provider__c,
          Status__c,
          Estimated_Delivery_Date__c,
          Actual_Delivery_Date__c,
          Resolution_Status__c,
          Resolution_Notes__c,
          Last_Synced__c,
          Risk_Level__c,
          Risk_Reason__c,
          Case__c,
          CreatedDate,
          LastModifiedDate,
          Case__r.CaseNumber,
          Case__r.Subject,
          Case__r.Status,
          Case__r.Priority,
          Case__r.Origin,
          Case__r.OwnerId,
          Case__r.Owner.Name,
          Case__r.CreatedDate,
          Case__r.LastModifiedDate
        FROM Shipment__c
        WHERE Id = :shipmentId
        WITH USER_MODE
        LIMIT 1
      ];

      if (shipments.isEmpty()) {
        throw new AuraHandledException('Shipment not found.');
      }

      return shipments[0];
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to retrieve shipment details: ' + e.getMessage()
      );
    }
  }

  // Retrieve chronological tracking event history for a shipment.
  @AuraEnabled(cacheable=true)
  public static List<Shipment_Event__c> getShipmentEvents(Id shipmentId) {
    if (shipmentId == null) {
      throw new AuraHandledException('A valid Shipment ID is required.');
    }

    try {
      return [
        SELECT
          Id,
          Name,
          Shipment__c,
          Event_ID__c,
          Event_Date__c,
          Event_Status__c,
          Event_Description__c,
          Event_Location__c,
          Provider__c,
          CreatedDate
        FROM Shipment_Event__c
        WHERE Shipment__c = :shipmentId
        WITH USER_MODE
        ORDER BY Event_Date__c DESC, CreatedDate DESC
        LIMIT 500
      ];
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to retrieve shipment events: ' + e.getMessage()
      );
    }
  }

  // Refresh tracking information for a single shipment record.
  @AuraEnabled
  public static Shipment__c refreshShipment(Id shipmentId) {
    if (shipmentId == null) {
      throw new AuraHandledException('A valid Shipment ID is required.');
    }

    try {
      List<Shipment__c> shipments = [
        SELECT Id, Tracking_Code__c, Carrier__c, Provider__c, Case__c
        FROM Shipment__c
        WHERE Id = :shipmentId
        WITH USER_MODE
        LIMIT 1
      ];

      if (shipments.isEmpty()) {
        throw new AuraHandledException('Shipment not found.');
      }

      Shipment__c target = shipments[0];
      String providerName = String.isBlank(target.Provider__c)
        ? 'Shippo'
        : target.Provider__c;

      return ShipmentService.syncAndSave(
        providerName,
        target.Carrier__c,
        target.Tracking_Code__c,
        target.Case__c
      );
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to refresh shipment: ' + e.getMessage()
      );
    }
  }

  // Retrieve Cases linked to shipments, including their related shipment details.
  @AuraEnabled(cacheable=true)
  public static List<Case> getShipmentCases() {
    try {
      return [
        SELECT
          Id,
          CaseNumber,
          Subject,
          Description,
          Status,
          Priority,
          Origin,
          OwnerId,
          Owner.Name,
          SuppliedEmail,
          ContactId,
          Contact.Name,
          Contact.Email,
          CreatedDate,
          LastModifiedDate,
          (
            SELECT
              Id,
              Name,
              Tracking_Code__c,
              Carrier__c,
              Provider__c,
              Status__c,
              Risk_Level__c,
              Risk_Reason__c,
              Estimated_Delivery_Date__c,
              Actual_Delivery_Date__c,
              Resolution_Status__c,
              Resolution_Notes__c,
              Last_Synced__c
            FROM Shipments__r
            ORDER BY LastModifiedDate DESC
          )
        FROM Case
        WHERE Id IN (SELECT Case__c FROM Shipment__c WHERE Case__c != NULL)
        WITH USER_MODE
        ORDER BY LastModifiedDate DESC
        LIMIT 200
      ];
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to retrieve shipment cases: ' + e.getMessage()
      );
    }
  }

  // Retrieve recent Cases available for linking to exceptions.
  @AuraEnabled(cacheable=true)
  public static List<Case> getAvailableCases() {
    try {
      return [
        SELECT
          Id,
          CaseNumber,
          Subject,
          Status,
          Priority,
          Origin,
          OwnerId,
          Owner.Name,
          CreatedDate,
          LastModifiedDate
        FROM Case
        WITH USER_MODE
        ORDER BY LastModifiedDate DESC
        LIMIT 100
      ];
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to retrieve available cases: ' + e.getMessage()
      );
    }
  }

  // Update case fields (status, priority, subject, description)
  @AuraEnabled
  public static Case updateCase(
    Id caseId,
    String status,
    String priority,
    String subject,
    String description
  ) {
    if (caseId == null) {
      throw new AuraHandledException('A valid Case ID is required.');
    }

    try {
      Case c = new Case(Id = caseId);
      if (status != null) {
        c.Status = status;
      }
      if (priority != null) {
        c.Priority = priority;
      }
      if (subject != null) {
        c.Subject = subject;
      }
      if (description != null) {
        c.Description = description;
      }

      Database.update(c, AccessLevel.USER_MODE);

      return [
        SELECT
          Id,
          CaseNumber,
          Subject,
          Description,
          Status,
          Priority,
          Origin,
          OwnerId,
          Owner.Name,
          SuppliedEmail,
          ContactId,
          Contact.Name,
          Contact.Email,
          CreatedDate,
          LastModifiedDate,
          (
            SELECT
              Id,
              Name,
              Tracking_Code__c,
              Carrier__c,
              Provider__c,
              Status__c,
              Risk_Level__c,
              Risk_Reason__c,
              Estimated_Delivery_Date__c,
              Actual_Delivery_Date__c,
              Resolution_Status__c,
              Resolution_Notes__c,
              Last_Synced__c
            FROM Shipments__r
            ORDER BY LastModifiedDate DESC
          )
        FROM Case
        WHERE Id = :caseId
        WITH USER_MODE
        LIMIT 1
      ];
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to update case: ' + e.getMessage()
      );
    }
  }

  // Assign Case using standard Case.OwnerId.
  @AuraEnabled
  public static Case assignCase(Id caseId, Id newOwnerId) {
    if (caseId == null) {
      throw new AuraHandledException('A valid Case ID is required.');
    }
    if (newOwnerId == null) {
      throw new AuraHandledException('A valid Owner ID is required.');
    }

    try {
      Case c = new Case(Id = caseId, OwnerId = newOwnerId);
      Database.update(c, AccessLevel.USER_MODE);

      return [
        SELECT
          Id,
          CaseNumber,
          Subject,
          Description,
          Status,
          Priority,
          Origin,
          OwnerId,
          Owner.Name,
          SuppliedEmail,
          ContactId,
          Contact.Name,
          Contact.Email,
          CreatedDate,
          LastModifiedDate
        FROM Case
        WHERE Id = :caseId
        WITH USER_MODE
        LIMIT 1
      ];
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to assign case: ' + e.getMessage()
      );
    }
  }

  // Create a new support Case linked to an unlinked shipment (prevents duplicate cases).
  @AuraEnabled
  public static Case createCaseForShipment(
    Id shipmentId,
    String subject,
    String priority,
    String origin,
    String description
  ) {
    if (shipmentId == null) {
      AuraHandledException ahe = new AuraHandledException(
        'A valid Shipment ID is required.'
      );
      ahe.setMessage('A valid Shipment ID is required.');
      throw ahe;
    }
    if (String.isBlank(subject)) {
      AuraHandledException ahe = new AuraHandledException(
        'Case Subject is required.'
      );
      ahe.setMessage('Case Subject is required.');
      throw ahe;
    }

    try {
      List<Shipment__c> shipments = [
        SELECT
          Id,
          Name,
          Tracking_Code__c,
          Carrier__c,
          Case__c,
          Case__r.CaseNumber
        FROM Shipment__c
        WHERE Id = :shipmentId
        WITH USER_MODE
        LIMIT 1
      ];

      if (shipments.isEmpty()) {
        AuraHandledException ahe = new AuraHandledException(
          'Shipment not found.'
        );
        ahe.setMessage('Shipment not found.');
        throw ahe;
      }

      Shipment__c targetShipment = shipments[0];
      if (targetShipment.Case__c != null) {
        String existingNumber = targetShipment.Case__r != null &&
          targetShipment.Case__r.CaseNumber != null
          ? targetShipment.Case__r.CaseNumber
          : '';
        AuraHandledException ahe = new AuraHandledException(
          'This shipment already has an associated Case: #' + existingNumber
        );
        ahe.setMessage(
          'This shipment already has an associated Case: #' + existingNumber
        );
        throw ahe;
      }

      Case newCase = new Case(
        Subject = subject.trim(),
        Priority = String.isBlank(priority) ? 'Medium' : priority.trim(),
        Origin = String.isBlank(origin)
          ? 'Logistics Operations'
          : origin.trim(),
        Description = description != null ? description.trim() : null,
        Status = 'New'
      );

      Database.insert(newCase, AccessLevel.USER_MODE);

      Shipment__c toUpdate = new Shipment__c(
        Id = shipmentId,
        Case__c = newCase.Id
      );
      Database.update(toUpdate, AccessLevel.USER_MODE);

      return [
        SELECT
          Id,
          CaseNumber,
          Subject,
          Description,
          Status,
          Priority,
          Origin,
          OwnerId,
          Owner.Name,
          CreatedDate,
          LastModifiedDate
        FROM Case
        WHERE Id = :newCase.Id
        WITH USER_MODE
        LIMIT 1
      ];
    } catch (Exception e) {
      if (e instanceof AuraHandledException) {
        throw e;
      }
      AuraHandledException ahe = new AuraHandledException(
        'Unable to create Case for shipment: ' + e.getMessage()
      );
      ahe.setMessage('Unable to create Case for shipment: ' + e.getMessage());
      throw ahe;
    }
  }

  // Link an existing Case to a shipment.
  @AuraEnabled
  public static Shipment__c linkCaseToShipment(Id shipmentId, Id caseId) {
    if (shipmentId == null) {
      throw new AuraHandledException('A valid Shipment ID is required.');
    }
    if (caseId == null) {
      throw new AuraHandledException('A valid Case ID is required.');
    }

    try {
      List<Shipment__c> shipments = [
        SELECT Id, Case__c, Case__r.CaseNumber
        FROM Shipment__c
        WHERE Id = :shipmentId
        WITH USER_MODE
        LIMIT 1
      ];

      if (shipments.isEmpty()) {
        throw new AuraHandledException('Shipment not found.');
      }

      List<Case> cases = [
        SELECT Id, CaseNumber
        FROM Case
        WHERE Id = :caseId
        WITH USER_MODE
        LIMIT 1
      ];

      if (cases.isEmpty()) {
        throw new AuraHandledException('Target Case not found.');
      }

      Shipment__c toUpdate = new Shipment__c(Id = shipmentId, Case__c = caseId);
      Database.update(toUpdate, AccessLevel.USER_MODE);

      return getShipmentDetail(shipmentId);
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to link Case to shipment: ' + e.getMessage()
      );
    }
  }

  // Update operational resolution status and notes for a shipment.
  @AuraEnabled
  public static Shipment__c updateShipmentResolution(
    Id shipmentId,
    String resolutionStatus,
    String resolutionNotes
  ) {
    if (shipmentId == null) {
      throw new AuraHandledException('A valid Shipment ID is required.');
    }

    try {
      Shipment__c shipmentToUpdate = new Shipment__c(Id = shipmentId);

      if (resolutionStatus != null) {
        shipmentToUpdate.Resolution_Status__c = resolutionStatus;
      }

      if (resolutionNotes != null) {
        shipmentToUpdate.Resolution_Notes__c = resolutionNotes;
      }

      Database.update(shipmentToUpdate, AccessLevel.USER_MODE);

      return getShipmentDetail(shipmentId);
    } catch (Exception e) {
      throw new AuraHandledException(
        'Unable to update shipment resolution: ' + e.getMessage()
      );
    }
  }

  // Wrapper for generated customer update draft
  public class CustomerUpdateDraft {
    @AuraEnabled
    public String subject { get; set; }
    @AuraEnabled
    public String body { get; set; }
    @AuraEnabled
    public String recipientEmail { get; set; }
    @AuraEnabled
    public String recipientName { get; set; }
    @AuraEnabled
    public Boolean hasRecipientEmail { get; set; }
  }

  // Generate a professional, concise customer shipment update draft
  @AuraEnabled
  public static CustomerUpdateDraft generateCustomerUpdate(Id caseId) {
    if (caseId == null) {
      AuraHandledException ahe = new AuraHandledException(
        'A valid Case ID is required.'
      );
      ahe.setMessage('A valid Case ID is required.');
      throw ahe;
    }

    try {
      List<Case> cases = [
        SELECT
          Id,
          CaseNumber,
          Subject,
          SuppliedEmail,
          ContactId,
          Contact.Name,
          Contact.Email,
          (
            SELECT
              Id,
              Name,
              Tracking_Code__c,
              Carrier__c,
              Status__c,
              Estimated_Delivery_Date__c,
              Actual_Delivery_Date__c,
              Risk_Level__c,
              Risk_Reason__c,
              Resolution_Status__c,
              Resolution_Notes__c
            FROM Shipments__r
            ORDER BY LastModifiedDate DESC
            LIMIT 1
          )
        FROM Case
        WHERE Id = :caseId
        WITH USER_MODE
        LIMIT 1
      ];

      if (cases.isEmpty()) {
        AuraHandledException ahe = new AuraHandledException('Case not found.');
        ahe.setMessage('Case not found.');
        throw ahe;
      }

      Case targetCase = cases[0];
      if (
        targetCase.Shipments__r == null || targetCase.Shipments__r.isEmpty()
      ) {
        AuraHandledException ahe = new AuraHandledException(
          'No shipment is linked to this Case.'
        );
        ahe.setMessage('No shipment is linked to this Case.');
        throw ahe;
      }

      Shipment__c shipment = targetCase.Shipments__r[0];
      return buildCustomerUpdateDraft(targetCase, shipment);
    } catch (Exception e) {
      if (e instanceof AuraHandledException) {
        throw e;
      }
      AuraHandledException ahe = new AuraHandledException(
        'Unable to generate customer update: ' + e.getMessage()
      );
      ahe.setMessage('Unable to generate customer update: ' + e.getMessage());
      throw ahe;
    }
  }

  // Helper to construct structured customer update draft from telemetry
  private static CustomerUpdateDraft buildCustomerUpdateDraft(
    Case c,
    Shipment__c s
  ) {
    CustomerUpdateDraft draft = new CustomerUpdateDraft();

    // 1. Resolve Recipient Email & Name
    String email = null;
    if (c.Contact != null && String.isNotBlank(c.Contact.Email)) {
      email = c.Contact.Email.trim();
    } else if (String.isNotBlank(c.SuppliedEmail)) {
      email = c.SuppliedEmail.trim();
    }

    draft.recipientEmail = email;
    draft.hasRecipientEmail = String.isNotBlank(email);

    String recipientName = (c.Contact != null &&
      String.isNotBlank(c.Contact.Name))
      ? c.Contact.Name.trim()
      : 'Valued Customer';
    draft.recipientName = recipientName;

    // 2. Resolve Shipment Attributes
    String trackingCode = String.isNotBlank(s.Tracking_Code__c)
      ? s.Tracking_Code__c.trim()
      : (String.isNotBlank(s.Name) ? s.Name.trim() : 'Consignment');

    String carrier = String.isNotBlank(s.Carrier__c)
      ? formatCarrierDisplay(s.Carrier__c)
      : 'our logistics partner';

    String status = String.isNotBlank(s.Status__c)
      ? s.Status__c.trim().toLowerCase()
      : 'unknown';

    String riskLevel = String.isNotBlank(s.Risk_Level__c)
      ? s.Risk_Level__c.trim()
      : 'On Track';

    String riskReason = String.isNotBlank(s.Risk_Reason__c)
      ? s.Risk_Reason__c.trim()
      : null;

    String formattedEta = s.Estimated_Delivery_Date__c != null
      ? s.Estimated_Delivery_Date__c.format('MMMM d, yyyy')
      : null;

    String formattedActualDeliveryDate = s.Actual_Delivery_Date__c != null
      ? s.Actual_Delivery_Date__c.format('MMMM d, yyyy')
      : null;

    // 3. Subject Line
    draft.subject = 'Update regarding your shipment ' + trackingCode;

    // 4. Body Content
    List<String> paragraphs = new List<String>();
    paragraphs.add('Dear ' + recipientName + ',');

    if (status == 'delivered') {
      String deliverySentence =
        'We are pleased to inform you that your shipment (' +
        trackingCode +
        ') handled by ' +
        carrier +
        ' has been successfully delivered';
      if (formattedActualDeliveryDate != null) {
        deliverySentence += ' on ' + formattedActualDeliveryDate;
      }
      deliverySentence += '.';
      paragraphs.add(deliverySentence);
      paragraphs.add(
        'Thank you for your business. Please inspect your package upon receipt, and feel free to reach out if you have any questions or concerns.'
      );
    } else if (status == 'out_for_delivery') {
      paragraphs.add(
        'Your shipment (' +
          trackingCode +
          ') handled by ' +
          carrier +
          ' is out for delivery today based on carrier tracking updates.'
      );
      paragraphs.add(
        'Please ensure that someone is present at the designated delivery address to receive the parcel. We will update you once final handover is confirmed.'
      );
    } else if (status == 'in_transit' || status == 'transit') {
      if (riskLevel.equalsIgnoreCase('Delayed')) {
        String delayText =
          'We are writing to provide an update regarding your shipment (' +
          trackingCode +
          ') with ' +
          carrier +
          '. The consignment has encountered a transit delay.';
        if (riskReason != null) {
          delayText += ' Stated reason: ' + riskReason + '.';
        }
        paragraphs.add(delayText);

        String etaText;
        if (s.Resolution_Status__c == 'Investigating') {
          etaText =
            'Our operations desk has an active investigation open for this consignment with ' +
            carrier +
            '.';
        } else if (s.Resolution_Status__c == 'Escalated') {
          etaText = 'This consignment has been escalated for priority operations review.';
        } else if (
          s.Resolution_Status__c == 'Action Required' &&
          String.isNotBlank(s.Resolution_Notes__c)
        ) {
          etaText = 'Operational update: ' + s.Resolution_Notes__c.trim() + '.';
        } else {
          etaText =
            'Our customer support team is monitoring transit telemetry from ' +
            carrier +
            '.';
        }

        if (formattedEta != null) {
          etaText +=
            ' The current estimated delivery date indicated by the carrier is ' +
            formattedEta +
            '.';
        } else {
          etaText += ' An updated estimated delivery date has not yet been confirmed by the carrier.';
        }
        paragraphs.add(etaText);
      } else if (riskLevel.equalsIgnoreCase('At Risk')) {
        String atRiskText =
          'We are tracking your shipment (' +
          trackingCode +
          ') with ' +
          carrier +
          ', which is currently in transit.';
        if (riskReason != null) {
          atRiskText += ' Carrier telemetry indicates: ' + riskReason + '.';
        }
        paragraphs.add(atRiskText);

        String atRiskUpdate;
        if (s.Resolution_Status__c == 'Investigating') {
          atRiskUpdate =
            'Our operations desk is actively tracking this consignment with ' +
            carrier +
            '.';
        } else if (s.Resolution_Status__c == 'Escalated') {
          atRiskUpdate = 'This consignment has been escalated for operational monitoring.';
        } else {
          atRiskUpdate = 'Our support team is monitoring consignment progress.';
        }

        if (formattedEta != null) {
          atRiskUpdate +=
            ' The carrier currently projects delivery by ' +
            formattedEta +
            '.';
        } else {
          atRiskUpdate += ' Carrier tracking has not confirmed an estimated delivery date at this stage.';
        }
        paragraphs.add(atRiskUpdate);
      } else {
        paragraphs.add(
          'Your shipment (' +
            trackingCode +
            ') is in transit with ' +
            carrier +
            ' and moving along the planned route.'
        );
        if (formattedEta != null) {
          paragraphs.add(
            'The estimated delivery date indicated by the carrier is ' +
              formattedEta +
              '.'
          );
        } else {
          paragraphs.add(
            'Carrier tracking does not currently list an estimated delivery date. We will provide updates as milestone scans are recorded.'
          );
        }
      }
    } else if (status == 'failure') {
      String failureText =
        'We are writing regarding your shipment (' +
        trackingCode +
        ') with ' +
        carrier +
        '. The carrier recorded a delivery attempt exception.';
      if (riskReason != null) {
        failureText += ' Stated exception: ' + riskReason + '.';
      }
      paragraphs.add(failureText);

      if (
        s.Resolution_Status__c == 'Resolved' &&
        String.isNotBlank(s.Resolution_Notes__c)
      ) {
        paragraphs.add('Resolution notes: ' + s.Resolution_Notes__c.trim());
      } else if (s.Resolution_Status__c == 'Investigating') {
        paragraphs.add(
          'Our operations desk is currently investigating this exception with ' +
            carrier +
            '.'
        );
      } else {
        paragraphs.add(
          'To assist with rescheduling delivery or confirming address details, please reply directly to this case with any specific delivery instructions or access information.'
        );
      }
    } else if (status == 'return_to_sender') {
      String returnText =
        'We want to inform you that your shipment (' +
        trackingCode +
        ') is recorded by ' +
        carrier +
        ' as being returned to sender.';
      if (riskReason != null) {
        returnText += ' Stated reason: ' + riskReason + '.';
      }
      paragraphs.add(returnText);

      if (
        s.Resolution_Status__c == 'Resolved' &&
        String.isNotBlank(s.Resolution_Notes__c)
      ) {
        paragraphs.add('Operational status: ' + s.Resolution_Notes__c.trim());
      } else if (s.Resolution_Status__c == 'Investigating') {
        paragraphs.add(
          'Our operations desk is investigating the return intake with ' +
            carrier +
            '.'
        );
      } else {
        paragraphs.add(
          'Please reply to this case if you have questions or require further assistance regarding this returned consignment.'
        );
      }
    } else if (status == 'pre_transit') {
      paragraphs.add(
        'Your shipment (' +
          trackingCode +
          ') has been booked with ' +
          carrier +
          ' and is awaiting carrier pickup or initial scan.'
      );
      if (formattedEta != null) {
        paragraphs.add(
          'The carrier preliminary estimated delivery date is ' +
            formattedEta +
            '.'
        );
      } else {
        paragraphs.add(
          'Carrier pickup scheduling is underway. Tracking milestones will become available once the initial scan is recorded.'
        );
      }
    } else {
      // unknown / default
      paragraphs.add(
        'We are tracking your shipment (' +
          trackingCode +
          ') with ' +
          carrier +
          '. Carrier tracking telemetry is currently updating.'
      );
      paragraphs.add(
        'If you need assistance regarding this shipment, please feel free to reply to this message.'
      );
    }

    paragraphs.add(
      'Best regards,\nCustomer Support Operations\nLogistics Intelligence Team'
    );
    draft.body = String.join(paragraphs, '\n\n');

    return draft;
  }

  // Helper to format carrier display name
  private static String formatCarrierDisplay(String carrier) {
    if (String.isBlank(carrier))
      return 'our logistics partner';
    String c = carrier.trim();
    if (c.equalsIgnoreCase('shippo'))
      return 'Shippo';
    if (c.equalsIgnoreCase('usps'))
      return 'USPS';
    if (c.equalsIgnoreCase('fedex'))
      return 'FedEx';
    if (c.equalsIgnoreCase('ups'))
      return 'UPS';
    if (c.equalsIgnoreCase('dhl'))
      return 'DHL';
    if (c.equalsIgnoreCase('delhivery'))
      return 'Delhivery';
    if (c.equalsIgnoreCase('bluedart'))
      return 'Blue Dart';
    if (c.equalsIgnoreCase('dtdc'))
      return 'DTDC';
    if (c.equalsIgnoreCase('ekart'))
      return 'Ekart';
    if (c.equalsIgnoreCase('shadowfax'))
      return 'Shadowfax';
    return c.substring(0, 1).toUpperCase() + c.substring(1);
  }
}
