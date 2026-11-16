import { LightningElement, wire, api } from "lwc";
import { refreshApex } from "@salesforce/apex";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getShipments from "@salesforce/apex/ShipmentController.getShipments";
import syncOne from "@salesforce/apex/ShipmentController.syncOne";
import syncMultiple from "@salesforce/apex/ShipmentController.syncMultiple";

const SYNC_BATCH_SIZE = 100;

const STATUS_LABELS = {
  pre_transit: "Pre-transit",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  return_to_sender: "Return to Sender",
  failure: "Failure",
  unknown: "Unknown"
};

const STATUS_ORDER = [
  { key: "pre_transit", label: "Pre-transit", tone: "violet" },
  { key: "in_transit", label: "In Transit", tone: "cyan" },
  { key: "out_for_delivery", label: "Out for Delivery", tone: "cyan" },
  { key: "delivered", label: "Delivered", tone: "emerald" },
  { key: "return_to_sender", label: "Returned", tone: "coral" },
  { key: "failure", label: "Failure", tone: "coral" },
  { key: "unknown", label: "Unknown", tone: "muted" }
];

const RISK_ORDER = [
  { key: "On Track", label: "On Track", tone: "emerald" },
  { key: "At Risk", label: "At Risk", tone: "amber" },
  { key: "Delayed", label: "Delayed", tone: "coral" }
];

