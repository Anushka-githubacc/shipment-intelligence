import { createElement } from "@lwc/engine-dom";
import { refreshApex } from "@salesforce/apex";
import ShipmentDashboard from "c/shipmentDashboard";
import getShipments from "@salesforce/apex/ShipmentController.getShipments";
import syncOne from "@salesforce/apex/ShipmentController.syncOne";
import syncMultiple from "@salesforce/apex/ShipmentController.syncMultiple";

jest.mock(
  "@salesforce/apex",
  () => ({
    refreshApex: jest.fn(() => Promise.resolve())
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.getShipments",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return {
      default: createApexTestWireAdapter()
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.syncOne",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.syncMultiple",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

const SHIPMENTS = [
  shipment({
    Id: "a01000000000001AAA",
    Name: "SH-0001",
    Tracking_Code__c: "TRACK-IN-1",
    Carrier__c: "ups",
    Status__c: "in_transit",
    Risk_Level__c: "On Track",
    Case__c: "500000000000001AAA"
  }),
  shipment({
    Id: "a01000000000002AAA",
    Name: "SH-0002",
    Tracking_Code__c: "TRACK-RISK-2",
    Carrier__c: "fedex",
    Status__c: "pre_transit",
    Risk_Level__c: "At Risk"
  }),
  shipment({
    Id: "a01000000000003AAA",
    Name: "SH-0003",
    Tracking_Code__c: "TRACK-DELAY-3",
    Carrier__c: "ups",
    Status__c: "failure",
    Risk_Level__c: "Delayed",
    Risk_Reason__c: "Delivery failed or was returned"
  }),
  shipment({
    Id: "a01000000000004AAA",
    Name: "SH-0004",
    Tracking_Code__c: "TRACK-DONE-4",
    Carrier__c: "dhl",
    Status__c: "delivered",
    Risk_Level__c: "On Track",
    Risk_Reason__c: "Delivered"
  }),
  shipment({
    Id: "a01000000000005AAA",
    Name: "SH-0005",
    Tracking_Code__c: "TRACK-RETURN-5",
    Carrier__c: "usps",
    Status__c: "return_to_sender",
    Risk_Level__c: "Delayed"
  }),
  shipment({
    Id: "a01000000000006AAA",
    Name: "SH-0006",
    Tracking_Code__c: "TRACK-UNKNOWN-6",
    Carrier__c: "shippo",
    Status__c: "unknown",
    Risk_Level__c: "At Risk"
  })
];

function shipment(overrides) {
  return {
    Provider__c: "Shippo",
    Estimated_Delivery_Date__c: "2026-12-01T15:00:00.000Z",
    Last_Synced__c: "2026-11-01T12:00:00.000Z",
    Risk_Reason__c: "Within the estimated delivery time",
    Case__c: null,
    ...overrides
  };
}

function mount() {
  const element = createElement("c-shipment-dashboard", {
    is: ShipmentDashboard
  });
  document.body.appendChild(element);
  return element;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function text(element, selector) {
  return element.shadowRoot.querySelector(selector).textContent.trim();
}

function dispatchChange(element, selector, detail) {
  element.shadowRoot.querySelector(selector).dispatchEvent(
    new CustomEvent("change", {
      detail
    })
  );
}

describe("c-shipment-dashboard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("calculates KPI counts from retrieved shipment records", async () => {
    const element = mount();
    getShipments.emit(SHIPMENTS);
    await flush();

    expect(text(element, '[data-kpi-value="total"]')).toBe("6");
    expect(text(element, '[data-kpi-value="on-track"]')).toBe("2");
    expect(text(element, '[data-kpi-value="at-risk"]')).toBe("2");
    expect(text(element, '[data-kpi-value="delayed"]')).toBe("2");
    expect(
      element.shadowRoot.querySelector('[data-indicator="test-data"]')
        .textContent
    ).toContain("TEST DATA");
  });

  it("filters by tracking code, carrier, status, and risk", async () => {
    const element = mount();
    getShipments.emit(SHIPMENTS);
    await flush();

    dispatchChange(element, '[data-filter="search"]', {
      value: "track-delay"
    });
    jest.advanceTimersByTime(300);
    await flush();
    expect(element.shadowRoot.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(element.shadowRoot.querySelector("tbody tr").dataset.tracking).toBe(
      "TRACK-DELAY-3"
    );

    dispatchChange(element, '[data-filter="search"]', { value: "UPS" });
    jest.advanceTimersByTime(300);
    await flush();
    expect(element.shadowRoot.querySelectorAll("tbody tr")).toHaveLength(2);

    dispatchChange(element, '[data-filter="search"]', { value: "" });
    jest.advanceTimersByTime(300);
    dispatchChange(element, '[data-filter="status"]', {
      value: "delivered"
    });
    await flush();
    expect(element.shadowRoot.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(text(element, "tbody tr")).toContain("Delivered");

    dispatchChange(element, '[data-filter="status"]', { value: "All" });
    dispatchChange(element, '[data-filter="risk"]', { value: "At Risk" });
    await flush();
    const risks = [...element.shadowRoot.querySelectorAll("tbody tr")].map(
      (row) => row.textContent
    );
    expect(risks).toHaveLength(2);
    risks.forEach((rowText) => expect(rowText).toContain("At Risk"));
  });

  it("limits Needs Attention to At Risk and Delayed shipments", async () => {
    const element = mount();
    getShipments.emit(SHIPMENTS);
    await flush();

    dispatchChange(element, '[data-filter="attention"]', {
      checked: true
    });
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-filter="risk"]').disabled
    ).toBe(true);

    const rows = [...element.shadowRoot.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(4);
    rows.forEach((row) => {
      expect(row.textContent).not.toContain("On Track");
      expect(
        row.textContent.includes("At Risk") ||
          row.textContent.includes("Delayed")
      ).toBe(true);
    });
    expect(text(element, '[data-kpi-value="total"]')).toBe("6");
    expect(
      element.shadowRoot.querySelector('[data-state="no-matches"]')
    ).toBeNull();

    dispatchChange(element, '[data-filter="attention"]', {
      checked: false
    });
    await flush();
    expect(
      element.shadowRoot.querySelector('[data-filter="risk"]').disabled
    ).toBe(false);
  });

  it("shows an empty org state and a no-match state", async () => {
    const element = mount();
    getShipments.emit([]);
    await flush();
    expect(
      element.shadowRoot.querySelector('[data-state="empty"]')
    ).not.toBeNull();

    getShipments.emit(SHIPMENTS);
    await flush();
    dispatchChange(element, '[data-filter="search"]', {
      value: "missing-code"
    });
    jest.advanceTimersByTime(300);
    await flush();
    expect(
      element.shadowRoot.querySelector('[data-state="no-matches"]')
    ).not.toBeNull();
    expect(element.shadowRoot.querySelector('[data-state="empty"]')).toBeNull();
  });

  it("shows an Apex retrieval error", async () => {
    const element = mount();
    getShipments.error({
      message: "Unable to retrieve shipments: denied"
    });
    await flush();

    expect(text(element, '[data-state="error"]')).toContain(
      "Unable to retrieve shipments: denied"
    );
  });

  it("updates the journey when a different shipment is selected", async () => {
    const element = mount();
    getShipments.emit(SHIPMENTS);
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-state="no-selection"]')
    ).not.toBeNull();

    element.shadowRoot.querySelector('[data-tracking="TRACK-IN-1"]').click();
    await flush();

    const current = element.shadowRoot.querySelector(".step.is-current");
    expect(current.dataset.stage).toBe("in_transit");
    expect(element.shadowRoot.querySelector("[data-exception]")).toBeNull();
    expect(
      element.shadowRoot.querySelector(".step.is-complete").dataset.stage
    ).toBe("pre_transit");

    element.shadowRoot.querySelector('[data-tracking="TRACK-DONE-4"]').click();
    await flush();

    expect(
      element.shadowRoot.querySelectorAll(".step.is-complete")
    ).toHaveLength(4);
    expect(
      element.shadowRoot.querySelector(".step.is-current").dataset.stage
    ).toBe("delivered");
  });

  it.each(["failure", "return_to_sender", "unknown"])(
    "shows a halted exception journey for %s",
    async (status) => {
      const element = mount();
      getShipments.emit(SHIPMENTS);
      await flush();

      const tracking = {
        failure: "TRACK-DELAY-3",
        return_to_sender: "TRACK-RETURN-5",
        unknown: "TRACK-UNKNOWN-6"
      }[status];

      element.shadowRoot.querySelector(`[data-tracking="${tracking}"]`).click();
      await flush();

      const exception = element.shadowRoot.querySelector("[data-exception]");
      expect(exception).not.toBeNull();
      expect(exception.dataset.exception).toBe(status);
      expect(element.shadowRoot.querySelector(".step.is-current")).toBeNull();
      const expectedMessages = {
        return_to_sender: "returning to the sender",
        failure: "delivery failure",
        unknown: "status is unknown"
      };
      expect(exception.textContent).toContain(expectedMessages[status]);
      expect(
        element.shadowRoot.querySelectorAll(".step.is-complete")
      ).toHaveLength(0);
      expect(
        element.shadowRoot.querySelectorAll(".step.is-current")
      ).toHaveLength(0);
      expect(
        element.shadowRoot.querySelectorAll(".step.is-halted")
      ).toHaveLength(4);
    }
  );

  it("shows the correct journey stages for out_for_delivery status", async () => {
    const outForDeliveryShipments = [
      shipment({
        Id: "a01000000000009AAA",
        Name: "SH-0009",
        Tracking_Code__c: "TRACK-OFD-9",
        Carrier__c: "fedex",
        Status__c: "out_for_delivery",
        Risk_Level__c: "On Track"
      })
    ];
    const element = mount();
    getShipments.emit(outForDeliveryShipments);
    await flush();

    element.shadowRoot.querySelector('[data-tracking="TRACK-OFD-9"]').click();
    await flush();

    const current = element.shadowRoot.querySelector(".step.is-current");
    expect(current).not.toBeNull();
    expect(current.dataset.stage).toBe("out_for_delivery");
    expect(current.querySelector(".step-state").textContent.trim()).toBe(
      "Current stage"
    );

    const completed = element.shadowRoot.querySelectorAll(".step.is-complete");
    expect(completed).toHaveLength(2);
    const completedStages = [...completed].map((step) => step.dataset.stage);
    expect(completedStages).toEqual(["pre_transit", "in_transit"]);

    expect(element.shadowRoot.querySelector("[data-exception]")).toBeNull();
  });

  it("synchronizes the selected shipment with carrier, tracking code, and case", async () => {
    syncOne.mockResolvedValue({
      ...SHIPMENTS[0],
      Status__c: "out_for_delivery"
    });
    const element = mount();
    getShipments.emit(SHIPMENTS);
    await flush();

    element.shadowRoot.querySelector('[data-tracking="TRACK-IN-1"]').click();
    await flush();
    element.shadowRoot.querySelector('[data-action="sync-selected"]').click();
    await flush();
    await flush();

    expect(syncOne).toHaveBeenCalledWith({
      carrier: "ups",
      trackingNumber: "TRACK-IN-1",
      caseId: "500000000000001AAA"
    });
    expect(syncMultiple).not.toHaveBeenCalled();
    expect(refreshApex).toHaveBeenCalled();
    expect(text(element, '[data-state="feedback"]')).toContain(
      "Synchronized 1 shipment."
    );
  });

  it("synchronizes visible shipments in carrier groups and chunks of 100", async () => {
    const bulk = [shipmentGroup("ups", 101), shipmentGroup("fedex", 1)].flat();
    syncMultiple.mockImplementation(({ carrier, trackingNumbers }) =>
      Promise.resolve(
        trackingNumbers.map((trackingNumber, index) => ({
          Id: `synced-${carrier}-${index}`,
          Carrier__c: carrier,
          Tracking_Code__c: trackingNumber,
          Status__c: "in_transit",
          Risk_Level__c: "On Track",
          Provider__c: "Shippo"
        }))
      )
    );

    const element = mount();
    getShipments.emit(bulk);
    await flush();

    element.shadowRoot.querySelector('[data-action="sync-visible"]').click();
    await flush();
    await flush();
    await flush();

    const calls = syncMultiple.mock.calls.map((call) => call[0]);
    const upsCalls = calls.filter((call) => call.carrier === "ups");
    const fedexCalls = calls.filter((call) => call.carrier === "fedex");
    expect(upsCalls).toHaveLength(2);
    expect(upsCalls[0].trackingNumbers).toHaveLength(100);
    expect(upsCalls[1].trackingNumbers).toHaveLength(1);
    expect(fedexCalls).toHaveLength(1);
    expect(fedexCalls[0].trackingNumbers).toEqual(["fedex-1"]);
    expect(syncOne).not.toHaveBeenCalled();
    expect(text(element, '[data-state="feedback"]')).toContain(
      "Synchronized 102 shipments."
    );
  });

  it("does not send a second synchronization while one is running", async () => {
    let resolveSync;
    syncOne.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve;
        })
    );
    const element = mount();
    getShipments.emit(SHIPMENTS);
    await flush();

    element.shadowRoot.querySelector('[data-tracking="TRACK-IN-1"]').click();
    await flush();
    const button = element.shadowRoot.querySelector(
      '[data-action="sync-selected"]'
    );
    button.click();
    button.click();

    expect(syncOne).toHaveBeenCalledTimes(1);
    resolveSync({ ...SHIPMENTS[0] });
    await flush();
  });

  it("refreshes Salesforce records without synchronizing", async () => {
    const element = mount();
    getShipments.emit(SHIPMENTS);
    await flush();
    refreshApex.mockClear();

    element.shadowRoot.querySelector('[data-action="refresh"]').click();
    await flush();
    await flush();

    expect(refreshApex).toHaveBeenCalled();
    expect(syncOne).not.toHaveBeenCalled();
    expect(syncMultiple).not.toHaveBeenCalled();
    expect(text(element, '[data-state="feedback"]')).toContain(
      "Shipment records are up to date."
    );
  });

  it("reports a synchronization failure and skips records that cannot be sent", async () => {
    syncOne.mockRejectedValue({
      body: { message: "Unable to synchronize shipment: timeout" }
    });
    const element = mount();
    getShipments.emit([
      shipment({
        Id: "a01000000000007AAA",
        Name: "SH-0007",
        Tracking_Code__c: "TRACK-BAD",
        Carrier__c: "ups",
        Status__c: "in_transit",
        Risk_Level__c: "On Track"
      }),
      shipment({
        Id: "a01000000000008AAA",
        Name: "SH-0008",
        Tracking_Code__c: "",
        Carrier__c: "",
        Status__c: "unknown",
        Risk_Level__c: "At Risk"
      })
    ]);
    await flush();

    element.shadowRoot.querySelector('[data-id="a01000000000008AAA"]').click();
    await flush();
    element.shadowRoot.querySelector('[data-action="sync-selected"]').click();
    await flush();

    expect(syncMultiple).not.toHaveBeenCalled();
    expect(syncOne).not.toHaveBeenCalled();
    expect(text(element, '[data-state="feedback"]')).toContain(
      "Carrier and tracking code are required"
    );

    element.shadowRoot.querySelector('[data-tracking="TRACK-BAD"]').click();
    await flush();
    element.shadowRoot.querySelector('[data-action="sync-selected"]').click();
    await flush();
    await flush();

    expect(text(element, '[data-state="feedback"]')).toContain(
      "Unable to synchronize shipment: timeout"
    );
  });
});

function shipmentGroup(carrier, count) {
  return Array.from({ length: count }, (_unused, index) =>
    shipment({
      Id: `a01${carrier}${String(index + 1).padStart(12, "0")}AAA`,
      Name: `${carrier}-${index + 1}`,
      Tracking_Code__c: `${carrier}-${index + 1}`,
      Carrier__c: carrier,
      Status__c: "in_transit",
      Risk_Level__c: "On Track"
    })
  );
}
