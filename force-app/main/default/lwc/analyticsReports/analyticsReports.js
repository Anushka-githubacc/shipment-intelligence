import { LightningElement, wire, api } from "lwc";
import { refreshApex } from "@salesforce/apex";
import getShipments from "@salesforce/apex/ShipmentController.getShipments";

const SEARCH_DEBOUNCE_MS = 300;

const STATUS_LABELS = {
  delivered: "Delivered",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  pre_transit: "Pre-Transit",
  failure: "Delivery Failure",
  return_to_sender: "Return to Sender",
  unknown: "Unknown"
};

const STATUS_BAR_COLORS = {
  delivered: "status-bar-delivered",
  in_transit: "status-bar-transit",
  out_for_delivery: "status-bar-out",
  pre_transit: "status-bar-pre",
  failure: "status-bar-failure",
  return_to_sender: "status-bar-return",
  unknown: "status-bar-unknown"
};

export default class AnalyticsReports extends LightningElement {
  // Raw data from Apex
  shipments = [];
  wiredShipmentsResult;

  // Filter state
  localSearchTerm = "";
  _externalSearchTerm = "";
  startDate = "";
  endDate = "";
  carrierFilter = "All";
  statusFilter = "All";
  selectedQuickFilter = "All";

  // Table sorting
  sortField = "Name";
  sortDirection = "asc";

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
      if (this.wiredShipmentsResult) {
        await refreshApex(this.wiredShipmentsResult);
      }
    } catch (err) {
      this.errorMessage =
        err?.body?.message ||
        err?.message ||
        "Failed to refresh analytics data.";
    } finally {
      this.isRefreshing = false;
    }
  }

  // Wire adapter retrieving shipment records
  @wire(getShipments, {
    searchTerm: "",
    statusFilter: "All",
    riskFilter: "All"
  })
  wiredShipments(result) {
    this.wiredShipmentsResult = result;
    const { data, error } = result;

    if (data) {
      this.shipments = data;
      this.errorMessage = "";
      this.isLoading = false;
    } else if (error) {
      this.errorMessage = this.extractErrorMessage(error);
      this.shipments = [];
      this.isLoading = false;
    }
  }

  // Effective search string (local search or external)
  get effectiveSearchTerm() {
    return (this.localSearchTerm || this._externalSearchTerm || "")
      .trim()
      .toLowerCase();
  }

  // Filtered shipments based on date range, carrier, status, search, and quick filters
  get filteredShipments() {
    let list = [...this.shipments];
    const search = this.effectiveSearchTerm;
    const carrier = (this.carrierFilter || "All").toLowerCase();
    const status = (this.statusFilter || "All").toLowerCase();
    const quick = (this.selectedQuickFilter || "All").toLowerCase();

    // 1. Quick KPI Filter
    if (quick === "delivered") {
      list = list.filter(
        (s) => (s.Status__c || "").toLowerCase() === "delivered"
      );
    } else if (quick === "in_transit") {
      list = list.filter((s) => {
        const st = (s.Status__c || "").toLowerCase();
        return st === "in_transit" || st === "out_for_delivery";
      });
    } else if (quick === "delayed") {
      list = list.filter(
        (s) => (s.Risk_Level__c || "").toLowerCase() === "delayed"
      );
    }

    // 2. Carrier Filter
    if (carrier !== "all") {
      list = list.filter((s) => (s.Carrier__c || "").toLowerCase() === carrier);
    }

    // 3. Status Filter
    if (status !== "all") {
      list = list.filter((s) => (s.Status__c || "").toLowerCase() === status);
    }

    // 4. Date Range Filter on Estimated_Delivery_Date__c
    if (this.startDate) {
      const startMs = new Date(this.startDate + "T00:00:00").getTime();
      list = list.filter((s) => {
        if (!s.Estimated_Delivery_Date__c) return false;
        const etaMs = new Date(s.Estimated_Delivery_Date__c).getTime();
        return etaMs >= startMs;
      });
    }
    if (this.endDate) {
      const endMs = new Date(this.endDate + "T23:59:59").getTime();
      list = list.filter((s) => {
        if (!s.Estimated_Delivery_Date__c) return false;
        const etaMs = new Date(s.Estimated_Delivery_Date__c).getTime();
        return etaMs <= endMs;
      });
    }

    // 5. Text Search Filter
    if (search) {
      list = list.filter((s) => {
        const code = (s.Tracking_Code__c || "").toLowerCase();
        const carr = (s.Carrier__c || "").toLowerCase();
        const name = (s.Name || "").toLowerCase();
        const reason = (s.Risk_Reason__c || "").toLowerCase();
        return (
          code.includes(search) ||
          carr.includes(search) ||
          name.includes(search) ||
          reason.includes(search)
        );
      });
    }

    // 6. Sorting
    list.sort((a, b) => {
      let valA = a[this.sortField] || "";
      let valB = b[this.sortField] || "";

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return this.sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return this.sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }

  // --- KPI Metrics ---

  get totalShipmentsCount() {
    return this.filteredShipments.length;
  }

  get deliveredCount() {
    return this.filteredShipments.filter(
      (s) => (s.Status__c || "").toLowerCase() === "delivered"
    ).length;
  }

  get inTransitCount() {
    return this.filteredShipments.filter((s) => {
      const st = (s.Status__c || "").toLowerCase();
      return st === "in_transit" || st === "out_for_delivery";
    }).length;
  }

  get delayedCount() {
    return this.filteredShipments.filter(
      (s) => (s.Risk_Level__c || "").toLowerCase() === "delayed"
    ).length;
  }

  get deliveredPercentage() {
    if (this.totalShipmentsCount === 0) return 0;
    return Math.round((this.deliveredCount / this.totalShipmentsCount) * 100);
  }

  get inTransitPercentage() {
    if (this.totalShipmentsCount === 0) return 0;
    return Math.round((this.inTransitCount / this.totalShipmentsCount) * 100);
  }

  get delayedPercentage() {
    if (this.totalShipmentsCount === 0) return 0;
    return Math.round((this.delayedCount / this.totalShipmentsCount) * 100);
  }

  // On-time delivery percentage:
  // Evaluated ONLY if reliable delivery completion timestamps exist.
  // When unavailable, explicitly reports 'N/A' to avoid fabricating metrics.
  get onTimeDeliveryRate() {
    const delivered = this.filteredShipments.filter(
      (s) => (s.Status__c || "").toLowerCase() === "delivered"
    );

    if (delivered.length === 0) {
      return "N/A";
    }

    // Check if any delivered record contains an actual delivery date timestamp field
    const hasActualTimestamps = delivered.some(
      (s) => s.Actual_Delivery_Date__c || s.Delivery_Date__c
    );

    if (!hasActualTimestamps) {
      return "N/A";
    }

    let onTimeCount = 0;
    delivered.forEach((s) => {
      const actual = new Date(
        s.Actual_Delivery_Date__c || s.Delivery_Date__c
      ).getTime();
      const est = s.Estimated_Delivery_Date__c
        ? new Date(s.Estimated_Delivery_Date__c).getTime()
        : null;
      if (!est || actual <= est) {
        onTimeCount++;
      }
    });

    return `${Math.round((onTimeCount / delivered.length) * 100)}%`;
  }

  get isOnTimeMetricUnavailable() {
    return this.onTimeDeliveryRate === "N/A";
  }

  get onTimeSubtext() {
    if (this.isOnTimeMetricUnavailable) {
      return "Actual delivery completion timestamp not recorded on core records";
    }
    return "Delivered on or before estimated arrival deadline";
  }

  // --- Shipment Status Distribution ---

  get statusDistribution() {
    const total = this.totalShipmentsCount;
    const counts = {
      delivered: 0,
      in_transit: 0,
      out_for_delivery: 0,
      pre_transit: 0,
      failure: 0,
      return_to_sender: 0,
      unknown: 0
    };

    this.filteredShipments.forEach((s) => {
      const st = (s.Status__c || "unknown").toLowerCase();
      if (counts[st] !== undefined) {
        counts[st]++;
      } else {
        counts.unknown++;
      }
    });

    return Object.keys(counts).map((key) => {
      const count = counts[key];
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        key,
        label: STATUS_LABELS[key] || key,
        count,
        percentage: pct,
        barStyle: `width: ${pct}%;`,
        colorClass: STATUS_BAR_COLORS[key] || "status-bar-unknown"
      };
    });
  }

  // --- Risk Distribution ---

  get riskDistribution() {
    const total = this.totalShipmentsCount;
    let onTrack = 0;
    let atRisk = 0;
    let delayed = 0;

    this.filteredShipments.forEach((s) => {
      const r = (s.Risk_Level__c || "").toLowerCase();
      if (r === "on track") onTrack++;
      else if (r === "at risk") atRisk++;
      else if (r === "delayed") delayed++;
    });

    const onTrackPct = total > 0 ? Math.round((onTrack / total) * 100) : 0;
    const atRiskPct = total > 0 ? Math.round((atRisk / total) * 100) : 0;
    const delayedPct = total > 0 ? Math.round((delayed / total) * 100) : 0;

    return {
      onTrackCount: onTrack,
      onTrackPercentage: onTrackPct,
      onTrackStyle: `width: ${onTrackPct}%;`,
      atRiskCount: atRisk,
      atRiskPercentage: atRiskPct,
      atRiskStyle: `width: ${atRiskPct}%;`,
      delayedCount: delayed,
      delayedPercentage: delayedPct,
      delayedStyle: `width: ${delayedPct}%;`,
      hasData: total > 0
    };
  }

  // --- Carrier-Wise Performance Comparisons ---

  get carrierPerformanceList() {
    const carrierMap = {};

    this.filteredShipments.forEach((s) => {
      const carrierRaw = s.Carrier__c || "Unknown Carrier";
      const key = carrierRaw.toLowerCase();

      if (!carrierMap[key]) {
        carrierMap[key] = {
          key,
          name: this.formatCarrierName(carrierRaw),
          total: 0,
          delivered: 0,
          inTransit: 0,
          atRisk: 0,
          delayed: 0,
          onTrack: 0
        };
      }

      carrierMap[key].total++;
      const st = (s.Status__c || "").toLowerCase();
      const r = (s.Risk_Level__c || "").toLowerCase();

      if (st === "delivered") carrierMap[key].delivered++;
      if (st === "in_transit" || st === "out_for_delivery")
        carrierMap[key].inTransit++;
      if (r === "on track") carrierMap[key].onTrack++;
      if (r === "at risk") carrierMap[key].atRisk++;
      if (r === "delayed") carrierMap[key].delayed++;
    });

    return Object.values(carrierMap).map((c) => {
      const onTrackPct =
        c.total > 0 ? Math.round((c.onTrack / c.total) * 100) : 0;
      const deliveredPct =
        c.total > 0 ? Math.round((c.delivered / c.total) * 100) : 0;

      let tier = "Optimal";
      let badgeClass = "badge-tier-optimal";
      if (onTrackPct < 50 || c.delayed > 0) {
        tier = "Critical";
        badgeClass = "badge-tier-critical";
      } else if (onTrackPct < 80 || c.atRisk > 0) {
        tier = "Attention";
        badgeClass = "badge-tier-attention";
      }

      return {
        ...c,
        onTrackPct,
        deliveredPct,
        tier,
        badgeClass,
        onTrackStyle: `width: ${onTrackPct}%;`
      };
    });
  }

  get hasCarrierData() {
    return this.carrierPerformanceList.length > 0;
  }

  // --- Delivery Trend Analysis Over Time ---

  get deliveryTrends() {
    const dateMap = {};
    let unscheduledCount = 0;

    this.filteredShipments.forEach((s) => {
      if (!s.Estimated_Delivery_Date__c) {
        unscheduledCount++;
        return;
      }

      // Group by calendar date (YYYY-MM-DD)
      const dateKey = s.Estimated_Delivery_Date__c.split("T")[0];

      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          dateKey,
          label: this.formatDateLabel(dateKey),
          total: 0,
          onTrack: 0,
          atRisk: 0,
          delayed: 0,
          delivered: 0
        };
      }

      dateMap[dateKey].total++;
      const st = (s.Status__c || "").toLowerCase();
      const r = (s.Risk_Level__c || "").toLowerCase();

      if (st === "delivered") dateMap[dateKey].delivered++;
      if (r === "on track") dateMap[dateKey].onTrack++;
      if (r === "at risk") dateMap[dateKey].atRisk++;
      if (r === "delayed") dateMap[dateKey].delayed++;
    });

    const sortedDates = Object.keys(dateMap).sort();
    if (sortedDates.length === 0 && unscheduledCount === 0) {
      return { hasTrends: false, items: [], unscheduledCount: 0 };
    }

    // Determine max items for relative progress bar widths
    let maxCount = unscheduledCount;
    sortedDates.forEach((d) => {
      if (dateMap[d].total > maxCount) maxCount = dateMap[d].total;
    });

    const items = sortedDates.map((d) => {
      const row = dateMap[d];
      const barPct =
        maxCount > 0 ? Math.round((row.total / maxCount) * 100) : 0;
      return {
        ...row,
        barStyle: `width: ${barPct}%;`
      };
    });

    return {
      hasTrends: items.length > 0 || unscheduledCount > 0,
      items,
      unscheduledCount
    };
  }

  // --- Detailed Table Display Rows ---

  get tableRows() {
    return this.filteredShipments.map((s) => {
      const statusRaw = (s.Status__c || "unknown").toLowerCase();
      const riskRaw = s.Risk_Level__c || "On Track";

      return {
        id: s.Id,
        name: s.Name,
        trackingCode: s.Tracking_Code__c || "—",
        carrier: this.formatCarrierName(s.Carrier__c),
        status: s.Status__c,
        statusLabel: STATUS_LABELS[statusRaw] || s.Status__c || "Unknown",
        statusBadgeClass: this.getStatusBadgeClass(statusRaw),
        riskLevel: riskRaw,
        riskBadgeClass: this.getRiskBadgeClass(riskRaw),
        etaFormatted: this.formatDateTime(s.Estimated_Delivery_Date__c),
        lastSyncedFormatted: this.formatDateTime(s.Last_Synced__c),
        caseNumber: s.Case__r?.CaseNumber || (s.Case__c ? "Linked" : "—")
      };
    });
  }

  get hasTableRows() {
    return this.tableRows.length > 0;
  }

  get isAllClear() {
    return !this.isLoading && this.shipments.length === 0;
  }

  get isFilteredEmpty() {
    return (
      !this.isLoading &&
      this.shipments.length > 0 &&
      this.filteredShipments.length === 0
    );
  }

  // --- Filter Dropdown Options ---

  get carrierOptions() {
    const carriers = new Set();
    this.shipments.forEach((s) => {
      if (s.Carrier__c) {
        carriers.add(s.Carrier__c.toLowerCase());
      }
    });

    const options = [{ label: "All Carriers", value: "All" }];
    Array.from(carriers)
      .sort()
      .forEach((c) => {
        options.push({
          label: this.formatCarrierName(c),
          value: c
        });
      });
    return options;
  }

  get statusOptions() {
    return [
      { label: "All Statuses", value: "All" },
      { label: "Delivered", value: "delivered" },
      { label: "In Transit", value: "in_transit" },
      { label: "Out for Delivery", value: "out_for_delivery" },
      { label: "Pre-Transit", value: "pre_transit" },
      { label: "Delivery Failure", value: "failure" },
      { label: "Return to Sender", value: "return_to_sender" },
      { label: "Unknown", value: "unknown" }
    ];
  }

  get hasActiveFilters() {
    return (
      Boolean(this.effectiveSearchTerm) ||
      this.carrierFilter !== "All" ||
      this.statusFilter !== "All" ||
      this.selectedQuickFilter !== "All" ||
      Boolean(this.startDate) ||
      Boolean(this.endDate)
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

  handleCarrierChange(event) {
    this.carrierFilter =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "All";
  }

  handleStatusChange(event) {
    this.statusFilter =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "All";
  }

  handleStartDateChange(event) {
    this.startDate =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
  }

  handleEndDateChange(event) {
    this.endDate =
      event.detail?.value !== undefined
        ? event.detail.value
        : event.target?.value || "";
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
    this.carrierFilter = "All";
    this.statusFilter = "All";
    this.selectedQuickFilter = "All";
    this.startDate = "";
    this.endDate = "";
  }

  handleSort(event) {
    const field = event.currentTarget.dataset.field;
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortField = field;
      this.sortDirection = "asc";
    }
  }

  // --- Helper Methods ---

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

  formatDateLabel(dateKey) {
    try {
      const parts = dateKey.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
      }
      return dateKey;
    } catch {
      return dateKey;
    }
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
    switch (status) {
      case "delivered":
        return "badge-status badge-status-delivered";
      case "in_transit":
      case "out_for_delivery":
        return "badge-status badge-status-transit";
      case "pre_transit":
        return "badge-status badge-status-pre";
      case "failure":
        return "badge-status badge-status-failure";
      case "return_to_sender":
        return "badge-status badge-status-return";
      default:
        return "badge-status badge-status-unknown";
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

  extractErrorMessage(error) {
    if (!error) return "An unexpected error occurred.";
    if (typeof error === "string") return error;
    if (error.body && error.body.message) return error.body.message;
    if (error.message) return error.message;
    return "Unable to load analytics data from Salesforce.";
  }
}
