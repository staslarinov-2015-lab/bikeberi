const state = {
  user: null,
  activeSection: "overview",
  search: "",
  statusFilter: "all",
  kpi: {
    totalBikes: 0,
    targetRate: 95,
  },
  repairs: [],
  inventory: [],
  diagnostics: [],
  repairDraftFromDiagnostic: null,
};

const loginOverlay = document.getElementById("login-overlay");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const roleDescription = document.getElementById("role-description");
const pageTitle = document.getElementById("page-title");
const heroTitle = document.getElementById("hero-title");
const heroCopy = document.getElementById("hero-copy");
const heroBadge = document.getElementById("hero-badge");
const globalSearch = document.getElementById("global-search");
const statusFilter = document.getElementById("status-filter");
const metricsGrid = document.getElementById("metrics-grid");
const timeline = document.getElementById("timeline");
const alertsList = document.getElementById("alerts-list");
const repairsTable = document.getElementById("repairs-table");
const diagnosticsTable = document.getElementById("diagnostics-table");
const inventoryGrid = document.getElementById("inventory-grid");
const repairForm = document.getElementById("repair-form");
const inventoryForm = document.getElementById("inventory-form");
const diagnosticForm = document.getElementById("diagnostic-form");
const ownerKpi = document.getElementById("owner-kpi");
const ownerKpiNote = document.getElementById("owner-kpi-note");
const ownerProcurement = document.getElementById("owner-procurement");
const ownerProcess = document.getElementById("owner-process");
const currentUser = document.getElementById("current-user");
const accountButton = document.getElementById("account-button");
const accountOverlay = document.getElementById("account-overlay");
const closeAccountButton = document.getElementById("close-account-button");
const passwordForm = document.getElementById("password-form");
const passwordMessage = document.getElementById("password-message");
const passwordError = document.getElementById("password-error");
const settingsForm = document.getElementById("settings-form");
const logoutButton = document.getElementById("logout-button");
const repairOverlay = document.getElementById("repair-overlay");
const inventoryOverlay = document.getElementById("inventory-overlay");
const openRepairModalButton = document.getElementById("open-repair-modal");
const closeRepairModalButton = document.getElementById("close-repair-modal");
const openInventoryModalButton = document.getElementById("open-inventory-modal");
const closeInventoryModalButton = document.getElementById("close-inventory-modal");
const diagnosticOverlay = document.getElementById("diagnostic-overlay");
const openDiagnosticModalButton = document.getElementById("open-diagnostic-modal");
const closeDiagnosticModalButton = document.getElementById("close-diagnostic-modal");
const refreshButton = document.getElementById("refresh-button");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "same-origin",
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && payload.error
        ? payload.error
        : "Ошибка запроса";
    throw new Error(message);
  }

  return payload;
}

function getRole() {
  return state.user?.role || "mechanic";
}

function getStatusClass(status) {
  if (status === "Готов") return "status-ready";
  if (status === "В ремонте") return "status-progress";
  return "status-waiting";
}

function getMetrics() {
  const readyRepairs = state.repairs.filter((item) => item.status === "Готов").length;
  const inRepair = state.repairs.filter((item) => item.status === "В ремонте").length;
  const waiting = state.repairs.filter((item) => item.status === "Ожидает запчасти").length;
  const lowStock = state.inventory.filter((item) => Number(item.stock) <= Number(item.min));
  const brokenBikes = inRepair + waiting;
  const workingBikes = Math.max(state.kpi.totalBikes - brokenBikes, 0);
  const readyRate = state.kpi.totalBikes
    ? Math.round((workingBikes / state.kpi.totalBikes) * 100)
    : 0;

  return {
    readyRepairs,
    inRepair,
    waiting,
    lowStock,
    workingBikes,
    readyRate,
  };
}

function getFilteredRepairs() {
  const query = state.search.trim().toLowerCase();
  return state.repairs.filter((item) => {
    const matchesStatus =
      state.statusFilter === "all" ? true : item.status === state.statusFilter;
    const haystack = [
      item.date,
      item.bike,
      item.issue,
      item.work,
      item.parts_used,
      item.needed_parts,
      item.status,
    ]
      .join(" ")
      .toLowerCase();

    return matchesStatus && haystack.includes(query);
  });
}

function syncRoleButtons() {
  document.querySelectorAll(".role-btn").forEach((button) => {
    const buttonRole = button.dataset.role;
    button.classList.toggle("hidden", buttonRole !== getRole());
    button.classList.toggle("is-active", buttonRole === getRole());
  });
}

