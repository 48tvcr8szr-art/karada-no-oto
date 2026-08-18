const STORAGE_KEY = "tomomi-body-sound-v1";
const state = loadState();
let period = currentPeriod();

const $ = (selector) => document.querySelector(selector);
const el = {
  form: $("#bpForm"), systolic: $("#systolic"), diastolic: $("#diastolic"), pulse: $("#pulse"), memo: $("#memo"),
  today: $("#todayLabel"), timingCard: $("#timingCard"), timingLabel: $("#timingLabel"), timingTitle: $("#timingTitle"),
  timingList: $("#timingList"), timeIcon: $("#timeIcon"), nightFields: $("#nightFields"), medicine: $("#medicine"),
  guidance: $("#guidanceCard"), guidanceTitle: $("#guidanceTitle"), guidanceText: $("#guidanceText"),
  avgSys: $("#avgSys"), avgDia: $("#avgDia"), avgPulse: $("#avgPulse"), averageMessage: $("#averageMessage"),
  conditionSvg: $("#conditionSvg"), chartEmpty: $("#chartEmpty"), chartDates: $("#chartDates"),
  doctorPeriod: $("#doctorPeriod"), conditionCounts: $("#conditionCounts"), doctorBpAverage: $("#doctorBpAverage"), doctorNightSummary: $("#doctorNightSummary"), doctorNotes: $("#doctorNotes"), doctorEmpty: $("#doctorEmpty"),
  printButton: $("#printButton"), printRecordRows: $("#printRecordRows"), doctorCard: $("#doctorCard"),
  history: $("#historyList"), empty: $("#emptyMessage"), count: $("#recordCount"),
  settingsButton: $("#settingsButton"), settingsDialog: $("#settingsDialog"), morningTime: $("#morningTime"), nightTime: $("#nightTime"), saveSettings: $("#saveSettings")
};

const timing = {
  morning: { label: "朝の血圧", title: "今は、朝の記録", icon: "☀", items: ["起床後1時間以内", "トイレのあと", "朝ごはんの前", "座って1～2分休む"] },
  night: { label: "夜の血圧", title: "眠る前の、静かな記録", icon: "☾", items: ["寝る前", "入浴・家事の直後を避ける", "座って1～2分休む", "薬と食事も一緒に記録"] }
};

el.today.textContent = new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
el.morningTime.value = state.settings.morningTime;
el.nightTime.value = state.settings.nightTime;

document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => setPeriod(button.dataset.period)));
el.form.addEventListener("submit", saveRecord);
el.history.addEventListener("click", deleteRecord);
el.settingsButton.addEventListener("click", () => el.settingsDialog.showModal());
el.printButton.addEventListener("click", () => window.print());
let doctorWasOpen = false;
window.addEventListener("beforeprint", () => { doctorWasOpen = el.doctorCard.open; el.doctorCard.open = true; });
window.addEventListener("afterprint", () => { el.doctorCard.open = doctorWasOpen; });
el.settingsDialog.addEventListener("close", () => {
  if (el.settingsDialog.returnValue !== "save") return;
  state.settings.morningTime = el.morningTime.value || "07:00";
  state.settings.nightTime = el.nightTime.value || "21:30";
  persist();
});

function currentPeriod() { return new Date().getHours() < 15 ? "morning" : "night"; }

function setPeriod(next) {
  period = next;
  const info = timing[period];
  document.querySelectorAll("[data-period]").forEach((button) => button.classList.toggle("active", button.dataset.period === period));
  el.timingCard.classList.toggle("night", period === "night");
  el.timingLabel.textContent = info.label;
  el.timingTitle.textContent = info.title;
  el.timeIcon.textContent = info.icon;
  el.timingList.replaceChildren(...info.items.map((text) => Object.assign(document.createElement("li"), { textContent: text })));
  el.nightFields.hidden = period !== "night";
}

