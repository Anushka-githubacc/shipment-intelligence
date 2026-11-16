import { LightningElement, api, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { refreshApex } from "@salesforce/apex";
import getShipments from "@salesforce/apex/ShipmentController.getShipments";
import getShipmentDetail from "@salesforce/apex/ShipmentController.getShipmentDetail";
import getShipmentEvents from "@salesforce/apex/ShipmentController.getShipmentEvents";
import refreshShipment from "@salesforce/apex/ShipmentController.refreshShipment";

const STATUS_LABELS = {
  pre_transit: "Pre-Transit",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  return_to_sender: "Returned",
  failure: "Failed",
  unknown: "Unknown"
};

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "All" },
  { label: "Pre-Transit", value: "pre_transit" },
  { label: "In Transit", value: "in_transit" },
  { label: "Out for Delivery", value: "out_for_delivery" },
  { label: "Delivered", value: "delivered" },
  { label: "Returned", value: "return_to_sender" },
  { label: "Failed", value: "failure" },
  { label: "Unknown", value: "unknown" }
];

const RISK_OPTIONS = [
  { label: "All Risk Levels", value: "All" },
  { label: "On Track", value: "On Track" },
  { label: "At Risk", value: "At Risk" },
  { label: "Delayed", value: "Delayed" }
];

export default class ShipmentIntelligence extends LightningElement {
  searchTerm = "";
  appliedSearchTerm = "";
  statusFilter = "All";
  riskFilter = "All";
  selectedShipmentId = null;

  isLoadingList = true;
  isLoadingDetail = false;
  isLoadingEvents = false;
  isRefreshing = false;

  listError = null;
  rawShipments = [];
  selectedShipment = null;
  rawEvents = [];

  wiredShipmentsResult;
  wiredDetailResult;
  wiredEventsResult;

  searchDebounceTimer;

  statusOptions = STATUS_OPTIONS;
  riskOptions = RISK_OPTIONS;

  @api
  get externalSearchTerm() {
    return this.searchTerm;
  }

  set externalSearchTerm(value) {
    const term = value || "";
    this.searchTerm = term;
    this.clearDebounceTimer();
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.searchDebounceTimer = setTimeout(() => {
      this.appliedSearchTerm = term;
    }, 300);
  }

  @api
  async handleRefresh() {
    await this.refreshAll();
  }

  disconnectedCallback() {
    this.clearDebounceTimer();
  }