function renderRoleContent() {
  const ownerMode = getRole() === "owner";

  roleDescription.textContent = ownerMode
    ? "Управленческий режим: контроль KPI, закупки, доступности парка и дисциплины сервиса."
    : "Операционный режим: быстро вносить ремонты, следить за проблемными байками и остатками деталей.";

  pageTitle.textContent = ownerMode ? "Контроль парка и сервиса" : "Сводка сервиса";
  heroTitle.textContent = ownerMode
    ? "Собственник видит бизнес-картину, а не только список поломок"
    : "Рабочий день механика под контролем";
  heroCopy.textContent = ownerMode
    ? "На одном экране видно, сколько байков реально готовы к аренде, где застревают ремонты и какие позиции тянут закупку."
    : "Видно текущую загрузку, зависшие ремонты и детали, которые нужно заказать.";
  heroBadge.textContent = ownerMode
    ? "Сегодня в фокусе: KPI и доступность парка"
    : "Сегодня в фокусе: оперативка";

  currentUser.textContent = state.user
    ? `${state.user.full_name} · ${ownerMode ? "Собственник" : "Механик"}`
    : "Не выполнен вход";

  document.querySelectorAll(".mechanic-only").forEach((node) => {
    node.classList.toggle("hidden", ownerMode);
  });

  document.querySelectorAll(".owner-only").forEach((node) => {
    node.classList.toggle("hidden", !ownerMode);
  });

  syncRoleButtons();
}

function renderSections() {
  document.querySelectorAll(".nav-link").forEach((button) => {
    const allowed = !button.classList.contains("owner-only") || getRole() === "owner";
    button.classList.toggle("hidden", !allowed);
    button.classList.toggle("is-active", button.dataset.section === state.activeSection);
  });

  document.querySelectorAll(".screen-section").forEach((section) => {
    section.classList.toggle("hidden", section.id !== `section-${state.activeSection}`);
  });
}

function renderStatusChips() {
  document.querySelectorAll("[data-status-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.statusFilter === state.statusFilter);
  });
}

function renderDiagnosticsTable() {
  const canManage = getRole() === "mechanic" || getRole() === "owner";
  diagnosticsTable.innerHTML = state.diagnostics
    .map(
      (item, index) => `
        <tr>
          <td><span class="row-index">${index + 1}</span></td>
          <td>${escapeHtml(item.date)}</td>
          <td><strong>${escapeHtml(item.bike)}</strong></td>
          <td>${escapeHtml(item.mechanic_name)}</td>
          <td>${escapeHtml(item.symptoms)}</td>
          <td>${escapeHtml(item.conclusion)}</td>
          <td>${escapeHtml(item.recommendation)}</td>
          <td class="mechanic-only">
            ${
              canManage
                ? `<div class="table-actions">
                    <button class="primary-btn primary-btn-small" type="button" data-action="create-repair-from-diagnostic" data-id="${item.id}">В ремонт</button>
                    <button class="icon-btn" type="button" data-action="edit-diagnostic" data-id="${item.id}">Изм.</button>
                    <button class="danger-btn" type="button" data-action="delete-diagnostic" data-id="${item.id}">Удалить</button>
                  </div>`
                : ""
            }
          </td>
        </tr>
      `
    )
    .join("");

  if (!state.diagnostics.length) {
    diagnosticsTable.innerHTML = `
      <tr>
        <td colspan="8" class="muted">Диагностических записей пока нет.</td>
      </tr>
    `;
  }
}

