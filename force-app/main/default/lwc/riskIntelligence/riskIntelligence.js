import { LightningElement, wire, api } from "lwc";
import { refreshApex } from "@salesforce/apex";
import getShipments from "@salesforce/apex/ShipmentController.getShipments";
import getShipmentDetail from "@salesforce/apex/ShipmentController.getShipmentDetail";

const STATUS_LABELS = {
  pre_transit: "Pre-Transit",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  return_to_sender: "Returned",
  failure: "Failed",
  unknown: "Unknown"
};

const RISK_OPTIONS = [
  { label: "All Risk Levels", value: "All" },
  { label: "On Track", value: "On Track" },
  { label: "At Risk", value: "At Risk" },
  { label: "Delayed", value: "Delayed" }
];

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

export default class RiskIntelligence extends LightningElement {
  searchTerm = "";
  appliedSearchTerm = "";
  riskFilter = "All";
  statusFilter = "All";

  selectedShipmentId = null;
  selectedShipment = null;

  isLoading = true;
  isRefreshing = false;
  errorMessage = null;

  allShipments = [];
  tableShipments = [];

  wiredAllShipmentsResult;
  wiredTableShipmentsResult;
  wiredDetailResult;

  searchDebounceTimer = null;

  riskOptions = RISK_OPTIONS;
  statusOptions = STATUS_OPTIONS;

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
      const promises = [];
      if (this.wiredAllShipmentsResult) {
        promises.push(refreshApex(this.wiredAllShipmentsResult));
      }
      if (this.wiredTableShipmentsResult) {
        promises.push(refreshApex(this.wiredTableShipmentsResult));
      }
      if (this.wiredDetailResult) {
        promises.push(refreshApex(this.wiredDetailResult));
      }
      await Promise.all(promises);
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

  // Computed parameters for Apex wire
  get appliedSearchParam() {
    return this.appliedSearchTerm && this.appliedSearchTerm.trim() !== ""
      ? this.appliedSearchTerm.trim()
      : null;
  }

  get appliedStatusParam() {
    return this.statusFilter === "All" ? null : this.statusFilter;
  }

  get appliedRiskParam() {
    return this.riskFilter === "All" ? null : this.riskFilter;
  }

  // Wire 1: All shipments for overall risk distribution & KPIs
  @wire(getShipments, {
    searchTerm: null,
    statusFilter: null,
    riskFilter: null
  })
  wiredAllShipments(result) {
    this.wiredAllShipmentsResult = result;
    const { data } = result;
    if (data) {
      this.allShipments = data;
    } else {
      this.allShipments = [];
    }
  }

  // Wire 2: Filtered shipments for table records
  @wire(getShipments, {
    searchTerm: "$appliedSearchParam",
    statusFilter: "$appliedStatusParam",
    riskFilter: "$appliedRiskParam"
  })
  wiredFilteredShipments(result) {
    this.wiredTableShipmentsResult = result;
    const { data, error } = result;
    this.isLoading = false;

    if (data) {
      this.tableShipments = data;
      this.errorMessage = null;

      // Update selectedShipment if selection still exists in data
      if (this.selectedShipmentId) {
        const stillExists = this.tableShipments.find(
          (s) => s.Id === this.selectedShipmentId
        );
        if (!stillExists && !this.wiredDetailResult?.data) {
          this.selectedShipmentId = null;
          this.selectedShipment = null;
        }
      }
    } else if (error) {
      this.tableShipments = [];
      this.errorMessage = this.extractErrorMessage(error);
    }
  }

