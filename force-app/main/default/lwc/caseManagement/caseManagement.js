import { LightningElement, wire, api } from "lwc";
import { refreshApex } from "@salesforce/apex";
import USER_ID from "@salesforce/user/Id";
import getShipmentCases from "@salesforce/apex/ShipmentController.getShipmentCases";
import updateCase from "@salesforce/apex/ShipmentController.updateCase";
import assignCase from "@salesforce/apex/ShipmentController.assignCase";
import updateShipmentResolution from "@salesforce/apex/ShipmentController.updateShipmentResolution";
import getShipmentEvents from "@salesforce/apex/ShipmentController.getShipmentEvents";
import generateCustomerUpdate from "@salesforce/apex/ShipmentController.generateCustomerUpdate";

const SEARCH_DEBOUNCE_MS = 300;

export default class CaseManagement extends LightningElement {
  // Raw cases from Apex
  cases = [];
  wiredCasesResult;

  // Selected case & related shipment
  selectedCaseId = null;
  rawTrackingEvents = [];
  wiredEventsResult;

  // Edit form state
  editSubject = "";
  editStatus = "";
  editPriority = "";
  editDescription = "";
  isSaving = false;
  isAssigning = false;
  saveSuccessMessage = "";
  saveErrorMessage = "";

  // Shipment Operational Resolution State
  shipmentResolutionStatus = "New";
  shipmentResolutionNotes = "";
  isSavingShipmentResolution = false;
  shipmentResolutionSuccessMessage = "";
  shipmentResolutionErrorMessage = "";

  // Level 3 Customer Communication State
  customerUpdateSubject = "";
  customerUpdateDraft = "";
  customerRecipientEmail = "";
  customerRecipientName = "";
  customerHasRecipientEmail = false;
  isDraftingCustomerUpdate = false;
  customerCommErrorMessage = "";

  // Filters
  localSearchTerm = "";
  _externalSearchTerm = "";
  statusFilter = "All";
  priorityFilter = "All";
  originFilter = "All";
  selectedQuickFilter = "All";

  // UI state
  isLoading = true;
  isRefreshing = false;
  errorMessage = "";
  searchTimeout;

  // External search term passed from application shell
  @api
  get externalSearchTerm() {
    return this._externalSearchTerm;
  }
  set externalSearchTerm(value) {
    this._externalSearchTerm = value || "";
    this.localSearchTerm = this._externalSearchTerm;
  }

  // Refresh handler exposed to parent shell
  @api
  async handleRefresh() {
    this.isRefreshing = true;
    try {
      if (this.wiredCasesResult) {
        await refreshApex(this.wiredCasesResult);
      }
      if (this.wiredEventsResult) {
        await refreshApex(this.wiredEventsResult);
      }
    } catch (err) {
      this.errorMessage = this.extractErrorMessage(err);
    } finally {
      this.isRefreshing = false;
    }
  }

  // Wire: Retrieve all shipment-related cases
  @wire(getShipmentCases)
  wiredCases(result) {
    this.wiredCasesResult = result;
    const { data, error } = result;

    if (data) {
      this.cases = data;
      this.errorMessage = "";
      this.isLoading = false;

      // Retain or select first case
      if (this.cases.length > 0) {
        if (this.selectedCaseId) {
          const stillExists = this.cases.find(
            (c) => c.Id === this.selectedCaseId
          );
          if (!stillExists) {
            this.selectCase(this.cases[0]);
          } else {
            // Keep current edit form synced
            this.syncEditForm(stillExists);
            this.syncShipmentResolutionForm(stillExists);
          }
        } else {
          this.selectCase(this.cases[0]);
        }
      } else {
        this.selectedCaseId = null;
      }
    } else if (error) {
      this.errorMessage = this.extractErrorMessage(error);
      this.cases = [];
      this.selectedCaseId = null;
      this.isLoading = false;
    }
  }

  // Wire: Retrieve tracking events for the selected case's shipment
  @wire(getShipmentEvents, { shipmentId: "$selectedShipmentId" })
  wiredEvents(result) {
    this.wiredEventsResult = result;
    const { data, error } = result;

    if (data) {
      this.rawTrackingEvents = data;
    } else if (error) {
      this.rawTrackingEvents = [];
    }
  }