  clearDebounceTimer() {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  // Wire: Shipments List
  @wire(getShipments, {
    searchTerm: "$appliedSearchTerm",
    statusFilter: "$statusFilter",
    riskFilter: "$riskFilter"
  })
  wiredGetShipments(result) {
    this.wiredShipmentsResult = result;
    const { data, error } = result;

    this.isLoadingList = false;

    if (data) {
      this.rawShipments = data;
      this.listError = null;

      // Auto-select first shipment if current selection is invalid
      if (this.rawShipments.length > 0) {
        const currentStillExists = this.rawShipments.some(
          (s) => s.Id === this.selectedShipmentId
        );
        if (!currentStillExists) {
          this.selectedShipmentId = this.rawShipments[0].Id;
        }
      } else {
        this.selectedShipmentId = null;
        this.selectedShipment = null;
        this.rawEvents = [];
      }
    } else if (error) {
      this.rawShipments = [];
      this.listError = this.extractErrorMessage(error);
      this.selectedShipmentId = null;
      this.selectedShipment = null;
      this.rawEvents = [];
    }
  }

  // Wire: Selected Shipment Detail
  @wire(getShipmentDetail, { shipmentId: "$selectedShipmentId" })
  wiredGetShipmentDetail(result) {
    this.wiredDetailResult = result;
    const { data, error } = result;

    this.isLoadingDetail = false;

    if (data) {
      this.selectedShipment = data;
    } else if (error) {
      this.selectedShipment = null;
    }
  }

  // Wire: Selected Shipment Events
  @wire(getShipmentEvents, { shipmentId: "$selectedShipmentId" })
  wiredGetShipmentEvents(result) {
    this.wiredEventsResult = result;
    const { data, error } = result;

    this.isLoadingEvents = false;

    if (data) {
      this.rawEvents = data;
    } else if (error) {
      this.rawEvents = [];
    }
  }

  // Handlers
  handleSearchChange(event) {
    const val = event.target.value;
    this.searchTerm = val;
    this.clearDebounceTimer();
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.searchDebounceTimer = setTimeout(() => {
      this.appliedSearchTerm = val;
      this.isLoadingList = true;
    }, 300);
  }

  handleStatusChange(event) {
    this.statusFilter = event.detail.value;
    this.isLoadingList = true;
  }

  handleRiskChange(event) {
    this.riskFilter = event.detail.value;
    this.isLoadingList = true;
  }

  handleSelectShipment(event) {
    const id = event.currentTarget.dataset.id;
    if (id && id !== this.selectedShipmentId) {
      this.selectedShipmentId = id;
      this.isLoadingDetail = true;
      this.isLoadingEvents = true;
    }
  }

  async handleRefreshCurrent() {
    if (!this.selectedShipmentId) {
      return;
    }

    this.isRefreshing = true;

    try {
      await refreshShipment({ shipmentId: this.selectedShipmentId });
      await this.refreshAll();
      this.showToast(
        "Success",
        "Shipment tracking refreshed successfully.",
        "success"
      );
    } catch (error) {
      this.showToast(
        "Refresh Failed",
        this.extractErrorMessage(error),
        "error"
      );
    } finally {
      this.isRefreshing = false;
    }
  }

  async refreshAll() {
    const promises = [];
    if (this.wiredShipmentsResult) {
      promises.push(refreshApex(this.wiredShipmentsResult));
    }
    if (this.wiredDetailResult) {
      promises.push(refreshApex(this.wiredDetailResult));
    }
    if (this.wiredEventsResult) {
      promises.push(refreshApex(this.wiredEventsResult));
    }
    await Promise.all(promises);
  }

  // Computed: Explorer Shipments
  get shipmentsCount() {
    return this.rawShipments ? this.rawShipments.length : 0;
  }

  get hasListError() {
    return Boolean(this.listError);
  }

  get hasNoShipments() {
    return (
      !this.isLoadingList &&
      (!this.rawShipments || this.rawShipments.length === 0)
    );
  }

  get formattedShipments() {
    return (this.rawShipments || []).map((s) => {
      const isSelected = s.Id === this.selectedShipmentId;
      return {
        ...s,
        statusLabel: STATUS_LABELS[s.Status__c] || s.Status__c || "Unknown",
        statusClass: this.computeStatusBadgeClass(s.Status__c),
        riskClass: this.computeRiskBadgeClass(s.Risk_Level__c),
        cardClass: `shipment-card ${isSelected ? "active-card" : ""}`,
        formattedEta: this.formatDate(s.Estimated_Delivery_Date__c),
        hasCase: Boolean(s.Case__c && s.Case__r && s.Case__r.CaseNumber),
        caseNumber: s.Case__r ? s.Case__r.CaseNumber : null
      };
    });
  }

  // Computed: Selected Shipment Detail
  get selectedShipmentRiskClass() {
    return this.selectedShipment
      ? this.computeRiskBadgeClass(this.selectedShipment.Risk_Level__c)
      : "";
  }

  get selectedShipmentStatusClass() {
    return this.selectedShipment
      ? this.computeStatusBadgeClass(this.selectedShipment.Status__c)
      : "";
  }

  get selectedShipmentStatusLabel() {
    if (!this.selectedShipment) return "";
    const st = this.selectedShipment.Status__c;
    return STATUS_LABELS[st] || st || "Unknown";
  }

  get detailActualDelivery() {
    return this.selectedShipment?.Actual_Delivery_Date__c
      ? this.formatDateTime(this.selectedShipment.Actual_Delivery_Date__c)
      : "Not recorded";
  }

  get detailEstimatedDelivery() {
    return this.selectedShipment
      ? this.formatDate(this.selectedShipment.Estimated_Delivery_Date__c)
      : "—";
  }

  get detailLastSynced() {
    return this.selectedShipment
      ? this.formatDateTime(this.selectedShipment.Last_Synced__c)
      : "—";
  }

  get riskReasonExplanation() {
    if (!this.selectedShipment) return "";
    return (
      this.selectedShipment.Risk_Reason__c ||
      "No specific risk factors detected."
    );
  }

  // Computed: Exception State
  get isExceptionStatus() {
    if (!this.selectedShipment) return false;
    const st = this.selectedShipment.Status__c;
    return st === "return_to_sender" || st === "failure" || st === "unknown";
  }

  get exceptionTitle() {
    if (!this.selectedShipment) return "";
    const st = this.selectedShipment.Status__c;
    if (st === "return_to_sender") return "Exception: Return to Sender";
    if (st === "failure") return "Exception: Delivery Failure";
    return "Status Alert: Unknown Transit State";
  }

  get exceptionDescription() {
    if (!this.selectedShipment) return "";
    const st = this.selectedShipment.Status__c;
    if (st === "return_to_sender") {
      return "The carrier has marked this shipment for return to the sender. Delivery has been aborted.";
    }
    if (st === "failure") {
      return "A critical exception or failed delivery attempt occurred during transit. Immediate attention required.";
    }
    return "Tracking information is unverified or currently unavailable from the integration provider.";
  }

  get exceptionIcon() {
    return this.selectedShipment?.Status__c === "unknown"
      ? "utility:warning"
      : "utility:error";
  }

  get exceptionVariant() {
    return this.selectedShipment?.Status__c === "unknown" ? "warning" : "error";
  }

  get exceptionBannerClass() {
    return this.selectedShipment?.Status__c === "unknown"
      ? "exception-banner banner-warning"
      : "exception-banner banner-danger";
  }

  // Computed: Journey Stepper
  get journeySteps() {
    const st = this.selectedShipment?.Status__c;
    const isDelivered = st === "delivered";
    const isOutForDelivery = st === "out_for_delivery";
    const isInTransit = st === "in_transit";
    const isPreTransit = st === "pre_transit";
    const isReturnedOrFailed = st === "return_to_sender" || st === "failure";

    return [
      {
        index: 1,
        label: "Booked / Pre-Transit",
        isCompleted:
          isInTransit || isOutForDelivery || isDelivered || isReturnedOrFailed,
        isActive: isPreTransit,
        stateLabel: isPreTransit
          ? "Current"
          : isInTransit || isOutForDelivery || isDelivered || isReturnedOrFailed
            ? "Completed"
            : "Pending",
        hasConnector: true,
        wrapperClass: `step-item ${isPreTransit ? "step-active" : ""} ${isInTransit || isOutForDelivery || isDelivered || isReturnedOrFailed ? "step-completed" : ""}`,
        connectorClass: `step-connector ${isInTransit || isOutForDelivery || isDelivered || isReturnedOrFailed ? "connector-filled" : ""}`
      },
      {
        index: 2,
        label: "In Transit",
        isCompleted: isOutForDelivery || isDelivered,
        isActive: isInTransit || isReturnedOrFailed,
        stateLabel: isInTransit
          ? "Current"
          : isOutForDelivery || isDelivered
            ? "Completed"
            : isReturnedOrFailed
              ? "Exception"
              : "Pending",
        hasConnector: true,
        wrapperClass: `step-item ${isInTransit ? "step-active" : ""} ${isOutForDelivery || isDelivered ? "step-completed" : ""} ${isReturnedOrFailed ? "step-exception" : ""}`,
        connectorClass: `step-connector ${isOutForDelivery || isDelivered ? "connector-filled" : ""}`
      },
      {
        index: 3,
        label: "Out for Delivery",
        isCompleted: isDelivered,
        isActive: isOutForDelivery,
        stateLabel: isOutForDelivery
          ? "Current"
          : isDelivered
            ? "Completed"
            : "Pending",
        hasConnector: true,
        wrapperClass: `step-item ${isOutForDelivery ? "step-active" : ""} ${isDelivered ? "step-completed" : ""}`,
        connectorClass: `step-connector ${isDelivered ? "connector-filled" : ""}`
      },
      {
        index: 4,
        label: "Delivered",
        isCompleted: isDelivered,
        isActive: false,
        stateLabel: isDelivered ? "Delivered" : "Pending",
        hasConnector: false,
        wrapperClass: `step-item ${isDelivered ? "step-completed step-final" : ""}`,
        connectorClass: ""
      }
    ];
  }

  // Computed: Linked Case
  get hasLinkedCase() {
    return Boolean(this.selectedShipment && this.selectedShipment.Case__c);
  }

  get linkedCaseNumber() {
    return this.selectedShipment?.Case__r?.CaseNumber || "—";
  }

  get linkedCaseSubject() {
    return this.selectedShipment?.Case__r?.Subject || "No subject";
  }

  get linkedCaseStatus() {
    return this.selectedShipment?.Case__r?.Status || "Unknown";
  }

  get linkedCasePriority() {
    return this.selectedShipment?.Case__r?.Priority || "Normal";
  }

  get caseUrl() {
    return this.selectedShipment?.Case__c
      ? `/lightning/r/Case/${this.selectedShipment.Case__c}/view`
      : "#";
  }

  // Computed: Milestone Events
  get eventsCount() {
    return this.rawEvents ? this.rawEvents.length : 0;
  }

  get hasEvents() {
    return !this.isLoadingEvents && this.rawEvents && this.rawEvents.length > 0;
  }

  get formattedEvents() {
    return (this.rawEvents || []).map((evt) => {
      const rawStatus = evt.Event_Status__c;
      const statusLabel = STATUS_LABELS[rawStatus] || rawStatus || "Milestone";
      return {
        ...evt,
        statusLabel,
        statusClass: this.computeStatusBadgeClass(rawStatus),
        formattedDate: this.formatDateTime(
          evt.Event_Date__c || evt.CreatedDate
        ),
        description:
          evt.Event_Description__c || "No detailed description provided.",
        location: evt.Event_Location__c,
        hasLocation: Boolean(evt.Event_Location__c)
      };
    });
  }

  // Helpers
  computeStatusBadgeClass(status) {
    if (!status) return "status-pill status-unknown";
    const s = status.toLowerCase();
    if (s === "delivered") return "status-pill status-delivered";
    if (s === "in_transit") return "status-pill status-transit";
    if (s === "out_for_delivery") return "status-pill status-out";
    if (s === "pre_transit") return "status-pill status-pre";
    if (s === "return_to_sender" || s === "failure")
      return "status-pill status-failure";
    return "status-pill status-unknown";
  }

  computeRiskBadgeClass(riskLevel) {
    if (!riskLevel) return "risk-badge risk-neutral";
    const r = riskLevel.toLowerCase();
    if (r.includes("track") || r.includes("low"))
      return "risk-badge risk-on-track";
    if (r.includes("risk") || r.includes("medium"))
      return "risk-badge risk-at-risk";
    if (r.includes("delay") || r.includes("high"))
      return "risk-badge risk-delayed";
    return "risk-badge risk-neutral";
  }

  formatDate(dateVal) {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
    } catch {
      return "—";
    }
  }

  formatDateTime(dateVal) {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? "—" : d.toLocaleString();
    } catch {
      return "—";
    }
  }

  extractErrorMessage(error) {
    if (!error) return "An unexpected error occurred.";
    if (typeof error === "string") return error;
    if (error.body && error.body.message) return error.body.message;
    if (error.message) return error.message;
    return JSON.stringify(error);
  }

  showToast(title, message, variant) {
    this.dispatchEvent(
      new ShowToastEvent({
        title,
        message,
        variant
      })
    );
  }
}
