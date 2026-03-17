let currentPin = "";
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let holidayConfig = null;

const hide = (id) => document.getElementById(id).classList.add("hidden");
const show = (id) => document.getElementById(id).classList.remove("hidden");

// Helper to wrap state changes in View Transitions
function transition(updateFn) {
  if (!document.startViewTransition) {
    updateFn();
    return;
  }
  document.startViewTransition(updateFn);
}

// Helper to get local YYYY-MM-DD (Fixes Timezone Shift)
function getLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getSaturdayOccurrence(date) {
  const d = date.getDate();
  return Math.ceil(d / 7);
}

// Replicating logic for frontend preview
function calculateDayOrderForDate(targetDate, config) {
  if (!config) return { status: "Loading..." };

  // Robust parsing: split YYYY-MM-DD to avoid UTC timezone shifts
  const [y, m, d] = config.semester_start_date.split("-").map(Number);
  const startDate = new Date(y, m - 1, d);
  startDate.setHours(0, 0, 0, 0); 

  const holidays = config.holidays || [];
  const day_order_cycle = config.day_order_cycle || 5;

  if (targetDate < startDate) return { status: "Semester Not Started" };

  const dayOfWeek = targetDate.getDay();
  const targetDateStr = getLocalDateString(targetDate);
  const holiday = holidays.find(h => h.date === targetDateStr);

  // Rule 1: Sunday is always a non-working day
  if (dayOfWeek === 0) return { status: "NON-WORKING DAY", reason: "Sunday" };

  // Rule 2: Saturday logic
  if (dayOfWeek === 6) {
    if (holiday) return { status: holiday.name };
    const occurrence = getSaturdayOccurrence(targetDate);
    if (occurrence % 2 !== 0) {
      return { status: "NON-WORKING DAY", reason: "Odd Saturday" };
    }
  }

  if (holiday) return { status: holiday.name };

  let workingDayCount = 0;
  let curr = new Date(startDate);
  while (curr <= targetDate) {
    const currDayOfWeek = curr.getDay();
    const currStr = getLocalDateString(curr);
    const isHoliday = holidays.some(h => h.date === currStr);

    let isWorkingDay = false;
    if (currDayOfWeek !== 0 && currDayOfWeek !== 6 && !isHoliday) {
      isWorkingDay = true;
    }

    if (isWorkingDay) {
      workingDayCount++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  const dayOrder = ((workingDayCount - 1) % day_order_cycle) + 1;
  if (dayOfWeek === 6) {
    const occurrence = getSaturdayOccurrence(targetDate);
    const statusStr = (occurrence % 2 === 0 && !holiday) ? "WORKING SATURDAY" : "NON-WORKING DAY";
    const reason = (occurrence % 2 !== 0) ? "Odd Saturday" : (holiday ? holiday.name : "");
    return { status: statusStr, reason: reason };
  }
  
  return { status: "WORKING DAY", dayOrder: `Day ${dayOrder}` };
}

async function openCalendar() {
  show("calendarModal");
  if (!holidayConfig) {
    const response = await fetch('/holiday_2.json');
    if (response.ok) {
      holidayConfig = await response.json();
    } else {
      holidayConfig = {
        semester_start_date: "2026-03-04",
        day_order_cycle: 5,
        holidays: []
      };
    }
  }
  renderCalendar();
}

function closeCalendar() {
  hide("calendarModal");
}

function prevMonth() {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
}

function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const monthTitle = document.getElementById("calendarMonth");
  grid.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  monthTitle.textContent = `${monthNames[currentMonth]} ${currentYear}`;

  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "calendar-day empty";
    grid.appendChild(emptyDiv);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(currentYear, currentMonth, d);
    const dayDiv = document.createElement("div");
    dayDiv.className = "calendar-day";
    dayDiv.textContent = d;

    if (dateObj.toDateString() === today.toDateString()) {
      dayDiv.classList.add("today");
    }

    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0) {
      dayDiv.classList.add("weekend");
    } else if (dayOfWeek === 6) {
      const occurrence = getSaturdayOccurrence(dateObj);
      if (occurrence % 2 !== 0) {
        dayDiv.classList.add("weekend");
      } else {
        dayDiv.classList.add("club-day");
      }
    }

    const dateStr = getLocalDateString(dateObj);
    const isHoliday = holidayConfig?.holidays.some(h => h.date === dateStr);
    if (isHoliday) {
      dayDiv.classList.add("holiday");
    }

    dayDiv.onmouseover = () => {
      const result = calculateDayOrderForDate(new Date(currentYear, currentMonth, d), holidayConfig);
      const hoverInfo = document.getElementById("hoverInfo");
      if (result.dayOrder) {
        hoverInfo.innerHTML = `<span style="color:#10b981">● ${result.dayOrder}</span> (${result.status})`;
      } else if (result.status === "WORKING SATURDAY") {
        hoverInfo.innerHTML = `<span style="color:#a855f7">● ${result.status}</span>`;
      } else {
        hoverInfo.innerHTML = `<span style="color:#ef4444">○ ${result.status}</span>`;
      }
    };

    dayDiv.onmouseout = () => {
      document.getElementById("hoverInfo").textContent = "Hover over a date to see the Day Order";
    };

    grid.appendChild(dayDiv);
  }
}

