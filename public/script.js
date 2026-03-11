let currentPin = "";
const hide = (id) => document.getElementById(id).classList.add("hidden");
const show = (id) => document.getElementById(id).classList.remove("hidden");

function showWelcome() {
  show("welcomeScreen");
  hide("guestView");
  hide("adminLogin");
  hide("adminPanel");
  document.getElementById("title").textContent = "Services";
  document.getElementById("portalStatus").textContent =
    "Academic Access Gateway";
}

function showGuestView() {
  hide("welcomeScreen");
  show("guestView");
  document.getElementById("title").textContent = "Student Portal";
  fetchDayOrder("dayOrderInfo");

  generateCalendar("calendar");
}

function showAdminLogin() {
  hide("welcomeScreen");
  show("adminLogin");
  document.getElementById("pinInput").value = "";
  document.getElementById("title").textContent = "Authentication";
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
    hide("adminLogin");
    show("adminPanel");
    fetchDayOrder("adminDayOrderInfo");
    document.getElementById("title").textContent = "Admin Console";
    generateCalendar("aCalendar");
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
    const statusClass =
      data.status === "WORKING DAY" ? "status-working" : "status-non-working";
    html += `<div class="${statusClass}">${data.status}</div>`;

    if (data.day_order)
      html += `<div class="day-cycle-display">${data.day_order}</div>`;
    if (data.reason)
      html += `<div class="reason-highlight">Reason: ${data.reason}</div>`;

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
    fetchDayOrder("adminDayOrderInfo");
  }
});
// CALENDARRR BACKENDDDD COOOOODEEE
async function generateCalendar(containerId) {

  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const calendar = document.createElement("div");
  calendar.className = "calendar";

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {

    const dateStr =
      year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");

    try {

      const response = await fetch(`/api/day-order/${dateStr}`);
      const data = await response.json();

      const cell = document.createElement("div");
      cell.className = "calendar-day";

      let orderText = "";

      if (data.status === "WORKING DAY") {
        orderText = data.day_order;
      } else if (data.reason) {
        orderText = data.reason;
      } else {
        orderText = data.status;
      }

      cell.innerHTML = `
        <div class="calendar-date">${day}</div>
        <div class="calendar-order">${orderText}</div>
      `;

      calendar.appendChild(cell);

    } catch {
      console.error("Fetch failed you idiot sandwich");
    }
  }

  container.appendChild(calendar);
}