const JOURNEY_STAGES = [
  { key: "pre_transit", label: "Booked / Pre-transit" },
  { key: "in_transit", label: "In Transit" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" }
];

const EXCEPTION_COPY = {
  return_to_sender: {
    label: "Returned to sender",
    message:
      "This shipment is returning to the sender. It is not progressing through delivery."
  },
  failure: {
    label: "Delivery failed",
    message:
      "The carrier reported a delivery failure. This shipment is not on a successful delivery path."
  },
  unknown: {
    label: "Status unknown",
    message:
      "The carrier status is unknown. Delivery progress cannot be confirmed."
  }
};

const UNRECOGNIZED_EXCEPTION = {
  label: "Progress unavailable",
  message:
    "This status is not a delivery stage. The shipment is not shown as progressing toward delivery."
};

export default class ShipmentDashboard extends LightningElement {
  searchTerm = null;
  statusFilter = "All";
  riskFilter = "All";
  savedRiskFilter = "All";
  needsAttention = false;

  statusFilterParam = null;
  riskFilterParam = null;

  searchTimeout = null;

  allRecords = [];
  tableRecords = [];
  selectedId = null;

  loadError = null;
  feedback = null;
  activityMessage = null;
  isBusy = false;

  allWireResult;
  tableWireResult;

  statusOptions = [
    { label: "All statuses", value: "All" },
    { label: "Pre-transit", value: "pre_transit" },
    { label: "In Transit", value: "in_transit" },
    { label: "Out for Delivery", value: "out_for_delivery" },
    { label: "Delivered", value: "delivered" },
    { label: "Return to Sender", value: "return_to_sender" },
    { label: "Failure", value: "failure" },
    { label: "Unknown", value: "unknown" }
  ];

  riskOptions = [
    { label: "All risk levels", value: "All" },
    { label: "On Track", value: "On Track" },
    { label: "At Risk", value: "At Risk" },
    { label: "Delayed", value: "Delayed" }
  ];

  @wire(getShipments, {
    searchTerm: null,
    statusFilter: null,
    riskFilter: null
  })
  wiredAllShipments(result) {
    this.allWireResult = result;
    if (result.data) {
      this.allRecords = result.data;
    } else if (result.error) {
      this.allRecords = [];
    }
    this.syncLoadError();
  }

  @wire(getShipments, {
    searchTerm: "$searchTerm",
    statusFilter: "$statusFilterParam",
    riskFilter: "$riskFilterParam"
  })
  wiredTableShipments(result) {
    this.tableWireResult = result;
    if (result.data) {
      this.tableRecords = result.data;
    } else if (result.error) {
      this.tableRecords = [];
    }
    this.syncLoadError();
    this.reconcileSelection();
  }

  get isInitialLoading() {
    return (
      !isWireSettled(this.allWireResult) || !isWireSettled(this.tableWireResult)
    );
  }

  get hasPopulation() {
    return this.allRecords.length > 0;
  }

  get showEmpty() {
    return !this.isInitialLoading && !this.loadError && !this.hasPopulation;
  }

  get filteredSourceRecords() {
    return (this.tableRecords || []).filter((record) =>
      this.recordMatchesFilters(record)
    );
  }

  get visibleShipments() {
    return this.filteredSourceRecords.map((record) => this.toView(record));
  }

  get visibleCount() {
    return this.visibleShipments.length;
  }

  get showNoMatches() {
    return (
      !this.isInitialLoading &&
      !this.loadError &&
      this.hasPopulation &&
      this.visibleCount === 0
    );
  }

  get showTable() {
    return !this.isInitialLoading && !this.loadError && this.visibleCount > 0;
  }

  get kpis() {
    const records = this.allRecords || [];
    return {
      total: records.length,
      onTrack: records.filter((record) => record.Risk_Level__c === "On Track")
        .length,
      atRisk: records.filter((record) => record.Risk_Level__c === "At Risk")
        .length,
      delayed: records.filter((record) => record.Risk_Level__c === "Delayed")
        .length
    };
  }

  get showOperations() {
    return !this.isInitialLoading && !this.loadError && this.hasPopulation;
  }

  get healthLabel() {
    const { total, onTrack } = this.kpis;
    if (!total) {
      return "No shipment population";
    }
    return `${Math.round((onTrack / total) * 100)}% of shipments are On Track`;
  }

  get statusBreakdown() {
    return buildShareRows(this.allRecords, STATUS_ORDER, (record) =>
      normalizeStatus(record.Status__c)
    );
  }

  get riskBreakdown() {
    return buildShareRows(
      this.allRecords,
      RISK_ORDER,
      (record) => record.Risk_Level__c || "Unclassified"
    );
  }

  get carrierBreakdown() {
    const counts = new Map();
    (this.allRecords || []).forEach((record) => {
      const carrier = record.Carrier__c || "Unspecified";
      counts.set(carrier, (counts.get(carrier) || 0) + 1);
    });
    const order = Array.from(counts.entries())
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
      )
      .map(([key]) => ({ key, label: key }));
    return buildShareRows(
      this.allRecords,
      order,
      (record) => record.Carrier__c || "Unspecified"
    );
  }

  get recentActivity() {
    return [...(this.allRecords || [])]
      .sort((left, right) => {
        const leftTime = Date.parse(left.Last_Synced__c || "") || 0;
        const rightTime = Date.parse(right.Last_Synced__c || "") || 0;
        if (rightTime !== leftTime) {
          return rightTime - leftTime;
        }
        return String(right.Name || "").localeCompare(String(left.Name || ""));
      })
      .slice(0, 5)
      .map((record) => this.toView(record));
  }

  get selectedRecord() {
    if (!this.selectedId) {
      return null;
    }
    return (
      this.filteredSourceRecords.find(
        (record) => record.Id === this.selectedId
      ) || null
    );
  }

  get selectedView() {
    return this.selectedRecord ? this.toView(this.selectedRecord) : null;
  }

  get journey() {
    const record = this.selectedRecord;
    if (!record) {
      return null;
    }

    const status = normalizeStatus(record.Status__c);
    const activeIndex = stageIndex(status);
    const isException = activeIndex < 0;
    const exceptionKey = isException
      ? EXCEPTION_COPY[status]
        ? status
        : "unknown"
      : null;
    const exception = isException
      ? EXCEPTION_COPY[status] ||
        (status ? UNRECOGNIZED_EXCEPTION : EXCEPTION_COPY.unknown)
      : null;

    const stages = JOURNEY_STAGES.map((stage, index) => {
      const isComplete =
        !isException && (status === "delivered" || index < activeIndex);
      const isCurrent = !isException && index === activeIndex;
      let stateLabel = "Upcoming";
      if (isException) {
        stateLabel = "Halted";
      } else if (isComplete && isCurrent) {
        stateLabel = "Delivered";
      } else if (isComplete) {
        stateLabel = "Complete";
      } else if (isCurrent) {
        stateLabel = "Current stage";
      }

      const classes = ["step"];
      if (isException) {
        classes.push("is-halted");
      }
      if (isComplete) {
        classes.push("is-complete");
      }
      if (isCurrent) {
        classes.push("is-current");
      }

      return {
        key: stage.key,
        label: stage.label,
        stateLabel,
        itemClass: classes.join(" ")
      };
    });

    return {
      status,
      isException,
      exceptionKey: exceptionKey || "none",
      exceptionLabel: exception ? exception.label : null,
      exceptionMessage: exception ? exception.message : null,
      stages
    };
  }

  get refreshDisabled() {
    return this.isBusy || this.isInitialLoading;
  }

  get syncVisibleDisabled() {
    return this.refreshDisabled || this.visibleCount === 0;
  }

  get syncSelectedDisabled() {
    return this.refreshDisabled || !this.selectedRecord;
  }

  @api
  get externalSearchTerm() {
    return this.searchTerm;
  }
  set externalSearchTerm(value) {
    const trimmed = value ? String(value).trim() : "";
    this.searchTerm = trimmed || null;
    this.reconcileSelection();
  }

  @api
  refresh() {
    this.handleRefresh();
  }

  get feedbackClass() {
    return this.feedback ? `banner banner-${this.feedback.variant}` : "banner";
  }

  get isRiskFilterDisabled() {
    return this.needsAttention;
  }

  disconnectedCallback() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
  }

  handleSearchChange(event) {
    const value = event.detail.value ? event.detail.value.trim() : "";
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.searchTimeout = setTimeout(() => {
      this.searchTerm = value || null;
      this.reconcileSelection();
      this.searchTimeout = null;
    }, 300);
  }

  handleStatusChange(event) {
    this.statusFilter = event.detail.value || "All";
    this.statusFilterParam =
      this.statusFilter === "All" ? null : this.statusFilter;
    this.reconcileSelection();
  }

  handleRiskChange(event) {
    this.riskFilter = event.detail.value || "All";
    this.savedRiskFilter = this.riskFilter;
    this.updateRiskParam();
    this.reconcileSelection();
  }

  handleAttentionToggle(event) {
    this.needsAttention = event.detail.checked === true;
    if (this.needsAttention) {
      this.savedRiskFilter = this.riskFilter;
      this.riskFilter = "All";
    } else {
      this.riskFilter = this.savedRiskFilter || "All";
    }
    this.updateRiskParam();
    this.reconcileSelection();
  }

  handleSelect(event) {
    this.selectedId = event.currentTarget.dataset.id;
  }

  handleRowKeydown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.selectedId = event.currentTarget.dataset.id;
    }
  }

  handleRefresh() {
    if (this.isBusy || this.isInitialLoading) {
      return;
    }
    this.runExclusive("Refreshing shipments…", async () => {
      await this.refreshFromServer();
      this.notify(
        "success",
        "Shipments refreshed",
        "Shipment records are up to date."
      );
    });
  }

  handleSyncSelected() {
    if (this.syncSelectedDisabled) {
      return;
    }
    this.synchronize([this.selectedRecord], "single");
  }

  handleSyncVisible() {
    if (this.syncVisibleDisabled) {
      return;
    }
    this.synchronize(this.filteredSourceRecords, "bulk");
  }

  updateRiskParam() {
    if (this.needsAttention || !this.riskFilter || this.riskFilter === "All") {
      this.riskFilterParam = null;
      return;
    }
    this.riskFilterParam = this.riskFilter;
  }

  recordMatchesFilters(record) {
    const search = (this.searchTerm || "").toLowerCase();
    if (search) {
      const tracking = (record.Tracking_Code__c || "").toLowerCase();
      const carrier = (record.Carrier__c || "").toLowerCase();
      const name = (record.Name || "").toLowerCase();
      const matchesSearch =
        tracking.includes(search) ||
        carrier.includes(search) ||
        name.includes(search);
      if (!matchesSearch) {
        return false;
      }
    }

    if (this.statusFilter && this.statusFilter !== "All") {
      if (normalizeStatus(record.Status__c) !== this.statusFilter) {
        return false;
      }
    }

    if (this.needsAttention) {
      const risk = record.Risk_Level__c;
      if (risk !== "At Risk" && risk !== "Delayed") {
        return false;
      }
    } else if (this.riskFilter && this.riskFilter !== "All") {
      if (record.Risk_Level__c !== this.riskFilter) {
        return false;
      }
    }

    return true;
  }

  toView(record) {
    const status = normalizeStatus(record.Status__c);
    const riskLevel = record.Risk_Level__c || "Unclassified";
    return {
      id: record.Id,
      shipmentNumber: record.Name || record.Id,
      trackingCode: record.Tracking_Code__c || "Unavailable",
      carrier: record.Carrier__c || "Unavailable",
      provider: record.Provider__c || "Shippo",
      statusLabel: STATUS_LABELS[status] || record.Status__c || "Unknown",
      eta: record.Estimated_Delivery_Date__c,
      hasEta: Boolean(record.Estimated_Delivery_Date__c),
      riskLevel,
      riskClass: riskClassFor(riskLevel),
      riskReason: record.Risk_Reason__c || "No risk reason recorded.",
      lastSynced: record.Last_Synced__c,
      hasLastSynced: Boolean(record.Last_Synced__c),
      isSelected: record.Id === this.selectedId,
      rowClass: record.Id === this.selectedId ? "row is-selected" : "row"
    };
  }

  reconcileSelection() {
    if (!this.selectedId) {
      return;
    }
    const stillVisible = this.filteredSourceRecords.some(
      (record) => record.Id === this.selectedId
    );
    if (!stillVisible) {
      this.selectedId = null;
    }
  }

  syncLoadError() {
    const error =
      (this.allWireResult && this.allWireResult.error) ||
      (this.tableWireResult && this.tableWireResult.error);
    this.loadError = error ? reduceErrors(error) : null;
  }

  synchronize(records, mode) {
    if (this.isBusy) {
      return;
    }

    const prepared = partitionRecords(records);
    if (prepared.ready.length === 0) {
      this.notify(
        "error",
        "Synchronization failed",
        "Carrier and tracking code are required before a shipment can be synchronized."
      );
      return;
    }

    const activity =
      mode === "single"
        ? "Synchronizing shipment…"
        : "Synchronizing shipments…";

    this.runExclusive(activity, async () => {
      try {
        const updated =
          mode === "single"
            ? [await syncSingle(prepared.ready[0])]
            : await syncGroups(prepared.ready);
        this.mergeUpdated(updated);
        await this.refreshFromServer();
        this.notify(
          "success",
          "Synchronization complete",
          successMessage(updated.length, prepared.skipped.length)
        );
      } catch (error) {
        if (error.updated && error.updated.length) {
          this.mergeUpdated(error.updated);
        }
        await this.refreshQuietly();
        const partial =
          error.updated && error.updated.length
            ? `Synchronized ${error.updated.length} before the failure. `
            : "";
        this.notify(
          "error",
          "Synchronization failed",
          partial + reduceErrors(error)
        );
      }
    });
  }

  runExclusive(activityMessage, work) {
    if (this.isBusy) {
      return;
    }
    this.isBusy = true;
    this.activityMessage = activityMessage;
    this.feedback = null;
    Promise.resolve(work())
      .catch((error) => {
        this.notify("error", "Request failed", reduceErrors(error));
      })
      .finally(() => {
        this.isBusy = false;
        this.activityMessage = null;
      });
  }

  async refreshFromServer() {
    const jobs = [];
    if (this.allWireResult) {
      jobs.push(refreshApex(this.allWireResult));
    }
    if (this.tableWireResult) {
      jobs.push(refreshApex(this.tableWireResult));
    }
    if (jobs.length === 0) {
      return;
    }
    await Promise.all(jobs);
  }

  async refreshQuietly() {
    try {
      await this.refreshFromServer();
    } catch (error) {
      this.loadError = reduceErrors(error);
    }
  }

  mergeUpdated(records) {
    const updates = new Map();
    (records || []).forEach((record) => {
      if (record && record.Id) {
        updates.set(record.Id, record);
      }
    });
    if (updates.size === 0) {
      return;
    }

    const mergeList = (list) => {
      const next = (list || []).map(
        (record) => updates.get(record.Id) || record
      );
      updates.forEach((record, id) => {
        if (!next.some((item) => item.Id === id)) {
          next.unshift(record);
        }
      });
      return next;
    };

    this.allRecords = mergeList(this.allRecords);
    this.tableRecords = mergeList(this.tableRecords);
    this.reconcileSelection();
  }

  notify(variant, title, message) {
    this.feedback = { variant, message };
    this.dispatchEvent(
      new ShowToastEvent({
        title,
        message,
        variant: variant === "error" ? "error" : "success"
      })
    );
  }
}