  // Effective search term (local search input or shell global search)
  get effectiveSearchTerm() {
    return (this.localSearchTerm || this._externalSearchTerm || "")
      .trim()
      .toLowerCase();
  }

  // Computed selected case object
  get selectedCase() {
    return this.cases.find((c) => c.Id === this.selectedCaseId) || null;
  }

  get selectedCaseOwnerName() {
    return this.selectedCase?.Owner?.Name || "Unassigned";
  }

  // Primary related shipment for selected case
  get selectedShipment() {
    const sc = this.selectedCase;
    if (sc && sc.Shipments__r && sc.Shipments__r.length > 0) {
      return sc.Shipments__r[0];
    }
    return null;
  }

  get selectedShipmentId() {
    return this.selectedShipment ? this.selectedShipment.Id : null;
  }

  get selectedShipmentResolutionStatus() {
    return this.selectedShipment?.Resolution_Status__c || "New";
  }

  get selectedShipmentResolutionNotes() {
    return (
      this.selectedShipment?.Resolution_Notes__c ||
      "No resolution notes recorded."
    );
  }

  // --- Customer Communication Getters ---

  get hasSelectedShipment() {
    return Boolean(this.selectedShipment);
  }

  get recipientEmail() {
    if (this.customerRecipientEmail) {
      return this.customerRecipientEmail;
    }
    const sc = this.selectedCase;
    if (sc?.Contact?.Email) {
      return sc.Contact.Email;
    }
    if (sc?.SuppliedEmail) {
      return sc.SuppliedEmail;
    }
    return "";
  }

  get hasRecipientEmail() {
    return Boolean(this.recipientEmail && this.recipientEmail.trim());
  }

  get recipientDisplayName() {
    if (this.customerRecipientName) {
      return this.customerRecipientName;
    }
    const sc = this.selectedCase;
    if (sc?.Contact?.Name) {
      return sc.Contact.Name;
    }
    return "Valued Customer";
  }

  get recipientSourceLabel() {
    const sc = this.selectedCase;
    if (sc?.Contact?.Email) return "Contact Email";
    if (sc?.SuppliedEmail) return "Web-to-Case Email";
    return "";
  }

  get isGmailDisabled() {
    return (
      !this.hasRecipientEmail ||
      !this.customerUpdateDraft ||
      !this.customerUpdateDraft.trim()
    );
  }