function saveRecord(event) {
  event.preventDefault();
  const systolic = numberValue(el.systolic.value);
  const diastolic = numberValue(el.diastolic.value);
  const pulse = numberValue(el.pulse.value);
  if (!valid(systolic, 60, 260)) return el.systolic.focus();
  if (!valid(diastolic, 35, 180)) return el.diastolic.focus();
  if (!valid(pulse, 30, 220)) return el.pulse.focus();
  const feeling = new FormData(el.form).get("feeling");
  const meal = period === "night" ? new FormData(el.form).get("meal") : null;
  const record = { id: crypto.randomUUID?.() || `${Date.now()}`, at: new Date().toISOString(), period, systolic, diastolic, pulse, feeling, meal, medicine: period === "night" && el.medicine.checked, memo: el.memo.value.trim() };
  state.records.unshift(record);
  persist();
  showGuidance(record);
  el.form.reset();
  el.medicine.checked = false;
  render();
  el.guidance.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showGuidance(record) {
  const veryHigh = record.systolic >= 180 || record.diastolic >= 120;
  const high = record.systolic >= 160 || record.diastolic >= 100;
  const elevated = record.systolic >= 135 || record.diastolic >= 85;
  const unwell = record.feeling === "tired" || record.feeling === "worse";
  el.guidance.hidden = false;
  el.guidance.className = "guidance-card";
  if (veryHigh) {
    el.guidance.classList.add("rest");
    el.guidanceTitle.textContent = "作業は止めろ。まず座れ。";
    el.guidanceText.textContent = "慌てず安静にして、もう一度測る。強い胸痛、息苦しさ、麻痺、ろれつや見え方の異常など、明らかにおかしい症状があるなら、数値を追いかけず周りの人と医療へつなげ。";
  } else if (high || (elevated && unwell)) {
    el.guidance.classList.add("rest");
    el.guidanceTitle.textContent = "今日は家事を一つ減らせ。";
    el.guidanceText.textContent = "背中を預けて5分休み、もう一度測って記録しろ。休んでも高めが続くなら、この記録を診察で見せればいい。";
  } else if (elevated) {
    el.guidance.classList.add("recheck");
    el.guidanceTitle.textContent = "慌てなくていい。測り直そう。";
    el.guidanceText.textContent = "一回の数字だけで決めない。座ったまま少し休み、もう一度測れ。今日の記録は、比べるためにちゃんと残した。";
  } else if (unwell) {
    el.guidance.classList.add("rest");
    el.guidanceTitle.textContent = "数字が穏やかでも、しんどさを優先。";
    el.guidanceText.textContent = "今日は無理を足すな。家事を一つ減らして、食べられるものと水分を少し。身体の実感も立派な記録だ。";
  } else {
    el.guidanceTitle.textContent = "今日も測れた。合格だ。";
    el.guidanceText.textContent = "良い悪いを競う数字じゃない。今日の身体に会いに来られた。それで十分だぞ、智実。";
  }
}

function deleteRecord(event) {
  const button = event.target.closest("button[data-delete]");
  if (!button || !confirm("この記録を消すか？")) return;
  state.records = state.records.filter((record) => record.id !== button.dataset.delete);
  persist();
  render();
}

function render() {
  const recent = state.records.filter((record) => Date.now() - new Date(record.at).getTime() < 7 * 86400000);
  renderConditionChart();
  renderDoctorSummary(recent);
  setAverage(el.avgSys, recent, "systolic");
  setAverage(el.avgDia, recent, "diastolic");
  setAverage(el.avgPulse, recent, "pulse");
  const days = new Set(recent.map((record) => record.at.slice(0, 10))).size;
  if (!recent.length) el.averageMessage.textContent = "まずは測れた日を、少しずつ残していこう。";
  else if (days < 5) el.averageMessage.textContent = `${days}日分、残せた。まだ判定せず、智実の普段を集めている途中だ。`;
  else {
    const avgS = average(recent, "systolic"), avgD = average(recent, "diastolic");
    el.averageMessage.textContent = avgS >= 135 || avgD >= 85 ? "数日間の平均が家庭血圧の相談目安を超えている。この画面を診察で見せよう。" : "一週間の流れが見えてきた。これが智実の身体を知る材料になる。";
  }
  el.count.textContent = `${state.records.length}件`;
  el.empty.hidden = state.records.length > 0;
  el.history.replaceChildren(...state.records.map(recordElement));
}

function recordElement(record) {
  const card = document.createElement("article");
  card.className = "record";
  const body = document.createElement("div");
  const head = document.createElement("div");
  head.className = "record-head";
  const badge = document.createElement("span");
  badge.className = `period-badge ${record.period}`;
  badge.textContent = record.period === "morning" ? "朝" : "夜";
  const date = document.createElement("span");
  date.textContent = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(record.at));
  head.append(badge, date);
  const values = document.createElement("div");
  values.className = "record-values";
  values.textContent = `${record.systolic} ／ ${record.diastolic}　`;
  const pulse = document.createElement("small");
  pulse.textContent = `脈 ${record.pulse}`;
  values.append(pulse);
  const meta = document.createElement("div");
  meta.className = "record-meta";
  meta.textContent = recordSummary(record);
  body.append(head, values, meta);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.delete = record.id;
  remove.textContent = "×";
  remove.setAttribute("aria-label", "この記録を削除");
  card.append(body, remove);
  return card;
}

function recordSummary(record) {
  const feelings = { good: "よかった", usual: "普通", tired: "しんどい", worse: "悪化", rough: "悪化" };
  const meals = { ate: "夕食：食べた", little: "夕食：少し", water: "夕食：水分だけ" };
  const parts = [feelings[record.feeling]];
  if (record.period === "night") parts.push(meals[record.meal], record.medicine ? "薬：飲んだ" : "薬：まだ");
  if (record.memo) parts.push(record.memo);
  return parts.filter(Boolean).join("・");
}