function syncSingle(record) {
  return syncOne({
    carrier: record.Carrier__c,
    trackingNumber: record.Tracking_Code__c,
    caseId: record.Case__c || null
  });
}

async function syncGroups(records) {
  const groups = groupByCarrier(records);
  const updated = [];
  const errors = [];

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    const batches = chunk(group.trackingNumbers, SYNC_BATCH_SIZE);
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      try {
        // Sequential execution preserves required transactional rate-limiting
        // to adhere to Salesforce per-transaction callout limits.
        // eslint-disable-next-line no-await-in-loop
        const result = await syncMultiple({
          carrier: group.carrier,
          trackingNumbers: batches[batchIndex]
        });
        if (Array.isArray(result)) {
          updated.push(...result);
        }
      } catch (error) {
        errors.push(reduceErrors(error));
      }
    }
  }

  if (errors.length) {
    const failure = new Error(errors.join(" "));
    failure.updated = updated;
    throw failure;
  }

  return updated;
}

function partitionRecords(records) {
  const ready = [];
  const skipped = [];
  (records || []).forEach((record) => {
    const carrier = (record.Carrier__c || "").trim();
    const trackingNumber = (record.Tracking_Code__c || "").trim();
    if (!carrier || !trackingNumber) {
      skipped.push(record);
      return;
    }
    ready.push({
      ...record,
      Carrier__c: carrier,
      Tracking_Code__c: trackingNumber
    });
  });
  return { ready, skipped };
}