  get gmailComposeUrl() {
    const email = (this.recipientEmail || "").trim();
    const subject = (this.customerUpdateSubject || "").trim();
    const body = (this.customerUpdateDraft || "").trim();
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      email
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // --- Dashboard KPI Metrics ---

  get totalCasesCount() {
    return this.cases.length;
  }

  get openCasesCount() {
    return this.cases.filter((c) => {
      const s = (c.Status || "").toLowerCase();
      return s === "new" || s === "open";
    }).length;
  }

  get inProgressCasesCount() {
    return this.cases.filter((c) => {
      const s = (c.Status || "").toLowerCase();
      return s === "working" || s === "in progress" || s === "pending";
    }).length;
  }

  get closedCasesCount() {
    return this.cases.filter((c) => (c.Status || "").toLowerCase() === "closed")
      .length;
  }

  get highPriorityCasesCount() {
    return this.cases.filter((c) => {
      const p = (c.Priority || "").toLowerCase();
      return p === "high" || p === "critical";
    }).length;
  }

  // --- Case Explorer Filtered List ---

  get filteredCases() {
    let list = [...this.cases];
    const search = this.effectiveSearchTerm;
    const status = (this.statusFilter || "All").toLowerCase();
    const priority = (this.priorityFilter || "All").toLowerCase();
    const origin = (this.originFilter || "All").toLowerCase();
    const quick = (this.selectedQuickFilter || "All").toLowerCase();

    // 1. Quick KPI Filter
    if (quick === "open") {
      list = list.filter((c) => {
        const s = (c.Status || "").toLowerCase();
        return s === "new" || s === "open";
      });
    } else if (quick === "working") {
      list = list.filter((c) => {
        const s = (c.Status || "").toLowerCase();
        return s === "working" || s === "in progress" || s === "pending";
      });
    } else if (quick === "closed") {
      list = list.filter((c) => (c.Status || "").toLowerCase() === "closed");
    } else if (quick === "high") {
      list = list.filter((c) => {
        const p = (c.Priority || "").toLowerCase();
        return p === "high" || p === "critical";
      });
    }

    // 2. Status Filter
    if (status !== "all") {
      list = list.filter((c) => (c.Status || "").toLowerCase() === status);
    }

    // 3. Priority Filter
    if (priority !== "all") {
      list = list.filter((c) => (c.Priority || "").toLowerCase() === priority);
    }

    // 4. Origin Filter
    if (origin !== "all") {
      list = list.filter((c) => (c.Origin || "").toLowerCase() === origin);
    }

    // 5. Text Search
    if (search) {
      list = list.filter((c) => {
        const num = (c.CaseNumber || "").toLowerCase();
        const sub = (c.Subject || "").toLowerCase();
        const pri = (c.Priority || "").toLowerCase();
        const st = (c.Status || "").toLowerCase();
        const owner = (c.Owner?.Name || "").toLowerCase();
        const sh =
          c.Shipments__r && c.Shipments__r.length > 0
            ? c.Shipments__r[0]
            : null;
        const code = (sh?.Tracking_Code__c || "").toLowerCase();
        const carr = (sh?.Carrier__c || "").toLowerCase();
        const shName = (sh?.Name || "").toLowerCase();
        const res = (sh?.Resolution_Status__c || "").toLowerCase();

        return (
          num.includes(search) ||
          sub.includes(search) ||
          pri.includes(search) ||
          st.includes(search) ||
          owner.includes(search) ||
          code.includes(search) ||
          carr.includes(search) ||
          shName.includes(search) ||
          res.includes(search)
        );
      });
    }

    return list;
  }

  get tableRows() {
    return this.filteredCases.map((c) => {
      const isSelected = c.Id === this.selectedCaseId;
      const sh =
        c.Shipments__r && c.Shipments__r.length > 0 ? c.Shipments__r[0] : null;

      return {
        id: c.Id,
        caseNumber: c.CaseNumber,
        subject: c.Subject || "—",
        ownerName: c.Owner?.Name || "—",
        priority: c.Priority || "Medium",
        priorityBadgeClass: this.getPriorityBadgeClass(c.Priority),
        status: c.Status || "New",
        statusBadgeClass: this.getStatusBadgeClass(c.Status),
        origin: c.Origin || "—",
        createdDateFormatted: this.formatDateTime(c.CreatedDate),
        lastModifiedDateFormatted: this.formatDateTime(c.LastModifiedDate),
        hasShipment: Boolean(sh),
        shipmentTrackingCode: sh?.Tracking_Code__c || "No Shipment",
        shipmentCarrier: this.formatCarrierName(sh?.Carrier__c),
        shipmentStatus: sh?.Status__c || "",
        isSelected,
        rowClass: isSelected ? "case-row is-selected" : "case-row"
      };
    });
  }

  get hasTableRows() {
    return this.tableRows.length > 0;
  }

  get isAllClear() {
    return !this.isLoading && this.cases.length === 0;
  }

  get isFilteredEmpty() {
    return (
      !this.isLoading &&
      this.cases.length > 0 &&
      this.filteredCases.length === 0
    );
  }

  get hasSelectedCase() {
    return Boolean(this.selectedCase);
  }

  // --- Tracking Milestones for Selected Shipment ---

  get trackingMilestones() {
    if (!this.rawTrackingEvents || this.rawTrackingEvents.length === 0) {
      return [];
    }

    return this.rawTrackingEvents.map((evt) => ({
      id: evt.Id,
      status: evt.Event_Status__c || "Event",
      statusBadgeClass: this.getEventStatusBadgeClass(evt.Event_Status__c),
      dateFormatted: this.formatDateTime(evt.Event_Date__c),
      location: evt.Event_Location__c || "Location unrecorded",
      description:
        evt.Event_Description__c || "Tracking milestone recorded by carrier"
    }));
  }

  get hasTrackingMilestones() {
    return this.trackingMilestones.length > 0;
  }

  // Selected shipment telemetry badges
  get selectedShipmentStatusClass() {
    return this.getShipmentStatusBadgeClass(this.selectedShipment?.Status__c);
  }

  get selectedShipmentRiskClass() {
    return this.getRiskBadgeClass(this.selectedShipment?.Risk_Level__c);
  }

  get selectedShipmentCarrierFormatted() {
    return this.formatCarrierName(this.selectedShipment?.Carrier__c);
  }

  get selectedShipmentEtaFormatted() {
    return this.formatDateTime(
      this.selectedShipment?.Estimated_Delivery_Date__c
    );
  }

  // --- Filter Dropdown Options ---

  get statusOptions() {
    return [
      { label: "All Statuses", value: "All" },
      { label: "New", value: "new" },
      { label: "Working / In Progress", value: "working" },
      { label: "Closed", value: "closed" }
    ];
  }

  get priorityOptions() {
    return [
      { label: "All Priorities", value: "All" },
      { label: "High", value: "high" },
      { label: "Medium", value: "medium" },
      { label: "Low", value: "low" }
    ];
  }

  get originOptions() {
    const origins = new Set();
    this.cases.forEach((c) => {
      if (c.Origin) origins.add(c.Origin);
    });

    const opts = [{ label: "All Origins", value: "All" }];
    Array.from(origins)
      .sort()
      .forEach((orig) => {
        opts.push({ label: orig, value: orig.toLowerCase() });
      });
    return opts;
  }

  // Form dropdown options for updating a Case
  get editStatusOptions() {
    return [
      { label: "New", value: "New" },
      { label: "Working", value: "Working" },
      { label: "Escalated", value: "Escalated" },
      { label: "Closed", value: "Closed" }
    ];
  }

  get editPriorityOptions() {
    return [
      { label: "High", value: "High" },
      { label: "Medium", value: "Medium" },
      { label: "Low", value: "Low" }
    ];
  }

  get resolutionFormOptions() {
    return [
      { label: "New", value: "New" },
      { label: "Investigating", value: "Investigating" },
      { label: "Escalated", value: "Escalated" },
      { label: "Action Required", value: "Action Required" },
      { label: "Resolved", value: "Resolved" },
      { label: "Dismissed", value: "Dismissed" }
    ];
  }

  get hasActiveFilters() {
    return (
      Boolean(this.effectiveSearchTerm) ||
      this.statusFilter !== "All" ||
      this.priorityFilter !== "All" ||
      this.originFilter !== "All" ||
      this.selectedQuickFilter !== "All"
    );
  }

  // --- Event Handlers ---

  handleSearchInput(event) {
    const term =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
    clearTimeout(this.searchTimeout);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.searchTimeout = setTimeout(() => {
      this.localSearchTerm = term;
    }, SEARCH_DEBOUNCE_MS);
  }

  handleStatusFilterChange(event) {
    this.statusFilter =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "All";
  }

  handlePriorityFilterChange(event) {
    this.priorityFilter =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "All";
  }

  handleOriginFilterChange(event) {
    this.originFilter =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "All";
  }

  handleQuickFilter(event) {
    const selected = event.currentTarget.dataset.quick || "All";
    if (this.selectedQuickFilter === selected) {
      this.selectedQuickFilter = "All";
    } else {
      this.selectedQuickFilter = selected;
    }
  }

  handleResetFilters() {
    this.localSearchTerm = "";
    this._externalSearchTerm = "";
    this.statusFilter = "All";
    this.priorityFilter = "All";
    this.originFilter = "All";
    this.selectedQuickFilter = "All";
  }

  handleSelectCase(event) {
    const caseId = event.currentTarget.dataset.caseId;
    const target = this.cases.find((c) => c.Id === caseId);
    if (target) {
      this.selectCase(target);
    }
  }

  // Form field change handlers
  handleEditSubjectChange(event) {
    this.editSubject =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
    this.clearAlerts();
  }

  handleEditStatusChange(event) {
    this.editStatus =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
    this.clearAlerts();
  }

  handleEditPriorityChange(event) {
    this.editPriority =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
    this.clearAlerts();
  }

  handleEditDescriptionChange(event) {
    this.editDescription =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
    this.clearAlerts();
  }

  handleCancelEdit() {
    if (this.selectedCase) {
      this.syncEditForm(this.selectedCase);
      this.clearAlerts();
    }
  }

  // Assign Case to current user via Apex
  async handleAssignToMe() {
    if (!this.selectedCaseId) return;

    this.isAssigning = true;
    this.clearAlerts();

    try {
      const updated = await assignCase({
        caseId: this.selectedCaseId,
        newOwnerId: USER_ID
      });

      this.saveSuccessMessage = `Case assigned to ${updated.Owner?.Name || "current user"} successfully.`;
      if (this.wiredCasesResult) {
        await refreshApex(this.wiredCasesResult);
      }
    } catch (err) {
      this.saveErrorMessage = this.extractErrorMessage(err);
    } finally {
      this.isAssigning = false;
    }
  }

  // Save changes to Case record via Apex
  async handleSaveCase() {
    if (!this.selectedCaseId) return;

    this.isSaving = true;
    this.clearAlerts();

    try {
      const updated = await updateCase({
        caseId: this.selectedCaseId,
        status: this.editStatus,
        priority: this.editPriority,
        subject: this.editSubject,
        description: this.editDescription
      });

      // Update local case state
      this.cases = this.cases.map((c) => {
        if (c.Id === updated.Id) {
          return {
            ...c,
            ...updated,
            Shipments__r: c.Shipments__r // preserve linked shipments
          };
        }
        return c;
      });

      this.saveSuccessMessage = `Case ${updated.CaseNumber || ""} updated successfully.`;
      this.syncEditForm(updated);

      if (this.wiredCasesResult) {
        await refreshApex(this.wiredCasesResult);
      }
    } catch (err) {
      this.saveErrorMessage = this.extractErrorMessage(err);
    } finally {
      this.isSaving = false;
    }
  }

  // Operational Resolution handlers for Linked Shipment
  handleShipmentResolutionStatusChange(event) {
    this.shipmentResolutionStatus =
      event.detail?.value || event.target?.value || "New";
    this.shipmentResolutionSuccessMessage = "";
    this.shipmentResolutionErrorMessage = "";
  }

  handleShipmentResolutionNotesChange(event) {
    this.shipmentResolutionNotes =
      event.detail?.value || event.target?.value || "";
    this.shipmentResolutionSuccessMessage = "";
    this.shipmentResolutionErrorMessage = "";
  }

  async handleSaveShipmentResolution() {
    if (!this.selectedShipmentId) return;

    this.isSavingShipmentResolution = true;
    this.shipmentResolutionSuccessMessage = "";
    this.shipmentResolutionErrorMessage = "";

    try {
      await updateShipmentResolution({
        shipmentId: this.selectedShipmentId,
        resolutionStatus: this.shipmentResolutionStatus,
        resolutionNotes: this.shipmentResolutionNotes
      });

      this.shipmentResolutionSuccessMessage =
        "Consignment operational resolution updated successfully.";
      if (this.wiredCasesResult) {
        await refreshApex(this.wiredCasesResult);
      }
    } catch (err) {
      this.shipmentResolutionErrorMessage = this.extractErrorMessage(err);
    } finally {
      this.isSavingShipmentResolution = false;
    }
  }

  // --- Customer Communication Handlers ---

  async handleDraftCustomerUpdate() {
    if (!this.selectedCaseId || !this.hasSelectedShipment) return;

    this.isDraftingCustomerUpdate = true;
    this.customerCommErrorMessage = "";

    try {
      const draft = await generateCustomerUpdate({
        caseId: this.selectedCaseId
      });

      this.customerUpdateSubject = draft?.subject || "";
      this.customerUpdateDraft = draft?.body || "";
      this.customerRecipientEmail = draft?.recipientEmail || "";
      this.customerRecipientName = draft?.recipientName || "";
      this.customerHasRecipientEmail = Boolean(draft?.hasRecipientEmail);
    } catch (err) {
      this.customerCommErrorMessage = this.extractErrorMessage(err);
    } finally {
      this.isDraftingCustomerUpdate = false;
    }
  }

  handleCustomerUpdateSubjectChange(event) {
    this.customerUpdateSubject =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
  }

  handleCustomerUpdateDraftChange(event) {
    this.customerUpdateDraft =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
  }

  handleClearCustomerDraft() {
    this.clearCustomerCommunicationDraft();
  }

  handleOpenInGmail() {
    if (this.isGmailDisabled) return;
    window.open(this.gmailComposeUrl, "_blank", "noopener,noreferrer");
  }

  clearCustomerCommunicationDraft() {
    this.customerUpdateSubject = "";
    this.customerUpdateDraft = "";
    this.customerRecipientEmail = "";
    this.customerRecipientName = "";
    this.customerHasRecipientEmail = false;
    this.customerCommErrorMessage = "";
  }

  // --- Helper Methods ---

  selectCase(caseObj) {
    this.selectedCaseId = caseObj.Id;
    this.syncEditForm(caseObj);
    this.syncShipmentResolutionForm(caseObj);
    this.clearCustomerCommunicationDraft();
    this.clearAlerts();
  }

  syncEditForm(caseObj) {
    this.editSubject = caseObj.Subject || "";
    this.editStatus = caseObj.Status || "New";
    this.editPriority = caseObj.Priority || "Medium";
    this.editDescription = caseObj.Description || "";
  }

  syncShipmentResolutionForm(caseObj) {
    const sh =
      caseObj && caseObj.Shipments__r && caseObj.Shipments__r.length > 0
        ? caseObj.Shipments__r[0]
        : null;
    this.shipmentResolutionStatus = sh?.Resolution_Status__c || "New";
    this.shipmentResolutionNotes = sh?.Resolution_Notes__c || "";
    this.shipmentResolutionSuccessMessage = "";
    this.shipmentResolutionErrorMessage = "";
  }

  clearAlerts() {
    this.saveSuccessMessage = "";
    this.saveErrorMessage = "";
  }

  formatCarrierName(carrier) {
    if (!carrier) return "Unknown";
    const c = carrier.trim();
    if (c.toLowerCase() === "shippo") return "Shippo";
    if (c.toLowerCase() === "usps") return "USPS";
    if (c.toLowerCase() === "fedex") return "FedEx";
    if (c.toLowerCase() === "ups") return "UPS";
    if (c.toLowerCase() === "dhl") return "DHL";
    return c.charAt(0).toUpperCase() + c.slice(1);
  }

  formatDateTime(isoString) {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return "—";
    }
  }

