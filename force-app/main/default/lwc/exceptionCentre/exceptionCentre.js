import { LightningElement, wire, api } from "lwc";
import { refreshApex } from "@salesforce/apex";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getShipments from "@salesforce/apex/ShipmentController.getShipments";
import getShipmentDetail from "@salesforce/apex/ShipmentController.getShipmentDetail";
import getShipmentEvents from "@salesforce/apex/ShipmentController.getShipmentEvents";
import refreshShipment from "@salesforce/apex/ShipmentController.refreshShipment";
import updateShipmentResolution from "@salesforce/apex/ShipmentController.updateShipmentResolution";
import createCaseForShipment from "@salesforce/apex/ShipmentController.createCaseForShipment";
import linkCaseToShipment from "@salesforce/apex/ShipmentController.linkCaseToShipment";
import getAvailableCases from "@salesforce/apex/ShipmentController.getAvailableCases";

const STATUS_LABELS = {
  pre_transit: "Pre-Transit",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  return_to_sender: "Returned",
  failure: "Failed",
  unknown: "Unknown"
};

const CATEGORY_DEFINITIONS = {
  failure: {
    label: "Delivery Failure",
    badgeClass: "cat-pill cat-critical",
    boxClass: "panel-risk-block block-critical",
    natureIcon: "utility:error",
    natureText: "Actual carrier-reported delivery failure exception."
  },
  return_to_sender: {
    label: "Return to Sender",
    badgeClass: "cat-pill cat-return",
    boxClass: "panel-risk-block block-return",
    natureIcon: "utility:undo",
    natureText: "Actual carrier-reported shipment return to origin."
  },
  delayed: {
    label: "SLA Overdue",
    badgeClass: "cat-pill cat-delayed",
    boxClass: "panel-risk-block block-delayed",
    natureIcon: "utility:clock",
    natureText: "Rule-based evaluation: Estimated delivery date SLA breached."
  },
  at_risk: {
    label: "Transit Warning",
    badgeClass: "cat-pill cat-warning",
    boxClass: "panel-risk-block block-warning",
    natureIcon: "utility:warning",
    natureText: "Rule-based evaluation: Approaching SLA delivery threshold."
  },
  unknown: {
    label: "Unknown State",
    badgeClass: "cat-pill cat-unknown",
    boxClass: "panel-risk-block block-unknown",
    natureIcon: "utility:help",
    natureText: "Telemetry warning: Carrier tracking status unverified."
  }
};

const CATEGORY_OPTIONS = [
  { label: "All Exceptions", value: "All" },
  { label: "Delivery Failures", value: "failure" },
  { label: "Return to Sender", value: "return_to_sender" },
  { label: "SLA Delays", value: "delayed" },
  { label: "Transit Warnings (At Risk)", value: "at_risk" },
  { label: "Unknown Tracking States", value: "unknown" }
];

const RESOLUTION_OPTIONS = [
  { label: "All Resolutions", value: "All" },
  { label: "New", value: "New" },
  { label: "Investigating", value: "Investigating" },
  { label: "Escalated", value: "Escalated" },
  { label: "Action Required", value: "Action Required" },
  { label: "Resolved", value: "Resolved" },
  { label: "Dismissed", value: "Dismissed" }
];

const RESOLUTION_FORM_OPTIONS = [
  { label: "New", value: "New" },
  { label: "Investigating", value: "Investigating" },
  { label: "Escalated", value: "Escalated" },
  { label: "Action Required", value: "Action Required" },
  { label: "Resolved", value: "Resolved" },
  { label: "Dismissed", value: "Dismissed" }
];

const PRIORITY_OPTIONS = [
  { label: "High", value: "High" },
  { label: "Medium", value: "Medium" },
  { label: "Low", value: "Low" }
];

const ORIGIN_OPTIONS = [
  { label: "Logistics Operations", value: "Logistics Operations" },
  { label: "Phone", value: "Phone" },
  { label: "Email", value: "Email" },
  { label: "Web", value: "Web" }
];

export default class ExceptionCentre extends LightningElement {
  searchTerm = "";
  appliedSearchTerm = "";
  categoryFilter = "All";
  carrierFilter = "All";
  resolutionFilter = "All";

  selectedShipmentId = null;
  selectedShipment = null;
  rawEvents = [];

  isLoading = true;
  isLoadingEvents = false;
  isRefreshing = false;
  isRefreshingShipment = false;
  errorMessage = null;

