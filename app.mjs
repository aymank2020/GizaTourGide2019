import {
  places,
  contentVersion,
  filterPlaces,
  parseFavorites,
} from "./places.mjs";
import { setupOffline } from "./offline.mjs";
const key = "giza-guide-favorites-v1";
const status = document.querySelector("#status");
const results = document.querySelector("#results");
let language = "ar";
let favorites = new Set();
let storageReadFailed = false;
let offlineState = { state: "preparing", online: navigator.onLine !== false };
let applyUpdate = null;
try {
  const saved = localStorage.getItem(key);
  if (saved) favorites = parseFavorites(saved);
} catch {
  storageReadFailed = true;
  status.textContent = "تعذر قراءة قائمة الزيارة. لم تُحذف البيانات المحفوظة.";
}
const labels = {
  ar: {
    title: "دليل الجيزة",
    intro: "أربعة أماكن للتعرف عليها، بمصادر رسمية وقائمة زيارة محلية.",
    notice: "راجع المصدر الرسمي قبل الزيارة لمعرفة المواعيد والتذاكر الحالية.",
    favorites: "قائمة الزيارة فقط",
    source: "المصدر الرسمي",
    reviewed: "راجعت روابط المصدر في:",
    contentVersion: "نسخة المحتوى:",
    add: "أضف إلى الزيارة",
    remove: "أزل من الزيارة",
    empty: "لا توجد أماكن تطابق البحث.",
    saved: "حُفظت قائمة الزيارة.",
    unsaved: "تعذر الحفظ؛ التغيير لهذه الجلسة فقط.",
    offlineReady:
      "الدليل محفوظ للفتح دون اتصال. روابط المصادر الرسمية تحتاج الإنترنت.",
    offlineActive:
      "أنت دون اتصال؛ الدليل وقائمة الزيارة يعملان محليًا. روابط المصادر تحتاج الإنترنت.",
    offlinePreparing: "يجري حفظ الدليل للفتح دون اتصال…",
    offlineUnavailable: "تعذر حفظ الدليل للفتح دون اتصال في هذا المتصفح.",
    offlineFirstVisit:
      "لم تُحفظ نسخة دون اتصال بعد؛ افتح الدليل مرة وأنت متصل.",
    update: "تحديث النسخة المحفوظة",
    footer:
      "المحتوى موجز بالعربية والإنجليزية، روجعت روابطه في 2 أكتوبر 2026. لا يتضمن مواعيد أو أسعارًا مفترضة. قائمة الزيارة تبقى على هذا المتصفح.",
  },
  en: {
    title: "Giza Guide",
    intro:
      "Four places to discover, with official sources and a local visit list.",
    notice:
      "Check the official source before visiting for current hours and tickets.",
    favorites: "Visit list only",
    source: "Official source",
    reviewed: "Source links reviewed on:",
    contentVersion: "Content version:",
    add: "Add to visit list",
    remove: "Remove from visit list",
    empty: "No places match these filters.",
    saved: "Visit list saved.",
    unsaved: "Saving failed; this change lasts for this session only.",
    offlineReady:
      "Guide saved for offline use. Official source links need the internet.",
    offlineActive:
      "You are offline; the guide and visit list work locally. Source links need the internet.",
    offlinePreparing: "Saving the guide for offline use…",
    offlineUnavailable:
      "This browser could not save the guide for offline use.",
    offlineFirstVisit:
      "No offline copy yet; open the guide once while connected.",
    update: "Update saved guide",
    footer:
      "Short Arabic and English descriptions; links reviewed on 2 October 2026. No assumed opening times or prices. Your visit list stays in this browser.",
  },
};
function el(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function render() {
  const copy = labels[language];
  renderOffline();
  document.querySelector("#content-version").textContent =
    `${copy.contentVersion} ${contentVersion}`;
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = copy.title;
  for (const id of ["title", "intro", "notice", "footer"])
    document.querySelector(`#${id}`).textContent = copy[id];
  document.querySelector("#favorites-label").textContent = copy.favorites;
  document.querySelector("#language").textContent =
    language === "ar" ? "English" : "العربية";
  document
    .querySelector("#query")
    .setAttribute(
      "aria-label",
      language === "ar" ? "بحث بالأماكن" : "Search places",
    );
  const visible = filterPlaces(
    document.querySelector("#query").value,
    document.querySelector("#favorites").checked ? favorites : null,
  );
  document.querySelector("#count").textContent =
    language === "ar"
      ? `${visible.length} أماكن · ${favorites.size} في قائمة الزيارة`
      : `${visible.length} places · ${favorites.size} in visit list`;
  results.replaceChildren();
  if (!visible.length) results.append(el("p", copy.empty));
  for (const place of visible) {
    const card = el("article", "");
    card.append(
      el("h2", place[language]),
      el("p", language === "ar" ? place.areaAr : place.areaEn),
      el("p", language === "ar" ? place.arSummary : place.enSummary),
    );
    const link = el("a", copy.source);
    link.href = place.source;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(link);
    const reviewed = el("p", `${copy.reviewed} `);
    const date = el(
      "time",
      new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${place.reviewedAt}T00:00:00Z`)),
    );
    date.dateTime = place.reviewedAt;
    reviewed.append(date);
    card.append(reviewed);
    const button = el(
      "button",
      favorites.has(place.id) ? copy.remove : copy.add,
    );
    button.type = "button";
    button.setAttribute("aria-pressed", String(favorites.has(place.id)));
    button.setAttribute(
      "aria-label",
      `${button.textContent}: ${place[language]}`,
    );
    button.style.display = "block";
    button.style.marginTop = "16px";
    button.addEventListener("click", () => {
      if (favorites.has(place.id)) favorites.delete(place.id);
      else favorites.add(place.id);
      try {
        if (storageReadFailed)
          throw new Error("Unreadable prior data preserved");
        localStorage.setItem(key, JSON.stringify([...favorites]));
        status.textContent = labels[language].saved;
      } catch {
        status.textContent = labels[language].unsaved;
      }
      render();
    });
    card.append(button);
    results.append(card);
  }
}
function renderOffline() {
  const copy = labels[language];
  const message =
    offlineState.state === "ready"
      ? offlineState.online
        ? copy.offlineReady
        : copy.offlineActive
      : !offlineState.online
        ? copy.offlineFirstVisit
        : offlineState.state === "unavailable"
          ? copy.offlineUnavailable
          : copy.offlinePreparing;
  document.querySelector("#offline-status").textContent = message;
  const update = document.querySelector("#offline-update");
  update.hidden = !applyUpdate;
  update.textContent = copy.update;
}
document.querySelector("#language").addEventListener("click", () => {
  language = language === "ar" ? "en" : "ar";
  status.textContent = "";
  document.querySelector("#query-label").firstChild.textContent =
    language === "ar" ? "بحث" : "Search";
  render();
});
for (const id of ["query", "favorites"])
  document.querySelector(`#${id}`).addEventListener("input", render);
render();
document
  .querySelector("#offline-update")
  .addEventListener("click", () => applyUpdate?.());
setupOffline({
  onChange: (value) => {
    offlineState = value;
    renderOffline();
  },
  onUpdate: (value) => {
    applyUpdate = value;
    renderOffline();
  },
});