  getStatusBadgeClass(status) {
    switch ((status || "").toLowerCase()) {
      case "closed":
        return "badge-status badge-status-closed";
      case "working":
      case "in progress":
      case "pending":
        return "badge-status badge-status-working";
      case "escalated":
        return "badge-status badge-status-escalated";
      default:
        return "badge-status badge-status-new";
    }
  }

  getPriorityBadgeClass(priority) {
    switch ((priority || "").toLowerCase()) {
      case "high":
      case "critical":
        return "badge-priority badge-priority-high";
      case "medium":
        return "badge-priority badge-priority-medium";
      default:
        return "badge-priority badge-priority-low";
    }
  }

  getShipmentStatusBadgeClass(status) {
    switch ((status || "").toLowerCase()) {
      case "delivered":
        return "badge-status badge-status-closed";
      case "in_transit":
      case "out_for_delivery":
        return "badge-status badge-status-working";
      case "failure":
      case "return_to_sender":
        return "badge-status badge-status-escalated";
      default:
        return "badge-status badge-status-new";
    }
  }

  getRiskBadgeClass(risk) {
    switch ((risk || "").toLowerCase()) {
      case "on track":
        return "badge-risk badge-risk-on-track";
      case "at risk":
        return "badge-risk badge-risk-at-risk";
      case "delayed":
        return "badge-risk badge-risk-delayed";
      default:
        return "badge-risk badge-risk-neutral";
    }
  }

  getEventStatusBadgeClass(status) {
    switch ((status || "").toLowerCase()) {
      case "delivered":
        return "event-badge event-badge-delivered";
      case "transit":
      case "in_transit":
        return "event-badge event-badge-transit";
      case "failure":
        return "event-badge event-badge-failure";
      case "returned":
        return "event-badge event-badge-returned";
      default:
        return "event-badge event-badge-neutral";
    }
  }

  extractErrorMessage(error) {
    if (!error) return "An unexpected error occurred.";
    if (typeof error === "string") return error;
    if (error.body && error.body.message) return error.body.message;
    if (error.message) return error.message;
    return "Unable to complete Salesforce Case operation.";
  }
}