  allShipments = [];

  // Resolution Form State
  editResolutionStatus = "New";
  editResolutionNotes = "";
  isSavingResolution = false;
  resolutionSuccessMessage = "";
  resolutionErrorMessage = "";

  // Create Case Modal State
  showCreateCaseModal = false;
  newCaseSubject = "";
  newCasePriority = "High";
  newCaseOrigin = "Logistics Operations";
  newCaseDescription = "";
  isCreatingCase = false;
  createCaseError = "";

  // Link Case Modal State
  showLinkCaseModal = false;
  selectedCaseToLink = "";
  availableCases = [];
  isLoadingAvailableCases = false;
  isLinkingCase = false;
  linkCaseError = "";

  wiredShipmentsResult;
  wiredDetailResult;
  wiredEventsResult;

  searchDebounceTimer = null;

  categoryOptions = CATEGORY_OPTIONS;
  resolutionOptions = RESOLUTION_OPTIONS;
  resolutionFormOptions = RESOLUTION_FORM_OPTIONS;
  priorityOptions = PRIORITY_OPTIONS;
  originOptions = ORIGIN_OPTIONS;

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
    this.isRefreshing = true;
    try {
      await this.refreshAllData();
    } finally {
      this.isRefreshing = false;
    }
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

  // Wire: All Shipments from Apex
  @wire(getShipments, {
    searchTerm: null,
    statusFilter: null,
    riskFilter: null
  })
  wiredShipments(result) {
    this.wiredShipmentsResult = result;
    const { data, error } = result;
    this.isLoading = false;

    if (data) {
      this.allShipments = data;
      this.errorMessage = null;

      // Retain selection if selected shipment still exists
      if (this.selectedShipmentId) {
        const stillExists = this.allShipments.find(
          (s) => s.Id === this.selectedShipmentId
        );
        if (!stillExists) {
          this.selectedShipmentId = null;
          this.selectedShipment = null;
          this.rawEvents = [];
        }
      }
    } else if (error) {
      this.allShipments = [];
      this.errorMessage = this.extractErrorMessage(error);
    }
  }

  // Wire: Selected Shipment Detail (including linked Case fields)
  @wire(getShipmentDetail, { shipmentId: "$selectedShipmentId" })
  wiredShipmentDetail(result) {
    this.wiredDetailResult = result;
    const { data, error } = result;

    if (data) {
      this.selectedShipment = data;
      this.syncResolutionForm(data);
    } else if (error) {
      this.selectedShipment =
        this.allShipments.find((s) => s.Id === this.selectedShipmentId) || null;
      if (this.selectedShipment) {
        this.syncResolutionForm(this.selectedShipment);
      }
    }
  }

  // Wire: Selected Shipment Events Timeline
  @wire(getShipmentEvents, { shipmentId: "$selectedShipmentId" })
  wiredShipmentEvents(result) {
    this.wiredEventsResult = result;
    const { data, error } = result;
    this.isLoadingEvents = false;

    if (data) {
      this.rawEvents = data;
    } else if (error) {
      this.rawEvents = [];
    }
  }

  syncResolutionForm(shipment) {
    if (!shipment) return;
    this.editResolutionStatus = shipment.Resolution_Status__c || "New";
    this.editResolutionNotes = shipment.Resolution_Notes__c || "";
    this.resolutionSuccessMessage = "";
    this.resolutionErrorMessage = "";
  }

  // Handlers
  handleSearchChange(event) {
    const val = event.target.value;
    this.searchTerm = val;
    this.clearDebounceTimer();
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.searchDebounceTimer = setTimeout(() => {
      this.appliedSearchTerm = val;
    }, 300);
  }

  handleCategoryChange(event) {
    this.categoryFilter = event.detail.value;
  }

  handleCarrierChange(event) {
    this.carrierFilter = event.detail.value;
  }

  handleResolutionFilterChange(event) {
    this.resolutionFilter = event.detail.value;
  }

  handleQuickCategoryFilter(event) {
    const cat = event.currentTarget.dataset.category;
    if (cat) {
      this.categoryFilter = cat;
    }
  }

  handleClearFilters() {
    this.searchTerm = "";
    this.appliedSearchTerm = "";
    this.categoryFilter = "All";
    this.carrierFilter = "All";
    this.resolutionFilter = "All";
  }

