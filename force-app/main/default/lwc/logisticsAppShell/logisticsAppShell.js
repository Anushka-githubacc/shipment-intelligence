import { LightningElement } from "lwc";

const WORKSPACES = [
  {
    id: "control-tower",
    label: "Control Tower",
    icon: "utility:dashboard",
    isComingSoon: false,
    description:
      "Live operations, delay risk intelligence, and interactive shipment journey tracking."
  },
  {
    id: "shipment-intelligence",
    label: "Shipment Intelligence",
    icon: "utility:transit_shipment",
    isComingSoon: true,
    description:
      "Deep telemetry, multi-leg consignment tracking, and route-level operational visibility across global transit networks."
  },
  {
    id: "risk-intelligence",
    label: "Risk Intelligence",
    icon: "utility:shield",
    isComingSoon: true,
    description:
      "Predictive delay modelling, carrier SLA risk scoring, and weather-impact pattern forecasting."
  },
  {
    id: "exception-centre",
    label: "Exception Centre",
    icon: "utility:error",
    isComingSoon: true,
    description:
      "Automated NDR (Non-Delivery Report) triage, returned-to-sender workflows, and carrier escalation management."
  },
  {
    id: "analytics-reports",
    label: "Analytics & Reports",
    icon: "utility:analytics",
    isComingSoon: true,
    description:
      "Executive KPI aggregations, carrier transit time benchmarks, and SLA compliance analytics."
  },
  {
    id: "case-management",
    label: "Case Management",
    icon: "utility:case",
    isComingSoon: true,
    description:
      "Automated customer communication drafts, Case-linked tracking, and CRM resolution pipelines."
  }
];

export default class LogisticsAppShell extends LightningElement {
  activeWorkspaceId = "control-tower";
  isSidebarCollapsed = false;
  isMobileNavOpen = false;

  globalSearchInput = "";
  globalSearchTerm = "";
  searchDebounceTimeout = null;

  disconnectedCallback() {
    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
      this.searchDebounceTimeout = null;
    }
  }

  get isControlTowerActive() {
    return this.activeWorkspaceId === "control-tower";
  }

  get currentWorkspace() {
    return (
      WORKSPACES.find((ws) => ws.id === this.activeWorkspaceId) || WORKSPACES[0]
    );
  }

  get shellContainerClass() {
    const classes = ["app-shell"];
    if (this.isSidebarCollapsed) {
      classes.push("is-collapsed");
    }
    if (this.isMobileNavOpen) {
      classes.push("is-mobile-open");
    }
    return classes.join(" ");
  }

  get sidebarClass() {
    return this.isSidebarCollapsed ? "sidebar collapsed" : "sidebar";
  }

  get collapseToggleLabel() {
    return this.isSidebarCollapsed
      ? "Expand application sidebar"
      : "Collapse application sidebar";
  }

  get collapseActionText() {
    return this.isSidebarCollapsed ? "" : "Collapse navigation";
  }

  get collapseIcon() {
    return this.isSidebarCollapsed
      ? "utility:chevronright"
      : "utility:chevronleft";
  }

  get workspaces() {
    return WORKSPACES.map((ws) => {
      const isSelected = ws.id === this.activeWorkspaceId;
      const buttonClass = ["nav-item"];
      if (isSelected) {
        buttonClass.push("is-active");
      }
      if (ws.isComingSoon) {
        buttonClass.push("is-coming-soon");
      }
      return {
        ...ws,
        isSelected,
        buttonClass: buttonClass.join(" "),
        ariaCurrent: isSelected ? "page" : undefined,
        iconClass: isSelected ? "icon-active" : "icon-muted"
      };
    });
  }

  handleNavClick(event) {
    const targetId = event.currentTarget.dataset.workspace;
    if (targetId && targetId !== this.activeWorkspaceId) {
      this.activeWorkspaceId = targetId;
    }
    this.isMobileNavOpen = false;
  }

  handleToggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  handleToggleMobileNav() {
    this.isMobileNavOpen = !this.isMobileNavOpen;
  }

  handleCloseMobileNav() {
    this.isMobileNavOpen = false;
  }

  handleGlobalSearchChange(event) {
    const rawValue = event.detail.value ? event.detail.value.trim() : "";
    this.globalSearchInput = event.detail.value || "";

    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
    }

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.searchDebounceTimeout = setTimeout(() => {
      this.globalSearchTerm = rawValue;
      this.searchDebounceTimeout = null;

      // If user searches while in a Coming Soon workspace, switch back to Control Tower
      if (!this.isControlTowerActive && rawValue) {
        this.activeWorkspaceId = "control-tower";
      }
    }, 300);
  }

  handleGlobalRefresh() {
    const dashboard = this.template.querySelector("c-shipment-dashboard");
    if (dashboard && typeof dashboard.refresh === "function") {
      dashboard.refresh();
    }
  }

  handleReturnToControlTower() {
    this.activeWorkspaceId = "control-tower";
  }
}
