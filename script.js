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
  bikes: [],
  workOrders: [],
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
      "Глубокая царапина",
      "Скол пластика",
      "Сломано крепление",
      "Разболтано крепление пластика",
      "Отсутствует элемент корпуса",
      "Корпус болтается",
      "Повреждена крышка батареи",
      "Поврежден боковой кожух",
      "Поврежден передний пластик",
      "Поврежден задний пластик",
      "Деформация корпуса после удара",
    ],
  },
  "Руль и управление": {
    summary: "Рулевая, ручки, рычаги, органы управления",
    faults: [
      "Люфт рулевой",
      "Руль стоит криво",
      "Тугой поворот руля",
      "Закусывает рулевую",
      "Люфт ручек",
      "Повреждена ручка",
      "Не работает ручка газа",
      "Заедает ручка газа",
      "Поврежден рычаг тормоза",
      "Не возвращается рычаг тормоза",
      "Повреждена кнопка управления",
      "Не работает кнопка включения",
    ],
  },
  "Тормоза": {
    summary: "Передний и задний контур торможения",
    faults: [
      "Скрип тормоза",
      "Стерты колодки",
      "Кривой тормозной диск",
      "Диск трет о колодки",
      "Не тормозит передний тормоз",
      "Не тормозит задний тормоз",
      "Слабое торможение",
      "Закис суппорт",
      "Течь тормозной системы",
      "Не возвращается тормоз",
      "Люфт тормозного механизма",
    ],
  },
  "Колеса и шины": {
    summary: "Покрышки, камеры, подшипники, диски",
    faults: [
      "Прокол",
      "Спускает колесо",
      "Изношена покрышка",
      "Боковой порез покрышки",
      "Деформация диска",
      "Биение колеса",
      "Люфт колеса",
      "Проблема с подшипником",
      "Поврежден ниппель",
      "Неправильное давление в шине",
      "Покрышка требует замены",
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
      "Повышенная вибрация",
      "Ошибка по мотору",
      "Пропадает тяга под нагрузкой",
      "Проблема после мойки",
      "Стук со стороны мотора",
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
      "Окисление контактов батареи",
      "Просадка напряжения",
      "Перегрев батареи",
      "Не работает зарядное устройство",
      "Батарея болтается в отсеке",
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
      "Замыкание",
      "Нестабильная работа электрики",
      "Не работает дисплей",
      "Неверные показания дисплея",
      "Ошибка датчиков",
      "Проблема с разъемом контроллера",
    ],
  },
  "Свет": {
    summary: "Фара, задний фонарь, стоп-сигнал, сигнал",
    faults: [
      "Не работает передняя фара",
      "Не работает задний фонарь",
      "Не работает стоп-сигнал",
      "Мигает свет",
      "Слабый свет",
      "Плохой контакт по свету",
      "Не работает сигнал",
      "Не работает подсветка дисплея",
      "Не включается световой режим",
    ],
  },
};

const BIKE_CODE_ALLOWED_LETTERS = ["P", "E", "Y"];
const BIKE_CODE_ALLOWED_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const BIKE_CODE_NORMALIZE_MAP = {
  Р: "P",
  P: "P",
  Е: "E",
  E: "E",
  У: "Y",
  Y: "Y",
};

const loginOverlay = document.getElementById("login-overlay");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const mobileNavOverlay = document.getElementById("mobile-nav-overlay");
const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
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
const bikesGrid = document.getElementById("bikes-grid");
const workOrdersBoard = document.getElementById("work-orders-board");
const repairForm = document.getElementById("repair-form");
const inventoryForm = document.getElementById("inventory-form");
const bikeForm = document.getElementById("bike-form");
const diagnosticForm = document.getElementById("diagnostic-form");
const ownerKpi = document.getElementById("owner-kpi");
const ownerKpiNote = document.getElementById("owner-kpi-note");
const ownerProcurement = document.getElementById("owner-procurement");
const ownerProcess = document.getElementById("owner-process");
const currentUser = document.getElementById("current-user");
const sidebarRoleTitle = document.getElementById("sidebar-role-title");
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
const bikeOverlay = document.getElementById("bike-overlay");
const openRepairModalButton = document.getElementById("open-repair-modal");
const closeRepairModalButton = document.getElementById("close-repair-modal");
const openInventoryModalButton = document.getElementById("open-inventory-modal");
const closeInventoryModalButton = document.getElementById("close-inventory-modal");
const openBikeModalButton = document.getElementById("open-bike-modal");
const closeBikeModalButton = document.getElementById("close-bike-modal");
const bikeModalTitle = document.getElementById("bike-modal-title");
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
const bikeCodeBuilders = Array.from(document.querySelectorAll("[data-bike-code-root]"));