  handleRowClick(event) {
    const id = event.currentTarget.dataset.id;
    if (id) {
      this.selectedShipmentId = id;
      this.isLoadingEvents = true;
    }
  }

  handleInspectClick(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (id) {
      this.selectedShipmentId = id;
      this.isLoadingEvents = true;
    }
  }

  handleCloseDetail() {
    this.selectedShipmentId = null;
    this.selectedShipment = null;
    this.rawEvents = [];
  }

  handleResolutionStatusChange(event) {
    this.editResolutionStatus = event.detail.value;
    this.resolutionSuccessMessage = "";
    this.resolutionErrorMessage = "";
  }

  handleResolutionNotesChange(event) {
    this.editResolutionNotes =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
    this.resolutionSuccessMessage = "";
    this.resolutionErrorMessage = "";
  }

  handleApplyRecommendation() {
    if (!this.recommendedAction) return;
    this.editResolutionStatus = this.recommendedAction.suggestedStatus;
    if (!this.editResolutionNotes || this.editResolutionNotes.trim() === "") {
      this.editResolutionNotes = `[${this.recommendedAction.title}] ${this.recommendedAction.guidance}`;
    }
    this.resolutionSuccessMessage = `Applied recommendation: Set status to "${this.recommendedAction.suggestedStatus}". Click Save to persist.`;
  }

  async handleSaveResolution() {
    if (!this.selectedShipmentId) return;

    this.isSavingResolution = true;
    this.resolutionSuccessMessage = "";
    this.resolutionErrorMessage = "";

    try {
      const updated = await updateShipmentResolution({
        shipmentId: this.selectedShipmentId,
        resolutionStatus: this.editResolutionStatus,
        resolutionNotes: this.editResolutionNotes
      });

      this.selectedShipment = updated;
      this.syncResolutionForm(updated);
      this.resolutionSuccessMessage =
        "Operational resolution updated successfully.";
      this.showToast("Success", "Resolution saved successfully.", "success");
      await this.refreshAllData();
    } catch (error) {
      this.resolutionErrorMessage = this.extractErrorMessage(error);
      this.showToast("Save Failed", this.resolutionErrorMessage, "error");
    } finally {
      this.isSavingResolution = false;
    }
  }

  handleCancelResolutionEdit() {
    if (this.selectedShipment) {
      this.syncResolutionForm(this.selectedShipment);
    }
  }

  handleOpenCreateCase() {
    if (!this.selectedShipment) return;
    const carrier = (this.selectedShipment.Carrier__c || "").toUpperCase();
    const code = this.selectedShipment.Tracking_Code__c || "";
    const cat = this.selectedCategoryLabel || "Exception";
    const reason = this.selectedShipment.Risk_Reason__c || "N/A";
    const status =
      STATUS_LABELS[this.selectedShipment.Status__c] ||
      this.selectedShipment.Status__c ||
      "Unknown";
    const risk = this.selectedShipment.Risk_Level__c || "Unknown";

    this.newCaseSubject = `[Exception] ${carrier} ${code} - ${cat}`;
    this.newCasePriority =
      this.selectedCategory === "failure" ||
      this.selectedCategory === "delayed" ||
      this.selectedCategory === "return_to_sender"
        ? "High"
        : "Medium";
    this.newCaseOrigin = "Logistics Operations";
    this.newCaseDescription = `Operational exception triage for consignment ${code} via ${carrier}.\nStatus: ${status}\nRisk Level: ${risk}\nStated Reason: ${reason}`;
    this.createCaseError = "";
    this.showCreateCaseModal = true;
  }

  handleCloseCreateCase() {
    this.showCreateCaseModal = false;
    this.createCaseError = "";
  }

  handleNewCaseSubjectChange(event) {
    this.newCaseSubject =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
  }

  handleNewCasePriorityChange(event) {
    this.newCasePriority = event.detail.value;
  }

  handleNewCaseOriginChange(event) {
    this.newCaseOrigin = event.detail.value;
  }

  handleNewCaseDescriptionChange(event) {
    this.newCaseDescription =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
  }