  // Wire 3: Detailed view for selected shipment
  @wire(getShipmentDetail, { shipmentId: "$selectedShipmentId" })
  wiredShipmentDetail(result) {
    this.wiredDetailResult = result;
    const { data, error } = result;

    if (data) {
      this.selectedShipment = data;
    } else if (error) {
      // Fall back to table shipment if detail wire fails
      this.selectedShipment =
        this.tableShipments.find((s) => s.Id === this.selectedShipmentId) ||
        null;
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
      this.isLoading = true;
    }, 300);
  }

  handleRiskFilterChange(event) {
    this.riskFilter = event.detail.value;
    this.isLoading = true;
  }

  handleStatusFilterChange(event) {
    this.statusFilter = event.detail.value;
    this.isLoading = true;
  }

  handleQuickRiskFilter(event) {
    const risk = event.currentTarget.dataset.risk;
    if (risk && risk !== this.riskFilter) {
      this.riskFilter = risk;
      this.isLoading = true;
    }
  }

  handleClearFilters() {
    this.searchTerm = "";
    this.appliedSearchTerm = "";
    this.riskFilter = "All";
    this.statusFilter = "All";
    this.isLoading = true;
  }

  handleRowClick(event) {
    const id = event.currentTarget.dataset.id;
    if (id) {
      this.selectedShipmentId = id;
    }
  }

  handleInspectClick(event) {
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (id) {
      this.selectedShipmentId = id;
    }
  }

  handleCloseDetail() {
    this.selectedShipmentId = null;
    this.selectedShipment = null;
  }

  // Computed: KPI counts and percentages
  get totalCount() {
    return this.allShipments.length;
  }

  get onTrackCount() {
    return this.allShipments.filter((s) =>
      (s.Risk_Level__c || "").toLowerCase().includes("track")
    ).length;
  }

  get onTrackPercentage() {
    return this.totalCount > 0
      ? Math.round((this.onTrackCount / this.totalCount) * 100)
      : 0;
  }

  get atRiskCount() {
    return this.allShipments.filter((s) =>
      (s.Risk_Level__c || "").toLowerCase().includes("risk")
    ).length;
  }

  get atRiskPercentage() {
    return this.totalCount > 0
      ? Math.round((this.atRiskCount / this.totalCount) * 100)
      : 0;
  }

  get delayedCount() {
    return this.allShipments.filter((s) =>
      (s.Risk_Level__c || "").toLowerCase().includes("delay")
    ).length;
  }

  get delayedPercentage() {
    return this.totalCount > 0
      ? Math.round((this.delayedCount / this.totalCount) * 100)
      : 0;
  }

  // Computed: Distribution bar styles & titles
  get onTrackBarStyle() {
    return `width: ${this.onTrackPercentage}%;`;
  }

  get onTrackTitle() {
    return `On Track: ${this.onTrackCount} shipments (${this.onTrackPercentage}%)`;
  }

  get atRiskBarStyle() {
    return `width: ${this.atRiskPercentage}%;`;
  }

  get atRiskTitle() {
    return `At Risk: ${this.atRiskCount} shipments (${this.atRiskPercentage}%)`;
  }

  get delayedBarStyle() {
    return `width: ${this.delayedPercentage}%;`;
  }

  get delayedTitle() {
    return `Delayed: ${this.delayedCount} shipments (${this.delayedPercentage}%)`;
  }

  // Computed: Layout and Filter states
  get mainLayoutClass() {
    return this.selectedShipment ? "main-layout has-inspection" : "main-layout";
  }

  get hasActiveFilters() {
    return (
      (this.searchTerm && this.searchTerm.trim() !== "") ||
      this.riskFilter !== "All" ||
      this.statusFilter !== "All"
    );
  }

  get filteredCount() {
    return this.tableShipments ? this.tableShipments.length : 0;
  }

  get hasError() {
    return Boolean(this.errorMessage);
  }

  get hasNoRecords() {
    return (
      !this.isLoading &&
      (!this.tableShipments || this.tableShipments.length === 0)
    );
  }

  get formattedShipments() {
    return (this.tableShipments || []).map((s) => {
      const isSelected = s.Id === this.selectedShipmentId;
      return {
        ...s,
        statusLabel: STATUS_LABELS[s.Status__c] || s.Status__c || "Unknown",
        statusClass: this.computeStatusBadgeClass(s.Status__c),
        riskClass: this.computeRiskBadgeClass(s.Risk_Level__c),
        formattedEta: this.formatDate(s.Estimated_Delivery_Date__c),
        rowClass: isSelected ? "row-selected" : ""
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

  get selectedShipmentRiskReason() {
    return (
      this.selectedShipment?.Risk_Reason__c || "No delay factors reported."
    );
  }

  get selectedShipmentEta() {
    return this.selectedShipment
      ? this.formatDate(this.selectedShipment.Estimated_Delivery_Date__c)
      : "—";
  }

  get selectedShipmentLastSynced() {
    return this.selectedShipment
      ? this.formatDateTime(this.selectedShipment.Last_Synced__c)
      : "—";
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
}
