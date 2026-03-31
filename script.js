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
  diagnosticFlow: {
    mode: "create",
    category: "",
    fault: "",
  },
};

const DIAGNOSTIC_LIBRARY = {
  "Пластик": {
    summary: "Обвес, крышки, внешние элементы корпуса",
    faults: [
      "Трещина пластика",
      "Сломано крепление",
      "Отсутствует элемент корпуса",
      "Корпус болтается",
      "Повреждена крышка батареи",
    ],
  },
  "Руль и управление": {
    summary: "Рулевая, ручки, рычаги, органы управления",
    faults: [
      "Люфт рулевой",
      "Руль стоит криво",
      "Не работает ручка газа",
      "Поврежден рычаг тормоза",
      "Тугой поворот руля",
    ],
  },
  "Тормоза": {
    summary: "Передний и задний контур торможения",
    faults: [
      "Скрип тормоза",
      "Стерты колодки",
      "Кривой тормозной диск",
      "Не тормозит передний тормоз",
      "Не тормозит задний тормоз",
    ],
  },
  "Колеса и шины": {
    summary: "Покрышки, камеры, подшипники, диски",
    faults: [
      "Прокол",
      "Спускает колесо",
      "Изношена покрышка",
      "Биение колеса",
      "Люфт колеса",
    ],
  },
  "Мотор": {
    summary: "Тяга, шум, вибрации, поведение привода",
    faults: [
      "Не тянет мотор",
      "Рывки при разгоне",
      "Посторонний шум мотора",
      "Мотор не включается",
      "Перегрев мотора",
    ],
  },
  "Батарея": {
    summary: "Батарея, зарядка, фиксация и контакты",
    faults: [
      "Батарея не заряжается",
      "Быстро теряет заряд",
      "Батарея не фиксируется",
      "Не определяется батарея",
      "Поврежден зарядный порт",
    ],
  },
  "Электрика": {
    summary: "Контроллер, проводка, кнопки, питание",
    faults: [
      "Не включается байк",
      "Ошибка контроллера",
      "Пропадает питание",
      "Повреждена проводка",
      "Окисление разъемов",
    ],
  },
  "Свет": {
    summary: "Фара, задний фонарь, стоп-сигнал, сигнал",
    faults: [
      "Не работает передняя фара",
      "Не работает задний фонарь",
      "Не работает стоп-сигнал",
      "Мигает свет",
      "Не работает сигнал",
    ],
  },
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
const diagnosticCategoryGrid = document.getElementById("diagnostic-category-grid");
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
const profileForm = document.getElementById("profile-form");
const profileMessage = document.getElementById("profile-message");
const profileNameDisplay = document.getElementById("profile-name-display");
const profileRoleDisplay = document.getElementById("profile-role-display");
const profilePhoneDisplay = document.getElementById("profile-phone-display");
const profileTelegramDisplay = document.getElementById("profile-telegram-display");
const profilePositionDisplay = document.getElementById("profile-position-display");
const profileAvatar = document.getElementById("profile-avatar");
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
const diagnosticModalTitle = document.getElementById("diagnostic-modal-title");
const diagnosticWizardCategoryGrid = document.getElementById("diagnostic-wizard-category-grid");
const diagnosticFaultGrid = document.getElementById("diagnostic-fault-grid");
const diagnosticFaultsTitle = document.getElementById("diagnostic-faults-title");
const diagnosticSelectedCategory = document.getElementById("diagnostic-selected-category");
const diagnosticSelectedFault = document.getElementById("diagnostic-selected-fault");
const diagnosticBackToCategories = document.getElementById("diagnostic-back-to-categories");
const diagnosticBackToFaults = document.getElementById("diagnostic-back-to-faults");
const diagnosticStepCategories = document.getElementById("diagnostic-step-categories");
const diagnosticStepFaults = document.getElementById("diagnostic-step-faults");
const diagnosticStepDetails = document.getElementById("diagnostic-step-details");
const diagnosticStepViewCategories = document.getElementById("diagnostic-step-view-categories");
const diagnosticStepViewFaults = document.getElementById("diagnostic-step-view-faults");
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

function getSeverityClass(severity) {
  if (severity === "Критичная") return "severity-critical";
  if (severity === "Средняя") return "severity-medium";
  return "severity-low";
}

function getDiagnosticCategoryCount(category) {
  return state.diagnostics.filter((item) => item.category === category).length;
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

function renderProfile() {
  if (!state.user) return;

  const initials = (state.user.full_name || state.user.username || "М")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  profileAvatar.textContent = initials || "М";
  profileNameDisplay.textContent = state.user.full_name || "Не заполнено";
  profileRoleDisplay.textContent = state.user.position || (getRole() === "owner" ? "Собственник" : "Механик");
  profilePhoneDisplay.textContent = state.user.phone || "Не заполнен";
  profileTelegramDisplay.textContent = state.user.telegram || "Не заполнен";
  profilePositionDisplay.textContent = state.user.position || "Не заполнена";

  if (profileForm) {
    profileForm.elements.fullName.value = state.user.full_name || "";
    profileForm.elements.position.value = state.user.position || "";
    profileForm.elements.phone.value = state.user.phone || "";
    profileForm.elements.telegram.value = state.user.telegram || "";
    profileForm.elements.notes.value = state.user.notes || "";
  }
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
          <td data-label="#"><span class="row-index">${index + 1}</span></td>
          <td data-label="Дата">${escapeHtml(item.date)}</td>
          <td data-label="Байк"><strong>${escapeHtml(item.bike)}</strong></td>
          <td data-label="Кто проверял">${escapeHtml(item.mechanic_name)}</td>
          <td data-label="Раздел"><span class="diagnostic-category-tag">${escapeHtml(item.category || "Общее")}</span></td>
          <td data-label="Поломка"><strong>${escapeHtml(item.fault || "Не указана")}</strong></td>
          <td data-label="Симптомы">${escapeHtml(item.symptoms)}</td>
          <td data-label="Заключение">${escapeHtml(item.conclusion)}</td>
          <td data-label="Срочность"><span class="severity-pill ${getSeverityClass(item.severity)}">${escapeHtml(item.severity || "Низкая")}</span></td>
          <td data-label="Рекомендация">${escapeHtml(item.recommendation)}</td>
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
        <td colspan="11" class="muted">Диагностических записей пока нет.</td>
      </tr>
    `;
  }
}

function renderDiagnosticCategoryGrid() {
  const cards = Object.entries(DIAGNOSTIC_LIBRARY).map(([category, config]) => {
    const count = getDiagnosticCategoryCount(category);
    return `
      <button class="diagnostic-category-card" type="button" data-action="start-diagnostic-category" data-category="${escapeHtml(category)}">
        <strong>${escapeHtml(category)}</strong>
        <p>${escapeHtml(config.summary)}</p>
        <p class="muted">Записей: ${count}</p>
      </button>
    `;
  });

  if (diagnosticCategoryGrid) {
    diagnosticCategoryGrid.innerHTML = cards.join("");
  }

  if (diagnosticWizardCategoryGrid) {
    diagnosticWizardCategoryGrid.innerHTML = cards.join("");
  }
}

function renderDiagnosticFaultGrid() {
  const category = state.diagnosticFlow.category;
  const config = DIAGNOSTIC_LIBRARY[category];
  if (!diagnosticFaultGrid || !diagnosticFaultsTitle) return;

  diagnosticFaultsTitle.textContent = category
    ? `Выбери поломку: ${category}`
    : "Выбери типовую поломку";

  if (!config) {
    diagnosticFaultGrid.innerHTML = '<p class="muted">Сначала выбери раздел диагностики.</p>';
    return;
  }

  diagnosticFaultGrid.innerHTML = config.faults
    .map(
      (fault) => `
        <button class="diagnostic-fault-card" type="button" data-action="select-diagnostic-fault" data-fault="${escapeHtml(fault)}">
          <strong>${escapeHtml(fault)}</strong>
          <p>Зафиксировать эту неисправность и перейти к карточке осмотра</p>
        </button>
      `
    )
    .join("");
}

function syncDiagnosticWizard() {
  const category = state.diagnosticFlow.category;
  const fault = state.diagnosticFlow.fault;

  diagnosticSelectedCategory.textContent = category || "Не выбран";
  diagnosticSelectedFault.textContent = fault || "Не выбрана";

  const editing = state.diagnosticFlow.mode === "edit";
  diagnosticModalTitle.textContent = editing ? "Редактирование диагностической записи" : "Новая диагностическая запись";

  diagnosticStepCategories.classList.toggle("is-active", !category);
  diagnosticStepFaults.classList.toggle("is-active", Boolean(category) && !fault);
  diagnosticStepDetails.classList.toggle("is-active", Boolean(category) && Boolean(fault));

  diagnosticStepViewCategories.classList.toggle("hidden", Boolean(category));
  diagnosticStepViewFaults.classList.toggle("hidden", !category || Boolean(fault));
  diagnosticForm.classList.toggle("hidden", !category || !fault);
}

function resetDiagnosticFlow() {
  state.diagnosticFlow = {
    mode: "create",
    category: "",
    fault: "",
  };
  diagnosticForm.reset();
  delete diagnosticForm.dataset.editId;
  diagnosticForm.elements.date.value = new Date().toISOString().slice(0, 10);
  diagnosticForm.elements.mechanicName.value = state.user?.full_name || "";
  diagnosticForm.elements.recommendation.value = "Наблюдать";
  diagnosticForm.elements.severity.value = "Низкая";
  diagnosticForm.elements.category.value = "";
  diagnosticForm.elements.fault.value = "";
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
}

function openDiagnosticOverlay() {
  diagnosticOverlay.classList.remove("hidden");
  renderDiagnosticCategoryGrid();
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
}

function chooseDiagnosticCategory(category) {
  state.diagnosticFlow.category = category;
  state.diagnosticFlow.fault = "";
  diagnosticForm.elements.category.value = category;
  diagnosticForm.elements.fault.value = "";
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
}

function chooseDiagnosticFault(fault) {
  state.diagnosticFlow.fault = fault;
  diagnosticForm.elements.category.value = state.diagnosticFlow.category;
  diagnosticForm.elements.fault.value = fault;
  if (!diagnosticForm.elements.symptoms.value.trim()) {
    diagnosticForm.elements.symptoms.value = `${state.diagnosticFlow.category}: ${fault}`;
  }
  syncDiagnosticWizard();
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
          <td data-label="#"><span class="row-index">${index + 1}</span></td>
          <td data-label="Дата">${escapeHtml(item.date)}</td>
          <td data-label="Байк"><strong>${escapeHtml(item.bike)}</strong></td>
          <td data-label="Проблема">${escapeHtml(item.issue)}</td>
          <td data-label="Что сделано">${escapeHtml(item.work)}</td>
          <td data-label="Использовано">${escapeHtml(item.parts_used)}</td>
          <td data-label="Нужно заказать">${escapeHtml(item.needed_parts)}</td>
          <td data-label="Статус"><span class="status-pill ${getStatusClass(item.status)}">${escapeHtml(item.status)}</span></td>
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
  renderDiagnosticCategoryGrid();
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
  renderInventory();
  renderOwnerPanel();
  renderProfile();
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
  resetDiagnosticFlow();
  openDiagnosticOverlay();
});

closeDiagnosticModalButton?.addEventListener("click", () => {
  diagnosticOverlay.classList.add("hidden");
  resetDiagnosticFlow();
});

diagnosticBackToCategories?.addEventListener("click", () => {
  state.diagnosticFlow.category = "";
  state.diagnosticFlow.fault = "";
  diagnosticForm.elements.category.value = "";
  diagnosticForm.elements.fault.value = "";
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
});

diagnosticBackToFaults?.addEventListener("click", () => {
  state.diagnosticFlow.fault = "";
  diagnosticForm.elements.fault.value = "";
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
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
      category: String(formData.get("category")).trim(),
      fault: String(formData.get("fault")).trim(),
      symptoms: String(formData.get("symptoms")).trim(),
      conclusion: String(formData.get("conclusion")).trim(),
      severity: String(formData.get("severity")).trim(),
      recommendation: String(formData.get("recommendation")).trim(),
    }),
  });

  resetDiagnosticFlow();
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

if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    profileMessage.classList.add("hidden");

    const formData = new FormData(profileForm);
    const payload = await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify({
        fullName: String(formData.get("fullName")).trim(),
        position: String(formData.get("position")).trim(),
        phone: String(formData.get("phone")).trim(),
        telegram: String(formData.get("telegram")).trim(),
        notes: String(formData.get("notes")).trim(),
      }),
    });

    profileMessage.textContent = payload.message;
    profileMessage.classList.remove("hidden");
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
    state.diagnosticFlow.mode = "edit";
    state.diagnosticFlow.category = item.category || "";
    state.diagnosticFlow.fault = item.fault || "";
    diagnosticForm.dataset.editId = id;
    diagnosticForm.elements.date.value = item.date;
    diagnosticForm.elements.bike.value = item.bike;
    diagnosticForm.elements.mechanicName.value = item.mechanic_name;
    diagnosticForm.elements.category.value = item.category || "";
    diagnosticForm.elements.fault.value = item.fault || "";
    diagnosticForm.elements.symptoms.value = item.symptoms;
    diagnosticForm.elements.conclusion.value = item.conclusion;
    diagnosticForm.elements.severity.value = item.severity || "Низкая";
    diagnosticForm.elements.recommendation.value = item.recommendation;
    openDiagnosticOverlay();
  }

  if (action === "delete-diagnostic") {
    if (!window.confirm("Удалить эту диагностическую запись?")) return;
    await api(`/api/diagnostics/${id}`, { method: "DELETE", headers: {} });
    await bootstrap();
  }

  if (action === "create-repair-from-diagnostic") {
    const item = state.diagnostics.find((entry) => String(entry.id) === id);
    if (!item) return;
    const issueParts = [item.category, item.fault].filter(Boolean);
    state.repairDraftFromDiagnostic = {
      date: item.date,
      bike: item.bike,
      issue: issueParts.length ? issueParts.join(" · ") : item.symptoms,
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

  if (action === "start-diagnostic-category") {
    resetDiagnosticFlow();
    chooseDiagnosticCategory(target.dataset.category);
    openDiagnosticOverlay();
  }

  if (action === "select-diagnostic-fault") {
    chooseDiagnosticFault(target.dataset.fault);
  }
});

bootstrap();