  async handleSaveCreateCase() {
    if (!this.newCaseSubject || this.newCaseSubject.trim() === "") {
      this.createCaseError = "Case Subject is required.";
      return;
    }

    this.isCreatingCase = true;
    this.createCaseError = "";

    try {
      await createCaseForShipment({
        shipmentId: this.selectedShipmentId,
        subject: this.newCaseSubject,
        priority: this.newCasePriority,
        origin: this.newCaseOrigin,
        description: this.newCaseDescription
      });

      this.showToast(
        "Success",
        "Support Case created and linked to exception.",
        "success"
      );
      this.showCreateCaseModal = false;
      await this.refreshAllData();
    } catch (error) {
      this.createCaseError = this.extractErrorMessage(error);
    } finally {
      this.isCreatingCase = false;
    }
  }

  async handleOpenLinkCase() {
    this.showLinkCaseModal = true;
    this.linkCaseError = "";
    this.selectedCaseToLink = "";
    this.isLoadingAvailableCases = true;

    try {
      const cases = await getAvailableCases();
      this.availableCases = (cases || []).map((c) => ({
        label: `#${c.CaseNumber} - ${c.Subject} (${c.Status})`,
        value: c.Id
      }));
      if (this.availableCases.length > 0) {
        this.selectedCaseToLink = this.availableCases[0].value;
      }
    } catch (error) {
      this.linkCaseError = this.extractErrorMessage(error);
      this.availableCases = [];
    } finally {
      this.isLoadingAvailableCases = false;
    }
  }

  handleCloseLinkCase() {
    this.showLinkCaseModal = false;
    this.linkCaseError = "";
  }

  handleSelectCaseToLink(event) {
    this.selectedCaseToLink = event.detail.value;
  }

  async handleSaveLinkCase() {
    if (!this.selectedCaseToLink) {
      this.linkCaseError = "Please select a Case to link.";
      return;
    }

    this.isLinkingCase = true;
    this.linkCaseError = "";

    try {
      await linkCaseToShipment({
        shipmentId: this.selectedShipmentId,
        caseId: this.selectedCaseToLink
      });

      this.showToast(
        "Success",
        "Support Case linked to exception successfully.",
        "success"
      );
      this.showLinkCaseModal = false;
      await this.refreshAllData();
    } catch (error) {
      this.linkCaseError = this.extractErrorMessage(error);
    } finally {
      this.isLinkingCase = false;
    }
  }

  async handleRefreshCurrentShipment() {
    if (!this.selectedShipmentId) return;

    this.isRefreshingShipment = true;
    try {
      await refreshShipment({ shipmentId: this.selectedShipmentId });
      await this.refreshAllData();
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
      this.isRefreshingShipment = false;
    }
  }