function groupByCarrier(records) {
  const groups = new Map();
  records.forEach((record) => {
    const carrier = record.Carrier__c;
    if (!groups.has(carrier)) {
      groups.set(carrier, []);
    }
    groups.get(carrier).push(record.Tracking_Code__c);
  });
  return Array.from(groups.entries()).map(([carrier, trackingNumbers]) => ({
    carrier,
    trackingNumbers
  }));
}

function chunk(values, size) {
  const batches = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

function successMessage(updatedCount, skippedCount) {
  const synced =
    updatedCount === 1
      ? "Synchronized 1 shipment."
      : `Synchronized ${updatedCount} shipments.`;
  if (!skippedCount) {
    return synced;
  }
  const skipped =
    skippedCount === 1
      ? " 1 shipment was skipped because carrier or tracking code is missing."
      : ` ${skippedCount} shipments were skipped because carrier or tracking code is missing.`;
  return synced + skipped;
}

function buildShareRows(records, order, valueFor) {
  const population = records || [];
  const total = population.length || 1;
  return order
    .map((item) => {
      const count = population.filter(
        (record) => valueFor(record) === item.key
      ).length;
      const percent = population.length ? Math.round((count / total) * 100) : 0;
      return {
        key: item.key,
        label: item.label,
        count,
        percent,
        barStyle: `width: ${percent}%`,
        barClass: `meter-fill meter-${item.tone || "cyan"}`
      };
    })
    .filter((item) => item.count > 0);
}

function normalizeStatus(status) {
  return (status || "").trim().toLowerCase();
}

function stageIndex(status) {
  switch (status) {
    case "pre_transit":
      return 0;
    case "in_transit":
      return 1;
    case "out_for_delivery":
      return 2;
    case "delivered":
      return 3;
    default:
      return -1;
  }
}

function riskClassFor(level) {
  if (level === "On Track") {
    return "pill pill-emerald";
  }
  if (level === "At Risk") {
    return "pill pill-amber";
  }
  if (level === "Delayed") {
    return "pill pill-coral";
  }
  return "pill";
}

function isWireSettled(result) {
  return Boolean(
    result && (result.data !== undefined || result.error !== undefined)
  );
}

function reduceErrors(error) {
  const errors = Array.isArray(error) ? error : [error];
  const messages = errors.filter(Boolean).map((item) => {
    if (Array.isArray(item.body)) {
      return item.body.map((entry) => entry.message).join(", ");
    }
    if (item.body && typeof item.body.message === "string") {
      return item.body.message;
    }
    if (typeof item.message === "string") {
      return item.message;
    }
    return "An unexpected error occurred.";
  });
  return messages.join(" ") || "An unexpected error occurred.";
}