function showWelcome() {
  transition(() => {
    show("welcomeScreen");
    hide("guestView");
    hide("adminLogin");
    hide("adminPanel");
    document.getElementById("title").textContent = "Services";
    document.getElementById("portalStatus").textContent = "Day Order Gateway";
  });
}

function showGuestView() {
  transition(() => {
    hide("welcomeScreen");
    show("guestView");
    document.getElementById("title").textContent = "Student Portal";
    fetchDayOrder("dayOrderInfo");
  });
}

function showAdminLogin() {
  transition(() => {
    hide("welcomeScreen");
    show("adminLogin");
    document.getElementById("pinInput").value = "";
    document.getElementById("title").textContent = "Authentication";
  });
}

function logout() {
  currentPin = "";
  showWelcome();
}

async function verifyPassword() {
  const pin = document.getElementById("pinInput").value;
  const response = await fetch("/api/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (response.ok) {
    currentPin = pin;
    transition(() => {
      hide("adminLogin");
      show("adminPanel");
      fetchDayOrder("adminDayOrderInfo");
      document.getElementById("title").textContent = "Admin Console";
    });
  } else alert("Incorrect PIN");
}

async function fetchDayOrder(targetId) {
  const target = document.getElementById(targetId);
  try {
    const response = await fetch("/api/day-order");
    const data = await response.json();
    if (data.error) {
      target.innerHTML = `<p style="color:#ef4444">${data.error}</p>`;
      return;
    }

    let html = `<p style="font-size:0.95rem; color:#94a3b8"><strong>Date:</strong> ${data.date}</p>`;
    let statusClass = "status-non-working";
    if (data.status === "WORKING DAY") statusClass = "status-working";
    else if (data.status === "WORKING SATURDAY") statusClass = "status-club-activities";

    html += `<div class="${statusClass}">${data.status}</div>`;

    if (data.day_order) html += `<div class="day-cycle-display">${data.day_order}</div>`;
    if (data.reason) html += `<div class="reason-highlight">Reason: ${data.reason}</div>`;

    target.innerHTML = html;
  } catch (e) {
    target.innerHTML = `<p style="color:#ef4444">Connection Offline</p>`;
  }
}

document.getElementById("holidayForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await fetch("/api/add-holiday", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: document.getElementById("hDate").value,
      name: document.getElementById("hReason").value,
      pin: currentPin,
    }),
  });
  if (res.ok) {
    const msg = document.getElementById("message");
    msg.className = "success";
    msg.textContent = "Holiday applied successfully.";
    msg.classList.remove("hidden");
    document.getElementById("holidayForm").reset();
    holidayConfig = null; //  forcing  calendar to refresh config
    fetchDayOrder("adminDayOrderInfo");
  }
});