  async refreshAllData() {
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

  // Helper: Determine exception category for a shipment
  getExceptionCategory(shipment) {
    const status = (shipment.Status__c || "").toLowerCase();
    const risk = (shipment.Risk_Level__c || "").toLowerCase();

    if (status === "failure") return "failure";
    if (status === "return_to_sender") return "return_to_sender";
    if (risk.includes("delay")) return "delayed";
    if (risk.includes("risk")) return "at_risk";
    if (status === "unknown") return "unknown";
    return null;
  }

  // Computed: All Exceptions in Dataset
  get allExceptions() {
    return (this.allShipments || [])
      .map((s) => {
        const category = this.getExceptionCategory(s);
        if (!category) return null;
        const def = CATEGORY_DEFINITIONS[category] || {};
        const resStatus = s.Resolution_Status__c || "New";
        return {
          ...s,
          exceptionCategory: category,
          categoryLabel: def.label || "Exception",
          categoryBadgeClass: def.badgeClass || "cat-pill",
          statusLabel: STATUS_LABELS[s.Status__c] || s.Status__c || "Unknown",
          statusClass: this.computeStatusBadgeClass(s.Status__c),
          riskClass: this.computeRiskBadgeClass(s.Risk_Level__c),
          resolutionStatus: resStatus,
          resolutionBadgeClass: this.computeResolutionBadgeClass(resStatus),
          formattedEta: this.formatDate(s.Estimated_Delivery_Date__c),
          formattedActualDelivery: this.formatDate(s.Actual_Delivery_Date__c),
          rowClass: s.Id === this.selectedShipmentId ? "row-selected" : ""
        };
      })
      .filter(Boolean);
  }

  // Computed: KPI counts
  get totalExceptionsCount() {
    return this.allExceptions.length;
  }

  get failureCount() {
    return this.allExceptions.filter((e) => e.exceptionCategory === "failure")
      .length;
  }

  get returnCount() {
    return this.allExceptions.filter(
      (e) => e.exceptionCategory === "return_to_sender"
    ).length;
  }

  get delayedCount() {
    return this.allExceptions.filter((e) => e.exceptionCategory === "delayed")
      .length;
  }

  get atRiskCount() {
    return this.allExceptions.filter((e) => e.exceptionCategory === "at_risk")
      .length;
  }

  get unknownCount() {
    return this.allExceptions.filter((e) => e.exceptionCategory === "unknown")
      .length;
  }

  get hasUnknownExceptions() {
    return this.unknownCount > 0;
  }

  // Computed: Distribution bar widths and titles
  get failureBarStyle() {
    const pct =
      this.totalExceptionsCount > 0
        ? (this.failureCount / this.totalExceptionsCount) * 100
        : 0;
    return `width: ${pct}%;`;
  }

  get failureBarTitle() {
    return `Delivery Failures: ${this.failureCount}`;
  }

  get returnBarStyle() {
    const pct =
      this.totalExceptionsCount > 0
        ? (this.returnCount / this.totalExceptionsCount) * 100
        : 0;
    return `width: ${pct}%;`;
  }

  get returnBarTitle() {
    return `Returns: ${this.returnCount}`;
  }

  get delayBarStyle() {
    const pct =
      this.totalExceptionsCount > 0
        ? (this.delayedCount / this.totalExceptionsCount) * 100
        : 0;
    return `width: ${pct}%;`;
  }

  get delayBarTitle() {
    return `SLA Delays: ${this.delayedCount}`;
  }

  get warningBarStyle() {
    const pct =
      this.totalExceptionsCount > 0
        ? (this.atRiskCount / this.totalExceptionsCount) * 100
        : 0;
    return `width: ${pct}%;`;
  }

  get warningBarTitle() {
    return `At Risk Warnings: ${this.atRiskCount}`;
  }

  get unknownBarStyle() {
    const pct =
      this.totalExceptionsCount > 0
        ? (this.unknownCount / this.totalExceptionsCount) * 100
        : 0;
    return `width: ${pct}%;`;
  }

  get unknownBarTitle() {
    return `Unknown States: ${this.unknownCount}`;
  }

  // Computed: Dynamic Carrier Filter Options
  get carrierOptions() {
    const carriers = new Set();
    this.allExceptions.forEach((e) => {
      if (e.Carrier__c) {
        carriers.add(e.Carrier__c.trim());
      }
    });
    const opts = [{ label: "All Carriers", value: "All" }];
    Array.from(carriers)
      .sort()
      .forEach((c) => {
        opts.push({ label: c.toUpperCase(), value: c });
      });
    return opts;
  }

  // Computed: Filtered Shipments
  get filteredShipments() {
    const term = (this.appliedSearchTerm || "").trim().toLowerCase();
    const catFilter = this.categoryFilter;
    const carFilter = this.carrierFilter.toLowerCase();
    const resFilter = this.resolutionFilter;

    return this.allExceptions.filter((item) => {
      // Category check
      if (catFilter !== "All" && item.exceptionCategory !== catFilter) {
        return false;
      }

      // Carrier check
      if (
        carFilter !== "all" &&
        (item.Carrier__c || "").toLowerCase() !== carFilter
      ) {
        return false;
      }

      // Resolution check
      if (resFilter !== "All" && item.resolutionStatus !== resFilter) {
        return false;
      }

      // Search query check
      if (term) {
        const matchCode = (item.Tracking_Code__c || "")
          .toLowerCase()
          .includes(term);
        const matchName = (item.Name || "").toLowerCase().includes(term);
        const matchCarrier = (item.Carrier__c || "")
          .toLowerCase()
          .includes(term);
        const matchReason = (item.Risk_Reason__c || "")
          .toLowerCase()
          .includes(term);
        const matchRes = (item.resolutionStatus || "")
          .toLowerCase()
          .includes(term);
        const matchNotes = (item.Resolution_Notes__c || "")
          .toLowerCase()
          .includes(term);
        const matchCase = (item.Case__r?.CaseNumber || "")
          .toLowerCase()
          .includes(term);
        if (
          !matchCode &&
          !matchName &&
          !matchCarrier &&
          !matchReason &&
          !matchRes &&
          !matchNotes &&
          !matchCase
        ) {
          return false;
        }
      }

      return true;
    });
  }

  get filteredCount() {
    return this.filteredShipments.length;
  }

  get hasActiveFilters() {
    return (
      Boolean(this.searchTerm && this.searchTerm.trim() !== "") ||
      this.categoryFilter !== "All" ||
      this.carrierFilter !== "All" ||
      this.resolutionFilter !== "All"
    );
  }

  get mainLayoutClass() {
    return this.selectedShipment ? "main-layout has-inspection" : "main-layout";
  }

  get hasError() {
    return Boolean(this.errorMessage);
  }

  get isAllClear() {
    return !this.isLoading && this.totalExceptionsCount === 0;
  }

  get hasNoFilterMatches() {
    return (
      !this.isLoading &&
      this.totalExceptionsCount > 0 &&
      this.filteredCount === 0
    );
  }

  // Computed: Selected Shipment Detail
  get selectedCategory() {
    return this.selectedShipment
      ? this.getExceptionCategory(this.selectedShipment)
      : null;
  }

  get selectedCategoryDef() {
    return this.selectedCategory
      ? CATEGORY_DEFINITIONS[this.selectedCategory] || {}
      : {};
  }

  get selectedCategoryLabel() {
    return this.selectedCategoryDef.label || "Exception";
  }

  get selectedCategoryBadgeClass() {
    return this.selectedCategoryDef.badgeClass || "cat-pill";
  }

  get selectedExceptionBoxClass() {
    return this.selectedCategoryDef.boxClass || "panel-risk-block";
  }

  get selectedNatureIcon() {
    return this.selectedCategoryDef.natureIcon || "utility:info_alt";
  }

  get selectedNatureText() {
    return this.selectedCategoryDef.natureText || "Exception detected.";
  }

  get selectedShipmentReason() {
    return (
      this.selectedShipment?.Risk_Reason__c ||
      "No specific exception reason provided."
    );
  }

  get selectedRiskBadgeClass() {
    return this.selectedShipment
      ? this.computeRiskBadgeClass(this.selectedShipment.Risk_Level__c)
      : "";
  }

  get selectedResolutionBadgeClass() {
    return this.computeResolutionBadgeClass(
      this.selectedShipment?.Resolution_Status__c
    );
  }

  get selectedShipmentEta() {
    return this.selectedShipment
      ? this.formatDate(this.selectedShipment.Estimated_Delivery_Date__c)
      : "—";
  }

  get selectedShipmentActualDelivery() {
    return this.selectedShipment?.Actual_Delivery_Date__c
      ? this.formatDateTime(this.selectedShipment.Actual_Delivery_Date__c)
      : "Pending terminal scan";
  }

  get selectedShipmentLastSynced() {
    return this.selectedShipment
      ? this.formatDateTime(this.selectedShipment.Last_Synced__c)
      : "—";
  }

  // Deterministic Operational Recommendations
  get recommendedAction() {
    if (!this.selectedShipment) return null;
    const status = (this.selectedShipment.Status__c || "").toLowerCase();
    const risk = (this.selectedShipment.Risk_Level__c || "").toLowerCase();

    if (status === "failure") {
      return {
        title: "Consignee Contact & Redelivery Scheduling",
        severity: "Critical",
        severityClass: "rec-badge-critical",
        icon: "utility:error",
        guidance:
          "Carrier reported a failed delivery attempt. Contact the recipient to confirm gate access and physical delivery address, then request carrier redelivery.",
        suggestedStatus: "Action Required",
        actionLabel: "Set Action Required"
      };
    }
    if (status === "return_to_sender") {
      return {
        title: "Carrier Return Triage & Sender Notification",
        severity: "Critical",
        severityClass: "rec-badge-critical",
        icon: "utility:undo",
        guidance:
          "Shipment is reversing course to sender. Contact courier to verify return dispatch reason and alert dispatch to initiate replacement order or restocking.",
        suggestedStatus: "Escalated",
        actionLabel: "Set Escalated"
      };
    }
    if (status === "delivered") {
      return {
        title: "Delivery Proof Verification & Incident Closure",
        severity: "Resolved",
        severityClass: "rec-badge-resolved",
        icon: "utility:success",
        guidance:
          "Consignment delivery completed. Confirm electronic proof of delivery with recipient and close active exception investigation.",
        suggestedStatus: "Resolved",
        actionLabel: "Set Resolved"
      };
    }
    if (risk.includes("delay") || status === "delayed") {
      return {
        title: "Linehaul Delay Inquiry & Regional Escalation",
        severity: "High",
        severityClass: "rec-badge-high",
        icon: "utility:clock",
        guidance:
          "Estimated delivery window has expired. Contact carrier linehaul desk regarding transit bottlenecks and escalate for priority destination sorting.",
        suggestedStatus: "Investigating",
        actionLabel: "Set Investigating"
      };
    }
    if (status === "unknown") {
      return {
        title: "Carrier API Telemetry Sync & Physical Scan Audit",
        severity: "High",
        severityClass: "rec-badge-high",
        icon: "utility:help",
        guidance:
          "Tracking telemetry is unverified or missing scan events. Trigger carrier API synchronization and verify physical scan at regional distribution hub.",
        suggestedStatus: "Action Required",
        actionLabel: "Set Action Required"
      };
    }
    if (risk.includes("risk")) {
      return {
        title: "Transit Milestone Monitoring & Regional Sorting Alert",
        severity: "Medium",
        severityClass: "rec-badge-medium",
        icon: "utility:warning",
        guidance:
          "Approaching SLA threshold with transit warning flags. Monitor milestone updates closely and alert regional dispatch desk.",
        suggestedStatus: "Investigating",
        actionLabel: "Set Investigating"
      };
    }

    return {
      title: "Operational Triage & Status Review",
      severity: "Normal",
      severityClass: "rec-badge-normal",
      icon: "utility:info",
      guidance:
        "Review consignment telemetry and determine operational remediation steps.",
      suggestedStatus: "Investigating",
      actionLabel: "Set Investigating"
    };
  }

  // Computed: Linked Case on Selected Shipment
  get hasLinkedCase() {
    return Boolean(this.selectedShipment?.Case__c);
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

  get linkedCaseOwner() {
    return this.selectedShipment?.Case__r?.Owner?.Name || "—";
  }

  get linkedCaseOrigin() {
    return this.selectedShipment?.Case__r?.Origin || "—";
  }

  get linkedCaseCreatedDate() {
    return this.formatDateTime(this.selectedShipment?.Case__r?.CreatedDate);
  }

  // Computed: Events Timeline
  get eventsCount() {
    return this.rawEvents ? this.rawEvents.length : 0;
  }

  get hasEvents() {
    return !this.isLoadingEvents && this.rawEvents && this.rawEvents.length > 0;
  }

  get formattedEvents() {
    return (this.rawEvents || []).map((evt) => {
      const rawStatus = evt.Event_Status__c;
      return {
        ...evt,
        statusLabel: STATUS_LABELS[rawStatus] || rawStatus || "Milestone",
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

  // Chronological Operational & Audit History (Genuine Salesforce Timestamps)
  get chronologicalHistory() {
    if (!this.selectedShipment) return [];
    const entries = [];

    // 1. Shipment Record Created
    if (this.selectedShipment.CreatedDate) {
      entries.push({
        id: "hist-created",
        date: new Date(this.selectedShipment.CreatedDate),
        formattedDate: this.formatDateTime(this.selectedShipment.CreatedDate),
        title: "Shipment Record Created",
        description: `Consignment registered in Salesforce with tracking code ${this.selectedShipment.Tracking_Code__c}.`,
        icon: "utility:record_create",
        badgeClass: "hist-badge-info"
      });
    }

    // 2. Carrier Telemetry Synchronized
    if (this.selectedShipment.Last_Synced__c) {
      entries.push({
        id: "hist-synced",
        date: new Date(this.selectedShipment.Last_Synced__c),
        formattedDate: this.formatDateTime(
          this.selectedShipment.Last_Synced__c
        ),
        title: "Carrier Telemetry Synchronized",
        description: `Stored synchronization through ${this.selectedShipment.Provider__c || "Shippo"}. Shippo is the integrated tracking provider.`,
        icon: "utility:sync",
        badgeClass: "hist-badge-cyan"
      });
    }

    // 3. Verified Delivery Completion
    if (this.selectedShipment.Actual_Delivery_Date__c) {
      entries.push({
        id: "hist-actual-delivery",
        date: new Date(this.selectedShipment.Actual_Delivery_Date__c),
        formattedDate: this.formatDateTime(
          this.selectedShipment.Actual_Delivery_Date__c
        ),
        title: "Verified Delivery Completion",
        description:
          "Carrier confirmed physical delivery to recipient address.",
        icon: "utility:success",
        badgeClass: "hist-badge-success"
      });
    }

    // 4. Linked Support Case Logged
    if (
      this.selectedShipment.Case__r &&
      this.selectedShipment.Case__r.CreatedDate
    ) {
      entries.push({
        id: "hist-case-created",
        date: new Date(this.selectedShipment.Case__r.CreatedDate),
        formattedDate: this.formatDateTime(
          this.selectedShipment.Case__r.CreatedDate
        ),
        title: `Support Case #${this.linkedCaseNumber} Logged`,
        description: `Customer support inquiry logged: "${this.linkedCaseSubject}" (Priority: ${this.linkedCasePriority}).`,
        icon: "utility:case",
        badgeClass: "hist-badge-violet"
      });
    }

    // 5. Linked Support Case Record Modification
    if (
      this.selectedShipment.Case__r &&
      this.selectedShipment.Case__r.LastModifiedDate
    ) {
      const caseMod = new Date(this.selectedShipment.Case__r.LastModifiedDate);
      const caseCreate = this.selectedShipment.Case__r.CreatedDate
        ? new Date(this.selectedShipment.Case__r.CreatedDate)
        : null;
      if (
        !caseCreate ||
        Math.abs(caseMod.getTime() - caseCreate.getTime()) > 60000
      ) {
        entries.push({
          id: "hist-case-modified",
          date: caseMod,
          formattedDate: this.formatDateTime(
            this.selectedShipment.Case__r.LastModifiedDate
          ),
          title: `Support Case #${this.linkedCaseNumber} Record Modified`,
          description: `Standard Salesforce record modification. Current status: ${this.linkedCaseStatus}, Assigned owner: ${this.linkedCaseOwner}.`,
          icon: "utility:edit",
          badgeClass: "hist-badge-violet"
        });
      }
    }

    // 6. Real Milestone Events from Shipment_Event__c
    if (this.rawEvents && this.rawEvents.length > 0) {
      this.rawEvents.forEach((evt, idx) => {
        const evtDate = evt.Event_Date__c
          ? new Date(evt.Event_Date__c)
          : new Date(evt.CreatedDate);
        const loc = evt.Event_Location__c ? ` (${evt.Event_Location__c})` : "";
        entries.push({
          id: `hist-evt-${idx}`,
          date: evtDate,
          formattedDate: this.formatDateTime(
            evt.Event_Date__c || evt.CreatedDate
          ),
          title: `Carrier Milestone: ${STATUS_LABELS[evt.Event_Status__c] || evt.Event_Status__c || "Milestone"}`,
          description: `${evt.Event_Description__c || "Tracking scan recorded."}${loc}`,
          icon: "utility:checkin",
          badgeClass: "hist-badge-cyan"
        });
      });
    }

    // 7. Consignment Record Last Modified
    if (this.selectedShipment.LastModifiedDate) {
      const modDate = new Date(this.selectedShipment.LastModifiedDate);
      const createDate = this.selectedShipment.CreatedDate
        ? new Date(this.selectedShipment.CreatedDate)
        : null;
      if (
        !createDate ||
        Math.abs(modDate.getTime() - createDate.getTime()) > 60000
      ) {
        entries.push({
          id: "hist-last-modified",
          date: modDate,
          formattedDate: this.formatDateTime(
            this.selectedShipment.LastModifiedDate
          ),
          title: "Consignment Record Modified",
          description: `General record modification in Salesforce. Current resolution state: ${this.selectedShipment.Resolution_Status__c || "New"}${this.selectedShipment.Resolution_Notes__c ? " (Notes: " + this.selectedShipment.Resolution_Notes__c + ")" : ""}.`,
          icon: "utility:task",
          badgeClass: "hist-badge-amber"
        });
      }
    }

    entries.sort((a, b) => b.date.getTime() - a.date.getTime());
    return entries;
  }

  get hasChronologicalHistory() {
    return this.chronologicalHistory.length > 0;
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

  computeResolutionBadgeClass(status) {
    if (!status) return "res-pill res-new";
    const s = status.toLowerCase();
    if (s.includes("new")) return "res-pill res-new";
    if (s.includes("investigat")) return "res-pill res-investigating";
    if (s.includes("escalat")) return "res-pill res-escalated";
    if (s.includes("action")) return "res-pill res-action";
    if (s.includes("resolve")) return "res-pill res-resolved";
    if (s.includes("dismiss")) return "res-pill res-dismissed";
    return "res-pill res-new";
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