function normalizeBikeCode(rawValue) {
  const source = String(rawValue || "").trim().toUpperCase();
  if (!source) return "";
  return source
    .split("")
    .map((char) => BIKE_CODE_NORMALIZE_MAP[char] || char)
    .join("");
}

function isValidBikeCode(rawValue) {
  const normalized = normalizeBikeCode(rawValue);
  return /^[PEY]{2}\d{3}[PEY]$/.test(normalized);
}

function getBikeBuilder(rootName) {
  return document.querySelector(`[data-bike-code-root="${rootName}"]`);
}

function updateBikeCodeHiddenInput(rootName) {
  const builder = getBikeBuilder(rootName);
  if (!builder) return "";
  const parts = ["l1", "l2", "d1", "d2", "d3", "l3"].map((part) => {
    const field = builder.querySelector(`[data-bike-part="${part}"]`);
    return field ? String(field.value || "").trim() : "";
  });
  const hiddenInput = builder.parentElement.querySelector('input[name="bike"]');
  const complete = parts.every(Boolean);
  const bikeCode = complete ? normalizeBikeCode(parts.join("")) : "";
  if (hiddenInput) {
    hiddenInput.value = bikeCode;
    hiddenInput.setCustomValidity(complete && isValidBikeCode(bikeCode) ? "" : "Укажи номер байка в формате РЕ123У");
  }
  return bikeCode;
}

function setBikeCodeValue(rootName, value) {
  const builder = getBikeBuilder(rootName);
  if (!builder) return;
  const normalized = normalizeBikeCode(value);
  const parts = normalized.length === 6 ? normalized.split("") : [];
  ["l1", "l2", "d1", "d2", "d3", "l3"].forEach((partName, index) => {
    const field = builder.querySelector(`[data-bike-part="${partName}"]`);
    if (!field) return;
    field.value = parts[index] || "";
  });
  updateBikeCodeHiddenInput(rootName);
}

function resetBikeCodeValue(rootName) {
  setBikeCodeValue(rootName, "");
}

function syncBikeCodeBuilders() {
  bikeCodeBuilders.forEach((builder) => {
    const rootName = builder.dataset.bikeCodeRoot;
    builder.querySelectorAll("[data-bike-part]").forEach((field) => {
      field.addEventListener("change", () => {
        updateBikeCodeHiddenInput(rootName);
      });
    });
    updateBikeCodeHiddenInput(rootName);
  });
}

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