function renderMetrics() {
  const metrics = getMetrics();
  const ownerMode = getRole() === "owner";
  const cards = ownerMode
    ? [
        {
          label: "Исправных байков",
          value: metrics.workingBikes,
          note: `Из ${state.kpi.totalBikes} байков в парке`,
          state: "ok",
        },
        {
          label: "KPI готовности",
          value: `${metrics.readyRate}%`,
          note:
            metrics.readyRate >= state.kpi.targetRate
              ? "Цель выполняется"
              : `Ниже цели ${state.kpi.targetRate}%`,
          state: metrics.readyRate >= state.kpi.targetRate ? "ok" : "danger",
        },
        {
          label: "Зависшие ремонты",
          value: metrics.waiting,
          note: "Байки ждут поставку деталей",
          state: metrics.waiting ? "danger" : "ok",
        },
        {
          label: "Проблемные позиции",
          value: metrics.lowStock.length,
          note: metrics.lowStock.length ? "Есть риск по закупке" : "Склад в норме",
          state: metrics.lowStock.length ? "danger" : "ok",
        },
      ]
    : [
        {
          label: "Готово сегодня",
          value: metrics.readyRepairs,
          note: "Закрытые ремонты",
          state: "ok",
        },
        {
          label: "В ремонте",
          value: metrics.inRepair,
          note: "Активная загрузка механика",
          state: "neutral",
        },
        {
          label: "Ждут запчасти",
          value: metrics.waiting,
          note: metrics.waiting ? "Нужен контроль поставки" : "Ожиданий нет",
          state: metrics.waiting ? "danger" : "ok",
        },
        {
          label: "Мало на складе",
          value: metrics.lowStock.length,
          note: metrics.lowStock.length ? "Есть дефицит" : "Остатки в норме",
          state: metrics.lowStock.length ? "danger" : "ok",
        },
      ];

  metricsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card ${card.state === "danger" ? "is-danger" : card.state === "ok" ? "is-ok" : ""}">
          <p class="section-label">${escapeHtml(card.label)}</p>
          <div class="metric-value">${escapeHtml(card.value)}</div>
          <p class="metric-note">${escapeHtml(card.note)}</p>
        </article>
      `
    )
    .join("");
}

function renderTimeline() {
  const items = [...state.repairs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  timeline.innerHTML = items
    .map(
      (item) => `
        <article class="timeline-item">
          <div class="timeline-meta">
            <span>${escapeHtml(item.date)}</span>
            <span>${escapeHtml(item.bike)}</span>
          </div>
          <h4>${escapeHtml(item.issue)}</h4>
          <p class="muted">${escapeHtml(item.work)}</p>
          <div class="timeline-meta">
            <span>${escapeHtml(item.parts_used)}</span>
            <span class="status-pill ${getStatusClass(item.status)}">${escapeHtml(item.status)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAlerts() {
  const metrics = getMetrics();
  const alerts = [];

  metrics.lowStock.forEach((item) => {
    alerts.push({
      title: item.name,
      copy: `Остаток ${item.stock}, минимум ${item.min}. Пора формировать закупку.`,
      state: "danger",
    });
  });

  state.repairs
    .filter((item) => item.status === "Ожидает запчасти")
    .forEach((item) => {
      alerts.push({
        title: item.bike,
        copy: `${item.issue}. Нужно заказать: ${item.needed_parts}.`,
        state: "danger",
      });
    });

  if (!alerts.length) {
    alerts.push({
      title: "Система в норме",
      copy: "Критичных зависаний и дефицитов сейчас нет.",
      state: "ok",
    });
  }

  alertsList.innerHTML = alerts
    .map(
      (alert) => `
        <article class="alert-card ${alert.state === "danger" ? "is-danger" : "is-ok"}">
          <h4>${escapeHtml(alert.title)}</h4>
          <p class="alert-copy">${escapeHtml(alert.copy)}</p>
        </article>
      `
    )
    .join("");
}

function renderRepairsTable() {
  const rows = getFilteredRepairs();
  const canManage = getRole() === "mechanic" || getRole() === "owner";

  repairsTable.innerHTML = rows
    .map(
      (item, index) => `
        <tr>
          <td><span class="row-index">${index + 1}</span></td>
          <td>${escapeHtml(item.date)}</td>
          <td><strong>${escapeHtml(item.bike)}</strong></td>
          <td>${escapeHtml(item.issue)}</td>
          <td>${escapeHtml(item.work)}</td>
          <td>${escapeHtml(item.parts_used)}</td>
          <td>${escapeHtml(item.needed_parts)}</td>
          <td><span class="status-pill ${getStatusClass(item.status)}">${escapeHtml(item.status)}</span></td>
          <td class="mechanic-only">
            ${
              canManage
                ? `<div class="table-actions">
                    <button class="icon-btn" type="button" data-action="edit-repair" data-id="${item.id}">Изм.</button>
                    <button class="danger-btn" type="button" data-action="delete-repair" data-id="${item.id}">Удалить</button>
                  </div>`
                : ""
            }
          </td>
        </tr>
      `
    )
    .join("");

  if (!rows.length) {
    repairsTable.innerHTML = `
      <tr>
        <td colspan="9" class="muted">По текущему фильтру записей не найдено.</td>
      </tr>
    `;
  }
}

function renderInventory() {
  const canManage = getRole() === "mechanic" || getRole() === "owner";
  inventoryGrid.innerHTML = state.inventory
    .map((item) => {
      const isLow = Number(item.stock) <= Number(item.min);
      return `
        <article class="inventory-card ${isLow ? "is-low" : ""}">
          <div class="inventory-meta">
            <span>${escapeHtml(item.name)}</span>
            <span>${isLow ? "Дефицит" : "Норма"}</span>
          </div>
          <div class="inventory-stock">${escapeHtml(item.stock)}</div>
          <p class="muted">Минимум: ${escapeHtml(item.min)}</p>
          <p class="muted">Нужно заказать: ${escapeHtml(item.need_to_order ? "Да" : "Нет")}</p>
          ${
            canManage
              ? `<div class="inventory-actions">
                  <button class="icon-btn" type="button" data-action="edit-inventory" data-id="${item.id}">Изменить</button>
                  <button class="danger-btn" type="button" data-action="delete-inventory" data-id="${item.id}">Удалить</button>
                </div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function renderOwnerPanel() {
  const metrics = getMetrics();
  ownerKpi.textContent = `${metrics.readyRate}%`;
  ownerKpiNote.textContent =
    metrics.readyRate >= state.kpi.targetRate
      ? `Цель достигнута: ${metrics.workingBikes} исправных байков из ${state.kpi.totalBikes}.`
      : `Нужно поднять доступность парка: ${metrics.workingBikes} исправных из ${state.kpi.totalBikes}.`;

  const procurementItems = metrics.lowStock.length
    ? metrics.lowStock.map(
        (item) =>
          `<div class="stack-item"><strong>${escapeHtml(item.name)}</strong><p class="muted">Остаток ${item.stock}, минимум ${item.min}</p></div>`
      )
    : ['<div class="stack-item"><strong>Закупка не требуется</strong><p class="muted">Критичных дефицитов на складе нет.</p></div>'];

  ownerProcurement.innerHTML = procurementItems.join("");

  ownerProcess.innerHTML = [
    `<div class="stack-item"><strong>Ремонтов в работе: ${metrics.inRepair}</strong><p class="muted">Это активная техническая загрузка команды.</p></div>`,
    `<div class="stack-item"><strong>Ждут запчасти: ${metrics.waiting}</strong><p class="muted">Эти байки не вернутся в аренду без закупки.</p></div>`,
    `<div class="stack-item"><strong>Закрытых работ: ${metrics.readyRepairs}</strong><p class="muted">Сколько ремонтов уже доведено до статуса "Готов".</p></div>`,
  ].join("");
}

function render() {
  loginOverlay.classList.toggle("hidden", Boolean(state.user));
  globalSearch.value = state.search;
  statusFilter.value = state.statusFilter;
  if (settingsForm) {
    settingsForm.elements.totalBikes.value = state.kpi.totalBikes || "";
    settingsForm.elements.targetRate.value = state.kpi.targetRate || "";
  }
  renderRoleContent();
  renderSections();
  renderStatusChips();
  renderMetrics();
  renderTimeline();
  renderAlerts();
  renderRepairsTable();
  renderDiagnosticsTable();
  renderInventory();
  renderOwnerPanel();
}

async function bootstrap() {
  try {
    const payload = await api("/api/bootstrap", { method: "GET", headers: {} });
    state.user = payload.user;
    state.kpi = payload.kpi;
    state.repairs = payload.repairs;
    state.inventory = payload.inventory;
    state.diagnostics = payload.diagnostics || [];
    if (getRole() !== "owner" && state.activeSection === "owner") {
      state.activeSection = "overview";
    }
    render();
  } catch (error) {
    if (String(error.message).includes("Авторизация")) {
      state.user = null;
      render();
      return;
    }

    loginError.textContent = error.message;
    loginError.classList.remove("hidden");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.classList.add("hidden");
  loginError.textContent = "";

  const formData = new FormData(loginForm);

  try {
    const payload = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: String(formData.get("username")).trim(),
        password: String(formData.get("password")),
      }),
    });

    state.user = payload.user;
    loginForm.reset();
    await bootstrap();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.classList.remove("hidden");
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST", body: JSON.stringify({}) });
  } finally {
    state.user = null;
    render();
  }
});

accountButton.addEventListener("click", () => {
  passwordError.classList.add("hidden");
  passwordMessage.classList.add("hidden");
  passwordForm.reset();
  accountOverlay.classList.remove("hidden");
});

closeAccountButton.addEventListener("click", () => {
  accountOverlay.classList.add("hidden");
});

openRepairModalButton?.addEventListener("click", () => {
  if (state.repairDraftFromDiagnostic) {
    const draft = state.repairDraftFromDiagnostic;
    repairForm.elements.date.value = draft.date || "";
    repairForm.elements.bike.value = draft.bike || "";
    repairForm.elements.issue.value = draft.issue || "";
    repairForm.elements.work.value = draft.work || "";
    repairForm.elements.partsUsed.value = draft.partsUsed || "";
    repairForm.elements.neededParts.value = draft.neededParts || "";
    repairForm.elements.status.value = draft.status || "В ремонте";
  }
  repairOverlay.classList.remove("hidden");
});

closeRepairModalButton?.addEventListener("click", () => {
  repairOverlay.classList.add("hidden");
  repairForm.reset();
  delete repairForm.dataset.editId;
  state.repairDraftFromDiagnostic = null;
});

openInventoryModalButton?.addEventListener("click", () => {
  inventoryOverlay.classList.remove("hidden");
});

closeInventoryModalButton?.addEventListener("click", () => {
  inventoryOverlay.classList.add("hidden");
  inventoryForm.reset();
  delete inventoryForm.dataset.editId;
});

openDiagnosticModalButton?.addEventListener("click", () => {
  diagnosticOverlay.classList.remove("hidden");
});

closeDiagnosticModalButton?.addEventListener("click", () => {
  diagnosticOverlay.classList.add("hidden");
  diagnosticForm.reset();
  delete diagnosticForm.dataset.editId;
});

refreshButton?.addEventListener("click", async () => {
  await bootstrap();
});

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeSection = button.dataset.section;
    render();
  });
});