function renderConditionChart() {
  const DAY = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - 27 * DAY);
  const daily = new Map();
  [...state.records].reverse().forEach((record) => {
    const date = new Date(record.at);
    date.setHours(0, 0, 0, 0);
    if (date < start || date > today) return;
    const key = date.toISOString().slice(0, 10);
    daily.set(key, record);
  });
  const levels = { good: 0, usual: 1, tired: 2, worse: 3, rough: 3 };
  const points = [];
  for (let index = 0; index < 28; index += 1) {
    const date = new Date(start.getTime() + index * DAY);
    const record = daily.get(date.toISOString().slice(0, 10));
    if (!record) continue;
    points.push({ x: index * (280 / 27), y: 16.5 + levels[record.feeling] * 33, feeling: record.feeling === "rough" ? "worse" : record.feeling });
  }
  el.conditionSvg.replaceChildren();
  if (points.length) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    line.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
    line.setAttribute("class", "condition-line");
    el.conditionSvg.append(line);
    points.forEach((point) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", "6");
      circle.setAttribute("class", `condition-dot ${point.feeling}`);
      el.conditionSvg.append(circle);
    });
  }
  el.chartEmpty.hidden = points.length > 0;
  const dateText = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
  el.chartDates.replaceChildren(
    Object.assign(document.createElement("span"), { textContent: dateText(start) }),
    Object.assign(document.createElement("span"), { textContent: dateText(today) })
  );
}

function renderDoctorSummary(recentSeven) {
  const DAY = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - 27 * DAY);
  const daily = new Map();
  [...state.records].reverse().forEach((record) => {
    const date = new Date(record.at);
    date.setHours(0, 0, 0, 0);
    if (date < start || date > today) return;
    daily.set(date.toISOString().slice(0, 10), record);
  });
  const labels = { good: "よかった", usual: "普通", tired: "しんどい", worse: "悪化", rough: "悪化" };
  const counts = { good: 0, usual: 0, tired: 0, worse: 0 };
  [...daily.values()].forEach((record) => { const key = record.feeling === "rough" ? "worse" : record.feeling; counts[key] = (counts[key] || 0) + 1; });
  el.conditionCounts.replaceChildren(...["good", "usual", "tired", "worse"].map((key) => {
    const box = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = labels[key];
    const value = document.createElement("strong");
    value.textContent = `${counts[key]}日`;
    box.append(label, value);
    return box;
  }));
  const formatDay = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
  el.doctorPeriod.textContent = `${formatDay(start)}～${formatDay(today)}（記録 ${daily.size}日）`;
  el.doctorBpAverage.textContent = recentSeven.length ? `${average(recentSeven, "systolic")}／${average(recentSeven, "diastolic")}　脈 ${average(recentSeven, "pulse")}` : "記録なし";
  const nights = state.records.filter((record) => new Date(record.at) >= start && record.period === "night");
  const medicineDays = nights.filter((record) => record.medicine).length;
  const waterDays = nights.filter((record) => record.meal === "water").length;
  el.doctorNightSummary.textContent = nights.length ? `${nights.length}回／服薬✓ ${medicineDays}・水分だけ ${waterDays}` : "記録なし";
  const notes = [...daily.values()].filter((record) => ["tired", "worse", "rough"].includes(record.feeling)).reverse();
  el.doctorNotes.replaceChildren(...notes.map((record) => {
    const item = document.createElement("li");
    const date = new Date(record.at);
    item.textContent = `${formatDay(date)}　${labels[record.feeling]}${record.memo ? `：${record.memo}` : ""}`;
    return item;
  }));
  el.doctorEmpty.hidden = notes.length > 0;
  const periodRecords = state.records.filter((record) => new Date(record.at) >= start).slice().reverse();
  el.printRecordRows.replaceChildren(...periodRecords.map((record) => {
    const row = document.createElement("tr");
    const date = new Date(record.at);
    const cells = [
      `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} ${record.period === "morning" ? "朝" : "夜"}`,
      `${record.systolic}/${record.diastolic}`,
      String(record.pulse),
      labels[record.feeling] || record.feeling,
      recordSummary(record)
    ];
    cells.forEach((text) => { const cell = document.createElement("td"); cell.textContent = text; row.append(cell); });
    return row;
  }));
}

function average(records, key) { return records.length ? Math.round(records.reduce((sum, item) => sum + item[key], 0) / records.length) : null; }
function setAverage(target, records, key) { target.textContent = records.length ? average(records, key) : "—"; }
function numberValue(value) { const digits = String(value).replace(/\D/g, ""); return digits ? Number(digits) : NaN; }
function valid(value, min, max) { return Number.isFinite(value) && value >= min && value <= max; }
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadState() {
  const fallback = { records: [], settings: { morningTime: "07:00", nightTime: "21:30" } };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { records: Array.isArray(saved?.records) ? saved.records : [], settings: { ...fallback.settings, ...(saved?.settings || {}) } };
  } catch { return fallback; }
}

setPeriod(period);
render();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js?v=2"));