function getBikeStatusClass(status) {
  if (status === "готов" || status === "в аренде") return "status-ready";
  if (status === "в ремонте" || status === "проверка" || status === "принят") return "status-progress";
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

function isMobileViewport() {
  return window.innerWidth <= 1080;
}

function closeMobileMenu() {
  document.body.classList.remove("mobile-menu-open");
  mobileNavOverlay?.classList.add("hidden");
}

function openMobileMenu() {
  if (!isMobileViewport()) return;
  document.body.classList.add("mobile-menu-open");
  mobileNavOverlay?.classList.remove("hidden");
}

function toggleMobileMenu() {
  if (document.body.classList.contains("mobile-menu-open")) {
    closeMobileMenu();
    return;
  }
  openMobileMenu();
}

function getMetrics() {
  const readyRepairs = state.repairs.filter((item) => item.status === "Готов").length;
  const inRepair = state.workOrders.filter((item) => item.status === "в ремонте").length;
  const waiting = state.workOrders.filter((item) => item.status === "ждет запчасти").length;
  const lowStock = state.inventory.filter((item) => Number(item.stock) <= Number(item.min));
  const rented = state.bikes.filter((item) => item.status === "в аренде").length;
  const readyForRent = state.bikes.filter((item) => item.status === "готов").length;
  const technical = state.bikes.filter((item) => item.status === "на диагностике").length;
  const workingBikes = rented + readyForRent;
  const readyRate = state.kpi.totalBikes
    ? Math.round((workingBikes / state.kpi.totalBikes) * 100)
    : 0;

  return {
    readyRepairs,
    inRepair,
    waiting,
    lowStock,
    rented,
    readyForRent,
    technical,
    workingBikes,
    readyRate,
  };
}

function formatHours(value) {
  return `${Number(value || 0).toFixed(1)} ч`;
}

function getOverviewBreakdown(metrics) {
  const total = Math.max(state.kpi.totalBikes || state.bikes.length || 1, 1);
  const perBikeHours = 8.47;
  return [
    {
      key: "rented",
      label: "В аренде",
      count: metrics.rented,
      hours: metrics.rented * perBikeHours,
      percent: Math.round((metrics.rented / total) * 100),
      color: "#10a36e",
      tint: "is-soft-green",
      icon: "⚲",
      extra: "активная аренда",
    },
    {
      key: "ready",
      label: "Готов к аренде",
      count: metrics.readyForRent,
      hours: metrics.readyForRent * perBikeHours,
      percent: Math.round((metrics.readyForRent / total) * 100),
      color: "#f5a000",
      tint: "is-soft-yellow",
      icon: "◌",
      extra: "ждут выдачи",
    },
    {
      key: "repair",
      label: "В ремонте",
      count: metrics.inRepair,
      hours: metrics.inRepair * perBikeHours,
      percent: Math.round((metrics.inRepair / total) * 100),
      color: "#3367e0",
      tint: "is-soft-blue",
      icon: "⌁",
      extra: "сервис в работе",
    },
    {
      key: "waiting",
      label: "Ждут запчасти",
      count: metrics.waiting + metrics.technical,
      hours: (metrics.waiting + metrics.technical) * perBikeHours,
      percent: Math.round(((metrics.waiting + metrics.technical) / total) * 100),
      color: "#19b3d4",
      tint: "is-soft-blue",
      icon: "△",
      extra: "простой парка",
    },
  ];
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

function renderSectionHeader() {
  const ownerMode = getRole() === "owner";
  const sectionMeta = {
    overview: ownerMode
      ? {
          title: "Дашборд",
          heroTitleText: "Собственник видит бизнес-картину, а не только список поломок",
          heroCopyText: "На одном экране видно, сколько байков реально готовы к аренде, где застревают ремонты и какие позиции тянут закупку.",
          badge: "Сегодня в фокусе: KPI и доступность парка",
        }
      : {
          title: "Дашборд",
          heroTitleText: "Рабочий день механика под контролем",
          heroCopyText: "Видно текущую загрузку, зависшие ремонты и детали, которые нужно заказать.",
          badge: "Сегодня в фокусе: оперативка",
        },
    bikes: {
      title: "Парк байков",
      heroTitleText: "Справочный состав парка",
      heroCopyText: "Раздел только для просмотра текущих байков и их статусов в сервисном цикле.",
      badge: "Только просмотр",
    },
    profile: {
      title: "Профиль механика",
      heroTitleText: "Личная карточка сотрудника",
      heroCopyText: "Здесь можно обновить имя, контакты, должность и рабочие заметки.",
      badge: "Аккаунт",
    },
    diagnostics: {
      title: "Диагностика",
      heroTitleText: "Первичный осмотр и фиксация поломок",
      heroCopyText: "Механик выбирает узел байка, указывает неисправность и формирует основание для ремонта.",
      badge: "Осмотр",
    },
    repairs: {
      title: "Ремонты",
      heroTitleText: "Активные заявки и завершенные работы",
      heroCopyText: "Здесь видна очередь ремонта, этапы заявок и история закрытых работ.",
      badge: "Сервисный цикл",
    },
    inventory: {
      title: "Склад",
      heroTitleText: "Остатки и дефицит запчастей",
      heroCopyText: "Раздел помогает держать в норме доступные детали и вовремя замечать нехватку.",
      badge: "Запчасти",
    },
    owner: {
      title: "Настройки KPI",
      heroTitleText: "Управление целями сервиса",
      heroCopyText: "Собственник задает ключевые ориентиры по готовности парка и контролирует исполнение.",
      badge: "Контроль",
    },
  };
  const meta = sectionMeta[state.activeSection] || sectionMeta.overview;
  pageTitle.textContent = meta.title;
  heroTitle.textContent = meta.heroTitleText;
  heroCopy.textContent = meta.heroCopyText;
  heroBadge.textContent = meta.badge;
}

function renderRoleContent() {
  const ownerMode = getRole() === "owner";
  const roleLabel = ownerMode ? "Владелец" : "Механик";

  roleDescription.textContent = ownerMode
    ? "Управленческий режим: контроль KPI, закупки, доступности парка и дисциплины сервиса."
    : "Операционный режим: быстро вносить ремонты, следить за проблемными байками и остатками деталей.";

  if (sidebarRoleTitle) {
    sidebarRoleTitle.textContent = roleLabel;
  }

  currentUser.textContent = state.user
    ? state.user.full_name
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

  if (currentUser) {
    currentUser.classList.toggle("is-active-profile", state.activeSection === "profile");
  }

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
  resetBikeCodeValue("diagnostic");
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
  const totalHours = (state.kpi.totalBikes || state.bikes.length || 0) * 8.47;
  const productiveHours = metrics.rented * 8.47;
  const downtimeHours = (metrics.inRepair + metrics.waiting + metrics.technical) * 8.47;
  const cards = [
    {
      icon: "◫",
      tint: "is-soft-blue",
      label: "Потенциал 100%",
      value: `${Math.round(totalHours)} ч`,
      note: `${state.kpi.totalBikes || state.bikes.length || 0} байков · полный день`,
    },
    {
      icon: "⚲",
      tint: "is-soft-green",
      label: "Заработано",
      value: formatHours(productiveHours),
      note: `${metrics.rented} байков в аренде`,
    },
    {
      icon: "↘",
      tint: "is-soft-red",
      label: "Потери",
      value: formatHours(downtimeHours),
      note: `${metrics.inRepair + metrics.waiting + metrics.technical} байков простаивают`,
    },
    {
      icon: "ϟ",
      tint: "is-soft-green",
      label: "КПД",
      value: `${metrics.readyRate}%`,
      note: `цель ${state.kpi.targetRate}%`,
    },
  ];

  metricsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="crm-kpi-card">
          <div class="crm-kpi-icon ${card.tint}">${card.icon}</div>
          <div>
            <span class="crm-kpi-label">${escapeHtml(card.label)}</span>
            <strong class="crm-kpi-value">${escapeHtml(card.value)}</strong>
            <span class="crm-kpi-note">${escapeHtml(card.note)}</span>
          </div>
        </article>
      `
    )
    .join("");

  const breakdown = getOverviewBreakdown(metrics).filter((item) => item.count > 0);
  const totalActiveHours = breakdown.reduce((sum, item) => sum + item.hours, 0);
  const donut = breakdown.length
    ? `conic-gradient(${(() => {
        let angle = 0;
        return breakdown
          .map((item) => {
            const share = totalActiveHours ? (item.hours / totalActiveHours) * 360 : 0;
            const segment = `${item.color} ${angle.toFixed(2)}deg ${(angle + share).toFixed(2)}deg`;
            angle += share;
            return segment;
          })
          .join(", ");
      })()})`
    : "conic-gradient(#e8eff8 0deg 360deg)";
  const donutNode = document.getElementById("dashboard-donut");
  const donutTotalNode = document.getElementById("dashboard-donut-total");
  const donutLegendNode = document.getElementById("dashboard-donut-legend");
  if (donutNode) {
    donutNode.style.setProperty("--donut", donut);
  }
  if (donutTotalNode) {
    donutTotalNode.textContent = `${Math.round(totalActiveHours || totalHours)} ч`;
  }
  if (donutLegendNode) {
    donutLegendNode.innerHTML = breakdown
      .map(
        (item) => `
          <div class="crm-legend-item">
            <span class="crm-legend-dot" style="background:${item.color}"></span>
            <span>${escapeHtml(item.label)} · ${escapeHtml(formatHours(item.hours))}</span>
          </div>
        `
      )
      .join("");
  }
}

function renderTimeline() {
  const metrics = getMetrics();
  const total = Math.max(state.kpi.totalBikes || state.bikes.length || 1, 1);
  timeline.innerHTML = getOverviewBreakdown(metrics)
    .map(
      (item) => `
        <article class="crm-status-row">
          <div class="crm-status-icon ${item.tint}">${item.icon}</div>
          <div>
            <div class="crm-status-title">${escapeHtml(item.label)}</div>
            <div class="crm-status-subtitle">${escapeHtml(formatHours(item.hours))} · ${item.count} из ${total} байков</div>
          </div>
          <div class="crm-status-metrics">
            <span class="crm-status-percent" style="color:${item.color}">${item.percent}%</span>
            <span class="crm-status-extra">${escapeHtml(item.extra)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAlerts() {
  const metrics = getMetrics();
  const totalHours = (state.kpi.totalBikes || state.bikes.length || 0) * 8.47;
  const distributedHours = getOverviewBreakdown(metrics).reduce((sum, item) => sum + item.hours, 0);
  const loadItems = [
    ...state.workOrders
      .filter((item) => ["ждет запчасти", "в ремонте", "проверка", "принят"].includes(item.status))
      .slice(0, 4)
      .map((item) => ({
        title: item.bike_code,
        copy: `${item.issue}. ${item.missing_parts?.length ? `Не хватает: ${item.missing_parts.map((part) => `${part.name} x${part.missing}`).join(", ")}` : "Комплект собран"}`,
        state: item.missing_parts?.length ? "danger" : "ok",
        hours: `${item.estimated_minutes || 0} мин`,
      })),
  ];

  if (!loadItems.length) {
    loadItems.push({
      title: "Сервисный поток стабилен",
      copy: "Сейчас нет критичных заявок и дефицитов по текущему парку.",
      state: "ok",
      hours: formatHours(metrics.workingBikes * 8.47),
    });
  }

  alertsList.innerHTML = `
    <div class="crm-load-meta">
      <span>Прошло: <strong>${escapeHtml(formatHours(metrics.workingBikes * 8.47))}</strong></span>
      <span>Распределено: <strong>${escapeHtml(formatHours(distributedHours))}</strong></span>
    </div>
    <div class="crm-load-footnote">из ${escapeHtml(formatHours(totalHours))} сервисного времени на текущий парк</div>
    <div class="crm-load-list">
      ${loadItems
    .map(
      (item) => `
        <article class="crm-load-item">
          <div>
            <div class="crm-load-item-title">${escapeHtml(item.title)}</div>
            <div class="crm-load-item-copy">${escapeHtml(item.copy)}</div>
          </div>
          <span class="crm-load-pill ${item.state === "danger" ? "is-danger" : "is-ok"}">
            ${item.state === "danger" ? "Внимание" : "Норма"}
          </span>
          <span class="crm-load-hours">${escapeHtml(item.hours)}</span>
        </article>
      `
    )
    .join("")}
    </div>
  `;
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
          <p class="muted">Минимум: ${escapeHtml(item.min)} · Зарезервировано: ${escapeHtml(item.reserved || 0)}</p>
          <p class="muted">Доступно сейчас: ${escapeHtml(item.available || 0)} · Нужно заказать: ${escapeHtml(item.need_to_order ? "Да" : "Нет")}</p>
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

function renderBikes() {
  if (!bikesGrid) return;
  const canManage = getRole() === "mechanic" || getRole() === "owner";
  bikesGrid.innerHTML = state.bikes
    .map(
      (bike) => `
        <article class="inventory-card">
          <div class="inventory-meta">
            <span>${escapeHtml(bike.code)}</span>
            <span class="status-pill ${getBikeStatusClass(bike.status)}">${escapeHtml(bike.status)}</span>
          </div>
          <div class="inventory-stock">${escapeHtml(bike.model)}</div>
          <p class="muted">Последний сервис: ${escapeHtml(bike.last_service_at || "еще не было")}</p>
          <p class="muted">${escapeHtml(bike.notes || "Без заметок по байку")}</p>
          ${
            canManage
              ? `<div class="inventory-actions inventory-actions-bike">
                  <select class="bike-status-select" data-bike-status-id="${bike.id}">
                    <option value="в аренде" ${bike.status === "в аренде" ? "selected" : ""}>В аренде</option>
                    <option value="готов" ${bike.status === "готов" ? "selected" : ""}>Готов</option>
                    <option value="на диагностике" ${bike.status === "на диагностике" ? "selected" : ""}>На диагностике</option>
                    <option value="принят" ${bike.status === "принят" ? "selected" : ""}>Принят</option>
                    <option value="ждет запчасти" ${bike.status === "ждет запчасти" ? "selected" : ""}>Ждет запчасти</option>
                    <option value="в ремонте" ${bike.status === "в ремонте" ? "selected" : ""}>В ремонте</option>
                    <option value="проверка" ${bike.status === "проверка" ? "selected" : ""}>Проверка</option>
                  </select>
                  <button class="primary-btn primary-btn-small" type="button" data-action="save-bike-status" data-id="${bike.id}">Сохранить статус</button>
                  <button class="icon-btn" type="button" data-action="edit-bike" data-id="${bike.id}">Изменить</button>
                </div>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function renderWorkOrders() {
  if (!workOrdersBoard) return;
  if (!state.workOrders.length) {
    workOrdersBoard.innerHTML = '<div class="stack-item"><strong>Активных заявок нет</strong><p class="muted">Новые заявки создаются автоматически после диагностики.</p></div>';
    return;
  }

  workOrdersBoard.innerHTML = state.workOrders
    .map((order) => {
      const etaText = order.estimated_ready_at
        ? new Date(order.estimated_ready_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "появится после комплектации";
      const parts = order.parts?.length
        ? order.parts
            .map((part) => {
              const reserved = Number(part.qty_reserved || 0);
              const required = Number(part.qty_required || 0);
              return `<span class="diagnostic-category-tag">${escapeHtml(part.part_name)} ${reserved}/${required}</span>`;
            })
            .join(" ")
        : '<span class="muted">Запчасти не требуются</span>';
      const missing = order.missing_parts?.length
        ? `<p class="error-text">Не хватает: ${escapeHtml(order.missing_parts.map((item) => `${item.name} x${item.missing}`).join(", "))}</p>`
        : '<p class="success-text">Комплект собран, можно запускать ремонт</p>';
      const history = order.history?.length
        ? `<div class="stack-list">${order.history
            .map(
              (entry) => `<div class="stack-item"><strong>${escapeHtml(entry.actor_name)}</strong><p class="muted">${escapeHtml(entry.message)}</p></div>`
            )
            .join("")}</div>`
        : "";

      return `
        <article class="content-card owner-card">
          <div class="inventory-meta">
            <span><strong>${escapeHtml(order.bike_code)}</strong> · ${escapeHtml(order.issue)}</span>
            <span class="status-pill ${getBikeStatusClass(order.status)}">${escapeHtml(order.status)}</span>
          </div>
          <p class="muted">Раздел: ${escapeHtml(order.category)} · Поломка: ${escapeHtml(order.fault)}</p>
          <p class="muted">Нужно времени: ${escapeHtml(order.estimated_minutes)} мин · ETA: ${escapeHtml(etaText)}</p>
          <div class="stack-item">
            <strong>Нужные запчасти</strong>
            <p class="muted">${escapeHtml(order.required_parts_text || "-")}</p>
            <div class="status-toolbar">${parts}</div>
            ${missing}
          </div>
          <div class="stack-item">
            <strong>План работ</strong>
            <p class="muted">${escapeHtml(order.planned_work || "-")}</p>
          </div>
          <div class="table-actions">
            ${order.can_reserve ? `<button class="icon-btn" type="button" data-action="work-order-reserve" data-id="${order.id}">Проверить склад</button>` : ""}
            ${order.can_start ? `<button class="primary-btn primary-btn-small" type="button" data-action="work-order-start" data-id="${order.id}">Начать ремонт</button>` : ""}
            ${order.can_send_to_check ? `<button class="icon-btn" type="button" data-action="work-order-check" data-id="${order.id}">На проверку</button>` : ""}
            ${order.can_mark_ready ? `<button class="primary-btn primary-btn-small" type="button" data-action="work-order-ready" data-id="${order.id}">Готов</button>` : ""}
            ${order.status === "проверка" ? `<button class="danger-btn" type="button" data-action="work-order-return" data-id="${order.id}">Вернуть в ремонт</button>` : ""}
          </div>
          ${history}
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
  renderSectionHeader();
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
  renderBikes();
  renderWorkOrders();
  renderOwnerPanel();
  renderProfile();
}

async function bootstrap() {
  try {
    const payload = await api("/api/bootstrap", { method: "GET", headers: {} });
    state.user = payload.user;
    state.kpi = payload.kpi;
    state.bikes = payload.bikes || [];
    state.repairs = payload.repairs;
    state.inventory = payload.inventory;
    state.diagnostics = payload.diagnostics || [];
    state.workOrders = payload.workOrders || [];
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

currentUser?.addEventListener("click", () => {
  state.activeSection = "profile";
  closeMobileMenu();
  render();
});

closeAccountButton.addEventListener("click", () => {
  accountOverlay.classList.add("hidden");
});

openRepairModalButton?.addEventListener("click", () => {
  if (state.repairDraftFromDiagnostic) {
    const draft = state.repairDraftFromDiagnostic;
    repairForm.elements.date.value = draft.date || "";
    setBikeCodeValue("repair", draft.bike || "");
    repairForm.elements.issue.value = draft.issue || "";
    repairForm.elements.work.value = draft.work || "";
    repairForm.elements.partsUsed.value = draft.partsUsed || "";
    repairForm.elements.neededParts.value = draft.neededParts || "";
    repairForm.elements.status.value = draft.status || "В ремонте";
  } else {
    resetBikeCodeValue("repair");
  }
  repairOverlay.classList.remove("hidden");
});

closeRepairModalButton?.addEventListener("click", () => {
  repairOverlay.classList.add("hidden");
  repairForm.reset();
  resetBikeCodeValue("repair");
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

openBikeModalButton?.addEventListener("click", () => {
  bikeForm?.reset();
  resetBikeCodeValue("bike");
  if (bikeModalTitle) bikeModalTitle.textContent = "Новый байк";
  delete bikeForm.dataset.editId;
  if (bikeForm) {
    bikeForm.elements.model.value = "Wenbox U2";
    bikeForm.elements.status.value = "в аренде";
  }
  bikeOverlay?.classList.remove("hidden");
});

closeBikeModalButton?.addEventListener("click", () => {
  bikeOverlay?.classList.add("hidden");
  bikeForm?.reset();
  resetBikeCodeValue("bike");
  delete bikeForm.dataset.editId;
});

openDiagnosticModalButton?.addEventListener("click", () => {
  resetDiagnosticFlow();
  openDiagnosticOverlay();
});

closeDiagnosticModalButton?.addEventListener("click", () => {
  diagnosticOverlay.classList.add("hidden");
  resetDiagnosticFlow();
});

mobileMenuToggle?.addEventListener("click", () => {
  toggleMobileMenu();
});

mobileNavOverlay?.addEventListener("click", () => {
  closeMobileMenu();
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
    closeMobileMenu();
    render();
  });
});

window.addEventListener("resize", () => {
  if (!isMobileViewport()) {
    closeMobileMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileMenu();
  }
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
  const bikeCode = updateBikeCodeHiddenInput("repair");

  if (!isValidBikeCode(bikeCode)) {
    repairForm.reportValidity();
    return;
  }

  await api(editingId ? `/api/repairs/${editingId}` : "/api/repairs", {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify({
      date: formData.get("date") || new Date().toISOString().slice(0, 10),
      bike: bikeCode,
      issue: String(formData.get("issue")).trim(),
      work: String(formData.get("work")).trim(),
      parts_used: String(formData.get("partsUsed")).trim() || "-",
      needed_parts: String(formData.get("neededParts")).trim() || "-",
      status: String(formData.get("status")),
    }),
  });

  repairForm.reset();
  resetBikeCodeValue("repair");
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

bikeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(bikeForm);
  const editingId = bikeForm.dataset.editId;
  const bikeCode = updateBikeCodeHiddenInput("bike");

  if (!isValidBikeCode(bikeCode)) {
    bikeForm.reportValidity();
    return;
  }

  await api(editingId ? `/api/bikes/${editingId}` : "/api/bikes", {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify({
      code: bikeCode,
      model: String(formData.get("model")).trim() || "Wenbox U2",
      status: String(formData.get("status")).trim(),
      notes: String(formData.get("notes")).trim(),
    }),
  });

  bikeForm.reset();
  resetBikeCodeValue("bike");
  delete bikeForm.dataset.editId;
  bikeOverlay?.classList.add("hidden");
  state.activeSection = "bikes";
  await bootstrap();
});

diagnosticForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(diagnosticForm);
  const editingId = diagnosticForm.dataset.editId;
  const bikeCode = updateBikeCodeHiddenInput("diagnostic");

  if (!isValidBikeCode(bikeCode)) {
    diagnosticForm.reportValidity();
    return;
  }

  await api(editingId ? `/api/diagnostics/${editingId}` : "/api/diagnostics", {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify({
      date: formData.get("date") || new Date().toISOString().slice(0, 10),
      bike: bikeCode,
      mechanicName: String(formData.get("mechanicName")).trim(),
      category: String(formData.get("category")).trim(),
      fault: String(formData.get("fault")).trim(),
      symptoms: String(formData.get("symptoms")).trim(),
      conclusion: String(formData.get("conclusion")).trim(),
      severity: String(formData.get("severity")).trim(),
      recommendation: String(formData.get("recommendation")).trim(),
      required_parts_text: String(formData.get("requiredParts")).trim(),
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
    setBikeCodeValue("repair", repair.bike);
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
    setBikeCodeValue("diagnostic", item.bike);
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
    setBikeCodeValue("repair", state.repairDraftFromDiagnostic.bike || "");
    repairForm.elements.issue.value = state.repairDraftFromDiagnostic.issue || "";
    repairForm.elements.work.value = state.repairDraftFromDiagnostic.work || "";
    repairForm.elements.partsUsed.value = state.repairDraftFromDiagnostic.partsUsed || "";
    repairForm.elements.neededParts.value = state.repairDraftFromDiagnostic.neededParts || "";
    repairForm.elements.status.value = state.repairDraftFromDiagnostic.status || "В ремонте";
    repairOverlay.classList.remove("hidden");
  }

  if (action === "edit-bike") {
    const bike = state.bikes.find((entry) => String(entry.id) === id);
    if (!bike || !bikeForm) return;
    bikeForm.dataset.editId = id;
    if (bikeModalTitle) bikeModalTitle.textContent = "Редактирование байка";
    setBikeCodeValue("bike", bike.code);
    bikeForm.elements.model.value = bike.model || "Wenbox U2";
    bikeForm.elements.status.value = bike.status || "в аренде";
    bikeForm.elements.notes.value = bike.notes || "";
    bikeOverlay?.classList.remove("hidden");
  }

  if (action === "save-bike-status") {
    const bike = state.bikes.find((entry) => String(entry.id) === id);
    const statusSelect = document.querySelector(`[data-bike-status-id="${id}"]`);
    if (!bike || !statusSelect) return;
    await api(`/api/bikes/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        code: bike.code,
        model: bike.model || "Wenbox U2",
        status: String(statusSelect.value).trim(),
        notes: bike.notes || "",
      }),
    });
    await bootstrap();
  }

  if (action.startsWith("work-order-")) {
    const actionMap = {
      "work-order-reserve": "reserve",
      "work-order-start": "start_repair",
      "work-order-check": "send_to_check",
      "work-order-ready": "mark_ready",
      "work-order-return": "return_to_repair",
    };
    await api(`/api/work-orders/${id}/transition`, {
      method: "POST",
      body: JSON.stringify({ action: actionMap[action] }),
    });
    await bootstrap();
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

syncBikeCodeBuilders();
bootstrap();