globalSearch.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderRepairsTable();
});

statusFilter.addEventListener("change", (event) => {
  state.statusFilter = event.target.value;
  renderStatusChips();
  renderRepairsTable();
});

document.querySelectorAll("[data-status-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.statusFilter = button.dataset.statusFilter;
    statusFilter.value = state.statusFilter;
    renderStatusChips();
    renderRepairsTable();
  });
});

repairForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(repairForm);
  const editingId = repairForm.dataset.editId;

  await api(editingId ? `/api/repairs/${editingId}` : "/api/repairs", {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify({
      date: formData.get("date") || new Date().toISOString().slice(0, 10),
      bike: String(formData.get("bike")).trim(),
      issue: String(formData.get("issue")).trim(),
      work: String(formData.get("work")).trim(),
      parts_used: String(formData.get("partsUsed")).trim() || "-",
      needed_parts: String(formData.get("neededParts")).trim() || "-",
      status: String(formData.get("status")),
    }),
  });

  repairForm.reset();
  delete repairForm.dataset.editId;
  repairOverlay.classList.add("hidden");
  state.repairDraftFromDiagnostic = null;
  state.activeSection = "repairs";
  await bootstrap();
});

inventoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(inventoryForm);
  const editingId = inventoryForm.dataset.editId;

  await api(editingId ? `/api/inventory/${editingId}` : "/api/inventory", {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify({
      name: String(formData.get("name")).trim(),
      stock: Number(formData.get("stock")),
      min: Number(formData.get("min")),
    }),
  });

  inventoryForm.reset();
  delete inventoryForm.dataset.editId;
  inventoryOverlay.classList.add("hidden");
  state.activeSection = "inventory";
  await bootstrap();
});

diagnosticForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(diagnosticForm);
  const editingId = diagnosticForm.dataset.editId;

  await api(editingId ? `/api/diagnostics/${editingId}` : "/api/diagnostics", {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify({
      date: formData.get("date") || new Date().toISOString().slice(0, 10),
      bike: String(formData.get("bike")).trim(),
      mechanicName: String(formData.get("mechanicName")).trim(),
      symptoms: String(formData.get("symptoms")).trim(),
      conclusion: String(formData.get("conclusion")).trim(),
      recommendation: String(formData.get("recommendation")).trim(),
    }),
  });

  diagnosticForm.reset();
  delete diagnosticForm.dataset.editId;
  diagnosticOverlay.classList.add("hidden");
  state.activeSection = "diagnostics";
  await bootstrap();
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  passwordError.classList.add("hidden");
  passwordMessage.classList.add("hidden");

  const formData = new FormData(passwordForm);

  try {
    const payload = await api("/api/account/password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: String(formData.get("currentPassword")),
        newPassword: String(formData.get("newPassword")),
      }),
    });
    passwordMessage.textContent = payload.message;
    passwordMessage.classList.remove("hidden");
    passwordForm.reset();
  } catch (error) {
    passwordError.textContent = error.message;
    passwordError.classList.remove("hidden");
  }
});

