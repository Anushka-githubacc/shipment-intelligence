import { createElement } from "@lwc/engine-dom";
import ShipmentIntelligence from "c/shipmentIntelligence";
import getShipments from "@salesforce/apex/ShipmentController.getShipments";
import getShipmentDetail from "@salesforce/apex/ShipmentController.getShipmentDetail";
import getShipmentEvents from "@salesforce/apex/ShipmentController.getShipmentEvents";
import refreshShipment from "@salesforce/apex/ShipmentController.refreshShipment";
import { refreshApex } from "@salesforce/apex";

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
  "@salesforce/apex/ShipmentController.getShipmentDetail",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return {
      default: createApexTestWireAdapter()
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.getShipmentEvents",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return {
      default: createApexTestWireAdapter()
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.refreshShipment",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

const MOCK_SHIPMENTS = [
  {
    Id: "a01000000000001AAA",
    Tracking_Code__c: "SHIPPO-TRANSIT-01",
    Carrier__c: "shippo",
    Provider__c: "Shippo",
    Status__c: "in_transit",
    Risk_Level__c: "On Track",
    Risk_Reason__c: "Within delivery window",
    Estimated_Delivery_Date__c: "2026-11-20T12:00:00Z",
    Last_Synced__c: "2026-11-15T10:00:00Z",
    Case__c: "500000000000001AAA",
    Case__r: {
      CaseNumber: "00001001",
      Subject: "Package delayed in Chicago",
      Status: "Working",
      Priority: "High"
    }
  },
  {
    Id: "a01000000000002AAA",
    Tracking_Code__c: "SHIPPO-DELIVERED-02",
    Carrier__c: "usps",
    Provider__c: "Shippo",
    Status__c: "delivered",
    Risk_Level__c: "On Track",
    Risk_Reason__c: "Delivered successfully",
    Estimated_Delivery_Date__c: "2026-11-14T15:00:00Z",
    Last_Synced__c: "2026-11-15T10:00:00Z",
    Case__c: null
  },
  {
    Id: "a01000000000003AAA",
    Tracking_Code__c: "SHIPPO-FAIL-03",
    Carrier__c: "fedex",
    Provider__c: "Shippo",
    Status__c: "failure",
    Risk_Level__c: "Delayed",
    Risk_Reason__c: "Delivery attempted, recipient not home",
    Estimated_Delivery_Date__c: "2026-11-10T12:00:00Z",
    Last_Synced__c: "2026-11-15T10:00:00Z",
    Case__c: null
  }
];

const MOCK_EVENTS = [
  {
    Id: "a02000000000001AAA",
    Event_ID__c: "evt-101",
    Event_Date__c: "2026-11-15T09:30:00Z",
    Event_Status__c: "in_transit",
    Event_Description__c: "Departed sorting facility",
    Event_Location__c: "Chicago, IL 60601, US",
    Provider__c: "Shippo"
  },
  {
    Id: "a02000000000002AAA",
    Event_ID__c: "evt-102",
    Event_Date__c: "2026-11-14T14:00:00Z",
    Event_Status__c: "pre_transit",
    Event_Description__c: "Shipping label created",
    Event_Location__c: "New York, NY 10001, US",
    Provider__c: "Shippo"
  }
];

function mount() {
  const element = createElement("c-shipment-intelligence", {
    is: ShipmentIntelligence
  });
  document.body.appendChild(element);
  return element;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function text(element, selector) {
  const root = element.shadowRoot || element;
  const node = root.querySelector(selector);
  return node ? node.textContent.trim() : "";
}

describe("c-shipment-intelligence", () => {
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

  it("renders explorer sidebar and auto-selects the first shipment", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    getShipmentDetail.emit(MOCK_SHIPMENTS[0]);
    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    expect(text(element, ".explorer-title")).toBe("Shipment Explorer");
    expect(text(element, ".count-pill")).toBe("3");

    const cards = element.shadowRoot.querySelectorAll(".shipment-card");
    expect(cards.length).toBe(3);
    expect(cards[0].classList.contains("active-card")).toBe(true);

    // Selected shipment details
    expect(text(element, ".tracking-title")).toBe("SHIPPO-TRANSIT-01");
    expect(text(element, ".carrier-badge")).toBe("shippo");
    expect(text(element, ".provider-badge")).toBe("Via Shippo");
  });

  it("updates selection when another shipment is clicked", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    getShipmentDetail.emit(MOCK_SHIPMENTS[0]);
    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    const cards = element.shadowRoot.querySelectorAll(".shipment-card");
    cards[1].click();
    await flush();

    getShipmentDetail.emit(MOCK_SHIPMENTS[1]);
    getShipmentEvents.emit([]);
    await flush();

    expect(text(element, ".tracking-title")).toBe("SHIPPO-DELIVERED-02");
  });

  it("renders journey stepper for in_transit status correctly", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    getShipmentDetail.emit(MOCK_SHIPMENTS[0]);
    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    const stepItems = element.shadowRoot.querySelectorAll(".step-item");
    expect(stepItems.length).toBe(4);
    expect(stepItems[0].classList.contains("step-completed")).toBe(true);
    expect(stepItems[1].classList.contains("step-active")).toBe(true);
    expect(stepItems[2].classList.contains("step-completed")).toBe(false);
    expect(stepItems[3].classList.contains("step-completed")).toBe(false);
  });

  it("renders journey stepper for delivered status with all steps completed", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    getShipmentDetail.emit(MOCK_SHIPMENTS[1]);
    getShipmentEvents.emit([]);
    await flush();

    const stepItems = element.shadowRoot.querySelectorAll(".step-item");
    expect(stepItems[0].classList.contains("step-completed")).toBe(true);
    expect(stepItems[1].classList.contains("step-completed")).toBe(true);
    expect(stepItems[2].classList.contains("step-completed")).toBe(true);
    expect(stepItems[3].classList.contains("step-completed")).toBe(true);
  });

  it("renders exception banner and stepper state for failure status", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    getShipmentDetail.emit(MOCK_SHIPMENTS[2]);
    getShipmentEvents.emit([]);
    await flush();

    expect(
      element.shadowRoot.querySelector(".exception-banner")
    ).not.toBeNull();
    expect(text(element, ".exception-title")).toBe(
      "Exception: Delivery Failure"
    );

    const stepItems = element.shadowRoot.querySelectorAll(".step-item");
    expect(stepItems[1].classList.contains("step-exception")).toBe(true);
    expect(stepItems[3].classList.contains("step-completed")).toBe(false);
  });

  it("displays linked Case details when Case is present", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    getShipmentDetail.emit(MOCK_SHIPMENTS[0]);
    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    expect(text(element, ".case-link")).toBe("#00001001");
    expect(text(element, ".priority-tag")).toBe("High");
    expect(text(element, ".case-card")).toContain("Package delayed in Chicago");
  });

  it("displays empty state when no Case is linked", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    getShipmentDetail.emit(MOCK_SHIPMENTS[1]);
    getShipmentEvents.emit([]);
    await flush();

    expect(text(element, ".empty-case-title")).toBe("No Linked Support Case");
  });

  it("displays milestone timeline with events", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    getShipmentDetail.emit(MOCK_SHIPMENTS[0]);
    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    const timelineEntries =
      element.shadowRoot.querySelectorAll(".timeline-entry");
    expect(timelineEntries.length).toBe(2);
    expect(text(timelineEntries[0], ".timeline-desc")).toBe(
      "Departed sorting facility"
    );
    expect(text(timelineEntries[0], ".timeline-loc")).toContain("Chicago, IL");
  });

  it("displays empty state when no milestone events are recorded", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    getShipmentDetail.emit(MOCK_SHIPMENTS[1]);
    getShipmentEvents.emit([]);
    await flush();

    expect(text(element, ".empty-timeline-title")).toBe(
      "No Tracking Events Recorded"
    );
  });

  it("debounces search input and refreshes list", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const searchInput = element.shadowRoot.querySelector(".explorer-search");
    searchInput.value = "SHIPPO-FAIL";
    searchInput.dispatchEvent(new CustomEvent("change"));

    // Before 300ms
    jest.advanceTimersByTime(200);
    await flush();

    // Advance remaining time
    jest.advanceTimersByTime(100);
    await flush();

    expect(getShipments.getLastConfig().searchTerm).toBe("SHIPPO-FAIL");
  });

  it("filters shipments by status and risk comboboxes", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const comboboxes = element.shadowRoot.querySelectorAll(".filter-dropdown");
    const statusCombobox = comboboxes[0];
    const riskCombobox = comboboxes[1];

    statusCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "in_transit" } })
    );
    riskCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "On Track" } })
    );
    await flush();

    expect(getShipments.getLastConfig().statusFilter).toBe("in_transit");
    expect(getShipments.getLastConfig().riskFilter).toBe("On Track");
  });

  it("calls refreshShipment imperative Apex on refresh button click", async () => {
    refreshShipment.mockResolvedValue({ Id: "a01000000000001AAA" });

    const element = mount();
    const toastHandler = jest.fn();
    element.addEventListener("lightning__showtoast", toastHandler);

    getShipments.emit(MOCK_SHIPMENTS);
    getShipmentDetail.emit(MOCK_SHIPMENTS[0]);
    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    const refreshBtn = element.shadowRoot.querySelector(".refresh-btn");
    refreshBtn.click();
    await flush();
    await flush();
    await flush();

    expect(refreshShipment).toHaveBeenCalledWith({
      shipmentId: "a01000000000001AAA"
    });
    expect(refreshApex).toHaveBeenCalled();
    expect(toastHandler).toHaveBeenCalled();
  });

  it("handles externalSearchTerm API property update", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    element.externalSearchTerm = "EXT-TERM-123";
    jest.advanceTimersByTime(300);
    await flush();

    expect(element.externalSearchTerm).toBe("EXT-TERM-123");
    expect(getShipments.getLastConfig().searchTerm).toBe("EXT-TERM-123");
  });

  it("handles handleRefresh API method", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    getShipmentDetail.emit(MOCK_SHIPMENTS[0]);
    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    await element.handleRefresh();
    expect(refreshApex).toHaveBeenCalled();
  });
});