if (settingsForm) {
  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(settingsForm);
    await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        totalBikes: Number(formData.get("totalBikes")),
        targetRate: Number(formData.get("targetRate")),
      }),
    });
    await bootstrap();
  });
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const id = target.dataset.id;
  const action = target.dataset.action;

  if (action === "edit-repair") {
    const repair = state.repairs.find((item) => String(item.id) === id);
    if (!repair) return;
    state.repairDraftFromDiagnostic = null;
    repairForm.dataset.editId = id;
    repairForm.elements.date.value = repair.date;
    repairForm.elements.bike.value = repair.bike;
    repairForm.elements.issue.value = repair.issue;
    repairForm.elements.work.value = repair.work;
    repairForm.elements.partsUsed.value = repair.parts_used;
    repairForm.elements.neededParts.value = repair.needed_parts;
    repairForm.elements.status.value = repair.status;
    repairOverlay.classList.remove("hidden");
  }

  if (action === "delete-repair") {
    if (!window.confirm("Удалить эту запись ремонта?")) return;
    await api(`/api/repairs/${id}`, { method: "DELETE", headers: {} });
    await bootstrap();
  }

  if (action === "edit-inventory") {
    const item = state.inventory.find((entry) => String(entry.id) === id);
    if (!item) return;
    inventoryForm.dataset.editId = id;
    inventoryForm.elements.name.value = item.name;
    inventoryForm.elements.stock.value = item.stock;
    inventoryForm.elements.min.value = item.min;
    inventoryOverlay.classList.remove("hidden");
  }

  if (action === "delete-inventory") {
    if (!window.confirm("Удалить эту складскую позицию?")) return;
    await api(`/api/inventory/${id}`, { method: "DELETE", headers: {} });
    await bootstrap();
  }

  if (action === "edit-diagnostic") {
    const item = state.diagnostics.find((entry) => String(entry.id) === id);
    if (!item) return;
    diagnosticForm.dataset.editId = id;
    diagnosticForm.elements.date.value = item.date;
    diagnosticForm.elements.bike.value = item.bike;
    diagnosticForm.elements.mechanicName.value = item.mechanic_name;
    diagnosticForm.elements.symptoms.value = item.symptoms;
    diagnosticForm.elements.conclusion.value = item.conclusion;
    diagnosticForm.elements.recommendation.value = item.recommendation;
    diagnosticOverlay.classList.remove("hidden");
  }

  if (action === "delete-diagnostic") {
    if (!window.confirm("Удалить эту диагностическую запись?")) return;
    await api(`/api/diagnostics/${id}`, { method: "DELETE", headers: {} });
    await bootstrap();
  }

  if (action === "create-repair-from-diagnostic") {
    const item = state.diagnostics.find((entry) => String(entry.id) === id);
    if (!item) return;
    state.repairDraftFromDiagnostic = {
      date: item.date,
      bike: item.bike,
      issue: item.symptoms,
      work: item.conclusion,
      partsUsed: "-",
      neededParts: item.recommendation === "Срочный ремонт" ? "Уточнить после ремонта" : "-",
      status: item.recommendation === "Снять с линии" ? "Ожидает запчасти" : "В ремонте",
    };
    state.activeSection = "repairs";
    render();
    repairForm.reset();
    repairForm.elements.date.value = state.repairDraftFromDiagnostic.date || "";
    repairForm.elements.bike.value = state.repairDraftFromDiagnostic.bike || "";
    repairForm.elements.issue.value = state.repairDraftFromDiagnostic.issue || "";
    repairForm.elements.work.value = state.repairDraftFromDiagnostic.work || "";
    repairForm.elements.partsUsed.value = state.repairDraftFromDiagnostic.partsUsed || "";
    repairForm.elements.neededParts.value = state.repairDraftFromDiagnostic.neededParts || "";
    repairForm.elements.status.value = state.repairDraftFromDiagnostic.status || "В ремонте";
    repairOverlay.classList.remove("hidden");
  }
});

bootstrap();
